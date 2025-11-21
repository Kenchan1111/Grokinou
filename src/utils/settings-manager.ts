import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * User-level settings stored in ~/.grok/user-settings.json
 * These are global settings that apply across all projects
 */
export interface UserSettings {
  apiKey?: string; // Legacy: Grok API key (for backward compatibility)
  baseURL?: string; // Legacy: API base URL
  defaultModel?: string; // User's preferred default model
  models?: string[]; // Available models list
  persistInputHistory?: boolean; // Persist input history to ~/.grok/input-history.jsonl
  
  // NEW: Multi-provider support
  apiKeys?: Record<string, string>; // API keys per provider: { grok: "xai-xxx", claude: "sk-ant-xxx" }
  providers?: Record<string, {
    baseURL: string;
    models?: string[];
  }>; // Provider configurations
}

/**
 * Project-level settings stored in .grok/settings.json
 * These are project-specific settings
 */
export interface ProjectSettings {
  model?: string; // Current model for this project
  mcpServers?: Record<string, any>; // MCP server configurations
  persistSession?: boolean; // Persist chat session to .grok/session.jsonl
  autoRestoreSession?: boolean; // Auto-restore session on launch
}

/**
 * Default values for user settings
 */
const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  baseURL: "https://api.x.ai/v1",
  defaultModel: "grok-4-latest",
  models: [
    // === GROK (X.AI) ===
    "grok-4-latest",
    "grok-code-fast-1",
    "grok-3-latest",
    "grok-3-fast",
    "grok-3-mini-fast",
    "grok2-vision-beta",
    
    // === CLAUDE (Anthropic) ===
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    
    // === OPENAI ===
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "o1-preview",
    "o1-mini",
    
    // === DEEPSEEK ===
    "deepseek-chat",
    "deepseek-coder",
    
    // === MISTRAL ===
    "mistral-large-latest",
    "mistral-medium-latest",
    "codestral-latest",
  ],
  persistInputHistory: true,
};

/**
 * Default values for project settings
 */
const DEFAULT_PROJECT_SETTINGS: Partial<ProjectSettings> = {
  model: "grok-code-fast-1",
  persistSession: true,
  autoRestoreSession: true,
};

/**
 * Unified settings manager that handles both user-level and project-level settings
 */
export class SettingsManager {
  private static instance: SettingsManager;

  private userSettingsPath: string;
  private projectSettingsPath: string;

  private constructor() {
    // User settings path: ~/.grok/user-settings.json
    this.userSettingsPath = path.join(
      os.homedir(),
      ".grok",
      "user-settings.json"
    );

    // Project settings path: .grok/settings.json (in current working directory)
    this.projectSettingsPath = path.join(
      process.cwd(),
      ".grok",
      "settings.json"
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
      SettingsManager.instance.migrateModelsIfNeeded();
    }
    return SettingsManager.instance;
  }
  
  /**
   * Auto-migrate old model list to include all providers
   */
  private migrateModelsIfNeeded(): void {
    try {
      const currentModels = this.getUserSetting("models") || [];
      
      // Check if migration is needed (old list has < 10 models)
      if (currentModels.length > 0 && currentModels.length < 10) {
        // Only Grok models? Migrate!
        const hasOnlyGrok = currentModels.every((m: string) => m.startsWith("grok"));
        
        if (hasOnlyGrok) {
          console.log("🔄 Migrating model list to include all providers...");
          this.updateUserSetting("models", DEFAULT_USER_SETTINGS.models);
          console.log(`✅ Added ${DEFAULT_USER_SETTINGS.models!.length - currentModels.length} new models`);
        }
      }
    } catch (error) {
      // Silent fail - not critical
    }
  }

  /**
   * Ensure directory exists for a given file path
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load user settings from ~/.grok/user-settings.json
   */
  public loadUserSettings(): UserSettings {
    try {
      if (!fs.existsSync(this.userSettingsPath)) {
        // Create default user settings if file doesn't exist
        this.saveUserSettings(DEFAULT_USER_SETTINGS);
        return { ...DEFAULT_USER_SETTINGS };
      }

      const content = fs.readFileSync(this.userSettingsPath, "utf-8");
      const settings = JSON.parse(content);

      // Merge with defaults to ensure all required fields exist
      return { ...DEFAULT_USER_SETTINGS, ...settings };
    } catch (error) {
      console.warn(
        "Failed to load user settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return { ...DEFAULT_USER_SETTINGS };
    }
  }

  /**
   * Save user settings to ~/.grok/user-settings.json
   */
  public saveUserSettings(settings: Partial<UserSettings>): void {
    try {
      this.ensureDirectoryExists(this.userSettingsPath);

      // Read existing settings directly to avoid recursion
      let existingSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };
      if (fs.existsSync(this.userSettingsPath)) {
        try {
          const content = fs.readFileSync(this.userSettingsPath, "utf-8");
          const parsed = JSON.parse(content);
          existingSettings = { ...DEFAULT_USER_SETTINGS, ...parsed };
        } catch (error) {
          // If file is corrupted, use defaults
          console.warn("Corrupted user settings file, using defaults");
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      fs.writeFileSync(
        this.userSettingsPath,
        JSON.stringify(mergedSettings, null, 2),
        { mode: 0o600 } // Secure permissions for API key
      );
    } catch (error) {
      console.error(
        "Failed to save user settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  /**
   * Update a specific user setting
   */
  public updateUserSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ): void {
    const settings = { [key]: value } as Partial<UserSettings>;
    this.saveUserSettings(settings);
  }

  /**
   * Get a specific user setting
   */
  public getUserSetting<K extends keyof UserSettings>(key: K): UserSettings[K] {
    const settings = this.loadUserSettings();
    return settings[key];
  }

  /**
   * Load project settings from .grok/settings.json
   */
  public loadProjectSettings(): ProjectSettings {
    try {
      if (!fs.existsSync(this.projectSettingsPath)) {
        // Create default project settings if file doesn't exist
        this.saveProjectSettings(DEFAULT_PROJECT_SETTINGS);
        return { ...DEFAULT_PROJECT_SETTINGS };
      }

      const content = fs.readFileSync(this.projectSettingsPath, "utf-8");
      const settings = JSON.parse(content);

      // Merge with defaults
      return { ...DEFAULT_PROJECT_SETTINGS, ...settings };
    } catch (error) {
      console.warn(
        "Failed to load project settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return { ...DEFAULT_PROJECT_SETTINGS };
    }
  }

  /**
   * Save project settings to .grok/settings.json
   */
  public saveProjectSettings(settings: Partial<ProjectSettings>): void {
    try {
      this.ensureDirectoryExists(this.projectSettingsPath);

      // Read existing settings directly to avoid recursion
      let existingSettings: ProjectSettings = { ...DEFAULT_PROJECT_SETTINGS };
      if (fs.existsSync(this.projectSettingsPath)) {
        try {
          const content = fs.readFileSync(this.projectSettingsPath, "utf-8");
          const parsed = JSON.parse(content);
          existingSettings = { ...DEFAULT_PROJECT_SETTINGS, ...parsed };
        } catch (error) {
          // If file is corrupted, use defaults
          console.warn("Corrupted project settings file, using defaults");
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      fs.writeFileSync(
        this.projectSettingsPath,
        JSON.stringify(mergedSettings, null, 2)
      );
    } catch (error) {
      console.error(
        "Failed to save project settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  /**
   * Update a specific project setting
   */
  public updateProjectSetting<K extends keyof ProjectSettings>(
    key: K,
    value: ProjectSettings[K]
  ): void {
    const settings = { [key]: value } as Partial<ProjectSettings>;
    this.saveProjectSettings(settings);
  }

  /**
   * Get a specific project setting
   */
  public getProjectSetting<K extends keyof ProjectSettings>(
    key: K
  ): ProjectSettings[K] {
    const settings = this.loadProjectSettings();
    return settings[key];
  }

  /**
   * Get the current model with proper fallback logic:
   * 1. Project-specific model setting
   * 2. User's default model
   * 3. System default
   */
  public getCurrentModel(): string {
    const projectModel = this.getProjectSetting("model");
    if (projectModel) {
      return projectModel;
    }

    const userDefaultModel = this.getUserSetting("defaultModel");
    if (userDefaultModel) {
      return userDefaultModel;
    }

    return DEFAULT_PROJECT_SETTINGS.model || "grok-code-fast-1";
  }

  /**
   * Set the current model for the project
   */
  public setCurrentModel(model: string): void {
    this.updateProjectSetting("model", model);
  }

  /**
   * Get available models list from user settings
   */
  public getAvailableModels(): string[] {
    const models = this.getUserSetting("models");
    return models || DEFAULT_USER_SETTINGS.models || [];
  }

  /**
   * Get API key from user settings or environment (legacy - for backward compatibility)
   */
  public getApiKey(): string | undefined {
    // First check environment variable
    const envApiKey = process.env.GROK_API_KEY;
    if (envApiKey) {
      return envApiKey;
    }

    // Then check user settings
    return this.getUserSetting("apiKey");
  }
  
  /**
   * Get all API keys (multi-provider)
   */
  public getApiKeys(): Record<string, string> | undefined {
    const apiKeys = this.getUserSetting("apiKeys");
    
    // Backward compatibility: if apiKeys not set but apiKey is, use it for grok
    if (!apiKeys || Object.keys(apiKeys).length === 0) {
      const legacyKey = this.getApiKey();
      if (legacyKey) {
        return { grok: legacyKey };
      }
    }
    
    return apiKeys;
  }
  
  /**
   * Set API key for a specific provider
   */
  public setApiKey(provider: string, apiKey: string): void {
    const apiKeys = this.getApiKeys() || {};
    apiKeys[provider] = apiKey;
    this.updateUserSetting("apiKeys", apiKeys);
  }
  
  /**
   * Get provider configurations
   */
  public getProviders(): Record<string, { baseURL: string; models?: string[] }> | undefined {
    return this.getUserSetting("providers");
  }

  /**
   * Get base URL from user settings or environment
   */
  public getBaseURL(): string {
    // First check environment variable
    const envBaseURL = process.env.GROK_BASE_URL;
    if (envBaseURL) {
      return envBaseURL;
    }

    // Then check user settings
    const userBaseURL = this.getUserSetting("baseURL");
    return (
      userBaseURL || DEFAULT_USER_SETTINGS.baseURL || "https://api.x.ai/v1"
    );
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}
