import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

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
    try {
      const modelToUse = model || this.currentModel;
      const isReasoning = this.isReasoningModel(modelToUse);
      
      const requestPayload: any = {
        model: modelToUse,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      };
      
      // ✅ Reasoning models (o1, o3, gpt-5): use max_completion_tokens, no temperature
      if (isReasoning) {
        requestPayload.max_completion_tokens = this.defaultMaxTokens;
      } else {
        requestPayload.temperature = 0.7;
        requestPayload.max_tokens = this.defaultMaxTokens;
      }

      // ✅ Add search parameters ONLY for Grok provider
      if (this.isGrokProvider() && searchOptions?.search_parameters) {
        requestPayload.search_parameters = searchOptions.search_parameters;
      }

      const response =
        await this.client.chat.completions.create(requestPayload);

      return response as GrokResponse;
    } catch (error: any) {
      throw new Error(`Grok API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string,
    searchOptions?: SearchOptions
  ): AsyncGenerator<any, void, unknown> {
    try {
      const modelToUse = model || this.currentModel;
      const isReasoning = this.isReasoningModel(modelToUse);
      
      const requestPayload: any = {
        model: modelToUse,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        stream: true,
      };
      
      // ✅ Reasoning models (o1, o3, gpt-5): use max_completion_tokens, no temperature
      if (isReasoning) {
        requestPayload.max_completion_tokens = this.defaultMaxTokens;
      } else {
        requestPayload.temperature = 0.7;
        requestPayload.max_tokens = this.defaultMaxTokens;
      }

      // ✅ Add search parameters ONLY for Grok provider
      if (this.isGrokProvider() && searchOptions?.search_parameters) {
        requestPayload.search_parameters = searchOptions.search_parameters;
      }

      const stream = (await this.client.chat.completions.create(
        requestPayload
      )) as any;

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
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
