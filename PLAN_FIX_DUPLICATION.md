# 🔧 Plan : Fix de la Vraie Duplication

## 🎯 Problème Réel Identifié

### Ce Que J'ai Mal Compris

**Mon fix précédent** :
- J'ai fait en sorte que le viewer se cache après **chaque exécution de tool** (`onExecutionEnd`)
- Problème : Le viewer disparaît entre chaque tool, on ne voit rien !

**Ce que tu veux** :
- Le viewer doit rester visible pendant **toute la série de tools**
- Le viewer ne doit se cacher que quand le **LLM a fini de répondre complètement** (rendu la main)

### Le Vrai Problème

**Ce n'est PAS** : Le viewer qui reste ouvert
**C'est** : La **duplication de la conversation** dans le layout en mode viewer

**Symptôme** :
- En mode split (viewer actif), les `tool_call` et `tool_result` sont affichés dans :
  1. **ExecutionViewer** (à droite) ✅ Normal
  2. **ChatHistory** (à gauche) ❌ Duplication

---

## 🔄 Rollback Nécessaire

### Commit à Rollback

**Commit fbeac83** : "feat: auto-hide viewer when execution completes"
- **Fichier** : `src/ui/components/layout-manager.tsx:122-133`
- **Changement** : Auto-hide immédiat du viewer après chaque tool

**Commande** :
```bash
git revert fbeac83
```

---

## ✅ Solution Proposée

### Option 1 : Ne Pas Afficher tool_call/tool_result en Mode Viewer (Simple)

**Principe** :
- Quand le viewer est actif (`mode = 'split'`), ChatHistory ne doit PAS afficher les tool entries
- Ces entries restent visibles dans ExecutionViewer seulement

**Implémentation** :

**1. Passer le mode du viewer à ChatHistory**
```typescript
// Dans chat-interface.tsx (ou via LayoutManager)
<ChatHistory
  entries={activeMessages}
  viewerActive={mode === 'split'}  // ← Nouveau prop
/>
```

**2. Modifier ChatHistory pour filtrer**
```typescript
// Dans chat-history.tsx:80-82
case "tool_call":
case "tool_result":
  // ✅ Ne pas afficher si le viewer est actif (déjà affiché dans ExecutionViewer)
  if (props.viewerActive) {
    return null;
  }
  // Sinon afficher normalement
  return <Box>...</Box>;
```

**Avantages** :
- ✅ Simple et ciblé
- ✅ Pas de changement de comportement du viewer
- ✅ Pas de timing complexe à gérer
- ✅ L'utilisateur garde le contrôle avec Ctrl+E

---

### Option 2 : Auto-hide Quand LLM Termine Complètement (Complexe)

**Principe** :
- Détecter quand le LLM a fini **TOUTES** les opérations (pas juste un tool)
- Cacher le viewer uniquement à ce moment-là

**Problème** :
- Comment détecter "le LLM a fini toutes les opérations" ?
- `onExecutionEnd()` se déclenche après **chaque tool**
- Il faudrait un event `onAllToolsComplete()` qui n'existe pas

**Difficulté** :
- ❌ Nécessite de tracker l'état global de la réponse LLM
- ❌ Risque de timing bugs
- ❌ Plus complexe à maintenir

---

## 🎯 Recommandation

**Je recommande Option 1** : Ne pas afficher les tool entries dans ChatHistory quand le viewer est actif.

**Pourquoi** :
- Simple et direct
- Résout exactement le problème de duplication
- Pas de side-effects
- L'utilisateur peut toujours cacher le viewer manuellement avec Ctrl+E

---

## 📋 Steps d'Implémentation

### Step 1 : Rollback du Fix Incorrect
```bash
git revert fbeac83
git commit -m "revert: rollback auto-hide viewer on tool completion"
```

### Step 2 : Identifier Comment Passer le Mode
**Problème** : ChatHistory est appelé dans `chat-interface.tsx`, mais le mode viewer est géré par `LayoutManager`

**Solutions** :
1. Passer le mode via un prop de LayoutManager → ChatInterface → ChatHistory
2. Utiliser un context React pour partager le mode
3. Détecter si ExecutionManager a des exécutions actives directement dans ChatHistory

**Option la plus simple** : Utiliser `executionManager.hasActiveExecutions()` directement dans ChatHistory

### Step 3 : Modifier ChatHistory
```typescript
// Dans chat-history.tsx
import { executionManager } from '../../execution/index.js';

// Dans le rendu
case "tool_call":
case "tool_result":
  // Ne pas afficher si le viewer est actif (exécutions en cours)
  if (executionManager.hasActiveExecutions()) {
    return null;
  }
  return <Box>...</Box>;
```

**Problème avec cette approche** : `hasActiveExecutions()` est true pendant l'exécution, mais pas après.
Donc après l'exécution, les tool entries réapparaissent dans ChatHistory.

**Meilleure approche** : Détecter si le viewer est visible (mode = 'split')

---

## 🤔 Question pour Toi

**Veux-tu** :

**A)** Implémenter Option 1 (simple) :
- Ne pas afficher tool entries dans ChatHistory quand le viewer est actif
- Nécessite de passer le mode du LayoutManager à ChatHistory

**B)** Une autre approche :
- Simplement NE JAMAIS afficher tool_call/tool_result dans ChatHistory
- Les afficher uniquement dans le viewer
- Quand viewer est caché, l'utilisateur ne voit pas les détails d'exécution (juste la réponse finale du LLM)

**C)** Garder le comportement actuel et juste rollback le auto-hide

Dis-moi quelle approche tu préfères, et je l'implémente !
