# ✅ Fix : Restauration de l'Historique dans le Viewer

## 🐛 Problème Identifié

**Symptôme** : Après le rollback et l'ajout de la clé dynamique, l'historique des exécutions n'est plus disponible dans le viewer.

**Cause** : Quand la clé du SplitView change (`split-active` → `split-idle`), React détruit et recrée l'ExecutionViewer. Au rechargement, l'ExecutionViewer appelait uniquement :

```typescript
const active = executionManager.getActiveExecutions(); // ← Retourne UNIQUEMENT les running
```

Les exécutions terminées (dans `executionHistory`) n'étaient pas chargées.

---

## ✅ Solution Appliquée

### Fix : Charger Active + History au Démarrage

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

### Comment Ça Fonctionne

**1. Chargement Initial** :
- `getActiveExecutions()` : Retourne les exécutions en cours (`status === 'running'`)
- `getHistory(limit)` : Retourne les dernières exécutions terminées (`executionHistory`)
- **Combine** les deux sources
- **Déduplique** avec un Map (au cas où une exécution serait dans les deux)
- **Trie** par timestamp
- **Limite** au nombre maximal (`maxExecutionsShown`)

**2. Résultat** :
- ✅ L'ExecutionViewer affiche les exécutions actives **ET** l'historique récent
- ✅ Même après un re-render (clé change), l'historique est rechargé
- ✅ L'utilisateur peut naviguer dans l'historique avec ↑↓

---

## 🎯 Comportement Final

### Flux Utilisateur

1. **Utilisateur active le viewer** : Ctrl+E
   - Viewer charge : active executions + historique récent
   - Affiche toutes les exécutions disponibles ✅

2. **Utilisateur envoie un prompt**
   - Nouvelle exécution démarre
   - S'ajoute à la liste
   - Viewer affiche l'exécution en temps réel ✅

3. **LLM termine l'exécution**
   - Clé du SplitView change (`split-active` → `split-idle`)
   - SplitView se re-render
   - **ExecutionViewer recharge** : active + historique
   - L'exécution terminée est maintenant dans l'historique ✅
   - L'utilisateur peut naviguer avec ↑↓ ✅

4. **Navigation dans l'historique**
   - ↑↓ : Naviguer entre les exécutions (actives + terminées)
   - Affiche : COT entries, commands, outputs
   - ✅ L'historique est disponible !

---

## 📊 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `src/ui/components/execution-viewer.tsx` | 44-58 | Charger active + history au lieu de seulement active |

---

## ✅ Build

```bash
$ npm run build
> tsc && chmod +x dist/index.js
✅ Success
```

---

## 🧪 Plan de Test

### Test 1 : Historique Après Re-render
```bash
1. Activer le viewer (Ctrl+E)
2. Envoyer un prompt : "Lis package.json"
3. Attendre la fin de l'exécution
4. Observer le viewer

Expected:
- ✅ L'exécution terminée reste visible dans le viewer
- ✅ L'utilisateur peut voir les détails (COT, commands)
- ✅ Navigation avec ↑↓ fonctionne
```

### Test 2 : Navigation Multi-Exécutions
```bash
1. Activer le viewer
2. Envoyer prompt 1 : "Lis package.json"
3. Attendre la fin
4. Envoyer prompt 2 : "Lis tsconfig.json"
5. Attendre la fin
6. Utiliser ↑↓ pour naviguer

Expected:
- ✅ Les deux exécutions sont visibles
- ✅ Navigation entre les exécutions fonctionne
- ✅ Détails de chaque exécution accessibles
```

### Test 3 : Re-render avec Historique
```bash
1. Envoyer plusieurs prompts (3-4)
2. Activer le viewer après les exécutions
3. Désactiver puis réactiver le viewer (Ctrl+E x2)

Expected:
- ✅ L'historique des exécutions reste accessible
- ✅ Pas de perte d'historique lors du toggle
```

---

## 🎉 Conclusion

**Statut** : ✅ FIX APPLIQUÉ

Le problème d'historique manquant a été résolu :
- ✅ L'ExecutionViewer charge maintenant les exécutions actives **ET** l'historique
- ✅ Même après re-render (clé dynamique), l'historique est restauré
- ✅ Navigation avec ↑↓ fonctionne pour toutes les exécutions
- ✅ Build réussi sans erreurs

**Comportement Final** :
- Viewer affiche : exécutions actives + historique récent (max 10 par défaut)
- Re-render (clé change) → Historique rechargé automatiquement
- Navigation complète disponible

**Prêt pour le test !** 🚀

---

## 📚 Références

- Issue : Historique des exécutions manquant après rollback + clé dynamique
- Root cause : `getActiveExecutions()` ne retourne que les running
- Solution : Combiner `getActiveExecutions()` + `getHistory()`
- Related : ExecutionManager.getHistory() (ligne 272)
