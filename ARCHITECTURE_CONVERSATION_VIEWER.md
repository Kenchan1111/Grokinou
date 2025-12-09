# 🏗️ Architecture : Conversation + Viewer

## 📊 Structure de l'Affichage

### ChatViewContent (Conversation Panel)

**Fichier** : `src/ui/components/chat-interface.tsx:576-622`

```typescript
const chatViewContent = (
  <Box>
    {/* 1. HISTORIQUE STATIQUE : Messages terminés et persistés */}
    <Static items={committedHistory}>
      {(entry) => <MemoizedArchived entry={entry} />}
    </Static>

    {/* 2. MESSAGES ACTIFS : Messages en cours de création */}
    <ChatHistory entries={activeMessages} />

    {/* 3. STREAMING : Contenu streamé en temps réel */}
    <StreamingDisplay
      isStreaming={isStreaming}
      streamingContent={streamingContent}
      streamingTools={streamingTools}
      streamingToolResults={streamingToolResults}
    />
  </Box>
);
```

**Types d'entries affichées** :
- `type: "user"` - Messages utilisateur
- `type: "assistant"` - Réponses LLM
- `type: "tool_call"` - Appels de tools (Read, Bash, etc.)
- `type: "tool_result"` - Résultats des tools

---

## 🔄 Flux des Messages

### 1. Calcul de activeMessages

**Fichier** : `chat-interface.tsx:363-377`

```typescript
useEffect(() => {
  if (isCommittingRef.current) return;

  // Messages actifs = tous les messages qui ne sont PAS encore dans committedHistory
  const activeCount = chatHistory.length - committedHistory.length;
  if (activeCount > 0) {
    const active = chatHistory.slice(-activeCount);
    setActiveMessages(active);  // ← Ces messages sont affichés par ChatHistory
  } else {
    setActiveMessages([]);
  }
}, [chatHistory, committedHistory]);
```

**Logique** :
- `activeMessages` = derniers messages de `chatHistory` qui ne sont pas encore dans `committedHistory`
- Ces messages sont affichés dans la section "MESSAGES ACTIFS"

---

### 2. Commit Automatique

**Fichier** : `chat-interface.tsx:384-402`

```typescript
useEffect(() => {
  // Si on n'est pas en train de streamer/processing et qu'il y a des messages actifs
  if (!isStreaming && !isProcessing && activeMessages.length > 0 && !isSwitchingRef.current && !isCommittingRef.current) {
    isCommittingRef.current = true;

    // ✅ Commit tous les messages actifs dans l'historique statique
    setCommittedHistory(prev => [...prev, ...activeMessages]);
    setActiveMessages([]);

    setTimeout(() => {
      isCommittingRef.current = false;
    }, 0);
  }
}, [isStreaming, isProcessing, activeMessages]);
```

**Logique** :
- Quand streaming/processing se termine
- Tous les `activeMessages` sont transférés vers `committedHistory`
- `activeMessages` est vidé
- `committedHistory` affiche maintenant ces messages dans la section STATIQUE

---

## 🔍 Le Problème Identifié

### Symptôme

**En mode viewer (split)** :
1. Exécution en cours → Affichée dans le viewer ✅
2. Exécution se termine → Reste dans le viewer (historique) ✅
3. **MAIS** : Le contenu du viewer apparaît AUSSI dans la conversation comme une "vue figée" ❌

### Hypothèse

Les **tool_call** et **tool_result** entries sont :
1. Ajoutées à `chatHistory` par l'agent
2. Affichées dans `activeMessages` (section MESSAGES ACTIFS)
3. Puis transférées à `committedHistory` (section HISTORIQUE STATIQUE)

**Résultat** : Les tools sont affichés dans **DEUX endroits** :
- Dans le **Viewer** (ExecutionViewer) ✅ (voulu)
- Dans la **Conversation** (ChatHistory) ❌ (problème)

---

## 🎯 Questions Clés

### Question 1 : Les Tool Entries Devraient-Elles Être dans chatHistory ?

**Actuellement** :
- Les `tool_call` et `tool_result` sont ajoutées à `chatHistory`
- Elles sont donc affichées dans la conversation

**Options** :
1. **Option A** : Les garder dans `chatHistory` mais ne PAS les afficher en mode viewer
2. **Option B** : Ne PAS les ajouter à `chatHistory` en mode viewer (seulement dans le viewer)

---

### Question 2 : Où les Tool Entries Sont-Elles Ajoutées ?

**Dans l'agent** : `src/agent/grok-agent.ts`

Quand un tool est exécuté, l'agent crée des entries de type `tool_call` et `tool_result` et les ajoute à `this.chatHistory`.

**Exemple** (lignes approximatives ~654-702) :
```typescript
// Create tool_call entries
assistantMessage.tool_calls.forEach((toolCall) => {
  const toolCallEntry: ChatEntry = {
    type: "tool_call",
    content: "Executing...",
    timestamp: new Date(),
    toolCall: toolCall,
  };
  this.chatHistory.push(toolCallEntry);  // ← Ajouté à chatHistory
  newEntries.push(toolCallEntry);
});

// Execute tools
for (const toolCall of assistantMessage.tool_calls) {
  const result = await this.executeTool(toolCall);

  // Update to tool_result
  const updatedEntry: ChatEntry = {
    type: "tool_result",
    content: this.formatToolResultSummary(toolCall, result),
    toolResult: result,
  };
  this.chatHistory[entryIndex] = updatedEntry;  // ← Mis à jour dans chatHistory
  await this.persist(updatedEntry);
}
```

**Ces entries** sont ensuite :
1. Retournées à `chat-interface.tsx`
2. Ajoutées à `chatHistory` du composant
3. Affichées dans `activeMessages` → `ChatHistory`
4. Puis transférées à `committedHistory` → `Static`

---

## 🎯 Solutions Possibles

### Solution A : Filtrer l'Affichage en Mode Viewer

**Idée** : Quand le viewer est actif, ne PAS afficher les `tool_call` et `tool_result` dans ChatHistory.

**Modification** : Dans `chat-history.tsx`, ajouter une condition :
```typescript
case "tool_call":
case "tool_result":
  // ✅ Si le viewer est actif, ne pas afficher (déjà dans le viewer)
  if (viewerIsActive) {
    return null;
  }
  // Sinon afficher normalement
  return <Box>...</Box>;
```

**Problème** : Comment savoir si le viewer est actif depuis ChatHistory ?

---

### Solution B : Ne Pas Ajouter à chatHistory en Mode Viewer

**Idée** : Quand le viewer est actif, les tool entries vont uniquement dans le `ExecutionManager`, pas dans `chatHistory`.

**Modification** : Dans l'agent, détecter si le viewer est actif et ne pas ajouter les tools à `chatHistory`.

**Problème** :
- Plus complexe
- L'agent ne sait pas si le viewer est actif
- Risque de perdre l'historique des tools

---

### Solution C : Utiliser un Flag "viewerMode" dans les Entries

**Idée** : Marquer les entries qui viennent du viewer avec un flag.

**Modification** :
```typescript
const toolCallEntry: ChatEntry = {
  type: "tool_call",
  content: "Executing...",
  timestamp: new Date(),
  toolCall: toolCall,
  fromViewer: true,  // ✅ Flag indiquant que c'est pour le viewer
};
```

Puis dans ChatHistory :
```typescript
case "tool_call":
case "tool_result":
  // Ne pas afficher si c'est du viewer (déjà affiché dans ExecutionViewer)
  if (entry.fromViewer) {
    return null;
  }
  return <Box>...</Box>;
```

**Avantage** : Simple et ciblé

---

## 🎯 Recommandation

Je pense que le problème vient du fait que les **tool_call** et **tool_result** entries sont affichées dans **DEUX endroits** :

1. **ExecutionViewer** (via ExecutionManager)
2. **ChatHistory** (via chatHistory state)

**Solution recommandée** : **Solution C** avec un flag

**Pourquoi** :
- Simple : Un seul flag à ajouter
- Sûr : Ne change pas la logique existante
- Maintenable : Facile à comprendre
- Flexible : Peut être étendu si besoin

---

## ❓ Pour Toi

Peux-tu confirmer :

1. **Est-ce bien les tool_call/tool_result qui apparaissent en double ?**
   - Ou est-ce autre chose ?

2. **Préfères-tu** :
   - Solution A : Filtrer à l'affichage (besoin de savoir si viewer actif)
   - Solution B : Ne pas ajouter à chatHistory (plus invasif)
   - Solution C : Utiliser un flag dans les entries (recommandé)

3. **Veux-tu garder l'historique des tools dans la conversation quand le viewer est désactivé ?**
   - Si oui → Solution C
   - Si non → On peut cacher complètement les tool entries

Dis-moi ce que tu en penses et je pourrai implémenter la solution ! 🎯
