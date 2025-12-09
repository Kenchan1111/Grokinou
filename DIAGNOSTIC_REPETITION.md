# 🐛 Diagnostic : Répétition de "Using tools to help you..."

## 🔍 Symptôme Observé

```
⏺ Using tools to help you...Using tools to help you...Using tools to help you...Using tools to help you...
```

**Observation Clé** :
- Le symbole `⏺` n'apparaît QU'UNE FOIS
- Le texte "Using tools to help you..." est répété SANS line breaks
- C'est le MÊME composant qui affiche le texte concaténé

## 📊 Analyse de DeepSeek

DeepSeek a identifié :
1. **Double rendering** : StreamingDisplay + ChatHistory
2. **Architecture multi-niveaux** : Composants imbriqués
3. **Pas de mémoization optimale**

**Verdict DeepSeek** : Le contenu apparaît à la fois dans StreamingDisplay (streaming) et ChatHistory (archivé).

## 🎯 Mon Analyse Complète

### Problème #1 : Content Streaming vs Assistant Entry

**Dans `grok-agent.ts:1024,1053`** :
```typescript
// Stream content as it comes
if (chunk.choices[0].delta?.content) {
  const deltaText = chunk.choices[0].delta.content;
  bufferedContent += deltaText;
  // ...
  yield { type: "content", content: bufferedContent };  // ✅ Stream delta content
}

// PUIS, après le stream:
const assistantEntry: ChatEntry = {
  type: "assistant",
  content: accumulatedMessage.content || "Using tools to help you...",  // ❌ Placeholder
  // ...
};
```

**Problème** : Si `accumulatedMessage.content` est vide (pas de texte streamé), on met "Using tools to help you..." comme content de l'entry.

### Problème #2 : Assistant Entry avec toolCalls est Affiché

**Après notre changement d'ordre** :
1. Tool results (affichés)
2. **Assistant entry "Using tools to help you..." (affiché !)**
3. Final response (affichée)

**Fichier** : `chat-history.tsx:62-79`
```typescript
case "assistant":
  return (
    <Box>
      <Text color="white">⏺ </Text>
      <Box>
        {entry.toolCalls ? (
          <Text color="white">{entry.content.trim()}</Text>  // ✅ Affiché
        ) : (
          <MarkdownRenderer content={entry.content.trim()} />
        )}
      </Box>
    </Box>
  );
```

**Résultat** : L'assistant entry avec toolCalls EST affiché avec son content "Using tools to help you...".

### Problème #3 : Possible Re-renders Multiples

**Si le composant re-render plusieurs fois** avec le même `streamingContent`, il pourrait afficher le texte concaténé.

**Fichier** : `chat-interface.tsx:81-88`
```typescript
}, (prevProps, nextProps) => {
  // Memoization pour éviter re-renders
  return (
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.streamingContent === nextProps.streamingContent &&
    // ...
  );
});
```

**Théorie** : Si `streamingContent` change légèrement à chaque fois (espaces, etc.), la mémoization échoue et le composant re-render, affichant le texte à nouveau.

---

## 🧪 Hypothèses à Tester

### Hypothèse A : StreamingDisplay + ChatHistory Overlap

**Test** :
- StreamingDisplay affiche pendant le streaming
- Quand le streaming se termine, l'entry est ajoutée à ChatHistory
- **Les deux** affichent le même contenu simultanément

**Vérification** :
```typescript
// Ajouter un log dans chat-interface.tsx
console.log('StreamingDisplay rendering:', { isStreaming, streamingContent });
console.log('ChatHistory entries count:', chatHistory.length);
```

### Hypothèse B : Assistant Entry avec toolCalls Affiché à Tort

**Test** :
- L'assistant entry "Using tools to help you..." est dans chatHistory
- Il est affiché par ChatHistory même s'il ne devrait pas

**Vérification** :
```typescript
// Dans chat-history.tsx:62
case "assistant":
  console.log('Rendering assistant:', { content: entry.content, hasToolCalls: !!entry.toolCalls });

  // Skip entries with toolCalls?
  if (entry.toolCalls && entry.toolCalls.length > 0) {
    console.log('Skipping assistant with toolCalls');
    return null;  // ✅ Ne pas afficher
  }
```

### Hypothèse C : Content Streamé Multiple Fois

**Test** :
- Le LLM envoie "Using tools to help you..." plusieurs fois dans le stream
- Chaque chunk est concaténé

**Vérification** :
```typescript
// Dans chat-interface.tsx:415
setStreamingContent((prev) => {
  console.log('Appending to streaming:', { prev, appendText });
  return prev + appendText;
});
```

---

## ✅ Solution Immédiate (Consensus avec DeepSeek)

### Fix #1 : Éviter l'Affichage de l'Assistant Entry avec toolCalls

**Fichier** : `src/ui/components/chat-history.tsx:62-79`

```typescript
case "assistant":
  // ✅ Ne pas afficher les assistant entries avec toolCalls
  // (Ce sont des messages internes de protocole)
  if (entry.toolCalls && entry.toolCalls.length > 0) {
    return null;
  }

  return (
    <Box key={index} flexDirection="column">
      <Box flexDirection="row" alignItems="flex-start">
        <Text color="white">⏺ </Text>
        <Box flexDirection="column" flexGrow={1}>
          <MarkdownRenderer content={entry.content.trim()} />
          {entry.isStreaming && <Text color="cyan">█</Text>}
        </Box>
      </Box>
    </Box>
  );
```

**Impact** : Élimine l'affichage de "Using tools to help you..." qui n'est qu'un placeholder.

---

### Fix #2 : Éviter Overlap StreamingDisplay + ChatHistory (DeepSeek)

**Fichier** : `src/ui/components/chat-interface.tsx`

```typescript
// Avant le render de StreamingDisplay
const lastEntryIsStreaming = chatHistory.length > 0 &&
  chatHistory[chatHistory.length - 1].type === 'assistant' &&
  chatHistory[chatHistory.length - 1].isStreaming;

const shouldShowStreaming = isStreaming && !lastEntryIsStreaming;

// Dans le JSX:
{shouldShowStreaming && (
  <StreamingDisplay
    isStreaming={isStreaming}
    streamingContent={streamingContent}
    // ...
  />
)}
```

**Impact** : Évite d'afficher le même contenu dans StreamingDisplay ET ChatHistory.

---

### Fix #3 : Améliorer le Placeholder Content

**Fichier** : `src/agent/grok-agent.ts:676, 1061`

```typescript
// Au lieu de :
content: assistantMessage.content || "Using tools to help you...",

// Utiliser :
content: assistantMessage.content || "",  // ✅ Empty string au lieu d'un placeholder
```

**Impact** : Si pas de content, ne rien afficher au lieu d'un placeholder.

---

## 🎯 Plan d'Action Recommandé

### Étape 1 : Fix Immédiat (5 min)
1. **Cacher assistant entries avec toolCalls** (Fix #1)
2. **Empty string au lieu de placeholder** (Fix #3)

### Étape 2 : Fix StreamingDisplay Overlap (15 min)
1. **Implémenter logique de DeepSeek** (Fix #2)
2. **Tester avec plusieurs messages**

### Étape 3 : Vérification (10 min)
1. **Logs de debug** pour confirmer
2. **Test avec tools multiples**
3. **Vérifier pas de régression**

---

## 🧪 Tests à Effectuer

### Test 1 : Message avec Tools
```
Input: "Peux-tu lire package.json et src/index.ts ?"

Attendu:
🔧 Read(package.json)
  [contenu]
🔧 Read(src/index.ts)
  [contenu]
⏺ Voici l'analyse des fichiers...

Pas attendu:
⏺ Using tools to help you...Using tools to help you...
```

### Test 2 : Message sans Tools
```
Input: "Explique-moi React"

Attendu:
⏺ React est une bibliothèque JavaScript...

Pas de duplication
```

### Test 3 : Multiple Messages
```
Input 1: "Analyse le code"
Input 2: "Résume les findings"

Attendu: Chaque réponse affichée UNE fois
```

---

## 📊 Verdict Final

**Cause Principale** : L'assistant entry avec `toolCalls` qui contient "Using tools to help you..." est affiché après notre changement d'ordre.

**Cause Secondaire** : Possible overlap entre StreamingDisplay et ChatHistory (diagnostic DeepSeek).

**Solution** : Combiner Fix #1 (cacher entries avec toolCalls) + Fix #3 (empty string).

**Priorité** : 🔴 CRITIQUE (affecte l'UX directement)

---

Voulez-vous que j'implémente les Fixes #1 et #3 immédiatement ?
