# 🎯 Plan de Fix - Duplication

## 🔍 Hypothèse du Problème

Après avoir changé l'ordre (tools avant assistant message), on a maintenant:

**Dans chatHistory** :
1. tool_result (Read file1)
2. tool_result (Read file2)
3. **assistant "Using tools to help you..." (avec toolCalls)**  ← Affiché ?
4. assistant "Voici mon analyse..." ← Affiché

## ❓ Question Clé

L'assistant entry avec `toolCalls` (qui dit "Using tools to help you...") devrait-il être affiché **du tout** ?

### Actuellement
Il EST affiché (ligne 68-70 dans chat-history.tsx) comme plain text.

### Options

#### Option A : Cacher complètement l'assistant entry avec toolCalls
**Raison** : C'est un message technique/interne, pas vraiment utile pour l'utilisateur.

**Changement** : Dans chat-history.tsx, skip les assistant entries qui ont toolCalls:

```typescript
case "assistant":
  // ✅ Skip assistant entries that have toolCalls (internal protocol)
  if (entry.toolCalls && entry.toolCalls.length > 0) {
    return null;
  }

  return (
    <Box key={index} flexDirection="column">
      // ... render assistant message
    </Box>
  );
```

#### Option B : Garder mais améliorer le message
**Changement** : Changer le contenu pour être plus clair.

**Fichier** : grok-agent.ts:676
```typescript
content: "" // ✅ Empty content, don't show anything
// OR
content: "🔧 Executing tools..." // ✅ More specific message
```

## 💡 Recommandation

**Option A** : Cacher complètement les assistant entries avec toolCalls.

**Raison** :
- L'utilisateur voit déjà les tools s'exécuter
- Le message "Using tools to help you..." n'apporte rien
- Plus clean : tools → résultat final

**Résultat attendu** :
```
> Peux-tu lire ces fichiers ?

🔧 Read(package.json)
  [contenu]

🔧 Read(src/index.ts)
  [contenu]

⏺ Voici l'analyse des fichiers...
  [réponse détaillée]
```

PAS :
```
> Peux-tu lire ces fichiers ?

🔧 Read(package.json)
  [contenu]

🔧 Read(src/index.ts)
  [contenu]

⏺ Using tools to help you...   ← ❌ Inutile

⏺ Voici l'analyse des fichiers...
  [réponse détaillée]
```
