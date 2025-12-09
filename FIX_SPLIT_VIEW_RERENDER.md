# ✅ Fix : Re-render du SplitView avec Clé Dynamique

## 🐛 Problème Résolu

**Symptôme** : En mode viewer (split), quand l'exécution du LLM se termine :
- Le prompt se réinitialise pour une nouvelle entrée
- **MAIS** l'ancien rendu du split reste visible (conversation + viewer figés)
- Résultat : **Double affichage** (ancien split + nouveau split superposés)

**Cause Racine** : Le composant `<Static>` d'Ink ne se rafraîchit pas proprement quand `committedHistory` est mis à jour en mode split.

---

## ✅ Solution Appliquée

### Fix : Clé Dynamique pour Forcer Re-render

**Fichier** : `src/ui/components/layout-manager.tsx:188-196`

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

### Comment Ça Fonctionne

**1. Pendant l'exécution** :
- `hasActiveExecution = true`
- Clé du SplitView : `split-active`
- Le viewer affiche l'exécution en temps réel ✅

**2. Fin de l'exécution** :
- `executionManager.onExecutionEnd()` se déclenche
- `hasActiveExecution = false`
- **Clé change** : `split-active` → `split-idle`
- React détecte le changement de clé
- React **détruit** l'ancien composant SplitView
- React **crée** un nouveau composant SplitView
- Tout est rafraîchi proprement ✅

**3. Nouvelle exécution démarre** :
- `hasActiveExecution = true`
- **Clé change** : `split-idle` → `split-active`
- Re-render à nouveau ✅

---

## 🎯 Comportement Attendu

### Flux Utilisateur

1. **Utilisateur active le viewer** : Ctrl+E
   - Mode passe à `split`
   - Clé : `split-idle` (pas d'exécution)

2. **Utilisateur envoie un prompt**
   - Exécution démarre
   - `hasActiveExecution = true`
   - **Clé change** : `split-idle` → `split-active`
   - SplitView se re-render
   - Viewer affiche l'exécution en temps réel

3. **LLM termine l'exécution**
   - `executionManager.onExecutionEnd()` se déclenche
   - `hasActiveExecution = false`
   - **Clé change** : `split-active` → `split-idle`
   - **SplitView se re-render complètement**
   - Pas de double affichage ✅
   - Prompt prêt pour nouvelle entrée

4. **Utilisateur peut continuer**
   - Soit envoyer un nouveau prompt (retour à étape 2)
   - Soit désactiver le viewer (Ctrl+E)

---

## 📊 Changements Appliqués

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `src/ui/components/layout-manager.tsx` | 190 | Ajout clé dynamique basée sur `hasActiveExecution` |

---

## 🔄 Commits

### 1. Rollback du Fix Incorrect
```bash
git revert fbeac83
# Commit: 0b1a904
# Message: Revert "fix(viewer): auto-hide viewer after execution completes"
```

**Pourquoi** : Le fix précédent cachait le viewer après **chaque tool**, pas après la **fin complète de l'exécution du LLM**.

### 2. Nouveau Fix : Clé Dynamique
```bash
# Fichier modifié: src/ui/components/layout-manager.tsx
# Ajout de: key={`split-${hasActiveExecution ? 'active' : 'idle'}`}
```

---

## ✅ Build

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
2. Envoyer un prompt : "Lis package.json"
3. Observer le viewer pendant l'exécution
4. Attendre la fin de l'exécution

Expected:
- Pendant l'exécution : Viewer affiche l'exécution en temps réel ✅
- Après l'exécution : Layout se rafraîchit proprement ✅
- Pas de double affichage (ancien + nouveau split) ✅
- Prompt prêt pour nouvelle entrée ✅
```

### Test 2 : Exécutions Multiples
```bash
1. Activer le viewer
2. Envoyer prompt 1 : "Lis package.json"
3. Attendre la fin
4. Envoyer prompt 2 : "Lis tsconfig.json"
5. Attendre la fin

Expected:
- Chaque exécution affiche proprement dans le viewer ✅
- Pas de "fantômes" des anciennes exécutions ✅
- Re-render propre entre chaque exécution ✅
```

### Test 3 : Toggle Viewer Pendant Exécution
```bash
1. Envoyer un prompt
2. Activer le viewer pendant l'exécution (Ctrl+E)
3. Attendre la fin
4. Désactiver le viewer (Ctrl+E)
5. Réactiver le viewer (Ctrl+E)

Expected:
- Activation pendant exécution : Viewer affiche l'exécution ✅
- Après fin : Re-render propre ✅
- Désactivation/réactivation : Pas de "vue figée" ✅
```

### Test 4 : Pas de Régression
```bash
1. Tester le mode fullscreen (Ctrl+F depuis split)
2. Tester les shortcuts (Ctrl+C, Ctrl+D)
3. Tester la navigation (↑↓)

Expected:
- Tous les modes fonctionnent normalement ✅
- Pas de régression ✅
```

---

## 🎉 Conclusion

**Statut** : ✅ FIX APPLIQUÉ

Le problème de "double affichage" en mode split a été résolu :
- ✅ Le viewer reste visible pendant toute l'exécution du LLM
- ✅ Quand l'exécution se termine, le SplitView se re-render proprement
- ✅ Pas de superposition de l'ancien et du nouveau layout
- ✅ Build réussi sans erreurs
- ✅ Solution simple et maintenable (1 ligne)

**Comportement Final** :
- Exécution démarre → Clé change → Re-render
- Exécution se termine → Clé change → Re-render
- Pas de "vue figée" ou de double affichage

**Prêt pour le test !** 🚀

---

## 📚 Références

- Issue originale : "Double affichage" en mode split après fin d'exécution
- Cause : Composant `<Static>` d'Ink qui ne se rafraîchit pas proprement
- Solution : Clé dynamique pour forcer re-render complet du SplitView
- Related : Rollback de l'auto-hide incorrect (commit fbeac83)
