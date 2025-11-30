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
 * Execution Viewer settings
 */
export interface ExecutionViewerSettings {
  enabled?: boolean; // Enable/disable execution viewer
  defaultMode?: 'hidden' | 'split' | 'fullscreen'; // Default mode
  autoShow?: boolean; // Auto-show when execution starts
  autoHide?: boolean; // Auto-hide when execution ends
  autoHideDelay?: number; // Delay before auto-hide (ms)
  splitRatio?: number; // Split ratio (0-1, default 0.6)
  layout?: 'horizontal' | 'vertical'; // Split layout orientation
  showCOT?: boolean; // Show Chain of Thought
  showCommands?: boolean; // Show command executions
  detailsMode?: boolean; // Show details by default
  maxExecutionsShown?: number; // Max executions in history
  colorScheme?: 'default' | 'minimal' | 'verbose'; // Color scheme
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
  executionViewer?: ExecutionViewerSettings; // Execution viewer configuration
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
    
    // === CLAUDE (Anthropic) - Verified names ===
    "claude-sonnet-4-5-20250514", // Latest Sonnet 4.5 (May 2025)
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    
    // === OPENAI - Verified ✅ (Tested 2025-11-22) ===
    "gpt-5", // ✅ Latest GPT-5 (Aug 2025)
    "gpt-5-2025-08-07", // ✅ Explicit date version
    "o3", // ✅ Latest O3 reasoning (Apr 2025)
    "o3-mini", // ✅ O3 Mini (Jan 2025)
    "o1", // ✅ O1 reasoning (Dec 2024)
    "gpt-4o", // ✅ Latest GPT-4o
    "gpt-4o-2024-11-20", // ✅ Nov 2024 version
    "gpt-4o-2024-08-06", // ✅ Aug 2024 version
    "gpt-4o-mini", // ✅ Mini version
    "chatgpt-4o-latest", // ✅ ChatGPT version
    "gpt-4-turbo", // ✅ GPT-4 Turbo
    "gpt-3.5-turbo", // ✅ GPT-3.5
    
    // === DEEPSEEK - Verified ✅ (Tested 2025-11-22) ===
    "deepseek-chat", // ✅ General chat
    "deepseek-coder", // ✅ Coding (→ deepseek-chat)
    "deepseek-reasoner", // ✅ R1 reasoning model
    
    // === MISTRAL - Verified ✅ (Tested 2025-11-22) ===
    "mistral-large-latest", // ✅
    "mistral-large-2407", // ✅
    "mistral-medium-latest", // ✅
    "mistral-small-latest", // ✅
    "mistral-tiny", // ✅
    "codestral-latest", // ✅
    "codestral-2405", // ✅
    "open-mistral-7b", // ✅
    "open-mixtral-8x7b", // ✅
    "open-mixtral-8x22b", // ✅
  ],
  persistInputHistory: true,
};

/**
 * Default values for execution viewer
 */
const DEFAULT_EXECUTION_VIEWER_SETTINGS: ExecutionViewerSettings = {
  enabled: true,
  defaultMode: 'hidden',
  autoShow: true,
  autoHide: false,
  autoHideDelay: 5000,
  splitRatio: 0.6,
  layout: 'horizontal',
  showCOT: true,
  showCommands: true,
  detailsMode: false,
  maxExecutionsShown: 10,
  colorScheme: 'default',
};

/**
 * Default values for project settings
 */
const DEFAULT_PROJECT_SETTINGS: Partial<ProjectSettings> = {
  model: "grok-code-fast-1",
  persistSession: true,
  autoRestoreSession: true,
  executionViewer: DEFAULT_EXECUTION_VIEWER_SETTINGS,
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
      const defaultCount = DEFAULT_USER_SETTINGS.models?.length || 35;
      
      // Check if migration is needed
      // Migrate if:
      // 1. List is significantly smaller than default (< 50% of default models)
      // 2. OR list is empty
      const needsMigration = 
        currentModels.length === 0 || 
        currentModels.length < (defaultCount / 2);
      
      if (needsMigration) {
        console.log(`🔄 Migrating model list from ${currentModels.length} to ${defaultCount} models...`);
        this.updateUserSetting("models", DEFAULT_USER_SETTINGS.models);
        console.log(`✅ Model list updated: ${currentModels.length} → ${defaultCount} models`);
      } else if (currentModels.length < defaultCount - 5) {
        // List exists but is slightly outdated
        // Don't auto-migrate (user might have customized), but log a warning
        console.log(`ℹ️  Your model list has ${currentModels.length} models (default: ${defaultCount})`);
        console.log(`   Run /models to see all available models, or manually update ~/.grok/user-settings.json`);
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
   * Get API key for a specific provider
   */
  public getApiKeyForProvider(provider: string): string | undefined {
    const apiKeys = this.getApiKeys();
    return apiKeys?.[provider];
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

  /**
   * Get execution viewer settings (merged with defaults)
   */
  public getExecutionViewerSettings(): ExecutionViewerSettings {
    const projectSettings = this.getProjectSetting("executionViewer") || {};
    return {
      ...DEFAULT_EXECUTION_VIEWER_SETTINGS,
      ...projectSettings,
    };
  }

  /**
   * Update execution viewer setting
   */
  public updateExecutionViewerSetting<K extends keyof ExecutionViewerSettings>(
    key: K,
    value: ExecutionViewerSettings[K]
  ): void {
    const current = this.getProjectSetting("executionViewer") || {};
    this.updateProjectSetting("executionViewer", {
      ...current,
      [key]: value,
    });
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}
