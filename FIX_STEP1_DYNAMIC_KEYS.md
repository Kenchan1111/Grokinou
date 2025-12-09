# ✅ Fix Step 1 : Clés Dynamiques pour Forcer Re-render

## 🎯 Stratégie Progressive

**Approche** : On teste d'abord la solution minimale (clés dynamiques), puis si nécessaire, on fera le refactoring complet (view/data separation).

---

## 📊 Changements Appliqués (Step 1)

### Changement 1 : Clé Dynamique sur `<Static>`

**Fichier** : `src/ui/components/chat-interface.tsx:603-610`

**AVANT** :
```typescript
<Static items={committedHistory}>
  {(entry, index) => (
    <MemoizedArchived key={`committed-${entry.timestamp.getTime()}-${index}`} entry={entry} />
  )}
</Static>
```

**APRÈS** :
```typescript
<Static
  items={committedHistory}
  key={`history-${committedHistory.length}-${isStreaming}`}  // ← Clé dynamique
>
  {(entry, index) => (
    <MemoizedArchived key={`committed-${entry.timestamp.getTime()}-${index}`} entry={entry} />
  )}
</Static>
```

**Pourquoi** :
- Quand `committedHistory.length` change (nouveau message committé)
- OU quand `isStreaming` change (fin de streaming)
- La clé change → React **détruit** l'ancien `<Static>` → **Crée** un nouveau
- Force un re-render complet → Pas de "gel" du contenu

---

### Changement 2 : Clé Dynamique sur `SplitView`

**Fichier** : `src/ui/components/layout-manager.tsx:188-196`

**AVANT** :
```typescript
{mode === 'split' && (
  <SplitView
    conversation={conversation}
    viewer={executionViewer}
    splitRatio={config.splitRatio}
    layout={config.layout}
  />
)}
```

**APRÈS** :
```typescript
{mode === 'split' && (
  <SplitView
    key={`split-${hasActiveExecution ? 'active' : 'idle'}`}  // ← Clé dynamique
    conversation={conversation}
    viewer={executionViewer}
    splitRatio={config.splitRatio}
    layout={config.layout}
  />
)}
```

**Pourquoi** :
- Quand `hasActiveExecution` change (exécution démarre ou se termine)
- La clé change → React **détruit** l'ancien `SplitView` → **Crée** un nouveau
- Force un re-render complet du layout

---

### Changement 3 : Charger Historique dans ExecutionViewer

**Fichier** : `src/ui/components/execution-viewer.tsx:41-58`

**AVANT** :
```typescript
// Initial load - get active executions
const active = executionManager.getActiveExecutions();
if (active.length > 0) {
  setExecutions(active.slice(-limit));
}
```

**APRÈS** :
```typescript
// Initial load - get both active executions and recent history
const active = executionManager.getActiveExecutions();
const history = executionManager.getHistory(limit);

// Combine active + history, remove duplicates, and sort by timestamp
const combined = [...active, ...history];
const uniqueMap = new Map<string, ExecutionState>();
combined.forEach(exec => uniqueMap.set(exec.id, exec));
const uniqueExecs = Array.from(uniqueMap.values())
  .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  .slice(-limit);

if (uniqueExecs.length > 0) {
  setExecutions(uniqueExecs);
}
```

**Pourquoi** :
- Comme le `SplitView` est détruit/recréé, l'`ExecutionViewer` est aussi recréé
- Au rechargement, on doit charger à la fois les exécutions actives ET l'historique
- Sinon, l'historique des exécutions disparaît (compteur 1/12 manquant)

---

## 🎯 Comment Ça Marche

### Flux Complet avec les Clés

**1. Utilisateur active le viewer** : Ctrl+E
- Mode = `split`
- `hasActiveExecution` = `false` (pas d'exécution)
- Clé du SplitView : `split-idle`

**2. Utilisateur envoie un prompt**
- Exécution démarre
- `hasActiveExecution` = `true`
- **Clé change** : `split-idle` → `split-active`
- **SplitView se re-render** (ancien détruit, nouveau créé)
- ExecutionViewer recharge : active + historique

**3. LLM exécute des tools**
- Viewer affiche l'exécution en temps réel
- Pas de changement de clé (toujours `split-active`)

**4. LLM termine l'exécution**
- `executionManager.onExecutionEnd()` se déclenche
- `hasActiveExecution` = `false`
- **Clé change** : `split-active` → `split-idle`
- **SplitView se re-render** (ancien détruit, nouveau créé)
- ExecutionViewer recharge : active + historique

**5. LLM commence à streamer la réponse**
- `isStreaming` = `true`
- **Clé de `<Static>` change** : `history-X-false` → `history-X-true`
- **`<Static>` se re-render** (ancien détruit, nouveau créé)
- Pas de contenu "gelé"

**6. LLM termine de streamer**
- `isStreaming` = `false`
- Messages transférés de `activeMessages` → `committedHistory`
- `committedHistory.length` change
- **Clé de `<Static>` change** : `history-X-true` → `history-Y-false`
- **`<Static>` se re-render** (ancien détruit, nouveau créé)
- Contenu mis à jour

---

## ✅ Résultat Attendu

**Problème résolu** :
- ✅ Plus de "vue figée" après l'exécution
- ✅ `<Static>` se rafraîchit proprement
- ✅ SplitView se rafraîchit proprement
- ✅ Pas de duplication de l'ancien + nouveau layout
- ✅ Historique des exécutions disponible (compteur 1/12)
- ✅ Navigation avec ↑↓ fonctionne

**Quand le re-render se déclenche** :
1. Quand exécution **démarre** (`hasActiveExecution` change)
2. Quand exécution **se termine** (`hasActiveExecution` change)
3. Quand streaming **démarre** (`isStreaming` change)
4. Quand streaming **se termine** (`isStreaming` change + `committedHistory.length` change)

**→ Double protection** contre le "gel" du rendu !

---

## 📊 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `src/ui/components/chat-interface.tsx` | 605 | Ajout clé sur `<Static>` |
| `src/ui/components/layout-manager.tsx` | 190 | Ajout clé sur `SplitView` |
| `src/ui/components/execution-viewer.tsx` | 44-58 | Chargement active + historique |

---

## ✅ Build

```bash
$ npm run build
> tsc && chmod +x dist/index.js
✅ Success
```

---

## 🧪 Plan de Test

### Test 1 : Vue Dupliquée
```bash
1. Activer le viewer (Ctrl+E)
2. Envoyer un prompt : "Lis package.json"
3. Attendre la fin complète (LLM rend la main)
4. Observer l'affichage

Expected:
- ✅ Pas de vue dupliquée (ancien + nouveau split)
- ✅ Layout propre
- ✅ Conversation affichée correctement
```

### Test 2 : Navigation Historique
```bash
1. Activer le viewer
2. Envoyer prompt 1 : "Lis package.json"
3. Attendre la fin
4. Envoyer prompt 2 : "Lis tsconfig.json"
5. Attendre la fin
6. Utiliser ↑↓ dans le viewer

Expected:
- ✅ Compteur visible (1/2, 2/2)
- ✅ Navigation avec ↑↓ fonctionne
- ✅ Historique complet disponible
```

### Test 3 : Re-render Pendant Réponse
```bash
1. Activer le viewer
2. Envoyer un prompt
3. Observer pendant l'exécution
4. Observer quand le LLM commence à répondre
5. Observer quand le LLM termine de répondre

Expected:
- ✅ Pendant exécution : Viewer affiche en temps réel
- ✅ Quand LLM répond : Re-render automatique
- ✅ Quand LLM termine : Layout propre, pas de duplication
```

### Test 4 : Exécutions Multiples
```bash
1. Activer le viewer
2. Envoyer 3-4 prompts successifs
3. Observer à chaque transition

Expected:
- ✅ Chaque transition est propre
- ✅ Pas de "fantômes" d'anciennes vues
- ✅ Historique s'accumule correctement
```

---

## 🎯 Next Steps

### Si Ça Marche ✅
1. Commit ces changements
2. Tester en conditions réelles
3. Décider si on fait le refactoring complet (view/data separation)

### Si Problème Persiste ❌
1. Debug : Identifier exactement quand le re-render ne se déclenche pas
2. Ajouter des logs pour tracker les changements de clés
3. Considérer le refactoring complet (Step 2)

---

## 🎉 Conclusion

**Statut** : ✅ STEP 1 APPLIQUÉ

**Changements** :
- 3 fichiers modifiés
- 3 changements ciblés (clés dynamiques + historique)
- Build réussi

**Prêt pour le test !** 🚀

Si cette solution fonctionne, on commit. Sinon, on passe au Step 2 (refactoring view/data separation).
