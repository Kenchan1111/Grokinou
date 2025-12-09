# 🐛 Diagnostic : Deux Problèmes Identifiés

## Problème #1 : Message Hardcodé au Premier Message

### 🔍 Symptôme
Quelque soit la première question posée, l'utilisateur reçoit toujours :
```
⏺ Bonjour ! Vous échangez avec deepseek-coder (DeepSeek), votre assistant IA pour ce projet.
```

### 📊 Cause Racine

**Fichier** : `src/agent/grok-agent.ts:895-937`

Il y a un **court-circuit** qui intercepte les messages simples (salutations ou questions d'identité) et retourne une réponse hardcodée AVANT de faire l'appel LLM :

```typescript
// Lignes 895-898 : Détection des salutations
const normalized = trimmed.toLowerCase();
const isSimpleGreetingOrIdentity =
  (normalized === "hi" ||
    normalized === "hello" ||
    normalized.startsWith("bonjour") ||
    normalized.startsWith("salut") ||
    normalized.includes("who am i talking to") ||
    normalized.includes("who am i speaking to"));

// Lignes 900-936 : Si détecté, retourner réponse hardcodée
if (isSimpleGreetingOrIdentity) {
  const modelName = this.grokClient.getCurrentModel();
  const provider = providerManager.detectProvider(modelName) || "grok";
  const providerLabel = /* ... mapping ... */;

  const identityText = `Bonjour ! Vous échangez avec ${modelName} (${providerLabel}), votre assistant IA pour ce projet.`;

  // Add to history
  const assistantEntry: ChatEntry = { /* ... */ };
  this.chatHistory.push(assistantEntry);
  await this.persist(assistantEntry);

  // Return without calling LLM
  yield { type: "content", content: "\n\n" + identityText };
  yield { type: "done" };
  return;  // ❌ Pas d'appel LLM !
}
```

### ❌ Problème
Cette logique a **deux défauts majeurs** :

1. **Trop aggressive** : Intercepte TOUTES les phrases qui commencent par "bonjour" ou "salut", même si la question est complexe
   - Exemple : "Bonjour, peux-tu lire package.json ?" → hardcodé au lieu d'appeler le LLM

2. **Pas nécessaire** : L'identity check au `/model switch` est déjà implémenté et fonctionne correctement

### ✅ Solution
**Supprimer complètement** ce court-circuit (lignes 895-937).

**Raison** :
- L'identity check officiel est déjà en place lors du switch de modèle
- Le LLM peut répondre naturellement aux salutations
- Plus besoin de hardcoder les réponses

---

## Problème #2 : Duplication en Mode Viewer

### 🔍 Symptôme
Quand le mode viewer (Ctrl+E) est activé :
- Les messages apparaissent **deux fois**
- Une fois dans l'interface conversation focus (panel gauche)
- Une autre fois dans la conversation normale (?)

Quand on sort du mode viewer (Ctrl+E), la duplication disparaît.

### 📊 Architecture du Viewer

**Fichier** : `src/ui/components/chat-interface.tsx:720-734`

Le `LayoutManager` enveloppe le `chatViewContent` dans un split view :

```typescript
if (executionViewerSettings.enabled) {
  return (
    <LayoutManager
      conversation={chatViewContent}          // ← Panel gauche : conversation
      executionViewer={<ExecutionViewer />}   // ← Panel droit : viewer
      config={{ /* ... */ }}
    />
  );
}
```

**Fichier** : `src/ui/components/layout-manager.tsx:288-324`

Le LayoutManager en mode split affiche :
- **Panel gauche** (60%) : `conversation` (le chatViewContent)
- **Panel droit** (40%) : `executionViewer`

### 📊 Structure du chatViewContent

**Fichier** : `src/ui/components/chat-interface.tsx:559-605`

```typescript
const chatViewContent = (
  <Box flexDirection="column">
    {/* HISTORIQUE STATIQUE : Tous les messages TERMINÉS (committed) */}
    <Static items={committedHistory}>
      {(entry) => <MemoizedArchived entry={entry} />}
    </Static>

    {/* MESSAGES ACTIFS : En cours de création/affichage */}
    <ChatHistory entries={activeMessages} />

    {/* STREAMING EN COURS : Message de Grok en train d'être écrit */}
    <StreamingDisplay
      isStreaming={isStreaming}
      streamingContent={streamingContent}
      streamingTools={streamingTools}
      streamingToolResults={streamingToolResults}
    />
  </Box>
);
```

### 🤔 Hypothèses pour la Duplication

#### Hypothèse A : Messages dans committedHistory ET activeMessages
Si un message est présent à la fois dans `committedHistory` (Static) et `activeMessages` (ChatHistory), il sera affiché deux fois.

**Vérification nécessaire** :
- Vérifier le flux : quand un message passe de `activeMessages` → `committedHistory`
- S'assurer qu'il n'est jamais dans les deux en même temps

#### Hypothèse B : Le ExecutionViewer affiche aussi les messages
Le `ExecutionViewer` pourrait afficher les messages de conversation en plus des executions.

**Vérification** : `src/ui/components/execution-viewer.tsx:126-203`

```typescript
export const ExecutionViewer: React.FC = () => {
  return (
    <Box flexDirection="column">
      {/* COT Section */}
      <Box>
        <Text>🧠 Chain of Thought</Text>
        {currentExecution.cot.map(entry => <COTEntryDisplay />)}
      </Box>

      {/* Commands Section */}
      <Box>
        <Text>📜 Command Output</Text>
        {currentExecution.commands.map(cmd => <CommandDisplay />)}
      </Box>
    </Box>
  );
};
```

**Verdict** : Le ExecutionViewer n'affiche QUE les COT et commands, PAS les messages de conversation.

#### Hypothèse C : Duplication dans le rendu de chatViewContent
Le `chatViewContent` pourrait être rendu deux fois quelque part.

**Vérification nécessaire** :
- Vérifier si le LayoutManager crée une copie du conversation prop
- Vérifier s'il y a un useEffect qui re-render le chatViewContent

### 🔍 Investigation Nécessaire

Pour diagnostiquer précisément, il faudrait :

1. **Ajouter des logs** dans chat-interface.tsx pour tracer :
   ```typescript
   console.log('committedHistory length:', committedHistory.length);
   console.log('activeMessages length:', activeMessages.length);
   console.log('Last committedHistory entry:', committedHistory[committedHistory.length - 1]);
   console.log('Last activeMessages entry:', activeMessages[activeMessages.length - 1]);
   ```

2. **Vérifier le timestamp** : Si les deux entrées dupliquées ont le même timestamp, c'est le même message affiché deux fois

3. **Tester sans LayoutManager** : Désactiver temporairement le viewer pour confirmer que c'est bien la cause

### ✅ Solution Potentielle

Si l'hypothèse A est correcte (message dans les deux listes), il faut s'assurer que :

**Fichier** : Probablement dans `input-controller.tsx` ou la gestion du flux de messages

```typescript
// Quand un message se termine :
1. Retirer le message de activeMessages
2. Ajouter le message à committedHistory
3. S'assurer qu'il n'est JAMAIS dans les deux en même temps
```

---

## 🎯 Plan d'Action

### Étape 1 : Fix Immédiat - Supprimer Message Hardcodé (5 min)
1. Supprimer complètement les lignes 895-937 dans grok-agent.ts
2. Le LLM répondra naturellement aux salutations

### Étape 2 : Investigation Duplication (15 min)
1. Ajouter des logs pour tracer committedHistory et activeMessages
2. Activer le viewer et observer les logs
3. Identifier précisément où se produit la duplication

### Étape 3 : Fix Duplication (variable)
Selon la cause identifiée :
- Si messages dans les deux listes → Fix le flux de gestion des messages
- Si problème de rendu → Fix le LayoutManager ou chatViewContent

---

## ❓ Questions pour l'Utilisateur

1. **Duplication précise** : Les messages dupliqués sont-ils EXACTEMENT identiques (même contenu, même timestamp) ?

2. **Tous les messages** : Est-ce que TOUS les messages sont dupliqués, ou seulement certains ?

3. **Quand apparaît la duplication** :
   - Immédiatement quand on active le viewer ?
   - Ou seulement après avoir envoyé un nouveau message ?

Ces informations aideront à affiner le diagnostic.
