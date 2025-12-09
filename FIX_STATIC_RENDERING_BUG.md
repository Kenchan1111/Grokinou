# 🐛 Fix : Bug de Rendu avec `<Static>` en Mode Split

## 🎯 Problème Identifié

### Symptôme
En mode viewer (split), quand une exécution se termine :
- Le nouveau prompt apparaît (prêt pour une nouvelle entrée)
- **MAIS** l'ancien rendu du split reste visible (conversation + viewer figés)
- Résultat : **DEUX layouts split superposés** dans l'affichage

### Cause Racine : `<Static>` d'Ink

**Fichier** : `src/ui/components/chat-interface.tsx:603-607`

```typescript
<Static items={committedHistory}>
  {(entry, index) => (
    <MemoizedArchived key={`committed-${entry.timestamp.getTime()}-${index}`} entry={entry} />
  )}
</Static>
```

**Séquence du bug** :
1. **Pendant exécution** :
   - `committedHistory` = anciens messages (dans `<Static>`)
   - `activeMessages` = messages en cours (dans `<ChatHistory>`)
   - Tout est rendu dans le SplitView

2. **Fin d'exécution** (lignes 384-402) :
   ```typescript
   // Commit automatique
   setCommittedHistory(prev => [...prev, ...activeMessages]);
   setActiveMessages([]);
   ```

3. **Problème** :
   - `<Static>` devrait se mettre à jour avec les nouveaux items
   - **MAIS** `<Static>` d'Ink "gèle" le contenu une fois rendu
   - L'ancien rendu de `<Static>` reste visible
   - Le nouveau rendu s'ajoute par-dessus
   - **Double affichage !**

### Pourquoi Seulement en Mode Split ?

En mode normal (hidden), le problème existe aussi mais est moins visible car :
- Pas de panneau viewer à côté
- L'utilisateur scroll naturellement
- Le layout est plus simple

En mode split :
- Deux panneaux côte à côte
- Layout plus complexe avec bordures
- Le double rendu est très visible (ancien split + nouveau split)

---

## ✅ Solutions Possibles

### Solution 1 : Forcer Re-render avec Clé Dynamique (Recommandé)

**Principe** : Forcer React/Ink à recréer complètement le SplitView en changeant sa clé.

**Implémentation** :

**Fichier** : `src/ui/components/layout-manager.tsx:190-197`

```typescript
// AVANT
{mode === 'split' && (
  <SplitView
    conversation={conversation}
    viewer={executionViewer}
    splitRatio={config.splitRatio}
    layout={config.layout}
  />
)}

// APRÈS
{mode === 'split' && (
  <SplitView
    key={`split-${hasActiveExecution ? 'active' : 'idle'}`}  // ← Force re-render
    conversation={conversation}
    viewer={executionViewer}
    splitRatio={config.splitRatio}
    layout={config.layout}
  />
)}
```

**Explication** :
- Quand `hasActiveExecution` change (exécution se termine)
- La clé change : `split-active` → `split-idle`
- React détruit l'ancien composant SplitView
- React crée un nouveau composant SplitView
- Tout est rafraîchi proprement ✅

**Avantages** :
- ✅ Simple (1 ligne)
- ✅ Force un re-render complet
- ✅ Pas de side-effects
- ✅ Fonctionne avec `<Static>`

**Inconvénient** :
- ⚠️ Perd le focus du panneau (conversation vs viewer)
- Mais c'est acceptable car l'exécution vient de se terminer

---

### Solution 2 : Remplacer `<Static>` par un Scroll Virtuel

**Principe** : Ne plus utiliser `<Static>` d'Ink, implémenter un scroll manuel.

**Avantages** :
- ✅ Contrôle total du rendu
- ✅ Pas de bug de `<Static>`

**Inconvénients** :
- ❌ Complexe à implémenter
- ❌ Risque de casser le comportement actuel
- ❌ Performance potentiellement moins bonne

**Non recommandé** pour l'instant.

---

### Solution 3 : Vider `committedHistory` Avant de Re-commit

**Principe** : Avant de transférer `activeMessages` vers `committedHistory`, vider `committedHistory`.

**Problème** :
- ❌ On perd l'historique des messages précédents
- ❌ L'utilisateur ne peut plus scroller vers le haut

**Non recommandé**.

---

### Solution 4 : Sortir du Mode Split Temporairement

**Principe** : Quand l'exécution se termine, sortir du split (`hidden`) puis y retourner (`split`).

**Implémentation** :
```typescript
const unsubscribeEnd = executionManager.onExecutionEnd(() => {
  const stillActive = executionManager.hasActiveExecutions();
  setHasActiveExecution(stillActive);

  if (!stillActive && mode === 'split') {
    // Sortir temporairement
    changeMode('hidden');

    // Retourner au split après 100ms
    setTimeout(() => {
      changeMode('split');
    }, 100);
  }
});
```

**Avantages** :
- ✅ Force un rafraîchissement complet
- ✅ Simple

**Inconvénients** :
- ❌ Flash visuel (hidden → split)
- ❌ Mauvaise UX

**Non recommandé**.

---

## 🎯 Recommandation : Solution 1

**Je recommande Solution 1** : Ajouter une clé dynamique au SplitView.

**Pourquoi** :
- Simple (1 ligne de code)
- Force un re-render propre
- Résout le bug de `<Static>`
- Pas de régression

---

## 📋 Implémentation

### Changement à Faire

**Fichier** : `src/ui/components/layout-manager.tsx:190-197`

```typescript
{mode === 'split' && (
  <SplitView
    key={`split-${hasActiveExecution ? 'active' : 'idle'}-${Date.now()}`}  // ← Force re-render
    conversation={conversation}
    viewer={executionViewer}
    splitRatio={config.splitRatio}
    layout={config.layout}
  />
)}
```

**Option 1** : Clé basée sur `hasActiveExecution`
- Change quand exécution démarre/se termine
- `split-active` → `split-idle`

**Option 2** : Clé avec timestamp
- Change à chaque render
- Plus "brutal" mais garantit le rafraîchissement

**Je recommande Option 1** (basée sur `hasActiveExecution`).

---

## 🧪 Test

### Scénario de Test
1. Activer le viewer (Ctrl+E)
2. Envoyer un prompt : "Lis package.json"
3. Observer le viewer pendant l'exécution
4. Attendre la fin de l'exécution

**Résultat attendu** :
- ✅ Pendant l'exécution : Viewer affiche l'exécution
- ✅ Après l'exécution : Layout se rafraîchit proprement
- ✅ Pas de double affichage (ancien split + nouveau split)
- ✅ Prompt prêt pour nouvelle entrée

---

## 🎉 Conclusion

Le problème n'est PAS :
- ❌ La duplication des tool entries
- ❌ Le viewer qui reste ouvert
- ❌ L'auto-hide du viewer

Le problème EST :
- ✅ Le composant `<Static>` d'Ink qui ne se rafraîchit pas proprement en mode split
- ✅ Résolu en forçant un re-render avec une clé dynamique

**Veux-tu que j'implémente cette solution maintenant ?**
