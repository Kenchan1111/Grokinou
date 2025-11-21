# 🎯 Plan d'Implémentation - Model Management (Production Ready)

## 📋 Vue d'Ensemble

Implémentation complète et rigoureuse du système de gestion des modèles avec :
- ✅ Configuration centralisée avec priorités
- ✅ Commandes en session (`/model`, `/model-default`)
- ✅ Support multi-provider (Grok, OpenAI, Claude, etc.)
- ✅ Persistence automatique
- ✅ Feedback utilisateur clair

---

## 🎯 Nouvelles Commandes

### **`/model <model-name>`**
Change le modèle pour la **session courante** (project-level).

```bash
❯ /model grok-4-latest
✅ Switched to grok-4-latest for this session
📝 Saved to: .grok/settings.json

❯ /model grok2-vision-beta
✅ Switched to grok2-vision-beta for this session
📝 Saved to: .grok/settings.json
```

**Comportement** :
- Change immédiatement le modèle dans `GrokClient`
- Sauvegarde dans `.grok/settings.json` (project-level)
- N'affecte PAS le default global
- Persiste pour ce répertoire uniquement

---

### **`/model-default <model-name>`**
Change le modèle par défaut **global** (user-level).

```bash
❯ /model-default grok-4-latest
✅ Set grok-4-latest as global default model
📝 Saved to: ~/.grok/user-settings.json
ℹ️  Current session still using: grok-code-fast-1
💡 Use /model grok-4-latest to switch this session too

❯ /model-default grok2-vision-beta
✅ Set grok2-vision-beta as global default model
📝 Saved to: ~/.grok/user-settings.json
ℹ️  This will be used for all NEW sessions
```

**Comportement** :
- Ne change PAS le modèle de la session courante
- Sauvegarde dans `~/.grok/user-settings.json` (user-level)
- Affecte toutes les nouvelles sessions
- Feedback clair sur l'état actuel

---

### **`/model` (sans argument)**
Affiche la configuration actuelle.

```bash
❯ /model
📊 Model Configuration:

Current Session:
  • Model:  grok-code-fast-1
  • Source: project (.grok/settings.json)
  • Status: ✅ Active

Global Default:
  • Model:  grok-4-latest
  • Source: user (~/.grok/user-settings.json)

Available Models:
  • grok-code-fast-1
  • grok-4-latest
  • grok-3-latest
  • grok-3-fast
  • grok-vision-beta

Usage:
  /model <model>         - Switch current session
  /model-default <model> - Set global default
```

---

## 🏗️ Architecture

### **1. ConfigResolver (Centralisé)**

```
Priority Chain:
┌─────────────────────────────────────┐
│ 1. CLI Arguments (--model)          │ ← Highest
├─────────────────────────────────────┤
│ 2. Environment (GROK_MODEL)         │
├─────────────────────────────────────┤
│ 3. Project (.grok/settings.json)    │ ← /model
├─────────────────────────────────────┤
│ 4. User (~/.grok/user-settings.json)│ ← /model-default
├─────────────────────────────────────┤
│ 5. System Default (grok-code-fast-1)│ ← Lowest
└─────────────────────────────────────┘
```

### **2. Flux des Commandes**

```
User Input: /model grok-4-latest
    ↓
CommandHandler (use-input-handler.ts)
    ↓
1. Validate model exists
    ↓
2. GrokAgent.setModel(model)
    ↓
3. Update .grok/settings.json
    ↓
4. Update sessionManager
    ↓
5. Show confirmation message
```

```
User Input: /model-default grok-4-latest
    ↓
CommandHandler
    ↓
1. Validate model exists
    ↓
2. Update ~/.grok/user-settings.json
    ↓
3. Show confirmation + info
    ↓
4. Remind: use /model to switch current session
```

---

## 📁 Fichiers à Créer/Modifier

### **NOUVEAU: `src/utils/config-resolver.ts`**
✅ Résolution centralisée des configs
✅ Priority chain
✅ Debugging helpers

### **NOUVEAU: `src/utils/model-manager.ts`**
✅ Gestion des modèles disponibles
✅ Validation
✅ Persistence

### **MODIFIER: `src/hooks/use-input-handler.ts`**
✅ Ajouter `/model` command
✅ Ajouter `/model-default` command
✅ Améliorer `/models` (backward compat)

### **MODIFIER: `src/agent/grok-agent.ts`**
✅ Utiliser ConfigResolver
✅ Méthode `setModel()` améliorée
✅ Corriger `switchProvider()`

### **MODIFIER: `src/grok/client.ts`**
✅ Retirer hardcoded default
✅ `model` required in constructor

### **MODIFIER: `src/index.ts`**
✅ Utiliser ConfigResolver au démarrage

---

## 🔧 Implémentation Détaillée

### **Phase 1: ModelManager** (`src/utils/model-manager.ts`)

```typescript
/**
 * Model Manager - Handles model validation and persistence
 */

import { getSettingsManager } from './settings-manager.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

export interface ModelInfo {
  name: string;
  provider: string;  // grok, openai, claude, etc.
  available: boolean;
}

export class ModelManager {
  private settingsManager = getSettingsManager();
  
  /**
   * Get list of available models from user settings
   */
  getAvailableModels(): string[] {
    return this.settingsManager.getAvailableModels();
  }
  
  /**
   * Validate if model exists in available list
   */
  validateModel(modelName: string): boolean {
    const available = this.getAvailableModels();
    return available.includes(modelName);
  }
  
  /**
   * Set current session model (project-level)
   * Saves to .grok/settings.json
   */
  setSessionModel(modelName: string, workdir: string = process.cwd()): void {
    if (!this.validateModel(modelName)) {
      throw new Error(`Model "${modelName}" not found in available models`);
    }
    
    const settingsPath = join(workdir, '.grok', 'settings.json');
    const settingsDir = dirname(settingsPath);
    
    // Ensure directory exists
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    
    // Load existing settings or create new
    let settings: any = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      } catch (error) {
        console.warn('⚠️  Failed to parse existing settings, creating new');
      }
    }
    
    // Update model
    settings.model = modelName;
    
    // Save
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }
  
  /**
   * Set default model (user-level)
   * Saves to ~/.grok/user-settings.json
   */
  setDefaultModel(modelName: string): void {
    if (!this.validateModel(modelName)) {
      throw new Error(`Model "${modelName}" not found in available models`);
    }
    
    this.settingsManager.updateUserSetting('defaultModel', modelName);
  }
  
  /**
   * Get current session model (from project settings)
   */
  getSessionModel(workdir: string = process.cwd()): string | undefined {
    const settingsPath = join(workdir, '.grok', 'settings.json');
    
    if (!existsSync(settingsPath)) {
      return undefined;
    }
    
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      return settings.model;
    } catch (error) {
      return undefined;
    }
  }
  
  /**
   * Get default model (from user settings)
   */
  getDefaultModel(): string | undefined {
    return this.settingsManager.getUserSetting('defaultModel');
  }
  
  /**
   * Get full model info for display
   */
  getModelInfo(): {
    current: { model: string; source: string };
    default: { model: string; source: string };
    available: string[];
  } {
    const sessionModel = this.getSessionModel();
    const defaultModel = this.getDefaultModel();
    const systemDefault = 'grok-code-fast-1';
    
    let currentModel: string;
    let currentSource: string;
    
    if (sessionModel) {
      currentModel = sessionModel;
      currentSource = 'project (.grok/settings.json)';
    } else if (defaultModel) {
      currentModel = defaultModel;
      currentSource = 'user (~/.grok/user-settings.json)';
    } else {
      currentModel = systemDefault;
      currentSource = 'system default';
    }
    
    return {
      current: {
        model: currentModel,
        source: currentSource,
      },
      default: {
        model: defaultModel || systemDefault,
        source: defaultModel ? 'user (~/.grok/user-settings.json)' : 'system default',
      },
      available: this.getAvailableModels(),
    };
  }
  
  /**
   * Format model info for display
   */
  formatModelInfo(): string {
    const info = this.getModelInfo();
    
    let output = '📊 Model Configuration:\n\n';
    
    output += 'Current Session:\n';
    output += `  • Model:  ${info.current.model}\n`;
    output += `  • Source: ${info.current.source}\n`;
    output += `  • Status: ✅ Active\n\n`;
    
    output += 'Global Default:\n';
    output += `  • Model:  ${info.default.model}\n`;
    output += `  • Source: ${info.default.source}\n\n`;
    
    output += 'Available Models:\n';
    for (const model of info.available) {
      const isCurrent = model === info.current.model;
      const marker = isCurrent ? '• ✅' : '  •';
      output += `${marker} ${model}\n`;
    }
    
    output += '\nUsage:\n';
    output += '  /model <model>         - Switch current session\n';
    output += '  /model-default <model> - Set global default\n';
    
    return output;
  }
}

// Singleton
export const modelManager = new ModelManager();
```

---

### **Phase 2: Améliorer use-input-handler.ts**

```typescript
import { modelManager } from "../utils/model-manager.js";

// Dans handleDirectCommand

// ============================================
// /model - Display or set current session model
// ============================================
if (trimmedInput === "/model") {
  const modelInfo = modelManager.formatModelInfo();
  
  const infoEntry: ChatEntry = {
    type: "assistant",
    content: modelInfo,
    timestamp: new Date(),
  };
  
  setChatHistory((prev) => [...prev, infoEntry]);
  clearInput();
  return true;
}

if (trimmedInput.startsWith("/model ")) {
  const modelArg = trimmedInput.slice(7).trim();
  
  try {
    // Validate model
    if (!modelManager.validateModel(modelArg)) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ Model "${modelArg}" not found.\n\n` +
                 `Available models:\n${modelManager.getAvailableModels().map(m => `  • ${m}`).join('\n')}\n\n` +
                 `To add a new model, edit ~/.grok/user-settings.json`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      clearInput();
      return true;
    }
    
    // Set model in agent
    agent.setModel(modelArg);
    
    // Save to project settings
    modelManager.setSessionModel(modelArg);
    
    // Update session manager
    sessionManager.switchProvider(
      sessionManager.getCurrentProvider() || 'grok',
      modelArg,
      agent.getApiKey()
    );
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✅ Switched to ${modelArg} for this session\n` +
               `📝 Saved to: .grok/settings.json\n\n` +
               `This change affects only this project directory.`,
      timestamp: new Date(),
    };
    
    setChatHistory((prev) => [...prev, confirmEntry]);
    clearInput();
    return true;
    
  } catch (error) {
    const errorEntry: ChatEntry = {
      type: "assistant",
      content: `❌ Failed to switch model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, errorEntry]);
    clearInput();
    return true;
  }
}

// ============================================
// /model-default - Set global default model
// ============================================
if (trimmedInput.startsWith("/model-default ")) {
  const modelArg = trimmedInput.slice(15).trim();
  
  try {
    // Validate model
    if (!modelManager.validateModel(modelArg)) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ Model "${modelArg}" not found.\n\n` +
                 `Available models:\n${modelManager.getAvailableModels().map(m => `  • ${m}`).join('\n')}\n\n` +
                 `To add a new model, edit ~/.grok/user-settings.json`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      clearInput();
      return true;
    }
    
    // Save to user settings
    modelManager.setDefaultModel(modelArg);
    
    // Get current model for comparison
    const currentModel = agent.getCurrentModel();
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✅ Set ${modelArg} as global default model\n` +
               `📝 Saved to: ~/.grok/user-settings.json\n\n` +
               `ℹ️  Current session still using: ${currentModel}\n` +
               `💡 Use /model ${modelArg} to switch this session too\n\n` +
               `This will be the default for all NEW sessions.`,
      timestamp: new Date(),
    };
    
    setChatHistory((prev) => [...prev, confirmEntry]);
    clearInput();
    return true;
    
  } catch (error) {
    const errorEntry: ChatEntry = {
      type: "assistant",
      content: `❌ Failed to set default model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, errorEntry]);
    clearInput();
    return true;
  }
}

// ============================================
// Update command suggestions
// ============================================
const commandSuggestions: CommandSuggestion[] = [
  { command: "/help", description: "Show help information" },
  { command: "/search", description: "Search in conversation history" },
  { command: "/model", description: "Display or set current session model" },
  { command: "/model-default", description: "Set global default model" },
  { command: "/clear", description: "Clear chat history" },
  // ... rest
];

// ============================================
// Update /help text
// ============================================
const helpContent = `Grok CLI Help:

Built-in Commands:
  /clear             - Clear chat history
  /clear-session     - Clear in-memory chat session only
  /clear-disk-session - Delete persisted session files and clear memory
  /help              - Show this help
  /model             - Display current model configuration
  /model <name>      - Switch to specified model for this session
  /model-default <name> - Set global default model
  /search <query>    - Search in conversation history
  /exit              - Exit application
  exit, quit         - Exit application

Model Management:
  /model                      - Show current configuration
  /model grok-4-latest        - Switch session to grok-4-latest
  /model-default grok-4-latest - Set global default to grok-4-latest

Examples:
  /model                      # Show current model info
  /model grok2-vision-beta    # Switch to vision model
  /model-default grok-4-latest # Set global default

Configuration Files:
  ~/.grok/user-settings.json  - Global settings (API key, default model)
  .grok/settings.json         - Project settings (current model)

Priority: CLI args > ENV vars > Project settings > User settings > System default

For complex operations, just describe what you want in natural language.
`;
```

---

### **Phase 3: Ajouter Méthodes à GrokAgent**

```typescript
// src/agent/grok-agent.ts

/**
 * Get current API key (for session switching)
 */
getApiKey(): string {
  return this.grokClient.getApiKey(); // Need to add this to GrokClient
}

/**
 * Get current model
 */
getCurrentModel(): string {
  return this.grokClient.getCurrentModel();
}

/**
 * Set model for current session
 */
setModel(model: string): void {
  this.grokClient.setModel(model);
  // Update token counter too
  this.tokenCounter = createTokenCounter(model);
}
```

---

### **Phase 4: Ajouter Méthode à GrokClient**

```typescript
// src/grok/client.ts

export class GrokClient {
  private client: OpenAI;
  private currentModel: string;
  private defaultMaxTokens: number;
  private apiKey: string; // ✅ Store for later access

  constructor(apiKey: string, model: string, baseURL?: string) {
    this.apiKey = apiKey; // ✅ Store
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || process.env.GROK_BASE_URL || "https://api.x.ai/v1",
      timeout: 360000,
    });
    const envMax = Number(process.env.GROK_MAX_TOKENS);
    this.defaultMaxTokens = Number.isFinite(envMax) && envMax > 0 ? envMax : 1536;
    this.currentModel = model;
  }
  
  // ✅ NEW: Get API key
  getApiKey(): string {
    return this.apiKey;
  }
  
  // Existing methods...
}
```

---

### **Phase 5: Améliorer SessionManager**

```typescript
// src/utils/session-manager-sqlite.ts

export class SessionManagerSQLite {
  // ...
  
  /**
   * Get current provider
   */
  getCurrentProvider(): string | null {
    return this.currentProvider;
  }
  
  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.currentModel;
  }
  
  // Existing methods...
}
```

---

## 🧪 Scénarios de Test

### **Test 1: Commande /model sans argument**
```bash
❯ /model
→ Affiche config actuelle
→ Current: grok-code-fast-1 (source: system default)
→ Default: grok-code-fast-1 (source: system default)
→ Liste des modèles disponibles
```

### **Test 2: Commande /model avec argument valide**
```bash
❯ /model grok-4-latest
→ ✅ Switched to grok-4-latest for this session
→ 📝 Saved to: .grok/settings.json
→ Vérifier: cat .grok/settings.json → {"model": "grok-4-latest"}
→ Message suivant utilise grok-4-latest
```

### **Test 3: Commande /model avec argument invalide**
```bash
❯ /model grok-invalid-model
→ ❌ Model "grok-invalid-model" not found.
→ Available models: [liste]
→ Reste sur le modèle actuel
```

### **Test 4: Commande /model-default**
```bash
❯ /model-default grok-4-latest
→ ✅ Set grok-4-latest as global default model
→ 📝 Saved to: ~/.grok/user-settings.json
→ ℹ️  Current session still using: grok-code-fast-1
→ 💡 Use /model grok-4-latest to switch this session too
→ Vérifier: cat ~/.grok/user-settings.json → {"defaultModel": "grok-4-latest"}
```

### **Test 5: Nouvelle session après /model-default**
```bash
# Dans nouveau terminal/répertoire
❯ grok
→ Démarre avec grok-4-latest (from user settings)
→ /model → Current: grok-4-latest (source: user)
```

### **Test 6: Priorité project > user**
```bash
# .grok/settings.json: {"model": "grok-3-fast"}
# ~/.grok/user-settings.json: {"defaultModel": "grok-4-latest"}

❯ grok
→ Démarre avec grok-3-fast (project override)
→ /model → Current: grok-3-fast (source: project)
```

### **Test 7: CLI arg prioritaire**
```bash
❯ grok --model grok-2-vision-beta
→ Utilise grok-2-vision-beta
→ N'affecte PAS les fichiers de config
→ Temporaire pour cette exécution uniquement
```

---

## 📊 Résumé des Commandes

| Commande | Effet | Portée | Persistence |
|----------|-------|--------|-------------|
| `grok --model X` | CLI override | Session | Temporaire |
| `/model X` | Switch session | Project | `.grok/settings.json` |
| `/model-default X` | Set global | User | `~/.grok/user-settings.json` |
| `/model` | Display info | - | - |

---

## 🚀 Ordre d'Implémentation

1. ✅ Créer `model-manager.ts`
2. ✅ Créer `config-resolver.ts`
3. ✅ Ajouter méthodes à `GrokClient`
4. ✅ Ajouter méthodes à `GrokAgent`
5. ✅ Ajouter commandes dans `use-input-handler.ts`
6. ✅ Corriger `switchProvider`
7. ✅ Tests
8. ✅ Documentation
9. ✅ Commit

---

## 📝 Documentation Utilisateur

### **Quick Start**

```bash
# Show current model
❯ /model

# Switch session model
❯ /model grok-4-latest

# Set global default
❯ /model-default grok-4-latest

# Works with any OpenAI-compatible model
❯ /model claude-sonnet-4
❯ /model gpt-4o
❯ /model gemini-2.5-pro
```

### **Configuration**

```json
// ~/.grok/user-settings.json (global)
{
  "apiKey": "your_key",
  "defaultModel": "grok-4-latest",
  "models": [
    "grok-code-fast-1",
    "grok-4-latest",
    "grok2-vision-beta"
  ]
}

// .grok/settings.json (project)
{
  "model": "grok-3-fast"
}
```

---

**C'est bon pour toi Zack ? Je commence l'implémentation ?** 🚀
