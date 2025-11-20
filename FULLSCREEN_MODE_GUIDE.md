# 🖥️ Guide : Mode Fullscreen pour Recherche

## ✅ Implémenté !

Le **mode fullscreen** est maintenant disponible pour maximiser l'affichage des résultats de recherche.

---

## 🎯 Concept

```
Mode Normal (Split 50/50):          Mode Fullscreen (f):
┌──────────────┬──────────────┐    ┌────────────────────────────┐
│ Conversation │ Results (8)  │    │                            │
│              │              │    │    Results (16+)           │
│ [Message 1]  │ [1] Result 1 │→f→ │                            │
│ [Message 2]  │ [2] Result 2 │    │    [1] Result 1            │
│ ...          │ [3] Result 3 │    │    [2] Result 2            │
│              │ ...          │    │    ...                     │
│              │ [8] Result 8 │    │    [16] Result 16          │
│              │              │    │                            │
└──────────────┴──────────────┘    └────────────────────────────┘
     50% width      50% width              100% width
```

---

## 🎮 Contrôles

### Mode Normal (Split)
| Touche | Action |
|--------|--------|
| `↑` / `↓` | Naviguer dans les résultats |
| `Enter` | Expand le résultat sélectionné |
| `f` | **Passer en fullscreen** ⭐ |
| `Ctrl+S` | Copier dans clipboard |
| `Esc` | Fermer recherche |

### Mode Fullscreen
| Touche | Action |
|--------|--------|
| `↑` / `↓` | Naviguer dans les résultats |
| `Enter` | Expand le résultat sélectionné |
| `f` | **Revenir en split** ⭐ |
| `Ctrl+S` | Copier dans clipboard |
| `Esc` | Fermer recherche |

---

## 🧪 Test Complet

### Scénario 1 : Split → Fullscreen → Split

```bash
# 1. Lance grok-cli
npm start

# 2. Ouvre une recherche
> /search sqlite

# Tu vois le split screen :
# - Gauche : Conversation
# - Droite : ~8 résultats de recherche

# 3. Presse 'f'
→ La conversation disparaît
→ Les résultats prennent toute la largeur
→ Header affiche : "🔍 Search: "sqlite" [FULLSCREEN]"
→ Tu vois maintenant ~16 résultats (plus d'espace)

# 4. Navigue avec ↑/↓
→ Sliding window fonctionne parfaitement
→ Tu peux voir tous les résultats

# 5. Presse 'f' à nouveau
→ Retour au split screen
→ Conversation réapparaît à gauche
→ [FULLSCREEN] disparaît du header
```

---

### Scénario 2 : Fullscreen + Expand

```bash
> /search test

# Split mode
Press 'f'
→ Fullscreen activé

# Navigate to result 5
↓ ↓ ↓ ↓

# Expand le résultat
Enter
→ Expanded view s'affiche en fullscreen
→ Tu vois tout le message + contexte
→ Scroll avec ↑/↓ fonctionne

# Retour à la liste
Esc (depuis expanded view)
→ Retour à la liste fullscreen

# Retour au split
Press 'f'
→ Split view restauré
```

---

### Scénario 3 : Copy en Fullscreen

```bash
> /search message

Press 'f'
→ Fullscreen

Navigate to interesting result
↓ ↓ ↓

Copy to clipboard
Ctrl+S
→ "✅ Copied to clipboard" notification
→ Message copié en Markdown

Paste ailleurs
Ctrl+Shift+V (dans un autre terminal/éditeur)
→ Le message formaté est collé
```

---

## 📊 Différences Split vs Fullscreen

### Split Mode (50% width)
- ✅ Conversation visible
- ✅ Contexte toujours là
- ❌ Moins de résultats visibles (~8)
- ❌ Moins d'espace horizontal

### Fullscreen Mode (100% width)
- ❌ Conversation cachée
- ✅ **Beaucoup plus de résultats visibles (~16)**
- ✅ **Pleine largeur pour lire les messages**
- ✅ Meilleur pour parcourir beaucoup de résultats

---

## 🎯 Quand Utiliser Fullscreen ?

### Utilise Fullscreen Quand :
1. ✅ Tu as **beaucoup de résultats** (20+)
2. ✅ Tu veux **parcourir rapidement**
3. ✅ Les messages sont **longs** (besoin de largeur)
4. ✅ Tu connais déjà le contexte de la conversation

### Reste en Split Quand :
1. ✅ Tu veux **voir la conversation actuelle**
2. ✅ Peu de résultats (< 10)
3. ✅ Tu compares avec la conversation

---

## 🔧 Détails Techniques

### Calcul de maxVisibleResults

```typescript
// Split mode (50% width)
maxVisibleResults = Math.min(8, Math.floor((terminalHeight - 10) / 4))
// → Environ 8 résultats

// Fullscreen mode (100% width)
maxVisibleResults = Math.floor(terminalHeight - 8)
// → Environ 16 résultats (24 lignes - 8 = 16)
```

### Architecture

```
chat-interface.tsx
  ├─ searchFullscreen: boolean
  └─ handleToggleFullscreen: () => void
      │
      └─> Conditional Render:
          ├─ if (fullscreen): <SearchResults fullscreen={true} />
          └─ else: <SplitLayout left={chat} right={<SearchResults />} />

search-results.tsx
  ├─ fullscreen: boolean (prop)
  ├─ onToggleFullscreen: () => void (prop)
  └─ useInput: 'f' → onToggleFullscreen()
```

---

## ✅ Avantages

1. **Plus de résultats visibles**
   - Split: ~8 résultats
   - Fullscreen: ~16 résultats
   - Gain: **2x plus d'espace**

2. **Pleine largeur**
   - Messages longs entièrement visibles
   - Code formaté sans truncation
   - Meilleure lisibilité

3. **Toggle instantané**
   - Une seule touche (`f`)
   - Pas de latence
   - State préservé (selection, scroll)

4. **Flexible**
   - Switch quand tu veux
   - Pas de perte de contexte
   - Conversation toujours là (juste cachée)

---

## 🎉 Prochaines Étapes ?

Dis-moi Zack si :
1. ✅ Le fullscreen fonctionne comme tu veux ?
2. 💡 Tu veux ajuster le nombre de résultats visibles ?
3. 💡 D'autres améliorations pour la recherche ?
4. 🚀 On peut pusher vers grokinou ?

---

**Teste et confirme que ça marche !** 🚀
