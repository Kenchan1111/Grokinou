# 🔍 Analyse de chat-interface.tsx et layout-manager.tsx

## 📊 Vue d'Ensemble

### ✅ Points Positifs
- ✅ Bonne utilisation de `useCallback` pour stabiliser les setters
- ✅ Debouncing implémenté pour le streaming (évite le lag de l'input)
- ✅ React.memo correctement utilisé pour `StreamingDisplay`
- ✅ Séparation de `committedHistory` et `activeMessages` (optimisation)
- ✅ Gestion propre de la mémoire avec cleanup des timers

### ⚠️ Problèmes Détectés

---

## 🔴 chat-interface.tsx

### 1. useMemo sans dependencies (ligne 673-686)
**Fichier** : `src/ui/components/chat-interface.tsx:673`

**Problème** :
```typescript
const executionViewerSettings = useMemo(() => {
  try {
    const manager = getSettingsManager();
    return manager.getExecutionViewerSettings();
  } catch {
    return { /* defaults */ };
  }
}, []); // ❌ Pas de dependencies - settings jamais mis à jour
```

**Impact** : Si les settings changent pendant l'exécution, le viewer ne se met pas à jour.

**Solution** :
```typescript
// Option 1 : Retirer useMemo si les settings ne changent pas souvent
const executionViewerSettings = (() => {
  try {
    const manager = getSettingsManager();
    return manager.getExecutionViewerSettings();
  } catch {
    return { /* defaults */ };
  }
})();

// Option 2 : Ajouter un state pour réagir aux changements
const [executionViewerSettings, setExecutionViewerSettings] = useState(() => {
  try {
    const manager = getSettingsManager();
    return manager.getExecutionViewerSettings();
  } catch {
    return { /* defaults */ };
  }
});
```

**Recommandation** : Option 1 (simple) si settings ne changent jamais pendant l'exécution.

---

### 2. useMemo complexe avec beaucoup de dependencies (ligne 689-749)
**Fichier** : `src/ui/components/chat-interface.tsx:689`

**Problème** :
```typescript
const finalContent = useMemo(() => {
  // ... 60 lignes de logique complexe ...
}, [
  searchMode,
  searchFullscreen,
  searchQuery,
  searchResults,
  handleCloseSearch, // ❌ fonction - peut changer à chaque render
  handlePasteToInput, // ❌ fonction - peut changer à chaque render
  handleToggleFullscreen, // ❌ fonction - peut changer à chaque render
  chatViewContent, // ❌ JSX - change à chaque render
  executionViewerSettings,
]); // ❌ Trop de dependencies, memoization peu efficace
```

**Impact** :
- Le `useMemo` est probablement inutile car il re-calcule presque à chaque render
- Les fonctions dans les dependencies cassent la memoization

**Solution** :
```typescript
// Stabiliser les fonctions avec useCallback
const handleCloseSearch = useCallback(() => {
  setSearchMode(false);
  setSearchQuery('');
  setSearchResults([]);
  setSearchFullscreen(false);
}, []); // ✅ Déjà fait ligne 251, c'est OK

const handleToggleFullscreen = useCallback(() => {
  setSearchFullscreen(prev => !prev);
}, []); // ✅ Déjà fait ligne 259, c'est OK

const handlePasteToInput = useCallback((text: string) => {
  if (inputInjectionRef.current) {
    inputInjectionRef.current(text);
  }
}, []); // ✅ Déjà fait ligne 264, c'est OK

// Mais chatViewContent change à chaque render car c'est du JSX
// Solution : Extraire en composant memoized
const ChatView = React.memo(() => chatViewContent);

// Puis utiliser <ChatView /> au lieu de chatViewContent
```

**Recommandation** :
- ✅ Les fonctions sont déjà stabilisées avec useCallback
- ⚠️ `chatViewContent` est le vrai problème (JSX qui change)
- 💡 **Verdict** : Le useMemo actuel est probablement OK car les fonctions sont stables

**Sévérité** : 🟡 Faible (optimisation possible mais pas nécessaire)

---

### 3. useEffect avec isSwitchingRef (ligne 377-385)
**Fichier** : `src/ui/components/chat-interface.tsx:377`

**Problème** :
```typescript
useEffect(() => {
  if (!isStreaming && !isProcessing && activeMessages.length > 0 && !isSwitchingRef.current) {
    setCommittedHistory(prev => [...prev, ...activeMessages]);
    setActiveMessages([]);
  }
}, [isStreaming, isProcessing, activeMessages]);
// ❌ isSwitchingRef pas dans dependencies (mais c'est un ref, donc OK)
```

**Impact** : Aucun - les refs ne doivent PAS être dans les dependencies.

**Verdict** : ✅ **Correct** - c'est l'utilisation normale d'un ref.

---

### 4. Potentielle race condition dans debouncing (ligne 166-225)
**Fichier** : `src/ui/components/chat-interface.tsx:166`

**Problème** :
```typescript
const stableStreamingContentSetter = useCallback((value: string | ((prev: string) => string)) => {
  if (typeof value === 'function') {
    setStreamingContent(value); // ✅ Applique immédiatement
  } else {
    // Debounce
    pendingStreamingUpdate.current.content = value;
    if (streamingUpdateRef.current) {
      clearTimeout(streamingUpdateRef.current);
    }
    streamingUpdateRef.current = setTimeout(() => {
      if (pendingStreamingUpdate.current.content !== undefined) {
        setStreamingContent(pendingStreamingUpdate.current.content);
        pendingStreamingUpdate.current.content = undefined;
      }
    }, 100); // ❌ Si plusieurs updates rapides, seule la dernière est appliquée
  }
}, []);
```

**Impact** : Pendant le streaming rapide, certains chunks de texte peuvent être "sautés".

**Verdict** : 🟡 **Acceptable** - C'est le but du debouncing (éviter trop d'updates). Mais on perd potentiellement du texte.

**Solution alternative** : Utiliser un buffer qui accumule au lieu de remplacer :
```typescript
pendingStreamingUpdate.current.content =
  (pendingStreamingUpdate.current.content || '') + value;
```

**Recommandation** : ✅ Garder tel quel si performance OK, sinon utiliser buffer accumulateur.

---

## 🔴 layout-manager.tsx

### 5. useEffect avec autoHideTimeout dans dependencies (ligne 109-138)
**Fichier** : `src/ui/components/layout-manager.tsx:109`

**Problème** :
```typescript
useEffect(() => {
  const unsubscribeStart = executionManager.onExecutionStart(() => {
    // ...
    cancelAutoHide(); // ⚠️ Utilise autoHideTimeout
  });

  const unsubscribeEnd = executionManager.onExecutionEnd(() => {
    // ...
    scheduleAutoHide(); // ⚠️ Utilise autoHideTimeout
  });

  return () => {
    // ...
    if (autoHideTimeout) { // ⚠️ Utilise autoHideTimeout
      clearTimeout(autoHideTimeout);
    }
  };
}, [config.autoShow, mode, changeMode, cancelAutoHide, scheduleAutoHide, autoHideTimeout]);
// ❌ autoHideTimeout dans dependencies → recréé les listeners à chaque timeout
```

**Impact** :
- Les listeners sont recréés à chaque fois qu'un timeout est créé/supprimé
- Potentielle fuite de listeners (unsubscribe ancien listener, mais nouveau déjà créé)

**Solution** :
```typescript
useEffect(() => {
  const unsubscribeStart = executionManager.onExecutionStart(() => {
    setHasActiveExecution(true);
    cancelAutoHide(); // ✅ Défini avec useCallback, donc stable

    if (config.autoShow && mode === 'hidden') {
      changeMode('split'); // ✅ Défini avec useCallback, donc stable
    }
  });

  const unsubscribeEnd = executionManager.onExecutionEnd(() => {
    const stillActive = executionManager.hasActiveExecutions();
    setHasActiveExecution(stillActive);

    if (!stillActive) {
      scheduleAutoHide(); // ✅ Défini avec useCallback, donc stable
    }
  });

  return () => {
    unsubscribeStart();
    unsubscribeEnd();
    // ❌ NE PAS clear le timeout ici - il sera clearé dans cancelAutoHide
  };
}, [config.autoShow, mode, changeMode, cancelAutoHide, scheduleAutoHide]);
// ✅ Retirer autoHideTimeout des dependencies
```

**Explication** : Le timeout doit être géré par `cancelAutoHide()` et `scheduleAutoHide()`, pas dans le cleanup du useEffect.

---

### 6. scheduleAutoHide avec autoHideTimeout dans dependencies (ligne 78-94)
**Fichier** : `src/ui/components/layout-manager.tsx:78`

**Problème** :
```typescript
const scheduleAutoHide = useCallback(() => {
  if (!config.autoHide) return;

  // Clear existing timeout
  if (autoHideTimeout) {
    clearTimeout(autoHideTimeout);
  }

  // Schedule new timeout
  const timeout = setTimeout(() => {
    if (!hasActiveExecution && mode === 'split') {
      changeMode('hidden');
    }
  }, config.autoHideDelay);

  setAutoHideTimeout(timeout);
}, [config.autoHide, config.autoHideDelay, hasActiveExecution, mode, autoHideTimeout, changeMode]);
// ❌ autoHideTimeout dans dependencies → fonction recréée à chaque timeout
```

**Impact** : La fonction `scheduleAutoHide` change à chaque fois qu'un timeout est créé, ce qui casse le `useCallback`.

**Solution** :
```typescript
const scheduleAutoHide = useCallback(() => {
  if (!config.autoHide) return;

  // Use functional update to avoid dependency on autoHideTimeout
  setAutoHideTimeout(prevTimeout => {
    // Clear existing timeout
    if (prevTimeout) {
      clearTimeout(prevTimeout);
    }

    // Schedule new timeout
    return setTimeout(() => {
      if (!hasActiveExecution && mode === 'split') {
        changeMode('hidden');
      }
    }, config.autoHideDelay);
  });
}, [config.autoHide, config.autoHideDelay, hasActiveExecution, mode, changeMode]);
// ✅ Retirer autoHideTimeout des dependencies
```

**Même chose pour cancelAutoHide** :
```typescript
const cancelAutoHide = useCallback(() => {
  setAutoHideTimeout(prevTimeout => {
    if (prevTimeout) {
      clearTimeout(prevTimeout);
    }
    return null;
  });
}, []); // ✅ Aucune dependency nécessaire
```

---

## 📋 Résumé des Corrections

### 🔴 Critiques (à corriger)
1. ✅ **layout-manager.tsx** : Retirer `autoHideTimeout` des dependencies de `scheduleAutoHide` et `cancelAutoHide`
2. ✅ **layout-manager.tsx** : Retirer `autoHideTimeout` des dependencies du useEffect ligne 109

### 🟡 Moyennes (recommandées)
3. ⚠️ **chat-interface.tsx** : Retirer useMemo de executionViewerSettings (ligne 673) ou le rendre réactif
4. ⚠️ **chat-interface.tsx** : Considérer buffer accumulateur pour debouncing (ligne 166)

### ✅ Déjà Correct
- ✅ Utilisation de refs (isSwitchingRef)
- ✅ Fonctions stabilisées avec useCallback
- ✅ Memoization de StreamingDisplay

---

## 🎯 Code Corrigé

### layout-manager.tsx

```typescript
/**
 * Cancel auto-hide
 */
const cancelAutoHide = useCallback(() => {
  setAutoHideTimeout(prevTimeout => {
    if (prevTimeout) {
      clearTimeout(prevTimeout);
    }
    return null;
  });
}, []); // ✅ Fixed: no dependencies needed

/**
 * Schedule auto-hide
 */
const scheduleAutoHide = useCallback(() => {
  if (!config.autoHide) return;

  setAutoHideTimeout(prevTimeout => {
    // Clear existing timeout
    if (prevTimeout) {
      clearTimeout(prevTimeout);
    }

    // Schedule new timeout
    return setTimeout(() => {
      if (!hasActiveExecution && mode === 'split') {
        changeMode('hidden');
      }
    }, config.autoHideDelay);
  });
}, [config.autoHide, config.autoHideDelay, hasActiveExecution, mode, changeMode]);
// ✅ Fixed: removed autoHideTimeout

/**
 * Listen to execution lifecycle
 */
useEffect(() => {
  const unsubscribeStart = executionManager.onExecutionStart(() => {
    setHasActiveExecution(true);
    cancelAutoHide();

    if (config.autoShow && mode === 'hidden') {
      changeMode('split');
    }
  });

  const unsubscribeEnd = executionManager.onExecutionEnd(() => {
    const stillActive = executionManager.hasActiveExecutions();
    setHasActiveExecution(stillActive);

    if (!stillActive) {
      scheduleAutoHide();
    }
  });

  return () => {
    unsubscribeStart();
    unsubscribeEnd();
  };
}, [config.autoShow, mode, changeMode, cancelAutoHide, scheduleAutoHide]);
// ✅ Fixed: removed autoHideTimeout
```

---

## 📊 Tests Recommandés

Après corrections :

1. ✅ Tester auto-hide : démarrer execution → attendre fin → vérifier que viewer se cache après délai
2. ✅ Tester annulation auto-hide : démarrer execution → nouvelle execution avant timeout → viewer reste visible
3. ✅ Tester multiples executions : 10+ executions rapides → pas de fuite mémoire
4. ✅ Tester streaming rapide : longue réponse → pas de lag de l'input

---

## 🚀 Optimisations Futures (Optionnelles)

### A. Extraire chatViewContent en composant memoized
```typescript
const ChatView = React.memo<{ /* props */ }>(({ /* props */ }) => {
  // Contenu de chatViewContent
});

// Usage
const finalContent = useMemo(() => {
  if (searchMode) {
    // ...
  }

  if (executionViewerSettings.enabled) {
    return (
      <LayoutManager
        conversation={<ChatView {...props} />}
        // ...
      />
    );
  }
}, [/* moins de dependencies */]);
```

### B. Utiliser buffer accumulateur pour streaming
```typescript
const stableStreamingContentSetter = useCallback((value: string) => {
  pendingStreamingUpdate.current.content =
    (pendingStreamingUpdate.current.content || '') + value;

  // Reste identique
}, []);
```

### C. Ajouter système de settings réactif
```typescript
// Créer un hook useExecutionViewerSettings qui écoute les changements
function useExecutionViewerSettings() {
  const [settings, setSettings] = useState(() => {
    const manager = getSettingsManager();
    return manager.getExecutionViewerSettings();
  });

  useEffect(() => {
    const manager = getSettingsManager();
    const unsubscribe = manager.onSettingsChange((newSettings) => {
      setSettings(newSettings.executionViewer);
    });

    return unsubscribe;
  }, []);

  return settings;
}
```

---

## 📝 Conclusion

### État Actuel
- ⚠️ **layout-manager.tsx** : Bugs potentiels avec autoHideTimeout
- ✅ **chat-interface.tsx** : Majoritairement correct, optimisations possibles

### Après Corrections
- ✅ **layout-manager.tsx** : Stable, pas de fuite de listeners
- ✅ **chat-interface.tsx** : Aucun changement nécessaire (déjà correct)

### Priorité
1. 🔴 **URGENT** : Corriger layout-manager.tsx (dependencies autoHideTimeout)
2. 🟡 **MOYEN** : Optimiser useMemo de executionViewerSettings (si settings changent)
3. 🟢 **OPTIONNEL** : Buffer accumulateur pour streaming
