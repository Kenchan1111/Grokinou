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
    const envMax = Number(process.env.GROK_MAX_TOKENS);
    this.defaultMaxTokens = Number.isFinite(envMax) && envMax > 0 ? envMax : 1536;
    this.currentModel = model; // ✅ Use provided model (required)
    
    console.log(`✅ GrokClient initialized with baseURL=${this.baseURL}`);
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
   * Check if current model is a reasoning model (o1, o3, gpt-5)
   * These models require max_completion_tokens and no temperature
   */
  private isReasoningModel(model?: string): boolean {
    const modelName = (model || this.currentModel).toLowerCase();
    return modelName.startsWith('o1') || 
           modelName.startsWith('o3') || 
           modelName.startsWith('gpt-5');
  }
  
  /**
   * Format tools for specific provider
   */
  private formatToolsForProvider(tools: GrokTool[]): any[] {
    const provider = this.getProvider();
    
    if (provider === 'mistral') {
      // Mistral format: Minimal properties (all as strings)
      return tools.map(tool => {
        // Convert all properties to string type (Mistral might not support number/boolean)
        const cleanProperties: any = {};
        for (const [key, value] of Object.entries(tool.function.parameters.properties)) {
          cleanProperties[key] = {
            type: "string", // Force string type for all properties
          };
        }
        
        return {
          type: "function",
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: {
              type: "object",
              properties: cleanProperties,
              required: tool.function.parameters.required || [],
            }
          }
        };
      });
    }
    
    if (provider === 'claude') {
      // Claude uses a different format (tools with input_schema)
      return tools.map(tool => ({
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
    
    if (provider === 'mistral') {
      // Mistral CANNOT handle tool_calls and tool messages in history
      // Strategy: Convert tool results to user messages, strip tool_calls
      return messages.map(msg => {
        // Convert tool result messages to user messages
        if (msg.role === 'tool') {
          return {
            role: 'user',
            content: `[Tool Result]\n${msg.content}`,
          };
        }
        // Remove tool_calls from assistant messages
        if (msg.role === 'assistant' && (msg as any).tool_calls) {
          return {
            role: msg.role,
            content: msg.content || '[Using tools...]',
          };
        }
        return msg;
      });
    }
    
    // For OpenAI, Grok, DeepSeek: Ensure tool_calls have 'type' field + remove orphaned tool messages
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
          
          // Only keep tool message if previous assistant has tool_calls
          if (prevAssistant && (prevAssistant as any).tool_calls) {
            cleaned.push(msg);
          }
          // Otherwise skip this orphaned tool message
          continue;
        }
        
        // Fix assistant messages with tool_calls (add missing 'type' field)
        if (msg.role === 'assistant' && (msg as any).tool_calls) {
          const toolCalls = (msg as any).tool_calls.map((tc: any) => ({
            id: tc.id,
            type: tc.type || 'function', // ✅ Add missing 'type' field
            function: tc.function,
          }));
          
          cleaned.push({
            ...msg,
            tool_calls: toolCalls,
          });
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
    if (tools && tools.length > 0) {
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
    
    // Add provider-specific parameters
    if (provider === 'claude') {
      // Claude uses max_tokens (not max_completion_tokens)
      requestPayload.max_tokens = this.defaultMaxTokens;
      // Claude doesn't use temperature in tool calls
      if (!tools || tools.length === 0) {
        requestPayload.temperature = 0.7;
      }
    } else if (isReasoning) {
      // Reasoning models (o1, o3, gpt-5): max_completion_tokens, no temperature
      requestPayload.max_completion_tokens = this.defaultMaxTokens;
    } else {
      // Standard models: temperature + max_tokens
      requestPayload.temperature = 0.7;
      requestPayload.max_tokens = this.defaultMaxTokens;
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

      debugLog.log(`✅ API Response OK - model: ${response.model}`);
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
      
      for await (const chunk of stream) {
        yield chunk;
      }
      
      debugLog.log(`✅ Stream completed`);
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
