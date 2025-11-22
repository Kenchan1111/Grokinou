/**
 * Provider Manager - Multi-provider support with auto-detection
 *
 * Features:
 * - Auto-detect provider from model name
 * - Manage API keys per provider
 * - Handle baseURL per provider
 * - Support: Grok, Claude, OpenAI, DeepSeek, Mistral
 */
export interface ProviderConfig {
    name: string;
    baseURL: string;
    models: string[];
    apiKey?: string;
}
export interface ProviderInfo {
    name: string;
    hasApiKey: boolean;
    maskedKey: string;
    baseURL: string;
    modelCount: number;
}
export declare class ProviderManager {
    private providers;
    constructor();
    /**
     * Initialize provider configurations from settings
     */
    private initializeProviders;
    /**
     * Detect provider from model name
     */
    detectProvider(modelName: string): string | null;
    /**
     * Get provider config by name
     */
    getProvider(name: string): ProviderConfig | undefined;
    /**
     * Get provider config for a specific model
     */
    getProviderForModel(modelName: string): ProviderConfig | null;
    /**
     * Check if provider has API key configured
     */
    hasApiKey(providerName: string): boolean;
    /**
     * Set API key for provider (in memory + persist)
     */
    setApiKey(providerName: string, apiKey: string): void;
    /**
     * Get masked API key for display (security)
     */
    getMaskedApiKey(providerName: string): string;
    /**
     * List all providers with status
     */
    listProviders(): ProviderInfo[];
    /**
     * Format provider list for display
     */
    formatProviderList(currentProvider?: string): string;
    /**
     * Get all provider names
     */
    getProviderNames(): string[];
    /**
     * Reload providers from settings (after changes)
     */
    reload(): void;
}
export declare const providerManager: ProviderManager;
