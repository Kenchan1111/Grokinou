# 🎯 Plan Model Management - Version Simplifiée (Réaliste)

## 📋 Analyse de l'Existant

### **Commande `/models` (Déjà Existante)** ✅
```typescript
// src/hooks/use-input-handler.ts ligne 424-429
if (trimmedInput === "/models") {
  setShowModelSelection(true);  // UI interactive
  setSelectedModelIndex(0);
  clearInput();
  return true;
}

// ligne 431-444
if (trimmedInput.startsWith("/models ")) {
  const modelArg = trimmedInput.split(" ")[1];
  agent.setModel(modelArg);
  updateCurrentModel(modelArg); // ✅ Sauvegarde dans .grok/settings.json
}
```
**Ce qui marche déjà** :
- ✅ `/models` → UI de sélection interactive
- ✅ `/models <name>` → Switch direct
- ✅ Sauvegarde dans `.grok/settings.json` (project-level)

**Ce qui manque** :
- ❌ Liste limitée aux modèles Grok uniquement
- ❌ Pas de `/model-default` pour changer le global default
- ❌ Pas de modèles autres providers (Claude, OpenAI, etc.)

---

## 🎯 Objectifs

### **1. Étendre la Liste des Modèles** 🌍
Ajouter support pour :
- **Grok** (X.AI) - Déjà supporté ✅
- **Claude** (Anthropic)
- **OpenAI** (GPT-4, etc.)
- **DeepSeek**
- **Mistral**

### **2. Ajouter Commande `/model-default`** 🔧
```bash
❯ /model-default grok-4-latest
✅ Set grok-4-latest as global default
📝 Saved to: ~/.grok/user-settings.json
ℹ️  Use /models to switch current session
```

### **3. Corriger les Bugs Existants** 🐛
- Bug switchProvider hardcodé
- Bug GrokClient default hardcodé

---

## 📝 Changements à Faire

### **Change 1: Étendre DEFAULT_USER_SETTINGS** 🌍

**Fichier**: `src/utils/settings-manager.ts`

```typescript
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
    "mistral-small-latest",
    "codestral-latest",
  ],
  persistInputHistory: true,
};
```

**Impact** :
- Ces modèles apparaîtront dans `/models` UI
- Utilisateur pourra les sélectionner directement
- Pas besoin de modifier manuellement le JSON

---

### **Change 2: Ajouter `/model-default`** 🔧

**Fichier**: `src/hooks/use-input-handler.ts`

```typescript
// NOUVELLE COMMANDE: /model-default
if (trimmedInput.startsWith("/model-default ")) {
  const modelArg = trimmedInput.slice(15).trim();
  const modelNames = availableModels.map((m) => m.model);

  if (modelNames.includes(modelArg)) {
    // Update user settings (global default)
    updateDefaultModel(modelArg);
    
    // Get current model for comparison
    const currentModel = agent.getCurrentModel();
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✅ Set ${modelArg} as global default model\n` +
               `📝 Saved to: ~/.grok/user-settings.json\n\n` +
               `ℹ️  Current session still using: ${currentModel}\n` +
               `💡 Use /models ${modelArg} to switch this session too\n\n` +
               `This will be used for all NEW sessions.`,
      timestamp: new Date(),
    };
    
    setChatHistory((prev) => [...prev, confirmEntry]);
  } else {
    const errorEntry: ChatEntry = {
      type: "assistant",
      content: `❌ Model "${modelArg}" not found.\n\n` +
               `Available models:\n${modelNames.map(m => `  • ${m}`).join('\n')}\n\n` +
               `To add a new model, edit ~/.grok/user-settings.json`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, errorEntry]);
  }
  
  clearInput();
  return true;
}

// UPDATE: Command suggestions
const commandSuggestions: CommandSuggestion[] = [
  { command: "/help", description: "Show help information" },
  { command: "/search", description: "Search in conversation history" },
  { command: "/models", description: "Switch model (interactive)" },
  { command: "/model-default", description: "Set global default model" }, // ✅ NEW
  { command: "/clear", description: "Clear chat history" },
  // ... rest
];
```

---

### **Change 3: Améliorer `/models` Feedback** 📝

```typescript
// AMÉLIORER: /models <name>
if (trimmedInput.startsWith("/models ")) {
  const modelArg = trimmedInput.split(" ")[1];
  const modelNames = availableModels.map((m) => m.model);

  if (modelNames.includes(modelArg)) {
    agent.setModel(modelArg);
    updateCurrentModel(modelArg); // Project settings
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✅ Switched to ${modelArg} for this session\n` +
               `📝 Saved to: .grok/settings.json\n\n` +
               `This affects only this project directory.`, // ✅ Clarification
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

### **Change 4: Corriger GrokClient** 🐛

**Fichier**: `src/grok/client.ts`

```typescript
export class GrokClient {
  private client: OpenAI;
  private currentModel: string; // ✅ NO DEFAULT (was: = "grok-4-1-fast-reasoning")
  private defaultMaxTokens: number;
  private apiKey: string; // ✅ NEW: Store for later access

  constructor(apiKey: string, model: string, baseURL?: string) { // ✅ model REQUIRED
    this.apiKey = apiKey; // ✅ Store
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || process.env.GROK_BASE_URL || "https://api.x.ai/v1",
      timeout: 360000,
    });
    const envMax = Number(process.env.GROK_MAX_TOKENS);
    this.defaultMaxTokens = Number.isFinite(envMax) && envMax > 0 ? envMax : 1536;
    this.currentModel = model; // ✅ Use provided model
  }

  // ✅ NEW: Get API key for session switching
  getApiKey(): string {
    return this.apiKey;
  }
  
  // Existing methods...
}
```

---

### **Change 5: Corriger GrokAgent Constructor** 🐛

**Fichier**: `src/agent/grok-agent.ts`

```typescript
constructor(
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
) {
  super();
  const manager = getSettingsManager();
  
  // ✅ CORRECTED: Priority chain
  // 1. CLI/constructor arg
  // 2. Project settings (.grok/settings.json)
  // 3. User default (~/.grok/user-settings.json)
  // 4. System default
  
  const projectModel = manager.getProjectSetting("model");
  const userDefault = manager.getCurrentModel(); // Includes user defaultModel
  const systemDefault = "grok-code-fast-1";
  
  const modelToUse = model || projectModel || userDefault || systemDefault;
  
  this.maxToolRounds = maxToolRounds || 400;
  this.grokClient = new GrokClient(apiKey, modelToUse, baseURL); // ✅ model required
  
  // ... rest unchanged
}

// ✅ NEW: Get current model
getCurrentModel(): string {
  return this.grokClient.getCurrentModel();
}

// ✅ NEW: Get API key
getApiKey(): string {
  return this.grokClient.getApiKey();
}
```

---

### **Change 6: Corriger switchProvider** 🐛

**Fichier**: `src/agent/grok-agent.ts`

```typescript
switchProvider(provider: string, apiKey: string, model?: string) {
  const baseUrls: Record<string, string> = {
    grok: 'https://api.x.ai/v1',
    claude: 'https://api.anthropic.com/v1',
    openai: 'https://api.openai.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    deepseek: 'https://api.deepseek.com/v1',
  };

  const baseURL = baseUrls[provider] || baseUrls.grok;
  
  // ✅ CORRECTED: Use same priority as constructor
  const manager = getSettingsManager();
  const projectModel = manager.getProjectSetting("model");
  const userDefault = manager.getCurrentModel();
  const systemDefault = "grok-code-fast-1";
  
  const modelToUse = model || projectModel || userDefault || systemDefault;

  // Update client
  this.grokClient = new GrokClient(apiKey, modelToUse, baseURL);
  
  // Update session manager
  sessionManager.switchProvider(provider, modelToUse, apiKey);
  
  console.log(`✅ Switched to ${provider} (${modelToUse})`);
}
```

---

### **Change 7: Améliorer /help** 📚

```typescript
const helpContent = `Grok CLI Help:

Built-in Commands:
  /clear             - Clear chat history
  /clear-session     - Clear in-memory session only
  /clear-disk-session - Delete persisted session and clear memory
  /help              - Show this help
  /models            - Switch model (interactive UI)
  /models <name>     - Switch to specified model directly
  /model-default <name> - Set global default model
  /search <query>    - Search in conversation history
  /exit              - Exit application

Model Management:
  /models                     - Interactive model selection
  /models grok-4-latest       - Switch session to grok-4-latest
  /model-default grok-4-latest - Set global default

Supported Providers:
  • Grok (X.AI)     - grok-4-latest, grok-code-fast-1, etc.
  • Claude          - claude-3-5-sonnet, claude-3-opus, etc.
  • OpenAI          - gpt-4o, gpt-4-turbo, o1-preview, etc.
  • DeepSeek        - deepseek-chat, deepseek-coder
  • Mistral         - mistral-large-latest, codestral-latest

Configuration Files:
  ~/.grok/user-settings.json  - Global settings (API key, default model, models list)
  .grok/settings.json         - Project settings (current model)

Priority: CLI args > ENV vars > Project settings > User default > System default

Edit ~/.grok/user-settings.json to:
  • Add custom models
  • Change API endpoints (baseURL)
  • Set global defaults

Examples:
  /models                      # Interactive UI
  /models gpt-4o              # Quick switch
  /model-default claude-3-5-sonnet # Set global default

For complex operations, describe what you want in natural language.
`;
```

---

## 🧪 Scénarios de Test

### **Test 1: Liste Étendue**
```bash
❯ /models
→ UI montre tous les modèles (Grok, Claude, OpenAI, DeepSeek, Mistral)
```

### **Test 2: Switch à Claude**
```bash
❯ /models claude-3-5-sonnet-20241022
✅ Switched to claude-3-5-sonnet-20241022 for this session
📝 Saved to: .grok/settings.json
```

### **Test 3: Set Global Default**
```bash
❯ /model-default grok-4-latest
✅ Set grok-4-latest as global default model
📝 Saved to: ~/.grok/user-settings.json
ℹ️  Current session still using: grok-code-fast-1
💡 Use /models grok-4-latest to switch this session too
```

### **Test 4: Nouvelle Session**
```bash
# Dans nouveau terminal
❯ grok
→ Démarre avec grok-4-latest (global default)
```

### **Test 5: Priority Project > User**
```bash
# .grok/settings.json: {"model": "gpt-4o"}
# ~/.grok/user-settings.json: {"defaultModel": "grok-4-latest"}

❯ grok
→ Utilise gpt-4o (project override)
```

---

## 📋 Checklist d'Implémentation

### **Phase 1: Étendre Liste Modèles** ✅
- [ ] Modifier `DEFAULT_USER_SETTINGS` dans `settings-manager.ts`
- [ ] Ajouter Grok, Claude, OpenAI, DeepSeek, Mistral
- [ ] Tester `/models` UI avec nouvelle liste

### **Phase 2: Ajouter /model-default** ✅
- [ ] Ajouter commande dans `use-input-handler.ts`
- [ ] Utiliser `updateDefaultModel()` existant
- [ ] Feedback clair (session vs global)
- [ ] Update command suggestions

### **Phase 3: Corriger Bugs** ✅
- [ ] GrokClient: retirer hardcoded default
- [ ] GrokClient: ajouter `getApiKey()`
- [ ] GrokAgent: corriger constructor priority
- [ ] GrokAgent: ajouter `getCurrentModel()` et `getApiKey()`
- [ ] GrokAgent: corriger `switchProvider`

### **Phase 4: Améliorer UX** ✅
- [ ] Améliorer feedback `/models <name>`
- [ ] Améliorer `/help` avec nouveaux providers
- [ ] Tester tous les flows

### **Phase 5: Documentation** ✅
- [ ] Update README
- [ ] Examples pour chaque provider
- [ ] Migration guide

---

## 🚀 Ordre d'Exécution

1. **Étendre `DEFAULT_USER_SETTINGS`** (settings-manager.ts)
2. **Ajouter `/model-default`** (use-input-handler.ts)
3. **Corriger `GrokClient`** (grok/client.ts)
4. **Corriger `GrokAgent`** (agent/grok-agent.ts)
5. **Améliorer `/models` feedback** (use-input-handler.ts)
6. **Améliorer `/help`** (use-input-handler.ts)
7. **Tester tous les scénarios**
8. **Documentation**
9. **Commit**

---

## 📊 Résumé

| Commande | Effet | Portée | Fichier |
|----------|-------|--------|---------|
| `grok --model X` | CLI override | Temporaire | - |
| `/models` | UI interactive | - | - |
| `/models X` | Switch session | Project | `.grok/settings.json` |
| `/model-default X` | Set global | User | `~/.grok/user-settings.json` |

**Providers Supportés** :
- ✅ Grok (X.AI)
- ✅ Claude (Anthropic)
- ✅ OpenAI
- ✅ DeepSeek
- ✅ Mistral

---

**Beaucoup plus simple et réaliste !** 🎯

Garder `/models` existant, ajouter juste `/model-default` et étendre la liste. 🚀
