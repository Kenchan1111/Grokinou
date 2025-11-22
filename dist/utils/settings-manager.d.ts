/**
 * User-level settings stored in ~/.grok/user-settings.json
 * These are global settings that apply across all projects
 */
export interface UserSettings {
    apiKey?: string;
    baseURL?: string;
    defaultModel?: string;
    models?: string[];
    persistInputHistory?: boolean;
    apiKeys?: Record<string, string>;
    providers?: Record<string, {
        baseURL: string;
        models?: string[];
    }>;
}
/**
 * Project-level settings stored in .grok/settings.json
 * These are project-specific settings
 */
export interface ProjectSettings {
    model?: string;
    mcpServers?: Record<string, any>;
    persistSession?: boolean;
    autoRestoreSession?: boolean;
}
/**
 * Unified settings manager that handles both user-level and project-level settings
 */
export declare class SettingsManager {
    private static instance;
    private userSettingsPath;
    private projectSettingsPath;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): SettingsManager;
    /**
     * Auto-migrate old model list to include all providers
     */
    private migrateModelsIfNeeded;
    /**
     * Ensure directory exists for a given file path
     */
    private ensureDirectoryExists;
    /**
     * Load user settings from ~/.grok/user-settings.json
     */
    loadUserSettings(): UserSettings;
    /**
     * Save user settings to ~/.grok/user-settings.json
     */
    saveUserSettings(settings: Partial<UserSettings>): void;
    /**
     * Update a specific user setting
     */
    updateUserSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
    /**
     * Get a specific user setting
     */
    getUserSetting<K extends keyof UserSettings>(key: K): UserSettings[K];
    /**
     * Load project settings from .grok/settings.json
     */
    loadProjectSettings(): ProjectSettings;
    /**
     * Save project settings to .grok/settings.json
     */
    saveProjectSettings(settings: Partial<ProjectSettings>): void;
    /**
     * Update a specific project setting
     */
    updateProjectSetting<K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]): void;
    /**
     * Get a specific project setting
     */
    getProjectSetting<K extends keyof ProjectSettings>(key: K): ProjectSettings[K];
    /**
     * Get the current model with proper fallback logic:
     * 1. Project-specific model setting
     * 2. User's default model
     * 3. System default
     */
    getCurrentModel(): string;
    /**
     * Set the current model for the project
     */
    setCurrentModel(model: string): void;
    /**
     * Get available models list from user settings
     */
    getAvailableModels(): string[];
    /**
     * Get API key from user settings or environment (legacy - for backward compatibility)
     */
    getApiKey(): string | undefined;
    /**
     * Get all API keys (multi-provider)
     */
    getApiKeys(): Record<string, string> | undefined;
    /**
     * Set API key for a specific provider
     */
    setApiKey(provider: string, apiKey: string): void;
    /**
     * Get provider configurations
     */
    getProviders(): Record<string, {
        baseURL: string;
        models?: string[];
    }> | undefined;
    /**
     * Get base URL from user settings or environment
     */
    getBaseURL(): string;
}
/**
 * Convenience function to get the singleton instance
 */
export declare function getSettingsManager(): SettingsManager;
