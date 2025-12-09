# ✅ Fix Viewer Auto-Hide - Sortie Automatique Après Exécution

## 🐛 Problème Résolu

**Symptôme** : En mode viewer (Ctrl+E), quand une exécution se termine :
- Le viewer conserve l'affichage de l'ancienne exécution (layout "figé")
- L'utilisateur doit manuellement sortir du viewer (Ctrl+E) pour voir la conversation normale
- Le problème n'est pas dans les données mais dans le **layout lui-même** qui persiste

**Nature du Bug** : Le LayoutManager reste en mode `split` après la fin de l'exécution, conservant l'état visuel du viewer.

---

## 📊 Cause Racine

### Architecture du LayoutManager

**Fichier** : `src/ui/components/layout-manager.tsx:111-137`

Le LayoutManager écoute les events du cycle de vie des exécutions :

```typescript
useEffect(() => {
  // Quand une exécution démarre
  const unsubscribeStart = executionManager.onExecutionStart(() => {
    setHasActiveExecution(true);

    // ✅ Auto-show viewer when execution starts
    if (config.autoShow && mode === 'hidden') {
      changeMode('split');
    }
  });

  // Quand une exécution se termine
  const unsubscribeEnd = executionManager.onExecutionEnd(() => {
    const stillActive = executionManager.hasActiveExecutions();
    setHasActiveExecution(stillActive);

    // ❌ AVANT : Schedule auto-hide avec délai (5 secondes)
    if (!stillActive) {
      scheduleAutoHide();  // Attend autoHideDelay avant de cacher
    }
  });
}, [/* ... */]);
```

### Le Problème

**Comportement Avant Fix** :
1. Exécution démarre → Viewer s'ouvre automatiquement (`autoShow`) ✅
2. Exécution se termine → Viewer reste ouvert
3. `scheduleAutoHide()` est appelé mais :
   - Par défaut `autoHide = false` → Ne se cache jamais
   - Même si `autoHide = true` → Attend 5 secondes avant de se cacher
4. **Résultat** : Le viewer reste en mode split avec l'ancien contenu visible

**Impact** :
- L'utilisateur voit une "vue figée" du viewer
- Doit manuellement désactiver le viewer (Ctrl+E)
- Expérience utilisateur dégradée

---

## ✅ Solution Appliquée

### Fix : Sortie Automatique Immédiate

**Fichier** : `src/ui/components/layout-manager.tsx:122-133`

```typescript
const unsubscribeEnd = executionManager.onExecutionEnd(() => {
  // Check if there are still active executions
  const stillActive = executionManager.hasActiveExecutions();
  setHasActiveExecution(stillActive);

  // ✅ Auto-hide viewer immediately when execution completes
  // This prevents the "frozen view" issue where the old execution
  // remains visible in the viewer after completion
  if (!stillActive && mode === 'split') {
    changeMode('hidden');  // ← Sortie immédiate
  }
});
```

### Changements Clés

**Avant** :
```typescript
if (!stillActive) {
  scheduleAutoHide();  // ❌ Attend un délai (5s) ou ne fait rien
}
```

**Après** :
```typescript
if (!stillActive && mode === 'split') {
  changeMode('hidden');  // ✅ Sortie immédiate
}
```

**Impact** :
- ✅ Quand l'exécution se termine, le viewer se cache **immédiatement**
- ✅ L'utilisateur voit la conversation normale avec la réponse du LLM
- ✅ Plus de "vue figée" du layout
- ✅ L'utilisateur peut réactiver le viewer avec Ctrl+E s'il veut consulter l'historique

---

## 🎯 Comportement Attendu

### Flux Utilisateur

1. **Utilisateur active le viewer** : Ctrl+E
   - Mode passe à `split`
   - Viewer visible à droite

2. **Utilisateur envoie un prompt**
   - Exécution démarre
   - Viewer affiche l'exécution en temps réel (COT, commands)

3. **LLM termine l'exécution**
   - `executionManager.onExecutionEnd()` se déclenche
   - **Viewer se cache automatiquement** (`mode = 'hidden'`)
   - Conversation normale affichée plein écran avec la réponse du LLM

4. **Si l'utilisateur veut voir l'historique**
   - Ctrl+E pour réactiver le viewer
   - Viewer affiche l'historique des exécutions passées (loguées dans timeline.db)

---

## 🔍 Pourquoi Cette Solution Fonctionne

### Le Layout se "Reset"

**Problème Original** :
- Le layout en mode split conservait son état visuel
- Même après la fin de l'exécution, le viewer affichait l'ancien contenu

**Avec le Fix** :
- Quand l'exécution se termine, on force `mode = 'hidden'`
- Le layout se "reset" complètement
- Plus de persistance de l'ancien état
- Si l'utilisateur réactive le viewer, c'est un nouveau rendu propre

### Cycle de Vie Clair

**Avant** : Mode split persistant
```
[Viewer Off] → [Exécution] → [Viewer On avec contenu] → [Fin] → [Viewer On avec contenu figé] ❌
```

**Après** : Mode split temporaire
```
[Viewer Off] → [Exécution] → [Viewer On avec contenu] → [Fin] → [Viewer Off] ✅
```

---

## 📊 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `src/ui/components/layout-manager.tsx` | 122-133 | Auto-hide immédiat au lieu de délai |

---

## ✅ Compilation

```bash
$ npm run build
> tsc && chmod +x dist/index.js
✅ Success
```

---

## 🧪 Plan de Test

### Test 1 : Auto-Hide Basique
```bash
1. Activer le viewer (Ctrl+E)
2. Envoyer un prompt : "Lis package.json"
3. Observer le viewer pendant l'exécution
4. Attendre la fin de l'exécution

Expected:
- Pendant l'exécution : Viewer visible avec COT et commands ✅
- Après l'exécution : Viewer se cache automatiquement ✅
- Conversation normale affichée avec la réponse du LLM ✅
```

### Test 2 : Réactivation Manuelle
```bash
1. Après une exécution (viewer caché)
2. Appuyer sur Ctrl+E

Expected:
- Viewer se réactive ✅
- Affiche l'historique des exécutions passées ✅
- Layout propre, pas de "vue figée" ✅
```

### Test 3 : Exécutions Multiples
```bash
1. Activer le viewer
2. Envoyer prompt 1
3. Attendre la fin → Viewer se cache ✅
4. Envoyer prompt 2
5. Pendant l'exécution, le viewer se réactive automatiquement (autoShow) ✅
6. Attendre la fin → Viewer se cache ✅

Expected:
- Chaque exécution active/désactive le viewer automatiquement ✅
- Pas de "vue figée" entre les exécutions ✅
```

### Test 4 : Mode Fullscreen
```bash
1. Activer le viewer (Ctrl+E)
2. Passer en fullscreen (Ctrl+F)
3. Envoyer un prompt
4. Attendre la fin

Expected:
- Le fix ne s'applique qu'au mode split ✅
- En fullscreen, le comportement reste inchangé ✅
```

---

## 📝 Note sur l'Historique

**Question** : Comment consulter l'historique des anciennes exécutions ?

**Réponse** : Les exécutions sont loguées dans `timeline.db`. Pour consulter :
1. Réactiver le viewer (Ctrl+E)
2. Le ExecutionViewer affiche l'historique des dernières exécutions
3. Navigation possible avec ↑↓

**Future Feature** : Implémenter une commande pour consulter l'historique complet depuis timeline.db.

---

## 🎉 Conclusion

**Statut** : ✅ FIX APPLIQUÉ

Le problème de "vue figée" dans le viewer a été résolu :
- ✅ Le viewer se cache automatiquement après l'exécution
- ✅ Plus de persistance du layout avec l'ancien contenu
- ✅ Expérience utilisateur fluide (auto-show + auto-hide)
- ✅ Build réussi sans erreurs
- ✅ Solution simple et maintenable

**Comportement Final** :
- Exécution démarre → Viewer s'active automatiquement
- Exécution se termine → Viewer se cache automatiquement
- L'utilisateur garde le contrôle avec Ctrl+E

**Prêt pour le test !** 🚀

---

## 📚 Références

- Issue originale : "Vue figée" en mode viewer après fin d'exécution
- Root cause : Persistance du layout en mode split
- Solution : Auto-hide immédiat au lieu de délai
- Related : `executionManager.onExecutionEnd()` pour le cycle de vie
