# ✅ Feature `/search` - Prête à Tester !

## 🎉 Statut

**Implémentée et committée** : `0ba61ba feat: add /search command with split-screen UI`

---

## 🚀 Comment Tester

### 1. **Installer les dépendances**

```bash
npm install  # clipboardy a été ajouté
npm run build
npm start
```

### 2. **Utiliser la recherche**

#### **Recherche basique**
```bash
> /search sqlite
```

#### **Recherche avec phrase exacte**
```bash
> /search "migration vers"
```

---

## 🎹 Contrôles Clavier

### **Mode Liste (par défaut)**

| Touche | Action |
|--------|--------|
| `↑` / `↓` | Naviguer dans les résultats |
| `Enter` | Expand le résultat sélectionné (voir le message complet) |
| `Ctrl+S` | **Copier résultat dans le clipboard système** |
| `Ctrl+P` | Coller le clipboard à la fin de l'input |
| `Esc` | Fermer la recherche |

### **Mode Expanded (après `Enter`)**

| Touche | Action |
|--------|--------|
| `↑` / `↓` | Scroller ligne par ligne |
| `PgUp` / `PgDn` | Scroller page par page |
| `n` / `p` | Next / Previous résultat (sans quitter le mode expanded) |
| `Ctrl+S` | **Copier le message COMPLET dans le clipboard** |
| `Ctrl+P` | Coller clipboard à la fin de l'input |
| `Esc` | Retour au mode liste |

---

## 🖥️ Interface Split-Screen

```
┌─────────────────────────────────────────────────────────────────────┐
│  GROK Banner                                                        │
├───────────────────────────────┬─────────────────────────────────────┤
│ Conversation Actuelle (50%)  │ 🔍 Résultats Recherche (50%)        │
│                               │                                     │
│ > Hello                       │ 📊 12 résultats trouvés            │
│ ⏺ Hi Zack!                    │                                     │
│                               │ ╔═══════════════════════════════╗  │
│ > Migrer vers SQLite          │ ║ [1/12] Session #3 - Nov 13    ║  │
│ ⏺ Excellente idée! SQLite...  │ ║ 👤 > Migrer vers [sqlite]     ║  │
│                               │ ║ 🤖 ⏺ [SQLite] offre des perf...║  │
│ > /search sqlite              │ ╚═══════════════════════════════╝  │
│                               │                                     │
│ ┌──────────────────────────┐ │   [2/12] Session #2 - Nov 12       │
│ │ ❯ Continue typing...     │ │   👤 > Pourquoi [sqlite] ?         │
│ └──────────────────────────┘ │   🤖 ⏺ [SQLite] permet...         │
│                               │                                     │
│ ⏸ auto-edit: off             │ ─────────────────────────────────  │
│ ≋ grok-code-fast-1           │ ↑/↓  Navigate    Enter  Expand     │
│                               │ ^S   Copy        Esc    Close      │
│                               │ ^P   Paste Input                    │
└───────────────────────────────┴─────────────────────────────────────┘
```

---

## ✨ Fonctionnalités

### **1. Recherche dans l'historique**
- Recherche dans **toutes les sessions** SQLite
- Pattern matching case-insensitive
- Surlignage du pattern en **jaune** `[sqlite]`

### **2. Split-Screen**
- **Gauche** : Conversation actuelle continue
- **Droite** : Résultats de recherche
- Tu peux continuer à interagir avec Grok pendant que les résultats sont affichés

### **3. Clipboard Système**
- **Ctrl+S** copie dans le clipboard système (pas juste dans l'app)
- Format **Markdown** avec métadonnées :
  ```markdown
  ---
  **Session**: Nov 13, 09:30
  **Working Directory**: `/home/zack/projects/grok-cli`
  **Provider**: Grok (grok-beta)
  ---
  
  ### 👤 User
  
  Migrer vers sqlite car JSONL devient trop lent
  
  ### 🤖 Assistant
  
  Excellente idée Zack! SQLite offre plusieurs avantages...
  
  *Copied from Grok CLI*
  ```

### **4. Paste Intelligent**
- **Ctrl+P** : Colle le clipboard **à la fin** de ton input actuel
- Parfait pour :
  - Copier un message depuis la recherche
  - L'éditer dans vim/VSCode
  - Le recoller dans Grok

---

## 🎯 Workflow Recommandé

### **Scénario 1 : Recherche rapide**
```bash
# 1. Chercher
> /search performance

# 2. Naviguer avec ↑/↓
# 3. Copier avec Ctrl+S
# 4. Fermer avec Esc
```

### **Scénario 2 : Lecture complète**
```bash
# 1. Chercher
> /search "sqlite migration"

# 2. Expand avec Enter
# 3. Lire avec ↑/↓ ou PgUp/PgDn
# 4. Copier avec Ctrl+S
# 5. Retour avec Esc
```

### **Scénario 3 : Édition externe**
```bash
# 1. Chercher et copier
> /search bug fix
# (navigue, puis Ctrl+S)

# 2. Ouvrir vim dans un autre terminal
vim note.md
# (colle avec Ctrl+Shift+V)

# 3. Éditer, ajouter contexte
# ...

# 4. Recopier dans le clipboard

# 5. Retour dans Grok CLI
> /search bug fix
# (Esc pour fermer)
> [tape ton début de message] Ctrl+P [colle le contenu édité]
```

---

## 🔍 Commandes de Recherche

| Commande | Description |
|----------|-------------|
| `/search pattern` | Recherche globale (toutes sessions) |
| `/search "exact phrase"` | Recherche phrase exacte (avec guillemets) |

**Flags futurs** (pas encore implémentés) :
```bash
/search pattern --session      # Recherche session actuelle uniquement
/search pattern --type=user    # Recherche messages utilisateur seulement
/search pattern --date=2024-11 # Recherche par date
```

---

## 📋 Ce qui a été implémenté

### **Backend**
- ✅ `SearchManager` : Recherche SQL avec LIKE
- ✅ `ClipboardManager` : Gestion clipboard système
- ✅ `parseSearchCommand()` : Parse `/search` input
- ✅ `executeSearchCommand()` : Exécute recherche

### **UI Components**
- ✅ `SplitLayout` : Split-screen 50/50
- ✅ `SearchResults` : Container principal avec navigation
- ✅ `SearchResultItem` : Item de résultat (compact)
- ✅ `ExpandedView` : Vue complète scrollable
- ✅ `HighlightedText` : Surlignage pattern

### **Integration**
- ✅ `chat-interface.tsx` : État search mode + SplitLayout
- ✅ `input-controller.tsx` : Props search command
- ✅ `use-input-handler.ts` : Intercepte `/search`, expose input injection
- ✅ Notifications visuelles (clipboard copy confirmations)

### **Dependencies**
- ✅ `clipboardy` : Clipboard cross-platform

---

## 🐛 Dépendances Système

**`clipboardy` nécessite** :
- **Linux** : `xclip` ou `xsel`
  ```bash
  sudo apt install xclip
  ```
- **macOS** : `pbcopy` / `pbpaste` (built-in)
- **Windows** : `clip.exe` (built-in)

Si `xclip` n'est pas installé, la fonctionnalité clipboard affichera une erreur.

---

## 🚧 Prochaines Améliorations

### **Phase 2 (suggérées)**
- [ ] **FTS5** : Full-text search pour performances
- [ ] **Multi-select** : Sélectionner plusieurs résultats (Space, Ctrl+A)
- [ ] **Filtres avancés** : `--session`, `--type`, `--date`
- [ ] **Regex search** : `/search /pattern/`
- [ ] **Export** : `/search-export pattern --format=json`
- [ ] **Search history** : Rappel des dernières recherches (↑/↓ après `/search`)

---

## 🎨 Architecture Technique

### **Flux de données**

```
User: /search sqlite
       ↓
use-input-handler.ts (detecte /search)
       ↓
chat-interface.tsx (handleSearchCommand)
       ↓
commands/search.ts (parseSearchCommand)
       ↓
utils/search-manager.ts (executeSearchCommand → SQL LIKE)
       ↓
chat-interface.tsx (setSearchMode(true), setSearchResults)
       ↓
SplitLayout renders:
  - Left: chatViewContent (conversation actuelle)
  - Right: SearchResults component
       ↓
User: Ctrl+S
       ↓
utils/clipboard-manager.ts (copySingleMessage → Markdown)
       ↓
clipboardy.write(formatted)
       ↓
System clipboard updated ✅
```

---

## 🎉 Résumé

**2,319 lignes de code** ajoutées pour une feature complète de recherche !

**15 fichiers modifiés/créés** :
- 5 composants UI React/Ink
- 3 utilitaires backend
- 1 command parser
- 1 doc de planning (788 lignes!)
- Intégration dans chat-interface, input-controller, use-input-handler

**Prêt à tester ! 🚀**

```bash
npm install && npm run build && npm start
```

Puis tape `/search` et explore ! 🔍
