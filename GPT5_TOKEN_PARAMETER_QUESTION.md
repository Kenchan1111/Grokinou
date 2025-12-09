# GPT-5 Token Parameter Question
## 2025-12-07 23:30 - REQUIRES INVESTIGATION

---

## ❓ QUESTION CRITIQUE NON RÉSOLUE

**GPT-5 utilise-t-il:**
- **Option A:** `max_tokens` + `temperature` (API standard)
- **Option B:** `max_completion_tokens` + NO temperature (API reasoning)

---

## 🔍 INDICES CONTRADICTOIRES

### POUR Option A (Standard API)
✅ GPT-5 devrait supporter tools (standard model behavior)
✅ GPT-5 n'est pas marketé comme "reasoning only"
✅ C'est le successor de GPT-4, pas d'o1

### POUR Option B (Reasoning API)
⚠️ Commit f0bd851: "will automatically recognize gpt-5.1 as a reasoning model"
⚠️ Commit 3ed38e7 (Nov 22): "Reasoning models (o1, o3, gpt-5) use max_completion_tokens"
⚠️ Commit 3ead8ad: "GPT-5 returned error: 400 Invalid value for tool_choice"

---

## 🤔 HYPOTHÈSE

Il est possible que:
1. **GPT-5 utilise l'API reasoning** (`max_completion_tokens`)
2. **MAIS supporte quand même les tools** (contrairement à o1/o3)

Cela expliquerait:
- Pourquoi il était dans `isReasoningModel()` (pour tokens)
- Pourquoi l'erreur 400 avec tool_choice (incompatible avec reasoning API?)
- Pourquoi mon fix marche (tools OK maintenant)

---

## 💡 SOLUTION PROPOSÉE

Créer DEUX fonctions distinctes:

### 1. `isReasoningModel()` - Pour l'API
```typescript
// Models qui utilisent reasoning API (max_completion_tokens, no temp)
private isReasoningModel(model?: string): boolean {
  const modelName = (model || this.currentModel).toLowerCase();
  return modelName.startsWith('o1') ||
         modelName.startsWith('o3') ||
         modelName.includes('gpt-5');  // Reasoning API
}
```

### 2. `supportsTools()` - Pour tools
```typescript
// Models qui supportent function calling
private supportsTools(model?: string): boolean {
  const modelName = (model || this.currentModel).toLowerCase();
  // o1/o3 do NOT support tools
  // GPT-5 DOES support tools (even if using reasoning API)
  return !(modelName.startsWith('o1') || modelName.startsWith('o3'));
}
```

### Usage
```typescript
// For token parameters
if (isReasoning) {
  requestPayload.max_completion_tokens = adaptiveMaxTokens;
} else {
  requestPayload.max_tokens = adaptiveMaxTokens;
  requestPayload.temperature = 0.7;
}

// For tools
if (tools && tools.length > 0 && this.supportsTools(modelToUse)) {
  requestPayload.tools = formattedTools;
}
```

---

## 🧪 TEST REQUIS

Pour vérifier, il faut tester GPT-5 et observer:

### Test 1: Avec `max_tokens` (standard)
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

**Si ça marche:** GPT-5 = Standard API ✅

---

### Test 2: Avec `max_completion_tokens` (reasoning)
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_completion_tokens": 100
  }'
```

**Si ça marche:** GPT-5 = Reasoning API ✅

---

### Test 3: Avec tools
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "messages": [{"role": "user", "content": "What is the weather?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather",
        "parameters": {"type": "object", "properties": {}}
      }
    }],
    "max_completion_tokens": 100
  }'
```

**Si ça marche:** GPT-5 = Reasoning API + Tools ✅

---

## 📊 ÉTAT ACTUEL DU CODE

**Après mon fix (abf394e):**

```typescript
// isReasoningModel() - Pour tokens ET tools
private isReasoningModel(model?: string): boolean {
  return modelName.startsWith('o1') ||
         modelName.startsWith('o3');
  // GPT-5 NOT included
}

// Usage 1: Tools
if (tools && tools.length > 0 && !isReasoning) {
  // GPT-5 will enter here ✅
}

// Usage 2: Token params
if (isReasoning) {
  requestPayload.max_completion_tokens = ...;
} else {
  requestPayload.max_tokens = ...;
  // GPT-5 will enter here
  // Using max_tokens + temperature
}
```

**Impact:**
- ✅ GPT-5 gets tools (correct)
- ⚠️ GPT-5 uses `max_tokens` (might be wrong if it needs `max_completion_tokens`)

---

## ⚠️ RISQUE POTENTIEL

Si GPT-5 nécessite `max_completion_tokens`:
- Mon fix actuel cassera GPT-5 pour les tokens
- Il faudra les deux fonctions (isReasoningModel + supportsTools)

**Symptôme attendu si cassé:**
- GPT-5 retourne erreur 400 pour `max_tokens`
- Ou ignore `max_tokens` complètement

---

## 🎯 ACTION RECOMMANDÉE

**Option 1: Tester maintenant**
```bash
npm start
/model gpt-5
> Write a long story (test max_tokens behavior)
```

Observer:
- GPT-5 répond-il normalement?
- Y a-t-il une erreur 400?
- Respecte-t-il max_tokens?

**Option 2: Implémenter les deux fonctions maintenant**
- Safer approach
- Prévient cassure potentielle
- Sépare les concerns (API vs tools)

---

## 📝 DÉCISION À PRENDRE

Tu dois choisir:

**A) Garder le fix actuel**
- Risque: Casse GPT-5 si il nécessite reasoning API
- Avantage: Simple, minimal changes

**B) Implémenter deux fonctions**
- Risque: Plus complexe
- Avantage: Séparation correcte (API params vs tools support)

**C) Tester d'abord, puis décider**
- Le plus sage
- Nécessite accès à GPT-5 pour tester

---

**Status:** QUESTION OUVERTE - Requires testing or OpenAI docs

**User decision needed:** Quelle approche préfères-tu?
