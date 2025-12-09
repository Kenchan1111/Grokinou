import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";
import { debugLog } from "../utils/debug-logger.js";

export type GrokMessage = ChatCompletionMessageParam;

export interface GrokTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface GrokToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface SearchParameters {
  mode?: "auto" | "on" | "off";
  // sources removed - let API use default sources to avoid format issues
}

export interface SearchOptions {
  search_parameters?: SearchParameters;
}

export interface GrokResponse {
  model?: string; // ✅ Model name returned by API
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: GrokToolCall[];
    };
    finish_reason: string;
  }>;
}

export class GrokClient {
  private client: OpenAI;
  private currentModel: string; // ✅ NO HARDCODED DEFAULT
  private defaultMaxTokens: number;
  private apiKey: string; // ✅ Store for later access
  private baseURL: string; // ✅ Store baseURL to detect provider

  constructor(apiKey: string, model: string, baseURL?: string) { // ✅ model REQUIRED
    this.apiKey = apiKey; // ✅ Store
    this.baseURL = baseURL || process.env.GROK_BASE_URL || "https://api.x.ai/v1";
    
    console.log(`🏗️  GrokClient constructor: model=${model}, baseURL=${this.baseURL}, apiKey=${apiKey.slice(0,10)}...`);
    
    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseURL,
      timeout: 360000,
    });
    // Adaptive max tokens based on model capabilities
    const envMax = process.env.GROK_MAX_TOKENS;

    // Handle special values
    if (envMax === 'unlimited' || envMax === '-1') {
      this.defaultMaxTokens = 0;  // 0 = unlimited
    } else if (envMax && !isNaN(Number(envMax))) {
      this.defaultMaxTokens = Number(envMax);
    } else {
      // Use model-specific defaults (0 = unlimited for reasoning models)
      this.defaultMaxTokens = this.getModelDefaultMaxTokens(model);
    }
    this.currentModel = model; // ✅ Use provided model (required)

    // Log initialization with token limits
    const tokenLimitInfo = this.defaultMaxTokens === 0
      ? 'unlimited (using API maximum)'
      : `${this.defaultMaxTokens} tokens`;
    console.log(`✅ GrokClient initialized: model=${this.currentModel}, baseURL=${this.baseURL}, max_tokens=${tokenLimitInfo}`);
  }
  
  /**
   * Detect current provider from baseURL
   */
  private getProvider(): 'grok' | 'openai' | 'claude' | 'mistral' | 'deepseek' {
    if (this.baseURL.includes('x.ai')) return 'grok';
    if (this.baseURL.includes('openai.com')) return 'openai';
    if (this.baseURL.includes('anthropic.com')) return 'claude';
    if (this.baseURL.includes('mistral.ai')) return 'mistral';
    if (this.baseURL.includes('deepseek.com')) return 'deepseek';
    return 'grok'; // Default
  }
  
  /**
   * Check if current provider is Grok
   */
  private isGrokProvider(): boolean {
    return this.baseURL.includes('x.ai');
  }
  
  /**
   * Get model context window size in tokens
   */
  private getModelContextWindow(model?: string): number {
    const m = (model || this.currentModel).toLowerCase();
    
    // Claude models: 200K context
    if (m.includes('claude') || m.includes('opus') || m.includes('sonnet')) {
      return 200000;  // 200K
    }
    
    // o3-mini: 200K
    if (m.includes('o3-mini')) {
      return 200000;  // 200K
    }
    
    // o1-preview: 128K
    if (m.includes('o1')) {
      return 128000;  // 128K
    }
    
    // GPT-5, GPT-4, Grok, DeepSeek, Mistral: 128K
    if (m.includes('gpt-5') || m.includes('gpt-4') || m.includes('grok') || 
        m.includes('deepseek') || m.includes('mistral')) {
      return 128000;  // 128K
    }
    
    // GPT-3.5: 16K
    if (m.includes('gpt-3.5')) {
      return 16385;  // 16K
    }
    
    // Default: 128K for modern models
    return 128000;
  }

  /**
   * Get adaptive max tokens based on model capabilities
   * Returns 0 for unlimited (no max_completion_tokens sent to API)
   * Returns >0 for specific limit
   * 
   * IMPORTANT: These limits are for OUTPUT tokens only (model responses)
   * Input tokens (files, context) are limited by model's context window
   */
  private getModelDefaultMaxTokens(model?: string): number {
    const m = (model || this.currentModel).toLowerCase();

    // Reasoning models (o1, o3, gpt-5): Unlimited by default
    // Let the API use its natural maximum (100K for o3, 64K for GPT-5, etc.)
    if (m.startsWith('o1') || m.startsWith('o3') || m.includes('gpt-5')) {
      return 0;  // 0 = unlimited (don't send max_completion_tokens)
    }

    // High-end models with large context windows: Allow very long responses
    if (m.includes('gpt-4') || m.includes('opus')) {
      return 32768;  // 32K tokens for detailed analysis of complex projects
    }

    // Claude Sonnet: 200K context, deserves very long responses
    if (m.includes('sonnet')) {
      return 32768;  // 32K tokens
    }

    // Grok models: Good for code analysis, allow long responses
    if (m.includes('grok')) {
      return 16384;  // 16K tokens for code analysis
    }

    // DeepSeek: Has strict limit of 8192 tokens
    if (m.includes('deepseek')) {
      return 8192;  // 8K tokens (DeepSeek API limit)
    }

    // Mistral: Modern models with good capacity
    if (m.includes('mistral')) {
      return 16384;  // 16K tokens
    }

    // Default: Very generous limit for complex project analysis
    return 16384;  // 16K tokens minimum
  }

  /**
   * Check if current model is a reasoning model (o1, o3 ONLY)
   * These models require max_completion_tokens and no temperature
   * Note: GPT-5 is NOT a reasoning model - it supports tools normally
   */
  public isReasoningModel(model?: string): boolean {
    const modelName = (model || this.currentModel).toLowerCase();
    // Only o1 and o3 are true reasoning models without tool support
    // GPT-5 is a regular model that DOES support tools
    return modelName.startsWith('o1') ||
           modelName.startsWith('o3');
  }
  
  /**
   * Format tools for specific provider
   */
  private formatToolsForProvider(tools: GrokTool[]): any[] {
    const provider = this.getProvider();
    
    if (provider === 'mistral') {
      // ✅ Mistral format: Standard OpenAI-compatible with full type support
      // According to https://docs.mistral.ai/agents/tools/function_calling
      // Mistral supports: string, number, boolean, object, array
      return tools.map(tool => ({
        type: "function",
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: {
            type: "object",
            properties: tool.function.parameters.properties,  // ✅ Keep original types
            required: tool.function.parameters.required || [],
          }
        }
      }));
    }
    
    if (provider === 'claude') {
      // Claude uses a different format (tools with input_schema)
      return tools.map(tool => ({
        type: "function", // Required type field for Anthropic API
        name: tool.function.name,
        description: tool.function.description,
        input_schema: {
          type: "object",
          properties: tool.function.parameters.properties,
          required: tool.function.parameters.required || [],
        }
      }));
    }
    
    // Grok, OpenAI, DeepSeek use standard OpenAI format
    return tools;
  }
  
  /**
   * Clean messages for provider compatibility
   */
  private cleanMessagesForProvider(messages: GrokMessage[]): GrokMessage[] {
    const provider = this.getProvider();
    
    // ✅ FIRST: Remove invalid assistant messages (empty content + no tool_calls)
    // This causes 400 errors with all providers (OpenAI, Mistral, etc.)
    messages = messages.filter(msg => {
      if (msg.role === 'assistant') {
        // Check if has content (handle both string and array types)
        const hasContent = msg.content && 
          (typeof msg.content === 'string' 
            ? msg.content.trim().length > 0 
            : msg.content.length > 0);
        const hasToolCalls = (msg as any).tool_calls && (msg as any).tool_calls.length > 0;
        
        // Keep only if has content OR tool_calls
        if (!hasContent && !hasToolCalls) {
          debugLog.log(`🗑️  Removing invalid assistant message (no content, no tool_calls)`);
          return false;
        }
      }
      return true;
    });
    
    if (provider === 'mistral') {
      // ✅ Mistral-specific cleaning (strict message structure rules)
      // According to https://docs.mistral.ai/agents/tools/function_calling
      // Mistral requires:
      // 1. No consecutive assistant messages (must have user between)
      // 2. Tool calls must have 'type': 'function'
      // 3. Proper alternation of user/assistant
      const cleaned: GrokMessage[] = [];
      let lastRole: string | null = null;
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        
        // Keep system messages as-is (only at start)
        if (msg.role === 'system') {
          cleaned.push(msg);
          lastRole = 'system';
          continue;
        }
        
        // ✅ Handle assistant messages
        if (msg.role === 'assistant') {
          // Strip tool_calls if present (Mistral doesn't need them in history)
          if ((msg as any).tool_calls) {
            debugLog.log(`🔄 Mistral: Stripping tool_calls from assistant message`);
            
            // If last was also assistant, inject separator user message
            if (lastRole === 'assistant') {
              debugLog.log(`⚠️  Mistral: Consecutive assistant messages detected, adding separator`);
              cleaned.push({
                role: 'user',
                content: '[Continue]',
              });
            }
            
            // Push assistant WITHOUT tool_calls (was the working solution from bc275d3)
            cleaned.push({
              role: 'assistant',
              content: msg.content || '[Using tools...]',
            });
            lastRole = 'assistant';
            continue;
          }
          
          // Assistant without tool_calls: keep if has content
          if (msg.content && (typeof msg.content === 'string' ? msg.content.trim() : true)) {
            // If last was also assistant, inject separator
            if (lastRole === 'assistant') {
              debugLog.log(`⚠️  Mistral: Consecutive assistant messages detected, adding separator`);
              cleaned.push({
                role: 'user',
                content: '[Continue]',
              });
            }
            
            cleaned.push(msg);
            lastRole = 'assistant';
            continue;
          }
          
          // Skip empty assistant messages (already filtered but double-check)
          debugLog.log(`🗑️  Mistral: Skipping empty assistant message`);
          continue;
        }
        
        // ✅ Handle tool messages - Convert ALL to user messages for Mistral
        if (msg.role === 'tool') {
          // ✅ Mistral doesn't support role:"tool" even with 'name' field
          // Convert ALL tool messages to user messages (not just orphans!)
          // This was the working solution from commit bc275d3 (22 Nov)
          debugLog.log(`🔄 Mistral: Converting tool message to user (content length: ${msg.content.length})`);
          cleaned.push({
            role: 'user',
            content: `[Tool Result]\n${msg.content}`,
          });
          lastRole = 'user';
          continue;
        }
        
        // ✅ Handle user messages (always keep)
        if (msg.role === 'user') {
          cleaned.push(msg);
          lastRole = 'user';
          continue;
        }
        
        // Other messages: keep as-is
        cleaned.push(msg);
        lastRole = msg.role;
      }
      
      debugLog.log(`✅ Mistral cleaning: ${messages.length} → ${cleaned.length} messages`);
      return cleaned;
    }
    
    // For OpenAI, Grok, DeepSeek: Ensure tool_calls are clean + convert orphaned tool messages
    if (provider === 'openai' || provider === 'grok' || provider === 'deepseek') {
      const cleaned: GrokMessage[] = [];
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        
        // If it's a tool message, check if previous message has tool_calls
        if (msg.role === 'tool') {
          // Find previous non-tool message
          let prevAssistant: GrokMessage | null = null;
          for (let j = i - 1; j >= 0; j--) {
            if (messages[j].role === 'assistant') {
              prevAssistant = messages[j];
              break;
            }
          }
          
          // If tool has valid parent: keep but truncate tool_call_id to 40 chars max
          // ✅ Check that tool_calls exists AND is non-empty (avoid empty arrays)
          if (prevAssistant && (prevAssistant as any).tool_calls && (prevAssistant as any).tool_calls.length > 0) {
            const toolMsg = msg as any;
            // ✅ Truncate tool_call_id to 40 chars (OpenAI API requirement)
            if (toolMsg.tool_call_id && toolMsg.tool_call_id.length > 40) {
              cleaned.push({
                ...msg,
                tool_call_id: toolMsg.tool_call_id.substring(0, 40),
              } as GrokMessage);
            } else {
              cleaned.push(msg);
            }
          } else {
            // Orphaned tool: convert to user to preserve content
            // Better than losing valuable context!
            cleaned.push({
              role: 'user',
              content: `[Tool Result - Previous Context]\n${msg.content}`,
            });
          }
          continue;
        }
        
        // Fix assistant messages with tool_calls
        // - Truncate tool_call.id to 40 chars max (OpenAI API requirement)
        // - Force tool_call.type to exactly "function"
        // NOTE: Removed .filter() - it was causing regressions during streaming
        //       Version originale (751e5a2) didn't filter, was more robust
        if (msg.role === 'assistant' && (msg as any).tool_calls) {
          const toolCalls = (msg as any).tool_calls.map((tc: any) => ({
            // ✅ Truncate tool_call id to 40 chars max (OpenAI API requirement)
            id: tc.id ? tc.id.substring(0, 40) : tc.id,
            // ✅ Always use the canonical value "function"
            //    (prevents corrupted values like "functionfunctionfunction")
            type: "function",
            function: tc.function,
          }));

          // ✅ Only include tool_calls if array is non-empty
          //    Empty arrays cause API error: "tool must be a response to a preceeding message with 'tool_calls'"
          if (toolCalls.length > 0) {
            cleaned.push({
              ...msg,
              tool_calls: toolCalls,
            });
          } else {
            // Remove tool_calls field if empty
            const { tool_calls, ...msgWithoutToolCalls } = msg as any;
            cleaned.push(msgWithoutToolCalls);
          }
          continue;
        }
        
        // Other messages: keep as-is
        cleaned.push(msg);
      }
      
      return cleaned;
    }
    
    // Other providers (Claude): return as-is
    return messages;
  }
  
  /**
   * Truncate messages to fit context window
   */
  private truncateMessages(messages: GrokMessage[], maxMessages: number = 50): GrokMessage[] {
    if (messages.length <= maxMessages) {
      return messages;
    }
    
    // Keep system message + last N messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    const recentMessages = otherMessages.slice(-maxMessages);
    
    debugLog.log(`⚠️  Truncated messages: ${messages.length} → ${systemMessages.length + recentMessages.length}`);
    
    return [...systemMessages, ...recentMessages];
  }
  
  /**
   * Additional pruning by rough character budget (provider-sensitive)
   */
  private pruneByCharBudget(messages: GrokMessage[], provider: string): GrokMessage[] {
    if (provider !== 'mistral') return messages;
    const BUDGET = 18000; // rough char budget (~6-8k tokens depending on content)
    // Always keep first system message if present
    const systemMsg = messages.find(m => m.role === 'system');
    const rest = messages.filter(m => m !== systemMsg);
    let acc: GrokMessage[] = [];
    let used = systemMsg ? JSON.stringify(systemMsg).length : 0;
    for (let i = rest.length - 1; i >= 0; i--) {
      const m = rest[i];
      const sz = JSON.stringify(m).length;
      if (used + sz > BUDGET) break;
      acc.push(m);
      used += sz;
    }
    acc.reverse();
    return systemMsg ? [systemMsg, ...acc] : acc;
  }
  
  /**
   * Estimate tokens in messages (rough approximation)
   * 1 token ≈ 3.5 characters (conservative estimate for code-heavy content)
   * This is more conservative than the typical 4 chars/token for English text
   */
  private estimateTokensInMessages(messages: GrokMessage[]): number {
    let totalChars = 0;
    
    for (const msg of messages) {
      const content = msg.content;
      
      if (typeof content === 'string') {
        totalChars += content.length;
      } else if (content && Array.isArray(content)) {
        // Handle array content (multimodal) - simplified
        // Just count as string if we can't parse properly
        totalChars += JSON.stringify(content).length;
      }
      
      // Add overhead for message structure
      totalChars += 100; // Approx overhead per message
    }
    
    // Conservative: 1 token ≈ 3.5 characters (better safe than sorry)
    return Math.ceil(totalChars / 3.5);
  }

  /**
   * Estimate tokens overhead from tool definitions
   * Each tool adds ~200 tokens (name + description + parameters schema)
   */
  private estimateToolsOverhead(tools?: GrokTool[]): number {
    if (!tools || tools.length === 0) return 0;

    // Rough estimate: ~200 tokens per tool
    // (includes name, description, and parameters JSON schema)
    return tools.length * 200;
  }

  /**
   * Calculate adaptive max tokens based on input size
   * Ensures: input_tokens + max_tokens ≤ context_window
   */
  private calculateAdaptiveMaxTokens(
    modelToUse: string,
    messages: GrokMessage[],
    defaultMaxTokens: number,
    tools?: GrokTool[]
  ): number {
    // If unlimited (0), keep unlimited
    if (defaultMaxTokens === 0) {
      return 0;
    }

    // Get context window for this model
    const contextWindow = this.getModelContextWindow(modelToUse);

    // Estimate input tokens (messages + tools overhead)
    const messageTokens = this.estimateTokensInMessages(messages);
    const toolsOverhead = this.estimateToolsOverhead(tools);
    const totalInputTokens = messageTokens + toolsOverhead;

    // ✅ CRITICAL: Validate that input doesn't exceed context window
    if (totalInputTokens >= contextWindow) {
      const errorMsg =
        `❌ Input size (${totalInputTokens.toLocaleString()} tokens: ` +
        `${messageTokens.toLocaleString()} messages + ${toolsOverhead.toLocaleString()} tools) ` +
        `exceeds model context window (${contextWindow.toLocaleString()} tokens). ` +
        `Please reduce input (fewer files, shorter messages, or fewer tools).`;
      debugLog.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Calculate available tokens for output
    const availableForOutput = contextWindow - totalInputTokens;

    // Safety margin: reserve 10% of context window for model overhead
    const safetyMargin = Math.floor(contextWindow * 0.1);
    const safeAvailable = availableForOutput - safetyMargin;

    // If not enough space even for minimal response
    if (safeAvailable < 100) {
      debugLog.log(`⚠️  Context window almost full: input=${totalInputTokens.toLocaleString()} (${messageTokens.toLocaleString()} msgs + ${toolsOverhead.toLocaleString()} tools), context=${contextWindow.toLocaleString()}, available=${safeAvailable}`);
      return 100; // Minimal response
    }
    
    // Use the smaller of: default limit OR available space
    const adaptiveMaxTokens = Math.min(defaultMaxTokens, safeAvailable);

    // Log adaptive adjustment
    if (adaptiveMaxTokens < defaultMaxTokens) {
      debugLog.log(`🔄 Adaptive max_tokens: ${defaultMaxTokens.toLocaleString()} → ${adaptiveMaxTokens.toLocaleString()} (input: ${totalInputTokens.toLocaleString()} tokens = ${messageTokens.toLocaleString()} msgs + ${toolsOverhead.toLocaleString()} tools)`);
    }

    return adaptiveMaxTokens;
  }

  /**
   * Build request payload specific to provider
   */
  private buildRequestPayload(
    modelToUse: string,
    messages: GrokMessage[],
    tools?: GrokTool[],
    searchOptions?: SearchOptions
  ): any {
    const provider = this.getProvider();
    const isReasoning = this.isReasoningModel(modelToUse);
    
    // ✅ Truncate messages for context window (especially for Mistral)
    const truncatedMessages = this.truncateMessages(messages, 50);
    const prunedByBudget = this.pruneByCharBudget(truncatedMessages, provider);
    
    // ✅ Clean messages for provider compatibility (currently no-op)
    const cleanedMessages = this.cleanMessagesForProvider(prunedByBudget);
    
    const requestPayload: any = {
      model: modelToUse,
      messages: cleanedMessages,
    };
    
    // Add tools if provided (formatted for provider)
    // ⚠️ Reasoning models (o1, o3 ONLY) do NOT support tools
    // Note: GPT-5 DOES support tools - it's not a reasoning model
    if (tools && tools.length > 0 && !isReasoning) {
      const formattedTools = this.formatToolsForProvider(tools);
      
      if (provider === 'claude') {
        requestPayload.tools = formattedTools;
        // Claude doesn't use tool_choice in the same way
      } else if (provider === 'mistral') {
        // Mistral: tools without tool_choice
        requestPayload.tools = formattedTools;
      } else {
        requestPayload.tools = formattedTools;
        requestPayload.tool_choice = "auto";
      }
    }
    
    // Calculate adaptive max tokens based on input size (including tools overhead)
    const adaptiveMaxTokens = this.calculateAdaptiveMaxTokens(
      modelToUse,
      cleanedMessages,
      this.defaultMaxTokens,
      tools  // ✅ Pass tools to account for their token overhead
    );
    
    // Add provider-specific parameters
    if (provider === 'claude') {
      // Claude uses max_tokens (not max_completion_tokens)
      // Only set if not unlimited
      if (adaptiveMaxTokens > 0) {
        requestPayload.max_tokens = adaptiveMaxTokens;
      }
      // Claude doesn't use temperature in tool calls
      if (!tools || tools.length === 0) {
        requestPayload.temperature = 0.7;
      }
    } else if (isReasoning) {
      // Reasoning models (o1, o3, gpt-5): max_completion_tokens, no temperature
      // Only set max_completion_tokens if not unlimited (0)
      if (adaptiveMaxTokens > 0) {
        requestPayload.max_completion_tokens = adaptiveMaxTokens;
      }
      // If adaptiveMaxTokens === 0, don't set it → API uses its natural maximum
    } else {
      // Standard models: temperature + max_tokens
      requestPayload.temperature = 0.7;
      // Only set max_tokens if not unlimited
      if (adaptiveMaxTokens > 0) {
        requestPayload.max_tokens = adaptiveMaxTokens;
      }
    }
    
    // Grok-specific: search_parameters
    if (provider === 'grok' && searchOptions?.search_parameters) {
      requestPayload.search_parameters = searchOptions.search_parameters;
    }
    
    return requestPayload;
  }

  setModel(model: string): void {
    this.currentModel = model;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }
  
  // ✅ NEW: Get API key for session switching
  getApiKey(): string {
    return this.apiKey;
  }

  async chat(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string,
    searchOptions?: SearchOptions
  ): Promise<GrokResponse> {
    const modelToUse = model || this.currentModel;
    const provider = this.getProvider();
    
    debugLog.log(`\n📡 GrokClient.chat() - provider: ${provider}, baseURL: ${this.baseURL}, model: ${modelToUse}`);
    
    // ✅ Build provider-specific request payload
    const requestPayload = this.buildRequestPayload(modelToUse, messages, tools, searchOptions);

    debugLog.log(`📤 Request payload:`, {
      provider,
      baseURL: this.baseURL,
      model: requestPayload.model,
      toolsCount: requestPayload.tools?.length || 0,
      messagesCount: requestPayload.messages?.length || 0,
      hasTemperature: 'temperature' in requestPayload,
      hasMaxTokens: 'max_tokens' in requestPayload,
      hasMaxCompletionTokens: 'max_completion_tokens' in requestPayload,
      temperature: requestPayload.temperature,
      max_tokens: requestPayload.max_tokens,
      tool_choice: requestPayload.tool_choice,
    });

    try {
      const response =
        await this.client.chat.completions.create(requestPayload);

      // Log response details for debugging
      const choice = response.choices?.[0];
      const content = choice?.message?.content;
      const finishReason = choice?.finish_reason;
      const refusal = (choice?.message as any)?.refusal;

      debugLog.log(`✅ API Response OK - model: ${response.model}, finish_reason: ${finishReason}, hasContent: ${!!content}, contentLength: ${content?.length || 0}, refusal: ${refusal || 'none'}`);

      return response as GrokResponse;
    } catch (error: any) {
      debugLog.error(`❌ API Error:`, {
        provider,
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
        requestHadTools: requestPayload.tools?.length || 0,
        requestHadMessages: requestPayload.messages?.length || 0,
        baseURL: this.baseURL,
        model: modelToUse,
      });
      throw new Error(`Grok API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string,
    searchOptions?: SearchOptions
  ): AsyncGenerator<any, void, unknown> {
    const modelToUse = model || this.currentModel;
    const provider = this.getProvider();
    
    debugLog.log(`\n🌊 GrokClient.chatStream() - provider: ${provider}, baseURL: ${this.baseURL}, model: ${modelToUse}`);
    
    // ✅ Build provider-specific request payload
    const requestPayload = this.buildRequestPayload(modelToUse, messages, tools, searchOptions);
    requestPayload.stream = true; // Enable streaming

    debugLog.log(`📤 Stream Request payload:`, {
      provider,
      baseURL: this.baseURL,
      model: requestPayload.model,
      toolsCount: requestPayload.tools?.length || 0,
      messagesCount: requestPayload.messages?.length || 0,
      hasTemperature: 'temperature' in requestPayload,
      hasMaxTokens: 'max_tokens' in requestPayload,
      temperature: requestPayload.temperature,
      max_tokens: requestPayload.max_tokens,
      tool_choice: requestPayload.tool_choice,
      stream: true,
    });
    
    // ✅ Log ACTUAL payload being sent (for debugging Mistral issue)
    debugLog.log(`📋 ACTUAL REQUEST PAYLOAD (complete):`, JSON.stringify({
      model: requestPayload.model,
      messages: requestPayload.messages,
      tools: requestPayload.tools,
      tool_choice: requestPayload.tool_choice,
      temperature: requestPayload.temperature,
      max_tokens: requestPayload.max_tokens,
      stream: requestPayload.stream,
    }, null, 2));

    try {
      const stream = (await this.client.chat.completions.create(
        requestPayload
      )) as any;

      debugLog.log(`✅ Stream started successfully`);

      let chunkCount = 0;
      let hasContent = false;
      let contentLength = 0;
      let hasToolCalls = false;
      let finishReasons: string[] = [];

      for await (const chunk of stream) {
        chunkCount++;

        // Log FIRST chunk in detail to see what GPT-5 returns
        if (chunkCount === 1) {
          debugLog.log(`📦 First chunk received:`, JSON.stringify(chunk, null, 2).substring(0, 500));
        }

        // Log chunk details for debugging
        const choice = chunk.choices?.[0];
        if (choice) {
          const delta = choice.delta;

          // Track content
          if (delta?.content) {
            hasContent = true;
            contentLength += delta.content.length;

            // Log first content chunk
            if (contentLength === delta.content.length) {
              debugLog.log(`📝 First content chunk: "${delta.content.substring(0, 100)}..."`);
            }
          }

          // Track tool calls
          if (delta?.tool_calls) {
            hasToolCalls = true;
          }

          // Track finish reasons
          if (choice.finish_reason) {
            finishReasons.push(choice.finish_reason);
            debugLog.log(`📊 Stream finish_reason: ${choice.finish_reason}`);
          }

          // Detect refusal
          const refusal = (delta as any)?.refusal || (choice as any)?.refusal;
          if (refusal) {
            debugLog.log(`🚫 REFUSAL detected: ${refusal}`);
          }
        }

        yield chunk;
      }

      debugLog.log(`✅ Stream completed - chunks: ${chunkCount}, hasContent: ${hasContent}, contentLength: ${contentLength}, hasToolCalls: ${hasToolCalls}, finishReasons: ${finishReasons.join(',') || 'none'}`);
    } catch (error: any) {
      debugLog.error(`❌ Stream Error:`, {
        provider,
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
        requestHadTools: requestPayload.tools?.length || 0,
        requestHadMessages: requestPayload.messages?.length || 0,
        baseURL: this.baseURL,
        model: modelToUse,
      });
      throw new Error(`Grok API error: ${error.message}`);
    }
  }

  async search(
    query: string,
    searchParameters?: SearchParameters
  ): Promise<GrokResponse> {
    const searchMessage: GrokMessage = {
      role: "user",
      content: query,
    };

    const searchOptions: SearchOptions = {
      search_parameters: searchParameters || { mode: "on" },
    };

    return this.chat([searchMessage], [], undefined, searchOptions);
  }
}
