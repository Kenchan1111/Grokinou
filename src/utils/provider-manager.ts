/**
 * Provider Manager - Multi-provider support with auto-detection
 * 
 * Features:
 * - Auto-detect provider from model name
 * - Manage API keys per provider
 * - Handle baseURL per provider
 * - Support: Grok, Claude, OpenAI, DeepSeek, Mistral
 */

import { getSettingsManager } from './settings-manager.js';

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

/**
 * Default provider configurations
 */
const DEFAULT_PROVIDERS: Record<string, Omit<ProviderConfig, 'name' | 'apiKey'>> = {
  grok: {
    baseURL: 'https://api.x.ai/v1',
    models: [
      'grok-4-latest',
      'grok-code-fast-1',
      'grok-3-latest',
      'grok-3-fast',
      'grok-3-mini-fast',
      'grok2-vision-beta',
    ],
  },
  claude: {
    baseURL: 'https://api.anthropic.com/v1',
    models: [
      'claude-sonnet-4-5-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
    ],
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    models: [
      // GPT-5 (Latest)
      'gpt-5',
      'gpt-5-2025-08-07',
      // O3 Reasoning (New)
      'o3',
      'o3-mini',
      // O1 Reasoning
      'o1',
      'o1-preview',
      'o1-mini',
      // GPT-4o
      'gpt-4o',
      'gpt-4o-2024-11-20',
      'gpt-4o-2024-08-06',
      'gpt-4o-mini',
      'gpt-4o-mini-2024-07-18',
      'chatgpt-4o-latest',
      // GPT-4 Turbo
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4-turbo-2024-04-09',
      'gpt-4',
      // GPT-3.5
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
    ],
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    models: [
      'deepseek-chat',
      'deepseek-coder',
      'deepseek-reasoner',
    ],
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    models: [
      'mistral-large-latest',
      'mistral-large-2407',
      'mistral-medium-latest',
      'mistral-small-latest',
      'mistral-tiny',
      'codestral-latest',
      'codestral-2405',
      'open-mistral-7b',
      'open-mixtral-8x7b',
      'open-mixtral-8x22b',
    ],
  },
};

export class ProviderManager {
  private providers: Map<string, ProviderConfig> = new Map();
  
  constructor() {
    this.initializeProviders();
  }
  
  /**
   * Initialize provider configurations from settings
   */
  private initializeProviders(): void {
    const settingsManager = getSettingsManager();
    
    // Get API keys from user settings
    const apiKeys = settingsManager.getApiKeys();
    
    // Load provider configs (user can override in settings)
    const userProviders = settingsManager.getProviders();
    
    // Merge default providers with user overrides
    for (const [name, defaultConfig] of Object.entries(DEFAULT_PROVIDERS)) {
      const userConfig = userProviders?.[name];
      
      this.providers.set(name, {
        name,
        baseURL: userConfig?.baseURL || defaultConfig.baseURL,
        models: userConfig?.models || defaultConfig.models,
        apiKey: apiKeys?.[name],
      });
    }
    
    // Add any additional user-defined providers
    if (userProviders) {
      for (const [name, config] of Object.entries(userProviders)) {
        if (!this.providers.has(name)) {
          this.providers.set(name, {
            name,
            baseURL: config.baseURL,
            models: config.models || [],
            apiKey: apiKeys?.[name],
          });
        }
      }
    }
  }
  
  /**
   * Detect provider from model name
   */
  detectProvider(modelName: string): string | null {
    // First, try exact match in provider models
    for (const [providerName, config] of this.providers.entries()) {
      if (config.models.includes(modelName)) {
        return providerName;
      }
    }
    
    // Fallback: heuristic detection from model name
    const lowerModel = modelName.toLowerCase();
    
    if (lowerModel.includes('grok')) return 'grok';
    if (lowerModel.includes('claude')) return 'claude';
    if (lowerModel.includes('gpt') || lowerModel.includes('o1')) return 'openai';
    if (lowerModel.includes('deepseek')) return 'deepseek';
    if (lowerModel.includes('mistral') || lowerModel.includes('codestral')) return 'mistral';
    
    // Default to grok if can't detect
    return 'grok';
  }
  
  /**
   * Get provider config by name
   */
  getProvider(name: string): ProviderConfig | undefined {
    return this.providers.get(name);
  }
  
  /**
   * Get provider config for a specific model
   */
  getProviderForModel(modelName: string): ProviderConfig | null {
    const providerName = this.detectProvider(modelName);
    if (!providerName) return null;
    
    return this.getProvider(providerName) || null;
  }
  
  /**
   * Check if provider has API key configured
   */
  hasApiKey(providerName: string): boolean {
    const provider = this.getProvider(providerName);
    return !!provider?.apiKey;
  }
  
  /**
   * Set API key for provider (in memory + persist)
   */
  setApiKey(providerName: string, apiKey: string): void {
    const provider = this.getProvider(providerName);
    if (!provider) {
      // Create provider if doesn't exist (for custom providers)
      this.providers.set(providerName, {
        name: providerName,
        baseURL: DEFAULT_PROVIDERS[providerName]?.baseURL || 'https://api.example.com/v1',
        models: DEFAULT_PROVIDERS[providerName]?.models || [],
        apiKey,
      });
    } else {
      // Update existing provider
      provider.apiKey = apiKey;
    }
    
    // Persist to user settings
    const settingsManager = getSettingsManager();
    settingsManager.setApiKey(providerName, apiKey);
  }
  
  /**
   * Get masked API key for display (security)
   */
  getMaskedApiKey(providerName: string): string {
    const provider = this.getProvider(providerName);
    if (!provider?.apiKey) return 'Not configured';
    
    const key = provider.apiKey;
    if (key.length <= 8) return '***';
    
    // Show prefix and last 3 chars: sk-ant-***xxx
    const firstDash = key.indexOf('-');
    if (firstDash !== -1) {
      return key.slice(0, firstDash + 1) + '***' + key.slice(-3);
    }
    
    // Fallback
    return key.slice(0, 3) + '***' + key.slice(-3);
  }
  
  /**
   * List all providers with status
   */
  listProviders(): ProviderInfo[] {
    const result: ProviderInfo[] = [];
    
    for (const [name, config] of this.providers.entries()) {
      result.push({
        name,
        hasApiKey: !!config.apiKey,
        maskedKey: this.getMaskedApiKey(name),
        baseURL: config.baseURL,
        modelCount: config.models.length,
      });
    }
    
    // Sort: configured first, then alphabetically
    return result.sort((a, b) => {
      if (a.hasApiKey && !b.hasApiKey) return -1;
      if (!a.hasApiKey && b.hasApiKey) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  
  /**
   * Format provider list for display
   */
  formatProviderList(currentProvider?: string): string {
    const providers = this.listProviders();
    
    let output = '🔐 API Keys Configuration:\n\n';
    output += 'Configured Providers:\n';
    
    for (const provider of providers) {
      const status = provider.hasApiKey ? '✅' : '❌';
      const active = provider.name === currentProvider ? ' (active)' : '';
      const key = provider.hasApiKey ? provider.maskedKey : 'Not configured';
      output += `  ${status} ${provider.name.padEnd(10)} - ${key}${active}\n`;
    }
    
    output += '\nUsage:\n';
    output += '  /apikey <provider> <key>  - Set API key for provider\n';
    output += '  /apikey show <provider>   - Show full key (for debugging)\n';
    output += '\nExamples:\n';
    output += '  /apikey claude sk-ant-api03-xxx\n';
    output += '  /apikey openai sk-proj-xxx\n';
    
    return output;
  }
  
  /**
   * Get all provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Reload providers from settings (after changes)
   */
  reload(): void {
    this.providers.clear();
    this.initializeProviders();
  }
}

// Singleton instance
export const providerManager = new ProviderManager();
