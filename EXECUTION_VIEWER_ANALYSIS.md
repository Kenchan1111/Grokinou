# 🔍 Analyse du Execution Viewer - Problèmes et Solutions

## 🔴 Problèmes Critiques (à corriger immédiatement)

### 1. Dependencies manquantes dans useEffect
**Fichier** : `src/ui/components/execution-viewer.tsx:69`

**Problème** :
```typescript
useEffect(() => {
  const limit = settings?.maxExecutionsShown ?? 10; // Utilise settings
  // ...
}, []); // ❌ settings absent des dependencies
```

**Solution** :
```typescript
useEffect(() => {
  const limit = settings?.maxExecutionsShown ?? 10;
  // ...
}, [settings]); // ✅ Ajouter settings
```

**Impact** : Sans ça, si les settings changent, le viewer ne se met pas à jour.

---

### 2. Limite maxExecutionsShown non respectée dynamiquement
**Fichier** : `src/ui/components/execution-viewer.tsx:50-64`

**Problème** :
```typescript
const unsubscribe = executionManager.subscribeToAll((execution) => {
  setExecutions(prev => {
    // ...
    return [...prev, execution]; // ❌ Pas de limite
  });
});
```

**Solution** :
```typescript
const unsubscribe = executionManager.subscribeToAll((execution) => {
  setExecutions(prev => {
    const limit = settings?.maxExecutionsShown ?? 10;
    let updated: ExecutionState[];

    const index = prev.findIndex(e => e.id === execution.id);
    if (index >= 0) {
      updated = [...prev];
      updated[index] = execution;
    } else {
      updated = [...prev, execution];
    }

    // Limite la taille de la liste (garde les plus récentes)
    if (updated.length > limit) {
      updated = updated.slice(-limit);
    }

    return updated;
  });
});
```

**Impact** : Sans ça, la mémoire peut croître indéfiniment si beaucoup d'exécutions.

---

### 3. selectedIndex peut pointer hors limites
**Fichier** : `src/ui/components/execution-viewer.tsx:107`

**Problème** :
```typescript
const currentExecution = executions[selectedIndex]; // ❌ Peut être undefined
```

**Solution** : Ajouter un effet pour clamper selectedIndex :
```typescript
useEffect(() => {
  if (selectedIndex >= executions.length && executions.length > 0) {
    setSelectedIndex(executions.length - 1);
  }
}, [executions.length, selectedIndex]);
```

**Impact** : Affichage vide si selectedIndex pointe en dehors.

---

## ⚠️ Problèmes Moyens (settings non utilisés)

### 4. showCOT et showCommands non implémentés
**Fichier** : `src/ui/components/execution-viewer.tsx:123-168`

**Problème** : Les sections COT et Commands sont toujours affichées, même si `settings.showCOT = false`.

**Solution** :
```typescript
{/* COT Section - conditionnelle */}
{(settings?.showCOT ?? true) && (
  <Box ...>
    <Text bold color="yellow">🧠 Chain of Thought</Text>
    {/* ... */}
  </Box>
)}

{/* Commands Section - conditionnelle */}
{(settings?.showCommands ?? true) && (
  <Box ...>
    <Text bold color="green">📜 Command Output</Text>
    {/* ... */}
  </Box>
)}
```

**Impact** : L'utilisateur ne peut pas masquer les sections via settings.

---

### 5. colorScheme non utilisé
**Fichier** : `src/ui/components/execution-viewer.tsx:197-210`

**Problème** : Le `colorScheme` existe dans settings mais n'est jamais utilisé.

**Solution** : Implémenter différents thèmes :
```typescript
const getColorScheme = (scheme: 'default' | 'minimal' | 'verbose' = 'default') => {
  switch(scheme) {
    case 'minimal':
      return {
        cot: 'white',
        commands: 'white',
        success: 'green',
        error: 'red',
        // ...
      };
    case 'verbose':
      return {
        cot: 'yellow',
        commands: 'cyan',
        // + plus de couleurs
      };
    default:
      return {
        cot: 'yellow',
        commands: 'green',
        // ...
      };
  }
};
```

**Impact** : Faible - fonctionnalité manquante mais non bloquante.

---

## 🟡 Problèmes Mineurs

### 6. Import inutile
**Fichier** : `src/ui/components/execution-viewer.tsx:12`

```typescript
import { useCallback } from 'react'; // ❌ Jamais utilisé
```

**Solution** : Supprimer l'import.

---

## 📊 Améliorations Architecturales Suggérées

### 1. Séparation des responsabilités
**Problème** : Le composant fait trop de choses (gestion d'état + affichage).

**Solution** : Créer un hook custom :
```typescript
function useExecutionViewer(settings?: Partial<ExecutionViewerSettings>) {
  const [executions, setExecutions] = useState<ExecutionState[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Toute la logique ici

  return {
    executions,
    selectedIndex,
    setSelectedIndex,
    currentExecution,
  };
}
```

### 2. Memoization manquante
**Problème** : Les composants enfants re-render à chaque mise à jour.

**Solution** : Utiliser `React.memo` et `useMemo` :
```typescript
const MemoizedCOTEntry = React.memo(COTEntryDisplay);
const MemoizedCommand = React.memo(CommandDisplay);
```

### 3. Gestion des erreurs absente
**Problème** : Pas de gestion d'erreur si executionManager.subscribeToAll() échoue.

**Solution** :
```typescript
useEffect(() => {
  try {
    const unsubscribe = executionManager.subscribeToAll(...);
    return () => unsubscribe();
  } catch (error) {
    console.error('Failed to subscribe to executions:', error);
  }
}, [settings]);
```

---

## 🎯 Plan de Correction Prioritaire

### Phase 1 - Corrections Critiques (URGENT)
1. ✅ Ajouter `settings` aux dependencies du useEffect
2. ✅ Implémenter la limite dynamique dans subscribe
3. ✅ Ajouter effet pour clamper selectedIndex
4. ✅ Supprimer import useCallback inutilisé

### Phase 2 - Implémentation Settings (MOYEN)
5. ⚡ Implémenter `showCOT` et `showCommands`
6. ⚡ Implémenter `colorScheme` (optionnel)

### Phase 3 - Optimisations (OPTIONNEL)
7. 🔧 Extraire hook useExecutionViewer
8. 🔧 Ajouter memoization
9. 🔧 Améliorer gestion d'erreurs

---

## 🚀 Code Corrigé (Phase 1)

Voici le code corrigé pour les problèmes critiques :

```typescript
export const ExecutionViewer: React.FC<ExecutionViewerProps> = ({ mode = 'split', settings }) => {
  const [executions, setExecutions] = useState<ExecutionState[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsMode, setDetailsMode] = useState(settings?.detailsMode ?? false);
  const [autoScroll, setAutoScroll] = useState(true);

  /**
   * Subscribe to execution manager updates
   */
  useEffect(() => {
    const limit = settings?.maxExecutionsShown ?? 10;

    // Initial load - get active executions
    const active = executionManager.getActiveExecutions();
    if (active.length > 0) {
      setExecutions(active.slice(-limit));
    }

    // Subscribe to updates
    const unsubscribe = executionManager.subscribeToAll((execution) => {
      setExecutions(prev => {
        const index = prev.findIndex(e => e.id === execution.id);
        let updated: ExecutionState[];

        if (index >= 0) {
          // Update existing execution
          updated = [...prev];
          updated[index] = execution;
        } else {
          // Add new execution
          updated = [...prev, execution];
        }

        // Apply limit (keep most recent)
        if (updated.length > limit) {
          updated = updated.slice(-limit);
        }

        return updated;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [settings]); // ✅ Fixed: added settings dependency

  /**
   * Clamp selectedIndex when executions list changes
   */
  useEffect(() => {
    if (selectedIndex >= executions.length && executions.length > 0) {
      setSelectedIndex(executions.length - 1);
    }
  }, [executions.length, selectedIndex]); // ✅ New: clamp selection

  // ... rest of the code
};
```

---

## 📝 Tests Recommandés

Après corrections, tester :

1. ✅ Changement de `maxExecutionsShown` → doit limiter la liste
2. ✅ Navigation avec ↑↓ après suppression d'executions
3. ✅ Ajout de 100+ exécutions → mémoire stable
4. ✅ Toggle `showCOT` et `showCommands` → sections masquées/affichées
5. ✅ Changement de `colorScheme` → couleurs mises à jour

---

## 📚 Documentation Manquante

Le viewer devrait avoir :
- 📖 README.md expliquant les settings disponibles
- 📖 Exemples de configuration
- 📖 Guide des raccourcis clavier
- 📖 Architecture du système d'exécution

---

## Conclusion

**État actuel** : ⚠️ Fonctionnel mais avec bugs potentiels

**Après Phase 1** : ✅ Stable et fiable

**Après Phase 2** : ⭐ Complètement configurable

**Après Phase 3** : 🚀 Optimisé et maintenable
