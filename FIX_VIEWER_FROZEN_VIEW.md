# ✅ Fix "Vue Figée" en Mode Viewer - Appliqué

## 🐛 Problème Résolu

**Symptôme** : En mode viewer (Ctrl+E), quand une exécution se termine :
- L'exécution est transférée à l'historique ✅
- Le split se rafraîchit pour le nouveau prompt ✅
- **MAIS** l'ancienne exécution reste visible dans le viewer comme une "vue figée" ❌
- Quand on quitte le mode viewer, tout redevient normal ✅

**Nature du Bug** : Problème d'affichage persistant dans le `ExecutionViewer` - les exécutions terminées ne sont pas retirées de l'affichage.

---

## 📊 Cause Racine (Diagnostic DeepSeek)

### Architecture du ExecutionViewer

**Fichier** : `src/ui/components/execution-viewer.tsx:41-77`

Le composant `ExecutionViewer` utilise :

1. **`executionManager.getActiveExecutions()`**
   - Retourne uniquement les exécutions avec `status === 'running'`
   - Utilisé pour le chargement initial

2. **`executionManager.subscribeToAll(callback)`**
   - Reçoit **TOUTES** les mises à jour d'exécutions (même terminées)
   - Utilisé pour les updates en temps réel

### La Race Condition

**Séquence du Bug** :

1. **Exécution démarre** → `status: 'running'` → ajoutée à `executions` state ✅
2. **Exécution se termine** → `status: 'success'` ou `'error'`
3. **subscribeToAll()** notifie le changement → met à jour l'exécution dans le state
4. **MAIS** l'exécution terminée **reste dans le state** ❌
5. **Résultat** : Le viewer continue d'afficher l'exécution terminée

### Code Problématique (Avant Fix)

```typescript
const unsubscribe = executionManager.subscribeToAll((execution) => {
  setExecutions(prev => {
    const index = prev.findIndex(e => e.id === execution.id);
    let updated: ExecutionState[];

    if (index >= 0) {
      // Update existing execution
      updated = [...prev];
      updated[index] = execution;  // ❌ Met à jour même si terminée
    } else {
      // Add new execution
      updated = [...prev, execution];  // ❌ Ajoute même si terminée
    }

    // Apply limit (keep most recent executions)
    if (updated.length > limit) {
      updated = updated.slice(-limit);
    }

    return updated;  // ❌ Retourne les exécutions terminées
  });
});
```

**Problème** : Aucun filtrage des exécutions terminées → elles restent dans l'affichage.

---

## ✅ Solution Appliquée

### Fix : Filtrer les Exécutions Terminées

**Fichier** : `src/ui/components/execution-viewer.tsx:50-82`

```typescript
const unsubscribe = executionManager.subscribeToAll((execution) => {
  setExecutions(prev => {
    const index = prev.findIndex(e => e.id === execution.id);
    let updated: ExecutionState[];

    if (index >= 0) {
      // Update existing execution
      updated = [...prev];
      updated[index] = execution;
    } else {
      // ✅ Add new execution ONLY if it's active
      if (execution.status === 'running') {
        updated = [...prev, execution];
      } else {
        // ✅ Don't add completed executions
        return prev;
      }
    }

    // ✅ CRITICAL FIX: Filter out completed executions to prevent "frozen view" in viewer mode
    // This ensures that when an execution completes (running → success/error),
    // it's automatically removed from the viewer display
    updated = updated.filter(exec => exec.status === 'running');

    // Apply limit (keep most recent executions)
    if (updated.length > limit) {
      updated = updated.slice(-limit);
    }

    return updated;
  });
});
```

### Changements Clés

#### 1. **Filtrage à l'Ajout** (lignes 61-67)
```typescript
if (execution.status === 'running') {
  updated = [...prev, execution];
} else {
  // Don't add completed executions
  return prev;
}
```
**Impact** : Les nouvelles exécutions terminées ne sont jamais ajoutées au state.

#### 2. **Filtrage Après Mise à Jour** (ligne 73)
```typescript
updated = updated.filter(exec => exec.status === 'running');
```
**Impact** : Quand une exécution passe de `running` → `success`/`error`, elle est **immédiatement retirée** de l'affichage.

---

## 🎯 Résultat Attendu

### Avant le Fix

```
[Mode viewer activé - Ctrl+E]

📜 Execution Viewer
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Chain of Thought
   💭 Executing tool: bash
   ⚡ Command: ls -la
   👁️ Command succeeded
   ✅ Tool execution succeeded  ← ❌ Reste visible (vue figée)

💬 Conversation
━━━━━━━━━━━━━━━━━━━━━━━━━━
> Nouveau prompt ici
```

**Problème** : L'ancienne exécution (terminée) reste visible dans le viewer, créant une "vue figée".

---

### Après le Fix

```
[Mode viewer activé - Ctrl+E]

📜 Execution Viewer
━━━━━━━━━━━━━━━━━━━━━━━━━━
No executions yet  ← ✅ Viewer vide (exécution terminée retirée)

💬 Conversation
━━━━━━━━━━━━━━━━━━━━━━━━━━
> Nouveau prompt ici
```

**Résultat** : Quand l'exécution se termine, elle est **automatiquement retirée** du viewer.

---

## 🔍 Pourquoi Ce Fix Fonctionne

### Flux Correct avec le Fix

1. **Exécution démarre** → `status: 'running'`
   - Ajoutée au state ✅
   - Affichée dans le viewer ✅

2. **Exécution en cours** → `status: 'running'`
   - Mise à jour du state ✅
   - Reste affichée ✅

3. **Exécution se termine** → `status: 'success'`
   - Mise à jour du state
   - **Filtrée par `.filter(exec => exec.status === 'running')`** ✅
   - **Retirée de l'affichage** ✅

4. **Nouvelle exécution démarre** → `status: 'running'`
   - Ajoutée au state ✅
   - Viewer affiche uniquement la nouvelle exécution ✅

### Propriétés du Fix

✅ **Simple** : Une seule ligne de filtre
✅ **Sûr** : Garantit qu'aucune exécution terminée ne reste
✅ **Performant** : Filtre léger sur un petit array
✅ **Maintenable** : Logique claire et documentée
✅ **Compatible** : Ne casse pas les autres fonctionnalités

---

## 📊 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `src/ui/components/execution-viewer.tsx` | 61-67 | Ajout condition pour n'ajouter que les exécutions running |
| `src/ui/components/execution-viewer.tsx` | 70-73 | Ajout filtre pour retirer les exécutions terminées |

---

## ✅ Compilation

```bash
$ npm run build
> tsc && chmod +x dist/index.js
✅ Success
```

---

## 🧪 Plan de Test

### Test 1 : Exécution Simple
```bash
1. Activer le viewer (Ctrl+E)
2. Envoyer une commande : "Peux-tu lire package.json ?"
3. Observer le viewer pendant l'exécution
4. Attendre la fin de l'exécution

Expected:
- Pendant l'exécution : Viewer affiche l'exécution ✅
- Après l'exécution : Viewer se vide automatiquement ✅
- Pas de "vue figée" ❌
```

### Test 2 : Exécutions Multiples
```bash
1. Activer le viewer
2. Envoyer plusieurs commandes successives
3. Observer le viewer entre chaque exécution

Expected:
- Chaque exécution terminée disparaît du viewer ✅
- Seule la nouvelle exécution est visible ✅
```

### Test 3 : Toggle Viewer
```bash
1. Envoyer une commande
2. Activer le viewer pendant l'exécution (Ctrl+E)
3. Observer l'affichage
4. Désactiver le viewer (Ctrl+E)
5. Réactiver le viewer après la fin

Expected:
- Pendant l'exécution : Viewer affiche l'exécution ✅
- Après désactivation : Conversation normale ✅
- Après réactivation : Viewer vide (pas de vue figée) ✅
```

### Test 4 : Pas de Régression
```bash
1. Tester le mode fullscreen (Ctrl+F depuis split)
2. Tester les shortcuts (Ctrl+C, Ctrl+D)
3. Vérifier l'historique des exécutions

Expected:
- Tous les modes fonctionnent normalement ✅
- Pas de régression ✅
```

---

## 🎉 Conclusion

**Statut** : ✅ FIX APPLIQUÉ

Le problème de "vue figée" dans le viewer a été résolu :
- ✅ Les exécutions terminées sont automatiquement retirées de l'affichage
- ✅ Le viewer affiche uniquement les exécutions actives
- ✅ Pas de duplication ou de "fantômes" d'anciennes exécutions
- ✅ Build réussi sans erreurs
- ✅ Solution simple et maintenable

**Crédit** : Diagnostic par DeepSeek, implémentation par Claude Code

**Prêt pour le test !** 🚀

---

## 📚 Références

- Issue originale : "Vue figée" en mode viewer après fin d'exécution
- Diagnostic : DeepSeek (analyse complète de la race condition)
- Implémentation : Claude Code
- Related fix : `FIX_DUPLICATION_VIEWER_APPLIED.md` (fix différent mais lié au viewer)
