# 🐛 Diagnostic : Duplication des Tools et Réponses

## 🔍 Problème Observé

L'utilisateur voit une **duplication** :
- Réponse du LLM affichée 2 fois
- Fichiers consultés et leurs sorties affichés 2 fois
- Les tools apparaissent en double

## 📊 Cause Racine

### Flux Actuel (Problématique)

**Fichier** : `src/agent/grok-agent.ts:661-702`

```typescript
// 1. Créer tool_call entries
assistantMessage.tool_calls.forEach((toolCall) => {
  const toolCallEntry: ChatEntry = {
    type: "tool_call",
    content: "Executing...",
    timestamp: new Date(),
    toolCall: toolCall,
  };
  this.chatHistory.push(toolCallEntry);  // ✅ Add to memory
  newEntries.push(toolCallEntry);         // ✅ Add to return value
  // ❌ NOT persisted yet (good!)
});

// 2. Créer assistant entry
const assistantEntry: ChatEntry = {
  type: "assistant",
  content: assistantMessage.content || "Using tools to help you...",
  timestamp: new Date(),
  toolCalls: assistantMessage.tool_calls,
};
this.chatHistory.push(assistantEntry);
await this.persist(assistantEntry);  // ✅ Persisted
newEntries.push(assistantEntry);

// 3. Execute tools et UPDATE les entries
for (const toolCall of assistantMessage.tool_calls) {
  const result = await this.executeTool(toolCall);

  // Find existing tool_call entry
  const entryIndex = this.chatHistory.findIndex(
    (entry) => entry.type === "tool_call" && entry.toolCall?.id === toolCall.id
  );

  if (entryIndex !== -1) {
    // ❌ PROBLÈME: Update l'entry en mémoire
    const updatedEntry: ChatEntry = {
      ...this.chatHistory[entryIndex],
      type: "tool_result",  // Change type
      content: this.formatToolResultSummary(toolCall, result),
      toolResult: result,
    };
    this.chatHistory[entryIndex] = updatedEntry;  // Update in memory
    await this.persist(updatedEntry);             // ❌ PERSIST AGAIN!

    // Also update in newEntries
    const newEntryIndex = newEntries.findIndex(...);
    if (newEntryIndex !== -1) {
      newEntries[newEntryIndex] = updatedEntry;
    }
  }
}
```

### Problème dans `persist()`

**Fichier** : `src/agent/grok-agent.ts:349-354`

```typescript
private async persist(entry: ChatEntry) {
  if (!this.persistSession) return;
  try {
    await appendChatEntry(entry);  // ❌ TOUJOURS APPEND, jamais UPDATE
  } catch {}
}
```

**Fichier** : `src/utils/session-manager-sqlite.ts:481-526`

```typescript
async appendChatEntry(entry: ChatEntry): Promise<void> {
  // ...
  const message = await this.saveMessage(entry);  // ❌ Crée NOUVEAU message
  // ...
}

private async saveMessage(entry: ChatEntry): Promise<Message> {
  const message = this.messageRepo.save({  // ❌ Crée toujours NOUVEAU
    session_id: this.currentSession.id,
    type: entry.type,
    // ...
  });
  return message;
}
```

### Résultat dans la Base de Données

**Après une exécution avec 2 tools** :

| ID | Type | Content | Tool Call ID |
|----|------|---------|--------------|
| 1 | assistant | "Using tools to help you..." | (has tool_calls) |
| 2 | tool_call | "Executing..." | tc_123 |  ← ❌ Pas mis à jour
| 3 | tool_call | "Executing..." | tc_456 |  ← ❌ Pas mis à jour
| 4 | tool_result | "Read: src/..." | tc_123 |  ← ✅ Nouveau entry
| 5 | tool_result | "Read: package.json..." | tc_456 |  ← ✅ Nouveau entry
| 6 | assistant | "Voici mon analyse..." | (no tool_calls) |

**Problème** : On a à la fois les `tool_call` ET les `tool_result` dans la DB !

### Affichage Résultant

Quand le chat history est chargé, on a :

```
Order in DB:
1. assistant "Using tools..."
2. tool_call tc_123  ← Affiché
3. tool_call tc_456  ← Affiché
4. tool_result tc_123  ← Affiché AUSSI
5. tool_result tc_456  ← Affiché AUSSI
6. assistant "Voici mon analyse..."
```

**Résultat** : Duplication ! Les tools apparaissent 2 fois (une fois comme `tool_call`, une fois comme `tool_result`).

---

## ✅ Solution

### Option 1 : Ne PAS Persister les tool_call Initiaux (Recommandé)

**Principe** : Seulement persister les `tool_result` finaux, pas les `tool_call` temporaires.

**Changement** : Dans le code qui update les entries, NE PAS persister si c'était un tool_call initial.

**Fichier** : `src/agent/grok-agent.ts:694-702`

```typescript
if (entryIndex !== -1) {
  const updatedEntry: ChatEntry = {
    ...this.chatHistory[entryIndex],
    type: "tool_result",
    content: this.formatToolResultSummary(toolCall, result),
    toolResult: result,
  };
  this.chatHistory[entryIndex] = updatedEntry;

  // ✅ ONLY persist tool_result, not the initial tool_call
  await this.persist(updatedEntry);

  // Also update in newEntries
  const newEntryIndex = newEntries.findIndex(...);
  if (newEntryIndex !== -1) {
    newEntries[newEntryIndex] = updatedEntry;
  }
}
```

**Avantage** : Simple, pas besoin de modifier la DB ou le persist logic.

**Résultat** : La DB contiendra seulement :
1. assistant "Using tools..."
2. tool_result tc_123  ← ✅ Un seul entry par tool
3. tool_result tc_456  ← ✅ Un seul entry par tool
4. assistant "Voici mon analyse..."

---

### Option 2 : Implémenter un updateChatEntry (Plus Complexe)

**Principe** : Ajouter une méthode pour UPDATE au lieu d'APPEND.

**Changements nécessaires** :
1. Ajouter `updateChatEntry()` dans session-manager-sqlite.ts
2. Modifier `persist()` pour détecter si c'est un update
3. Trouver et UPDATE l'entry existante dans la DB par tool_call_id

**Avantage** : Plus propre conceptuellement.

**Inconvénient** : Beaucoup plus de code, risque de bugs.

---

## 🎯 Recommandation

**Option 1** : Ne PAS persister les tool_call initiaux.

**Raison** :
- Simple : 1 ligne de code à ne PAS exécuter
- Efficace : Évite les écritures DB inutiles
- Correct : Les tool_call temporaires n'ont pas besoin d'être persistés

**Implémentation** :
1. Les tool_call entries sont créées en mémoire seulement
2. Quand le tool s'exécute, on les update en mémoire
3. On persiste SEULEMENT le tool_result final

---

## 📝 Plan d'Implémentation

### Étape 1 : Vérifier Où les tool_call sont Persistés

Rechercher tous les `persist()` calls liés aux tool_call :

```bash
grep -n "await this.persist.*tool" src/agent/grok-agent.ts
```

### Étape 2 : S'Assurer que tool_call n'est PAS Persisté Initialement

Vérifier lignes 661-671 :
```typescript
// ✅ CORRECT: tool_call NOT persisted here
assistantMessage.tool_calls.forEach((toolCall) => {
  const toolCallEntry: ChatEntry = {
    type: "tool_call",
    // ...
  };
  this.chatHistory.push(toolCallEntry);
  newEntries.push(toolCallEntry);
  // ✅ No persist() call here
});
```

### Étape 3 : Vérifier que tool_result EST Persisté

Lignes 694-702 :
```typescript
// ✅ CORRECT: tool_result IS persisted
const updatedEntry: ChatEntry = {
  ...this.chatHistory[entryIndex],
  type: "tool_result",
  // ...
};
this.chatHistory[entryIndex] = updatedEntry;
await this.persist(updatedEntry);  // ✅ This is correct
```

### Étape 4 : Vérifier le Code de Streaming (processUserMessageWithStreaming)

Il y a peut-être un deuxième endroit où les tools sont gérés (streaming mode).

**Fichier** : `src/agent/grok-agent.ts:~1100-1110`

Vérifier si les tool entries sont persistées là aussi.

---

## 🧪 Tests à Effectuer

### Test 1 : Vérifier la DB Après Exécution

```bash
# Envoyer un message qui utilise 2 tools
> Peux-tu lire package.json et src/index.ts ?

# Vérifier la DB
sqlite3 ~/.grok/grokinou.db
SELECT id, type, content, tool_call_id FROM messages ORDER BY id DESC LIMIT 10;
```

**Attendu** : Seulement des `tool_result`, PAS de `tool_call`.

### Test 2 : Vérifier l'Affichage

**Attendu** :
- Chaque tool affiché UNE FOIS
- Chaque réponse LLM affichée UNE FOIS

---

## ❓ Question pour l'Utilisateur

L'utilisateur a mentionné qu'on a "changé l'ordre pour que les tools apparaissent au-dessus de la réponse du LLM".

**Vérifier** : Est-ce que la duplication existait AVANT ce changement ?

Si oui → Le changement d'ordre a peut-être exposé un bug existant (tool_call + tool_result tous les deux persistés).

Si non → Le changement d'ordre a peut-être introduit une deuxième persist() quelque part.

---

## 🔍 Prochaine Étape

1. **Chercher** où else `persist()` est appelé pour les tool entries
2. **Vérifier** le code de streaming (ligne ~1100)
3. **Confirmer** que tool_call n'est pas persisté initialement
4. **Appliquer le fix** si nécessaire

Voulez-vous que je procède à l'investigation complète et applique le fix ?
