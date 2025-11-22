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
}
export interface SearchOptions {
    search_parameters?: SearchParameters;
}
export interface GrokResponse {
    model?: string;
    choices: Array<{
        message: {
            role: string;
            content: string | null;
            tool_calls?: GrokToolCall[];
        };
        finish_reason: string;
    }>;
}
export declare class GrokClient {
    private client;
    private currentModel;
    private defaultMaxTokens;
    private apiKey;
    private baseURL;
    constructor(apiKey: string, model: string, baseURL?: string);
    /**
     * Detect current provider from baseURL
     */
    private getProvider;
    /**
     * Check if current provider is Grok
     */
    private isGrokProvider;
    /**
     * Check if current model is a reasoning model (o1, o3, gpt-5)
     * These models require max_completion_tokens and no temperature
     */
    private isReasoningModel;
    /**
     * Format tools for specific provider
     */
    private formatToolsForProvider;
    /**
     * Clean messages for provider compatibility
     */
    private cleanMessagesForProvider;
    /**
     * Truncate messages to fit context window
     */
    private truncateMessages;
    /**
     * Additional pruning by rough character budget (provider-sensitive)
     */
    private pruneByCharBudget;
    /**
     * Build request payload specific to provider
     */
    private buildRequestPayload;
    setModel(model: string): void;
    getCurrentModel(): string;
    getApiKey(): string;
    chat(messages: GrokMessage[], tools?: GrokTool[], model?: string, searchOptions?: SearchOptions): Promise<GrokResponse>;
    chatStream(messages: GrokMessage[], tools?: GrokTool[], model?: string, searchOptions?: SearchOptions): AsyncGenerator<any, void, unknown>;
    search(query: string, searchParameters?: SearchParameters): Promise<GrokResponse>;
}
