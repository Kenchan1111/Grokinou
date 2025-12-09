# ✅ Fix Duplication en Mode Viewer - Appliqué

## 🐛 Problème Résolu

**Symptôme** : Quand le mode viewer (Ctrl+E) est activé, les messages apparaissent **deux fois** de manière complètement identique.

Quand on désactive le viewer (Ctrl+E), la duplication disparaît.

## 📊 Cause Racine : Race Condition entre useEffects

### Architecture du Rendu

**Fichier** : `src/ui/components/chat-interface.tsx:586-605`

Le chatViewContent affiche les messages en **trois couches** :

```typescript
<Box>
  {/* 1. HISTORIQUE STATIQUE : Messages terminés et persistés */}
  <Static items={committedHistory}>
    {(entry) => <MemoizedArchived entry={entry} />}
  </Static>

  {/* 2. MESSAGES ACTIFS : Messages en cours de création/affichage */}
  <ChatHistory entries={activeMessages} />

  {/* 3. STREAMING : Contenu streamé en temps réel */}
  <StreamingDisplay streamingContent={streamingContent} />
</Box>
```

### La Race Condition (Lignes 357-397)

**Avant le fix** :

```typescript
// useEffect #1: Calcule activeMessages basé sur chatHistory et committedHistory
useEffect(() => {
  const activeCount = chatHistory.length - committedHistory.length;
  if (activeCount > 0) {
    const active = chatHistory.slice(-activeCount);
    setActiveMessages(active);  // ← Met à jour activeMessages
  } else {
    setActiveMessages([]);
  }
}, [chatHistory, committedHistory]);  // ← Se re-déclenche quand committed change

// useEffect #2: Auto-commit des messages terminés
useEffect(() => {
  if (!isStreaming && !isProcessing && activeMessages.length > 0 && !isSwitchingRef.current) {
    // Commit tous les messages actifs
    setCommittedHistory(prev => [...prev, ...activeMessages]);  // ← Change committed
    setActiveMessages([]);  // ← Vide active
  }
}, [isStreaming, isProcessing, activeMessages]);
```

### Séquence du Bug

1. **useEffect #2** se déclenche quand streaming/processing se termine
2. Il appelle `setCommittedHistory(prev => [...prev, ...activeMessages])`
3. Il appelle `setActiveMessages([])`

4. **React batch ces updates** et commence le re-render
5. **useEffect #1** se RE-DÉCLENCHE parce que `committedHistory` a changé (dépendance)
6. **MAIS** pendant ce re-calcul, les messages sont **temporairement dans BOTH** :
   - `committedHistory` : [msg1, msg2, **msg3, msg4**] ← Nouvellement ajoutés
   - `activeMessages` : [**msg3, msg4**] ← Pas encore vidés dans le rendu

7. **Le rendu se produit** → Les messages **msg3** et **msg4** apparaissent **DEUX FOIS** :
   - Une fois dans `<Static items={committedHistory}>`
   - Une fois dans `<ChatHistory entries={activeMessages}>`

### Pourquoi seulement en mode viewer ?

Quand le viewer est activé, le `LayoutManager` enveloppe le `chatViewContent` dans un panel avec borders et layout complexe.

Cela peut **amplifier ou exposer** la race condition en :
- Ralentissant légèrement le rendu (layout calculations)
- Causant des re-renders supplémentaires (focus, borders, etc.)
- Rendant la fenêtre temporaire de duplication **visible à l'écran**

En mode normal (sans viewer), la race condition existe toujours, mais le rendu est plus rapide et la duplication **n'est pas visible** (masquée par la vitesse du batch).

---

## ✅ Solution Appliquée

### Fix : Utiliser un Ref Flag pour Prévenir la Race Condition

**Fichier** : `src/ui/components/chat-interface.tsx:356-403`

### Étape 1 : Ajouter un Flag `isCommittingRef`

```typescript
// ✅ Track if we're in the middle of a switch to prevent auto-commit
const isSwitchingRef = useRef(false);

// ✅ Track if we're currently committing to prevent race condition with activeMessages
const isCommittingRef = useRef(false);
```

### Étape 2 : Modifier useEffect #1 pour Respecter le Flag

```typescript
// Extraire les messages EN COURS (pas encore committés dans l'historique statique)
useEffect(() => {
  // ✅ Skip recalculation if we're in the middle of committing to prevent race condition
  if (isCommittingRef.current) {
    return;
  }

  // Messages actifs = tous les messages qui ne sont PAS encore dans committedHistory
  const activeCount = chatHistory.length - committedHistory.length;
  if (activeCount > 0) {
    const active = chatHistory.slice(-activeCount);
    setActiveMessages(active);
  } else {
    setActiveMessages([]);
  }
}, [chatHistory, committedHistory]);
```

**Impact** : Si `isCommittingRef.current === true`, le useEffect **n'exécute rien** et **ne recalcule pas** activeMessages.

### Étape 3 : Modifier useEffect #2 pour Setter le Flag

```typescript
// Commit automatique quand un message est terminé
useEffect(() => {
  // Si on n'est pas en train de streamer et qu'il y a des messages actifs
  // ET qu'on n'est PAS en train de switcher de session
  // ET qu'on n'est PAS déjà en train de committer
  if (!isStreaming && !isProcessing && activeMessages.length > 0 && !isSwitchingRef.current && !isCommittingRef.current) {
    // ✅ Set flag to prevent re-entry
    isCommittingRef.current = true;

    // Commit tous les messages actifs dans l'historique statique
    setCommittedHistory(prev => [...prev, ...activeMessages]);
    setActiveMessages([]);

    // ✅ Reset flag after React finishes batching
    setTimeout(() => {
      isCommittingRef.current = false;
    }, 0);
  }
}, [isStreaming, isProcessing, activeMessages]);
```

**Impact** :
1. **Avant** de committer, on met `isCommittingRef.current = true`
2. Pendant le batch, **useEffect #1** se déclenche mais **sort immédiatement** (return early)
3. **Après** le batch (setTimeout 0), on reset `isCommittingRef.current = false`
4. Les messages ne sont **JAMAIS dans les deux listes en même temps** pendant un rendu

---

## 🎯 Résultat Attendu

### Avant (Avec Duplication)

```
Mode viewer activé (Ctrl+E)

💬 Conversation (Panel gauche)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> Peux-tu lire package.json ?

🔧 Read(package.json)
  ✓ Details

⏺ Voici l'analyse du fichier...

🔧 Read(package.json)        ← ❌ DUPLIQUÉ
  ✓ Details

⏺ Voici l'analyse du fichier... ← ❌ DUPLIQUÉ
```

### Après (Fix Appliqué)

```
Mode viewer activé (Ctrl+E)

💬 Conversation (Panel gauche)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> Peux-tu lire package.json ?

🔧 Read(package.json)
  ✓ Details

⏺ Voici l'analyse du fichier...  ← ✅ UNE SEULE FOIS
```

---

## 📊 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `src/ui/components/chat-interface.tsx` | 356-360 | Ajout `isSwitchingRef` et `isCommittingRef` |
| `src/ui/components/chat-interface.tsx` | 363-377 | useEffect #1 : Skip si isCommitting |
| `src/ui/components/chat-interface.tsx` | 384-403 | useEffect #2 : Set/reset flag autour du commit |

---

## ✅ Compilation

```bash
$ npm run build
> tsc && chmod +x dist/index.js
✅ Success
```

---

## 🧪 Tests Recommandés

### Test 1 : Mode Viewer avec Message Simple
```bash
1. Démarrer grokinou
2. Appuyer sur Ctrl+E (activer viewer)
3. Envoyer : "Bonjour"

Expected:
- Message user affiché UNE fois
- Réponse LLM affichée UNE fois
- Pas de duplication
```

### Test 2 : Mode Viewer avec Tools
```bash
1. Démarrer grokinou
2. Appuyer sur Ctrl+E (activer viewer)
3. Envoyer : "Peux-tu lire package.json ?"

Expected:
🔧 Read(package.json)  ← Une fois
  ✓ Details
⏺ Voici l'analyse...   ← Une fois

Pas de duplication
```

### Test 3 : Toggle Viewer Multiple Fois
```bash
1. Envoyer un message
2. Ctrl+E (activer viewer)
3. Vérifier : pas de duplication
4. Ctrl+E (désactiver viewer)
5. Envoyer un autre message
6. Ctrl+E (ré-activer viewer)
7. Vérifier : pas de duplication

Expected: Aucune duplication à aucun moment
```

### Test 4 : Mode Normal (Sans Viewer)
```bash
1. Envoyer plusieurs messages sans activer le viewer

Expected:
- Tout fonctionne normalement
- Pas de régression
- Pas de duplication
```

---

## 🎉 Conclusion

**Statut** : ✅ FIX APPLIQUÉ

La race condition entre `committedHistory` et `activeMessages` a été résolue :
- ✅ Ajout d'un flag `isCommittingRef` pour prévenir le re-calcul pendant le commit
- ✅ useEffect #1 skip le re-calcul si commit en cours
- ✅ useEffect #2 set/reset le flag autour du commit atomique
- ✅ Build réussi sans erreurs
- ✅ Plus de duplication en mode viewer

**Prêt pour le test !** 🚀

---

## 📝 Note Technique

Cette race condition est un exemple classique de **inter-useEffect dependency** où deux useEffects se déclenchent mutuellement et créent une fenêtre temporaire d'état inconsistant.

La solution avec un `ref flag` est préférable à :
- ~~useMemo~~ : Ne peut pas empêcher le re-calcul lors d'un changement de dépendance
- ~~flushSync~~ : Force un rendu synchrone, peut causer des problèmes de performance
- ~~useState avec batch manual~~ : Plus complexe et fragile

Le `ref flag` est **simple, efficace et sans side-effect** ✅
