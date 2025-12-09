# 🔍 Comparaison: Codex vs Grok-CLI - Gestion des Tool Calls

**Date :** 2025-11-30  
**Question :** Quelle est la limite `max_tool_rounds` dans Codex ?

---

## 📊 **Résumé**

| Aspect | **Grok-CLI** | **Codex (Anthropic)** |
|--------|--------------|----------------------|
| **Limite de tools** | ✅ `maxToolRounds: 15` (configurable) | ❌ **AUCUNE limite explicite** |
| **Architecture** | Boucle itérative (jusqu'à N rounds) | **Système de "turn" unique** |
| **Approche** | Agent autonome avec multi-rounds | Agent interactif par tour |
| **Risque de boucle** | ⚠️ Élevé (d'où la limite) | ✅ Faible (1 turn = 1 réponse) |

---

## 🏗️ **Architecture des deux systèmes**

### **Grok-CLI (Architecture actuelle)**

```
User Input
    ↓
LLM Processing
    ↓
    ├── Tool Call 1 → Result 1
    ├── Tool Call 2 → Result 2
    ├── Tool Call 3 → Result 3
    ├── ... (jusqu'à maxToolRounds)
    └── Final Response (forcée après N calls)
```

**Caractéristiques :**
- ✅ Agent **autonome** qui peut chaîner plusieurs tools
- ✅ Flexible : le LLM décide combien de tools utiliser
- ⚠️ **Risque** : Boucles infinies si `maxToolRounds` trop élevé
- 🔧 **Solution** : Limite stricte (`maxToolRounds = 15`)

**Fichier de config :**
```json
{
  "maxToolRounds": 15  // ~/.grok/user-settings.json
}
```

---

### **Codex (Architecture Anthropic)**

```
User Input
    ↓
LLM Processing (1 "turn")
    ↓
    ├── [Optional] Multiple Tool Calls in PARALLEL
    │   ├── Tool 1 → Result 1
    │   ├── Tool 2 → Result 2
    │   └── Tool 3 → Result 3
    ↓
Final Response (toujours générée)
    ↓
User Input (nouveau turn)
```

**Caractéristiques :**
- ✅ **1 turn = 1 réponse** (pas de boucle)
- ✅ Tools exécutés en **parallèle** si nécessaire
- ✅ Réponse **toujours générée** après les tool calls
- ✅ **Aucun risque de boucle infinie** par design
- 🔄 Pour continuer : l'utilisateur lance un **nouveau turn**

**Fichiers de config :**
```toml
# ~/.codex/config.toml
# AUCUNE option "maxToolRounds" ou équivalent

# Options de retry pour les streams (différent)
# request_max_retries = 4  # max 100
# stream_max_retries = 5   # max 100
```

---

## 🔍 **Recherche effectuée dans Codex**

### Fichiers analysés :
- ✅ `docs/config.md` - Aucune mention de "maxToolRounds"
- ✅ `docs/example-config.md` - Aucune limite de tools
- ✅ `codex-rs/core/src/codex.rs` - Architecture basée sur "turn"
- ✅ `codex-rs/core/src/tools/` - Gestion des tool calls

### Résultat :
```
❌ Aucune configuration "maxToolRounds" trouvée dans Codex
❌ Aucune constante "MAX_TOOL_ITERATIONS" ou similaire
✅ Codex utilise un système de "turn" unique par requête
```

---

## 🤔 **Pourquoi Codex n'a pas besoin de `maxToolRounds` ?**

### **Design Pattern : "Turn-based" vs "Agentic Loop"**

**Codex (Turn-based) :**
```rust
// Pseudo-code simplifié
fn process_turn(user_input) {
    let prompt = build_prompt(user_input, history);
    let response = llm.generate(prompt);
    
    // Si le LLM demande des tools
    if response.tool_calls {
        let results = execute_tools(response.tool_calls); // En parallèle
        let final_response = llm.generate_with_results(results);
        return final_response;  // ← Toujours une réponse finale
    }
    
    return response;
}
```

**Grok-CLI (Agentic Loop) :**
```typescript
// Pseudo-code simplifié
async function processUserMessage(input) {
    let round = 0;
    let response;
    
    while (round < maxToolRounds) {  // ← Limite nécessaire !
        response = await llm.generate(context);
        
        if (response.toolCalls) {
            const results = await executeTools(response.toolCalls);
            context.add(results);
            round++;  // Continue la boucle
        } else {
            return response;  // Réponse finale
        }
    }
    
    // Forcé après maxToolRounds
    return llm.generate_final_response(context);
}
```

---

## 📈 **Avantages et inconvénients**

### **Codex (Turn-based)**

**✅ Avantages :**
- Pas de risque de boucle infinie
- Performance prévisible
- Contrôle utilisateur à chaque étape
- Architecture simple et robuste

**❌ Inconvénients :**
- Moins autonome (nécessite interactions utilisateur)
- Ne peut pas chaîner automatiquement plusieurs tools
- Workflow plus manuel

### **Grok-CLI (Agentic Loop)**

**✅ Avantages :**
- Agent autonome (peut résoudre seul)
- Chaînage automatique de tools
- Plus puissant pour tâches complexes
- Moins d'interactions utilisateur

**❌ Inconvénients :**
- ⚠️ **Risque de boucle infinie** (d'où `maxToolRounds`)
- Performance imprévisible
- Peut "s'emballer" sans limite
- Debugging plus complexe

---

## 🎯 **Recommandations**

### **Pour Grok-CLI (valeurs optimales)**

| Modèle | `maxToolRounds` | Justification |
|--------|----------------|---------------|
| **GPT-5, O3, O1** | **10-15** | Modèles de raisonnement, limiter pour éviter boucles |
| **GPT-4o, Claude** | **20-25** | Équilibre autonomie/contrôle |
| **Grok, Mistral** | **15-20** | Standard |
| **DeepSeek** | **15-20** | Standard |

**Valeur actuelle (CORRIGÉE) :** ✅ **15** (optimal)

**Ancienne valeur (PROBLÉMATIQUE) :** ❌ **400** (cause de boucles infinies)

---

## 💡 **Solutions hybrides possibles**

### **Option 1 : Mode "Turn" optionnel dans Grok-CLI**
```json
{
  "agentMode": "autonomous",  // boucle avec maxToolRounds
  "agentMode": "turn-based"   // comme Codex (1 turn = 1 réponse)
}
```

### **Option 2 : Détection de boucle intelligente**
```typescript
// Détecter si le LLM appelle les mêmes tools en boucle
function detectToolLoop(history) {
    const recent = history.slice(-5);
    const toolNames = recent.map(h => h.toolCall?.name);
    
    // Si les 3 derniers calls sont identiques → STOP
    if (toolNames[0] === toolNames[1] && toolNames[1] === toolNames[2]) {
        return true;  // Boucle détectée !
    }
    return false;
}
```

### **Option 3 : Timeout basé sur le temps**
```typescript
const MAX_EXECUTION_TIME = 120000; // 2 minutes max
const startTime = Date.now();

while (Date.now() - startTime < MAX_EXECUTION_TIME && round < maxToolRounds) {
    // ...
}
```

---

## 📚 **Conclusion**

### **Codex n'a PAS de `maxToolRounds` car :**
1. Architecture **turn-based** (pas de boucle)
2. **1 turn = 1 réponse** (toujours)
3. Tools exécutés **en parallèle** puis réponse finale
4. **Aucun risque de boucle infinie** by design

### **Grok-CLI a BESOIN de `maxToolRounds` car :**
1. Architecture **agentic loop** (autonome)
2. Peut chaîner **N tool calls** avant réponse
3. **Risque de boucle infinie** si pas de limite
4. Valeur optimale : **10-15** pour GPT-5

---

## 🔗 **Références**

- **Codex Config Docs :** `/home/zack/GROK_CLI/codex/docs/config.md`
- **Codex Core Source :** `/home/zack/GROK_CLI/codex/codex-rs/core/src/codex.rs`
- **Grok-CLI Settings :** `~/.grok/user-settings.json`
- **GPT-5 Bugfix :** `GPT5_BUGFIX_TOOL_LOOP.md`

---

**Créé par :** Claude Sonnet 4.5  
**Date :** 2025-11-30 17:35
