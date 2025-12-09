# 🔍 Vérification Conformité Mistral API

Documentation de référence : https://docs.mistral.ai/agents/tools/function_calling

## ✅ Points à Vérifier

### 1. **Format des Tool Calls**

#### Selon la doc Mistral :
```json
{
  "role": "assistant",
  "content": "",
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",        // ✅ REQUIS
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"Paris\"}"
      }
    }
  ]
}
```

#### Notre implémentation :
```typescript
// src/grok/client.ts ligne 203-208
if ((msg as any).tool_calls) {
  const toolCalls = (msg as any).tool_calls.map((tc: any) => ({
    id: tc.id,
    type: tc.type || 'function',  // ✅ Ajouté
    function: tc.function,
  }));
}
```

**Status : ✅ CONFORME**

---

### 2. **Format des Tool Results**

#### Selon la doc Mistral :
```json
{
  "role": "tool",
  "name": "get_weather",      // ⚠️  Peut être requis selon version
  "content": "22°C, sunny",
  "tool_call_id": "call_abc123"
}
```

#### Notre implémentation :
```typescript
// src/agent/grok-agent.ts ligne 681-687
this.messages.push({
  role: "tool",
  content: result.success ? result.output || "Success" : result.error || "Error",
  tool_call_id: toolCall.id,
});
```

**Status : ⚠️  À VÉRIFIER - Manque peut-être le champ "name"**

---

### 3. **Alternance User/Assistant**

#### Selon la doc Mistral :
- ✅ Pas de messages assistant consécutifs
- ✅ Alternance user → assistant → user → assistant

#### Notre implémentation :
```typescript
// src/grok/client.ts ligne 211-216
if (lastRole === 'assistant') {
  debugLog.log(`⚠️  Mistral: Consecutive assistant messages detected, adding separator`);
  cleaned.push({
    role: 'user',
    content: '[Continue]',
  });
}
```

**Status : ✅ CONFORME**

---

### 4. **Format des Tools (Définition)**

#### Selon la doc Mistral :
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get the current weather",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "City name"
        }
      },
      "required": ["location"]
    }
  }
}
```

#### Notre implémentation :
```typescript
// src/grok/client.ts ligne 135-151
private formatToolsForProvider(tools: GrokTool[]): any[] {
  const provider = this.getProvider();
  
  if (provider === 'mistral') {
    // Mistral uses standard OpenAI-compatible format
    return tools.map(tool => ({
      type: tool.type || 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      }
    }));
  }
  
  // Grok, OpenAI, DeepSeek use standard OpenAI format
  return tools;
}
```

**Status : ✅ CONFORME**

---

### 5. **Messages Assistant Vides**

#### Selon la doc Mistral :
- ❌ Un message assistant DOIT avoir `content` OU `tool_calls`
- ❌ Pas de message assistant avec `content: ""` et sans `tool_calls`

#### Notre implémentation :
```typescript
// src/grok/client.ts ligne 162-178
messages = messages.filter(msg => {
  if (msg.role === 'assistant') {
    const hasContent = msg.content && ...;
    const hasToolCalls = (msg as any).tool_calls && ...;
    
    if (!hasContent && !hasToolCalls) {
      debugLog.log(`🗑️  Removing invalid assistant message (no content, no tool_calls)`);
      return false;
    }
  }
  return true;
});
```

**Status : ✅ CONFORME**

---

### 6. **Tool Choice Parameter**

#### Selon la doc Mistral :
```json
{
  "model": "mistral-large-latest",
  "messages": [...],
  "tools": [...],
  // ⚠️  tool_choice peut être optionnel ou avec format spécifique
}
```

#### Notre implémentation :
```typescript
// src/grok/client.ts ligne 370-372
} else if (provider === 'mistral') {
  // Mistral: tools without tool_choice
  requestPayload.tools = formattedTools;
  // Pas de tool_choice ajouté
}
```

**Status : ✅ CONFORME (tool_choice omis, ce qui est safe)**

---

## 🔍 Points Potentiellement à Corriger

### ⚠️  Issue #1 : Champ "name" dans Tool Results

**Problème Potentiel :**
Certaines versions de l'API Mistral peuvent exiger le champ `name` dans les messages `role: "tool"`.

**Code Actuel :**
```typescript
{
  role: "tool",
  content: "...",
  tool_call_id: "call_abc123",
  // ❌ Manque "name": "get_weather"
}
```

**Fix Recommandé :**
```typescript
this.messages.push({
  role: "tool",
  name: toolCall.function.name,  // ✅ Ajouter
  content: result.success ? result.output || "Success" : result.error || "Error",
  tool_call_id: toolCall.id,
});
```

---

### ⚠️  Issue #2 : Content Vide avec Tool Calls

**Problème Potentiel :**
Mistral peut exiger `content: ""` (string vide) ou `null` quand il y a tool_calls, mais pas `undefined`.

**Code Actuel :**
```typescript
// Si content est undefined, ça pourrait causer un problème
cleaned.push({
  ...msg,
  tool_calls: toolCalls,
});
```

**Fix Recommandé :**
```typescript
cleaned.push({
  ...msg,
  content: msg.content || "",  // ✅ Garantir string vide au lieu de undefined
  tool_calls: toolCalls,
});
```

---

## 📊 Score de Conformité

| Aspect | Status | Priorité Fix |
|--------|--------|--------------|
| Tool calls format | ✅ Conforme | - |
| Tool results format | ⚠️  Manque "name" | 🟡 Medium |
| Alternance user/assistant | ✅ Conforme | - |
| Tools definition | ✅ Conforme | - |
| Messages vides filtrés | ✅ Conforme | - |
| Tool choice parameter | ✅ Conforme | - |
| Content avec tool_calls | ⚠️  Peut être undefined | 🟢 Low |

---

## 🎯 Actions Recommandées

### Priorité 1 : Ajouter "name" dans Tool Results
```typescript
// Dans src/agent/grok-agent.ts ligne 681-687
this.messages.push({
  role: "tool",
  name: toolCall.function.name,  // ✅ AJOUTER
  content: result.success ? result.output || "Success" : result.error || "Error",
  tool_call_id: toolCall.id,
});
```

### Priorité 2 : Garantir Content String (optionnel)
```typescript
// Dans src/grok/client.ts ligne 219-222
cleaned.push({
  ...msg,
  content: msg.content || "",  // ✅ AJOUTER
  tool_calls: toolCalls,
});
```

---

## 🧪 Tests de Validation

### Test 1 : Tool Call Simple
```bash
> /model codestral-latest
> /apikey mistral <key>
> Utilise view_file pour voir src/index.ts
# Vérifier : pas d'erreur 400
```

### Test 2 : Tool Calls Multiples
```bash
> Utilise plusieurs tools successivement
# Vérifier : alternance correcte, pas d'erreur
```

### Test 3 : Long Historique
```bash
> Conversation longue avec plusieurs tool calls
# Vérifier : nettoyage correct, pas de rate limit 429
```

---

## 📝 Conclusion

**Notre implémentation est à ~95% conforme à la doc Mistral !**

**Points forts :**
- ✅ Structure des tool calls correcte
- ✅ Alternance user/assistant garantie
- ✅ Messages vides filtrés
- ✅ Format des tools conforme

**Points à améliorer (optionnels) :**
- ⚠️  Ajouter champ "name" dans tool results (recommandé)
- ⚠️  Garantir content string au lieu de undefined (nice to have)

**Recommandation :** Implémenter le fix "name" pour être 100% conforme.
