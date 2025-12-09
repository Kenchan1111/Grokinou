# 🔍 Analyse du Problème Viewer - État des Lieux

## ✅ État Actuel (Commit 6b09a8d)

On est revenus à l'état stable avant tous les tentatives de fix.

---

## 🎯 Symptômes Décrits

### Symptôme 1 : Vue Dupliquée Après Exécution
**Description** : En mode viewer (Ctrl+E), quand l'exécution du LLM se termine :
- Le layout affiche **DEUX vues superposées** :
  1. L'ancienne vue split (figée) : conversation à gauche + viewer à droite
  2. La nouvelle vue split (vide) : prête pour un nouveau prompt

**Quand ça se produit** :
- Utilisateur en mode viewer (split)
- Envoie un prompt
- LLM exécute des tools (Read, Bash, etc.)
- LLM termine et "rend la main"
- → **À ce moment**, le problème apparaît

**Ce qui devrait se passer** :
- Le layout devrait se "nettoyer" et afficher uniquement la nouvelle vue split
- Pas de superposition de l'ancienne vue

---

### Symptôme 2 : Navigation dans les Exécutions Manquante
**Description** : Le compteur "1/12" et la navigation avec ↑↓ entre les différentes commandes/fichiers ne sont plus disponibles.

**Fonctionnalité attendue** :
- Pouvoir voir toutes les commandes exécutées
- Naviguer avec ↑↓ entre les différentes commandes
- Voir quel fichier a été consulté (1/12, 2/12, etc.)

---

## 🔍 Questions à Clarifier

### Question 1 : La Vue Dupliquée

**Hypothèse A** : Problème de rendu React/Ink
- Le composant `<Static>` ne se rafraîchit pas proprement
- L'ancien rendu persiste dans le buffer terminal

**Hypothèse B** : Problème de données
- Les entries sont dupliquées dans `committedHistory` et `activeMessages`
- Affichage double car même données rendues deux fois

**Hypothèse C** : Problème de layout
- Le SplitView ne se "reset" pas proprement après l'exécution
- Ancien layout + nouveau layout coexistent

**🤔 Question pour toi** : Peux-tu décrire plus précisément ce que tu vois ?
- Est-ce que c'est **visuellement** deux layouts l'un sur l'autre ?
- Ou est-ce que c'est le **contenu** qui est dupliqué (mêmes messages affichés deux fois) ?
- Est-ce que si tu scroll, tu vois l'ancien contenu en haut et le nouveau en bas ?

---

### Question 2 : La Navigation

**Constat** : Tu mentionnes qu'il y avait un compteur "1/12" et une navigation.

**🤔 Questions pour toi** :
1. **Où était ce compteur** ?
   - Dans le viewer (panneau de droite) ?
   - Dans la conversation (panneau de gauche) ?
   - Dans une barre de statut ?

2. **Qu'est-ce qui était compté** ?
   - Les fichiers consultés ?
   - Les commandes exécutées ?
   - Les executions (une execution = un ensemble de tools) ?

3. **Comment naviguait-on** ?
   - ↑↓ changeait l'execution affichée ?
   - ↑↓ changeait la commande affichée dans la même execution ?

---

## 📊 Architecture Actuelle du Viewer

### Composants Impliqués

**1. LayoutManager** (`src/ui/components/layout-manager.tsx`)
- Gère les modes : `hidden`, `split`, `fullscreen`
- Affiche SplitView en mode split
- Gère les keyboard shortcuts (Ctrl+E, Ctrl+F)

**2. ExecutionViewer** (`src/ui/components/execution-viewer.tsx`)
- Affiche les exécutions
- State local : `executions` (liste des ExecutionState)
- Navigation : `selectedIndex` pour ↑↓
- Affiche : COT entries, commands, status bar

**3. ExecutionManager** (`src/execution/execution-manager.ts`)
- Gère les executions globalement
- `activeExecutions` : Set des IDs d'executions running
- `executionHistory` : Array des executions terminées (max 100)
- Events : `execution:start`, `execution:complete`, etc.

**4. ChatInterface** (`src/ui/components/chat-interface.tsx`)
- Gère la conversation
- `committedHistory` : Messages terminés (dans `<Static>`)
- `activeMessages` : Messages en cours
- Streaming display

---

## 🎯 Plan d'Investigation

### Étape 1 : Reproduire le Problème

**Test** :
1. Lancer grokinou
2. Activer le viewer : Ctrl+E
3. Envoyer un prompt simple : "Lis package.json"
4. Observer le viewer pendant l'exécution
5. **Attendre la fin complète** (LLM rend la main)
6. **Observer ce qui se passe**

**Questions** :
- Est-ce que tu vois la vue dupliquée ?
- Est-ce que le compteur "1/12" apparaît à un moment ?
- Prends un screenshot si possible

---

### Étape 2 : Identifier le Compteur

**Recherche** : Chercher dans le code où est affiché ce compteur "1/12"

```bash
# Chercher "/{" ou le pattern du compteur
grep -r "selectedIndex.*length" src/ui/components/
grep -r "\\/" src/ui/components/execution-viewer.tsx
```

**Hypothèse** : Le compteur est probablement dans ExecutionViewer ligne 130-136 :
```typescript
{executions.length > 1 && (
  <Box>
    <Text>Executions ({selectedIndex + 1}/{executions.length})</Text>
  </Box>
)}
```

Mais peut-être qu'il y avait un autre compteur pour les commands ?

---

### Étape 3 : Analyser le Rendu du Split

**Vérifier** :
- Si `<Static>` est bien cleared après l'exécution
- Si `committedHistory` contient des duplications
- Si le SplitView a un state interne qui persiste

---

## 💡 Solutions Potentielles (À Discuter)

### Solution 1 : Forcer Clear de Static
- Vider temporairement `committedHistory` pendant l'exécution
- Re-populer après

### Solution 2 : Clé Dynamique (Tentée, Mais...)
- Ajout de clé dynamique au SplitView
- Problème : Perd le state de l'ExecutionViewer
- Peut-être avec une meilleure gestion de l'historique ?

### Solution 3 : Détecter Fin de Toutes les Opérations
- Ajouter un event `onAllToolsComplete()` dans ExecutionManager
- Se déclenche quand toutes les tools d'une requête sont terminées
- À ce moment, refresh le layout

### Solution 4 : Ne Pas Dupliquer les Tool Entries
- Filtrer les tool entries de ChatHistory quand viewer actif
- Évite la duplication visuelle

---

## ❓ Questions pour Toi

Avant de continuer, j'ai besoin que tu clarifie :

**1. La vue dupliquée** :
- Peux-tu décrire exactement ce que tu vois ?
- Est-ce que c'est visuellement deux layouts superposés ?
- Ou est-ce que c'est le contenu dupliqué ?

**2. Le compteur "1/12"** :
- Où était-il affiché ?
- Qu'est-ce qu'il comptait exactement ?
- Est-ce que tu peux tester l'état actuel (commit 6b09a8d) et voir si le compteur est présent ?

**3. La navigation ↑↓** :
- À quoi servait-elle exactement ?
- Est-ce qu'elle fonctionne dans l'état actuel ?

Avec ces informations, je pourrai identifier la vraie solution ! 🎯
