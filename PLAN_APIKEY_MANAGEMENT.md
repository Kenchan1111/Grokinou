# 🔐 Plan API Key Management - Multi-Provider

## 🎯 Problème

Quand on change de modèle (ex: Grok → Claude), il faut aussi changer l'API key :
```bash
❯ /models claude-3-5-sonnet
→ Switch modèle ✅
→ Mais garde GROK_API_KEY ❌
→ Appel API échoue ! 🔴
```

**Solution** : Stocker et gérer les API keys par provider + switch automatique.

---

## 🏗️ Architecture Proposée

### **1. Structure de Configuration**

#### **`~/.grok/user-settings.json`** (Multi-Provider)
```json
{
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-4-latest",
  
  "apiKeys": {
    "grok": "xai-xxx",
    "claude": "sk-ant-xxx",
    "openai": "sk-xxx",
    "deepseek": "xxx",
    "mistral": "xxx"
  },
  
  "providers": {
    "grok": {
      "baseURL": "https://api.x.ai/v1",
      "models": ["grok-4-latest", "grok-code-fast-1", "grok2-vision-beta"]
    },
    "claude": {
      "baseURL": "https://api.anthropic.com/v1",
      "models": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"]
    },
    "openai": {
      "baseURL": "https://api.openai.com/v1",
      "models": ["gpt-4o", "gpt-4-turbo", "o1-preview"]
    },
    "deepseek": {
      "baseURL": "https://api.deepseek.com/v1",
      "models": ["deepseek-chat", "deepseek-coder"]
    },
    "mistral": {
      "baseURL": "https://api.mistral.ai/v1",
      "models": ["mistral-large-latest", "codestral-latest"]
    }
  },
  
  "models": [
    "grok-4-latest",
    "claude-3-5-sonnet-20241022",
    "gpt-4o",
    "deepseek-chat",
    "mistral-large-latest"
  ]
}
```

---

## 🔧 Nouvelles Commandes

### **`/apikey` - Display Current Keys**
```bash
❯ /apikey

🔐 API Keys Configuration:

Configured Providers:
  ✅ grok      - xai-***xxx (active)
  ✅ claude    - sk-ant-***xxx
  ✅ openai    - sk-***xxx
  ❌ deepseek  - Not configured
  ❌ mistral   - Not configured

Current Session:
  • Provider: grok
  • Model:    grok-4-latest
  • API Key:  xai-***xxx

Usage:
  /apikey <provider> <key>  - Set API key for provider
  /apikey show <provider>   - Show full key (masked)
```

---

### **`/apikey <provider> <key>` - Set API Key**
```bash
❯ /apikey claude sk-ant-api03-xxx
✅ Set API key for claude
📝 Saved to: ~/.grok/user-settings.json (encrypted)
🔒 Key masked: sk-ant-***xxx

❯ /apikey openai sk-proj-xxx
✅ Set API key for openai
📝 Saved to: ~/.grok/user-settings.json (encrypted)
```

---

### **`/apikey show <provider>` - Show Full Key**
```bash
❯ /apikey show claude
🔐 API Key for claude:
sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

⚠️  Warning: Keep this key secret!
```

---

## 🔄 Workflow Automatique

### **Scénario 1: Switch Modèle Auto-Détecte Provider**

```bash
# User a configuré :
# - grok: xai-xxx
# - claude: sk-ant-xxx

❯ /models grok-4-latest
→ Détecte provider: grok
→ Load API key: xai-xxx
→ Load baseURL: https://api.x.ai/v1
✅ Switched to grok-4-latest

❯ /models claude-3-5-sonnet-20241022
→ Détecte provider: claude
→ Load API key: sk-ant-xxx
→ Load baseURL: https://api.anthropic.com/v1
✅ Switched to claude-3-5-sonnet-20241022
→ Recréé GrokClient avec nouvelle config
```

---

### **Scénario 2: Provider Sans API Key**

```bash
❯ /models deepseek-chat
❌ API key not configured for provider: deepseek

Set it now:
  /apikey deepseek your-api-key-here

Or configure in ~/.grok/user-settings.json:
{
  "apiKeys": {
    "deepseek": "your-key-here"
  }
}
```

---

## 📁 Nouveaux Fichiers

### **`src/utils/provider-manager.ts`** (Nouveau)

```typescript
/**
 * Provider Manager - Detect provider from model name and manage API keys
 */

export interface ProviderConfig {
  name: string;
  baseURL: string;
  models: string[];
  apiKey?: string;
}

export class ProviderManager {
  private providers: Map<string, ProviderConfig> = new Map();
  
  constructor() {
    this.initializeProviders();
  }
  
  /**
   * Initialize provider configurations
   */
  private initializeProviders(): void {
    const settingsManager = getSettingsManager();
    const userSettings = settingsManager.getUserSettings();
    
    // Load from user settings or use defaults
    const providersConfig = userSettings?.providers || DEFAULT_PROVIDERS;
    const apiKeys = userSettings?.apiKeys || {};
    
    for (const [name, config] of Object.entries(providersConfig)) {
      this.providers.set(name, {
        name,
        baseURL: config.baseURL,
        models: config.models,
        apiKey: apiKeys[name],
      });
    }
  }
  
  /**
   * Detect provider from model name
   */
  detectProvider(modelName: string): string | null {
    for (const [providerName, config] of this.providers.entries()) {
      if (config.models.includes(modelName)) {
        return providerName;
      }
    }
    
    // Fallback: heuristic detection
    if (modelName.includes('grok')) return 'grok';
    if (modelName.includes('claude')) return 'claude';
    if (modelName.includes('gpt') || modelName.includes('o1')) return 'openai';
    if (modelName.includes('deepseek')) return 'deepseek';
    if (modelName.includes('mistral')) return 'mistral';
    
    return null;
  }
  
  /**
   * Get provider config
   */
  getProvider(name: string): ProviderConfig | undefined {
    return this.providers.get(name);
  }
  
  /**
   * Get provider for model
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
      throw new Error(`Unknown provider: ${providerName}`);
    }
    
    // Update in memory
    provider.apiKey = apiKey;
    
    // Persist to user settings
    const settingsManager = getSettingsManager();
    const userSettings = settingsManager.getUserSettings();
    const apiKeys = userSettings?.apiKeys || {};
    
    apiKeys[providerName] = apiKey;
    settingsManager.updateUserSetting('apiKeys', apiKeys);
  }
  
  /**
   * Get masked API key for display
   */
  getMaskedApiKey(providerName: string): string {
    const provider = this.getProvider(providerName);
    if (!provider?.apiKey) return 'Not configured';
    
    const key = provider.apiKey;
    if (key.length <= 8) return '***';
    
    return key.slice(0, key.indexOf('-') + 1) + '***' + key.slice(-3);
  }
  
  /**
   * List all providers with status
   */
  listProviders(): Array<{
    name: string;
    hasApiKey: boolean;
    maskedKey: string;
    baseURL: string;
    modelCount: number;
  }> {
    const result = [];
    
    for (const [name, config] of this.providers.entries()) {
      result.push({
        name,
        hasApiKey: !!config.apiKey,
        maskedKey: this.getMaskedApiKey(name),
        baseURL: config.baseURL,
        modelCount: config.models.length,
      });
    }
    
    return result;
  }
  
  /**
   * Format provider list for display
   */
  formatProviderList(): string {
    const providers = this.listProviders();
    
    let output = '🔐 API Keys Configuration:\n\n';
    output += 'Configured Providers:\n';
    
    for (const provider of providers) {
      const status = provider.hasApiKey ? '✅' : '❌';
      const key = provider.hasApiKey ? provider.maskedKey : 'Not configured';
      output += `  ${status} ${provider.name.padEnd(10)} - ${key}\n`;
    }
    
    output += '\nUsage:\n';
    output += '  /apikey <provider> <key>  - Set API key\n';
    output += '  /apikey show <provider>   - Show full key\n';
    
    return output;
  }
}

// Default providers configuration
const DEFAULT_PROVIDERS = {
  grok: {
    baseURL: 'https://api.x.ai/v1',
    models: [
      'grok-4-latest',
      'grok-code-fast-1',
      'grok-3-latest',
      'grok-3-fast',
      'grok2-vision-beta',
    ],
  },
  claude: {
    baseURL: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'o1-preview',
      'o1-mini',
    ],
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    models: [
      'deepseek-chat',
      'deepseek-coder',
    ],
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'codestral-latest',
    ],
  },
};

// Singleton
export const providerManager = new ProviderManager();
```

---

## 🔧 Modifications

### **1. Améliorer `/models <name>`** (use-input-handler.ts)

```typescript
if (trimmedInput.startsWith("/models ")) {
  const modelArg = trimmedInput.split(" ")[1];
  const modelNames = availableModels.map((m) => m.model);

  if (modelNames.includes(modelArg)) {
    // ✅ NEW: Detect provider and get config
    const providerConfig = providerManager.getProviderForModel(modelArg);
    
    if (!providerConfig) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ Could not detect provider for model: ${modelArg}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      clearInput();
      return true;
    }
    
    // Check API key
    if (!providerConfig.apiKey) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ API key not configured for provider: ${providerConfig.name}\n\n` +
                 `Set it now:\n` +
                 `  /apikey ${providerConfig.name} your-api-key-here\n\n` +
                 `Or configure in ~/.grok/user-settings.json`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      clearInput();
      return true;
    }
    
    // ✅ Switch with new provider config
    agent.switchToModel(
      modelArg,
      providerConfig.apiKey,
      providerConfig.baseURL
    );
    
    // Update project settings
    updateCurrentModel(modelArg);
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✅ Switched to ${modelArg}\n` +
               `📝 Provider: ${providerConfig.name}\n` +
               `🔗 Endpoint: ${providerConfig.baseURL}\n` +
               `💾 Saved to: .grok/settings.json`,
      timestamp: new Date(),
    };
    
    setChatHistory((prev) => [...prev, confirmEntry]);
  } else {
    // ... error handling
  }
  
  clearInput();
  return true;
}
```

---

### **2. Ajouter `/apikey` Command** (use-input-handler.ts)

```typescript
// ============================================
// /apikey - Display API keys
// ============================================
if (trimmedInput === "/apikey") {
  const info = providerManager.formatProviderList();
  
  const infoEntry: ChatEntry = {
    type: "assistant",
    content: info,
    timestamp: new Date(),
  };
  
  setChatHistory((prev) => [...prev, infoEntry]);
  clearInput();
  return true;
}

// ============================================
// /apikey <provider> <key> - Set API key
// ============================================
if (trimmedInput.startsWith("/apikey ") && !trimmedInput.includes(" show ")) {
  const parts = trimmedInput.split(" ");
  
  if (parts.length < 3) {
    const errorEntry: ChatEntry = {
      type: "assistant",
      content: `❌ Invalid syntax.\n\n` +
               `Usage:\n` +
               `  /apikey <provider> <key>     - Set API key\n` +
               `  /apikey show <provider>      - Show full key\n\n` +
               `Example:\n` +
               `  /apikey claude sk-ant-api03-xxx`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, errorEntry]);
    clearInput();
    return true;
  }
  
  const providerName = parts[1];
  const apiKey = parts[2];
  
  try {
    providerManager.setApiKey(providerName, apiKey);
    
    const maskedKey = providerManager.getMaskedApiKey(providerName);
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✅ Set API key for ${providerName}\n` +
               `📝 Saved to: ~/.grok/user-settings.json\n` +
               `🔒 Key masked: ${maskedKey}`,
      timestamp: new Date(),
    };
    
    setChatHistory((prev) => [...prev, confirmEntry]);
  } catch (error) {
    const errorEntry: ChatEntry = {
      type: "assistant",
      content: `❌ Failed to set API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, errorEntry]);
  }
  
  clearInput();
  return true;
}

// ============================================
// /apikey show <provider> - Show full key
// ============================================
if (trimmedInput.startsWith("/apikey show ")) {
  const providerName = trimmedInput.split(" ")[2];
  
  const provider = providerManager.getProvider(providerName);
  
  if (!provider || !provider.apiKey) {
    const errorEntry: ChatEntry = {
      type: "assistant",
      content: `❌ No API key configured for provider: ${providerName}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, errorEntry]);
    clearInput();
    return true;
  }
  
  const infoEntry: ChatEntry = {
    type: "assistant",
    content: `🔐 API Key for ${providerName}:\n` +
             `${provider.apiKey}\n\n` +
             `⚠️  Warning: Keep this key secret!`,
    timestamp: new Date(),
  };
  
  setChatHistory((prev) => [...prev, infoEntry]);
  clearInput();
  return true;
}
```

---

### **3. Ajouter `switchToModel` à GrokAgent** (agent/grok-agent.ts)

```typescript
/**
 * Switch to a different model with new API key and baseURL
 * (Used when changing providers)
 */
switchToModel(model: string, apiKey: string, baseURL: string): void {
  // Recreate client with new config
  this.grokClient = new GrokClient(apiKey, model, baseURL);
  
  // Update token counter
  this.tokenCounter = createTokenCounter(model);
  
  // Update session manager
  const provider = providerManager.detectProvider(model) || 'grok';
  sessionManager.switchProvider(provider, model, apiKey);
}
```

---

## 🧪 Scénarios de Test

### **Test 1: Liste API Keys**
```bash
❯ /apikey
→ Affiche tous les providers
→ Status ✅/❌ pour chaque
→ Keys masquées
```

### **Test 2: Set API Key**
```bash
❯ /apikey claude sk-ant-api03-xxx
✅ Set API key for claude
📝 Saved to: ~/.grok/user-settings.json
🔒 Key masked: sk-ant-***xxx
```

### **Test 3: Switch avec Auto-Detection**
```bash
❯ /models claude-3-5-sonnet-20241022
→ Détecte provider: claude
→ Load API key: sk-ant-***xxx
→ Recréé GrokClient
✅ Switched to claude-3-5-sonnet-20241022
```

### **Test 4: Switch sans API Key**
```bash
❯ /models deepseek-chat
❌ API key not configured for provider: deepseek
→ Instructions pour configurer
```

### **Test 5: Show Full Key**
```bash
❯ /apikey show claude
🔐 API Key for claude:
sk-ant-api03-xxxxxxxx
⚠️  Warning: Keep this key secret!
```

---

## 📋 Checklist

### **Phase 1: Provider Manager** ✅
- [ ] Créer `provider-manager.ts`
- [ ] Detect provider from model name
- [ ] Manage API keys by provider
- [ ] Format display

### **Phase 2: Commands** ✅
- [ ] `/apikey` - Display
- [ ] `/apikey <provider> <key>` - Set
- [ ] `/apikey show <provider>` - Show full

### **Phase 3: Integration** ✅
- [ ] Améliorer `/models` avec auto-detection
- [ ] Ajouter `switchToModel()` à GrokAgent
- [ ] Update settings-manager pour `apiKeys`

### **Phase 4: Tests** ✅
- [ ] Test multi-provider switch
- [ ] Test API key persistence
- [ ] Test error handling

---

## 🔒 Sécurité

### **Considérations**
- ✅ Keys stockées en clair dans `~/.grok/user-settings.json`
- ✅ Permissions fichier: `chmod 600 ~/.grok/user-settings.json`
- ✅ Keys masquées dans l'UI
- ✅ `show` command pour debug uniquement

### **Future: Encryption** 🔮
```typescript
// Optionnel: Encrypt keys at rest
import { encrypt, decrypt } from './crypto.js';

setApiKey(provider: string, apiKey: string): void {
  const encrypted = encrypt(apiKey, userPassword);
  // Store encrypted...
}
```

---

**Ça répond à ta question Zack ?** 🔐

L'idée :
1. Stocker toutes les API keys dans `user-settings.json`
2. Auto-détecter le provider depuis le nom du modèle
3. Switch automatique key + baseURL
4. Commandes `/apikey` pour gérer en session

Sans redémarrer le CLI ! 🚀
