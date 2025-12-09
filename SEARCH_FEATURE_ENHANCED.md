# 🔍 Feature `/search` - Plan Amélioré (Zack's Vision)

## 🎯 Vision Globale

**Recherche puissante avec clipboard système** - Pas de copie automatique vers le prompt pour plus de flexibilité (édition externe, réutilisation multi-contexte).

---

## 🎨 UI Split Screen - 3 Modes

### **Mode 1 : Liste Compacte (Défaut)**

```
┌─────────────────────────────────────────────────────────────────────┐
│  GROK Banner                                                        │
├───────────────────────────────┬─────────────────────────────────────┤
│ Conversation Actuelle         │ 🔍 Recherche: "sqlite"             │
│                               ├─────────────────────────────────────┤
│ > Hello Grok                  │ 📊 12 résultats trouvés            │
│ ⏺ Hi Zack! How can I help?   │                                     │
│                               │ ╔═══════════════════════════════╗  │
│ > Migrer vers SQLite          │ ║ [1/12] Session #3 - Nov 13    ║  │
│ ⏺ Excellente idée! SQLite...  │ ║ 👤 > Migrer vers [sqlite]     ║  │
│                               │ ║ 🤖 ⏺ [SQLite] offre des perf...║  │
│ > /search sqlite              │ ╚═══════════════════════════════╝  │
│                               │                                     │
│ ┌──────────────────────────┐ │   [2/12] Session #2 - Nov 12       │
│ │ ❯ Type to continue...    │ │   👤 > Pourquoi [sqlite] ?         │
│ └──────────────────────────┘ │   🤖 ⏺ [SQLite] permet...         │
│                               │                                     │
│ ⏸ auto-edit: off             │   [3/12] Session #3 - Nov 13       │
│ ≋ grok-code-fast-1           │   👤 > Base [sqlite] fonctionne    │
│                               │   🤖 ⏺ La migration [SQLite]...   │
│                               │                                     │
│                               │ ─────────────────────────────────  │
│                               │ ↑/↓  Navigate    Enter  Expand     │
│                               │ ^S   Copy        Esc    Close      │
│                               │ ^P   Paste Input Tab    Switch     │
└───────────────────────────────┴─────────────────────────────────────┘
```

**Caractéristiques** :
- Aperçu compact (2-3 lignes par résultat)
- Pattern `[sqlite]` surligné en **jaune**
- Résultat sélectionné : bordure double `╔═══╗` + fond **bleu**
- Navigation rapide avec `↑` / `↓`
- **Ctrl+S** : Copie dans clipboard SANS expand

---

### **Mode 2 : Vue Expanded (Enter)**

```
┌─────────────────────────────────────────────────────────────────────┐
│  GROK Banner                                                        │
├───────────────────────────────┬─────────────────────────────────────┤
│ Conversation Actuelle         │ 🔍 "sqlite" - Résultat [1/12]      │
│                               ├─────────────────────────────────────┤
│ > Hello Grok                  │ 📅 Session #3 - Nov 13, 09:30      │
│ ⏺ Hi Zack!                    │ 📂 ~/projects/grok-cli             │
│                               │ 🤖 Provider: Grok (grok-beta)      │
│ > /search sqlite              │ ─────────────────────────────────  │
│                               │                                     │
│ ┌──────────────────────────┐ │ 👤 User (09:30:15):                │
│ │ ❯ Type to continue...    │ │ > Migrer vers [sqlite] car JSONL  │
│ └──────────────────────────┘ │   devient trop lent avec l'histo- │
│                               │   rique qui grossit.               │
│ ⏸ auto-edit: off             │                                     │
│ ≋ grok-code-fast-1           │ 🤖 Assistant (09:30:42):           │
│                               │ ⏺ Excellente idée Zack! [SQLite]  │
│                               │   offre plusieurs avantages par    │
│                               │   rapport à JSONL:                 │
│                               │                                     │
│                               │   1. **Performance**: Indexation   │
│                               │      native permet des recherches  │
│                               │      ultra-rapides même avec des   │
│                               │      milliers de messages.         │
│                               │                                     │
│                               │   2. **Transactions**: [SQLite]    │
│                               │      garantit l'intégrité des...   │
│                               │                                     │
│                               │   ⬇ Scroll for more (65% shown)    │
│                               │ ─────────────────────────────────  │
│                               │ ↑/↓  Scroll      ^S   Copy Full    │
│                               │ PgUp/PgDn Page   Esc  Back         │
│                               │ ^P   Paste Input                    │
└───────────────────────────────┴─────────────────────────────────────┘
```

**Caractéristiques** :
- **Message complet** affiché (user + assistant)
- **Scrollable** : `↑` / `↓` pour scroller ligne par ligne, `PgUp` / `PgDn` pour pages
- Pattern toujours surligné `[sqlite]`
- Métadonnées : session, date, workdir, provider
- **Ctrl+S** : Copie **tout le message** (user + assistant) dans clipboard
- `Esc` : Retour au Mode 1 (liste compacte)

---

### **Mode 3 : Multi-Select (Future)**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 "sqlite" - Multi-Selection                                      │
├─────────────────────────────────────────────────────────────────────┤
│ 📊 12 résultats | 3 sélectionnés                                   │
│                                                                     │
│ ☑ [1/12] Session #3 - Nov 13                                       │
│   👤 > Migrer vers [sqlite]                                        │
│   🤖 ⏺ [SQLite] offre des performances...                         │
│                                                                     │
│ ☐ [2/12] Session #2 - Nov 12                                       │
│   👤 > Pourquoi [sqlite] ?                                         │
│                                                                     │
│ ☑ [3/12] Session #3 - Nov 13                                       │
│   👤 > Base [sqlite] fonctionne                                    │
│   🤖 ⏺ La migration [SQLite]...                                   │
│                                                                     │
│ ☑ [4/12] Session #1 - Nov 10                                       │
│   👤 > FTS5 vs LIKE pour [sqlite]                                  │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────  │
│ Space  Toggle    ^A   Select All   ^S  Copy Selected (3)          │
│ Enter  Expand    ^D   Deselect All Esc Close                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Caractéristiques** :
- `Space` : Toggle sélection
- `Ctrl+A` : Sélectionner tous
- `Ctrl+S` : Copie tous les messages sélectionnés (séparés par `---`)
- Compteur : "3 sélectionnés"

---

## 🎯 Workflow Utilisateur

### **Scénario 1 : Recherche Rapide + Copie**

```bash
# 1. Lancer recherche
> /search sqlite

# 2. Naviguer avec flèches (reste en Mode 1)
↓ ↓ ↓  # Résultat [3/12]

# 3. Copier dans clipboard sans expand
Ctrl+S

# 4. Notification
✅ Message copié dans le clipboard (245 caractères)

# 5. Utiliser ailleurs (éditeur externe, autre terminal, etc.)
# Ou coller dans le prompt avec Ctrl+P
Ctrl+P
> [contenu collé depuis clipboard]
```

---

### **Scénario 2 : Lecture Complète + Copie**

```bash
# 1. Lancer recherche
> /search "migration sqlite"

# 2. Naviguer jusqu'au résultat voulu
↓ ↓  # Résultat [2/12]

# 3. Expand pour lire en entier
Enter

# 4. Scroller pour lire tout
↓ ↓ ↓ PgDn PgDn  # Lecture complète (5 pages)

# 5. Copier message complet
Ctrl+S

# 6. Notification détaillée
✅ Conversation copiée dans le clipboard:
   - User message (120 chars)
   - Assistant response (1,850 chars)
   Total: 1,970 caractères

# 7. Retour à la liste
Esc
```

---

### **Scénario 3 : Multi-Copie (Future)**

```bash
# 1. Recherche
> /search performance

# 2. Activer multi-select
Ctrl+M  # Toggle multi-select mode

# 3. Sélectionner plusieurs résultats
Space   # Résultat [1/8] ☑
↓ Space # Résultat [2/8] ☑
↓ ↓ ↓
Space   # Résultat [5/8] ☑

# 4. Copier tous
Ctrl+S

# 5. Clipboard = 3 conversations séparées
✅ 3 conversations copiées (4,230 caractères)

Content:
────────────────────────────────────────
[Résultat 1/8 - Session #3 - Nov 13]
👤 > ...
🤖 ⏺ ...
────────────────────────────────────────
[Résultat 2/8 - Session #3 - Nov 13]
👤 > ...
🤖 ⏺ ...
────────────────────────────────────────
[Résultat 5/8 - Session #2 - Nov 12]
👤 > ...
🤖 ⏺ ...
────────────────────────────────────────
```

---

## 🎹 Keybindings Complets

### **Mode 1 : Liste Compacte**

| Touche | Action |
|--------|--------|
| `↑` / `↓` | Naviguer dans les résultats |
| `Enter` | Expand résultat sélectionné (→ Mode 2) |
| `Ctrl+S` | **Copier résultat dans clipboard** (compact) |
| `Ctrl+P` | Coller clipboard → prompt input |
| `Ctrl+M` | Toggle multi-select mode (→ Mode 3) |
| `Tab` | Switch focus conversation ↔ résultats |
| `Esc` | Fermer recherche |
| `/` | Quick filter (filtre les résultats affichés) |

### **Mode 2 : Vue Expanded**

| Touche | Action |
|--------|--------|
| `↑` / `↓` | Scroller ligne par ligne |
| `PgUp` / `PgDn` | Scroller page par page |
| `Home` / `End` | Début / Fin du message |
| `Ctrl+S` | **Copier message COMPLET dans clipboard** |
| `Ctrl+P` | Coller clipboard → prompt input |
| `n` / `p` | Next / Previous résultat (sans quitter Mode 2) |
| `Esc` | Retour au Mode 1 (liste) |

### **Mode 3 : Multi-Select**

| Touche | Action |
|--------|--------|
| `Space` | Toggle sélection résultat actuel |
| `Ctrl+A` | Sélectionner tous les résultats |
| `Ctrl+D` | Désélectionner tous |
| `Ctrl+S` | Copier tous les résultats sélectionnés |
| `Enter` | Expand résultat actuel (keep selection) |
| `Esc` | Retour au Mode 1 |

---

## 💾 Clipboard Management

### **Format de Copie**

#### **Copie Simple (1 résultat)**
```
[Session #3 - 2024-11-13 09:30 - ~/projects/grok-cli]

User (09:30:15):
Migrer vers sqlite car JSONL devient trop lent avec l'historique qui grossit.

Assistant (09:30:42):
Excellente idée Zack! SQLite offre plusieurs avantages par rapport à JSONL:

1. **Performance**: Indexation native permet des recherches ultra-rapides...
2. **Transactions**: SQLite garantit l'intégrité des données...
3. **Requêtes complexes**: Filtrer par date, provider, session...

[Copié depuis Grok CLI - /search sqlite]
```

#### **Copie Multiple (3 résultats)**
```
═══════════════════════════════════════════════════════════════════
[Résultat 1/3 - Session #3 - Nov 13, 09:30]
───────────────────────────────────────────────────────────────────
User: Migrer vers sqlite...
Assistant: Excellente idée Zack! SQLite offre...
═══════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════
[Résultat 2/3 - Session #2 - Nov 12, 15:45]
───────────────────────────────────────────────────────────────────
User: Pourquoi sqlite ?
Assistant: SQLite permet de...
═══════════════════════════════════════════════════════════════════

═══════════════════════════════════════════────════════════════════
[Résultat 3/3 - Session #1 - Nov 10, 20:10]
───────────────────────────────────────────────────────────────────
User: FTS5 vs LIKE
Assistant: FTS5 est bien plus performant...
═══════════════════════════════════════════════════════════════════

[3 résultats copiés depuis Grok CLI - /search sqlite]
```

---

### **Clipboard API (Node.js)**

**Option 1 : `clipboardy` (Cross-platform)** ⭐ RECOMMANDÉ
```bash
npm install clipboardy
```

```typescript
import clipboard from 'clipboardy';

// Copier
await clipboard.write(textContent);

// Notification
console.log(`✅ ${charCount} caractères copiés dans le clipboard`);

// Lire (pour Ctrl+P)
const clipContent = await clipboard.read();
```

**Pros** :
- ✅ Cross-platform (Linux, macOS, Windows)
- ✅ Async API propre
- ✅ Léger (150KB)

---

**Option 2 : `node-clipboard` (Natif)**
```bash
npm install node-clipboard
```

**Option 3 : Shell fallback**
```typescript
// Linux
execSync(`echo "${content}" | xclip -selection clipboard`);

// macOS
execSync(`echo "${content}" | pbcopy`);

// Windows
execSync(`echo "${content}" | clip`);
```

---

## 🎨 Visual Enhancements

### **Highlighting Strategy**

#### **Pattern Highlighting**
```typescript
// Fonction de surlignage intelligent
function highlightPattern(text: string, pattern: string): ReactNode {
  const regex = new RegExp(`(${escapeRegex(pattern)})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    const isMatch = regex.test(part);
    return isMatch ? (
      <Text key={i} backgroundColor="yellow" color="black" bold>
        {part}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    );
  });
}
```

**Résultat** :
```
> Migrer vers [sqlite] car JSONL...
            ^^^^^^^^
            (fond jaune)
```

---

#### **Context Highlighting (Expanded Mode)**
```typescript
// Surligner lignes contenant le pattern
function highlightContextLines(content: string, pattern: string) {
  const lines = content.split('\n');
  
  return lines.map((line, i) => {
    const hasMatch = line.toLowerCase().includes(pattern.toLowerCase());
    
    return (
      <Box key={i} backgroundColor={hasMatch ? 'bgYellow' : undefined}>
        <Text dimColor={!hasMatch}>
          {highlightPattern(line, pattern)}
        </Text>
      </Box>
    );
  });
}
```

**Résultat** :
```
1. Performance: Indexation native...
2. Transactions: SQLite garantit...    ← Ligne surlignée (fond léger)
               ^^^^^^
3. Requêtes: Filtrer par date...
```

---

### **Selection Indicators**

```typescript
// Mode 1 : Compact
{isSelected ? '╔═══' : '┌───'}  // Bordure double si sélectionné
{isSelected ? <Text backgroundColor="blue" color="white">{content}</Text> : content}

// Mode 3 : Multi-select
{isChecked ? '☑' : '☐'}  // Checkbox
```

---

## 🏗️ Architecture Technique

### **1. ClipboardManager**

**`src/utils/clipboard-manager.ts`**
```typescript
import clipboard from 'clipboardy';
import { Message } from '../db/types.js';

export interface ClipboardOptions {
  includeMetadata?: boolean;
  format?: 'plain' | 'markdown';
  separator?: string;
}

export class ClipboardManager {
  /**
   * Copy single message to clipboard
   */
  async copySingleMessage(
    message: Message,
    context: { sessionDate: string; workdir: string },
    options: ClipboardOptions = {}
  ): Promise<number> {
    const formatted = this.formatMessage(message, context, options);
    await clipboard.write(formatted);
    return formatted.length;
  }

  /**
   * Copy multiple messages
   */
  async copyMultipleMessages(
    messages: Array<{ message: Message; context: any }>,
    options: ClipboardOptions = {}
  ): Promise<number> {
    const separator = options.separator || '\n═══════════════════════\n';
    const formatted = messages
      .map((item, i) => 
        `[Résultat ${i + 1}/${messages.length}]\n` +
        this.formatMessage(item.message, item.context, options)
      )
      .join(separator);
    
    await clipboard.write(formatted);
    return formatted.length;
  }

  /**
   * Read from clipboard (for Ctrl+P paste)
   */
  async readClipboard(): Promise<string> {
    return await clipboard.read();
  }

  /**
   * Format message with metadata
   */
  private formatMessage(
    message: Message,
    context: { sessionDate: string; workdir: string },
    options: ClipboardOptions
  ): string {
    const { includeMetadata = true, format = 'plain' } = options;
    
    let output = '';
    
    // Metadata header
    if (includeMetadata) {
      output += `[Session - ${context.sessionDate} - ${context.workdir}]\n\n`;
    }
    
    // Message content
    output += `${message.role === 'user' ? 'User' : 'Assistant'}:\n`;
    output += message.content;
    
    // Footer
    if (includeMetadata) {
      output += '\n\n[Copié depuis Grok CLI]';
    }
    
    return output;
  }
}

export const clipboardManager = new ClipboardManager();
```

---

### **2. SearchResultsComponent Enhanced**

**`src/ui/components/search-results.tsx`**
```typescript
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { clipboardManager } from '../../utils/clipboard-manager.js';

type ViewMode = 'list' | 'expanded' | 'multi';

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  results,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedScrollOffset, setExpandedScrollOffset] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);

  // Keybindings
  useInput(async (input, key) => {
    if (viewMode === 'list') {
      if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow) {
        setSelectedIndex(Math.min(results.length - 1, selectedIndex + 1));
      } else if (key.return) {
        setViewMode('expanded');
        setExpandedScrollOffset(0);
      } else if (key.ctrl && input === 's') {
        await handleCopyCompact();
      } else if (key.ctrl && input === 'p') {
        await handlePasteToInput();
      } else if (key.ctrl && input === 'm') {
        setViewMode('multi');
      } else if (key.escape) {
        onClose();
      }
    } else if (viewMode === 'expanded') {
      if (key.upArrow) {
        setExpandedScrollOffset(Math.max(0, expandedScrollOffset - 1));
      } else if (key.downArrow) {
        setExpandedScrollOffset(expandedScrollOffset + 1);
      } else if (key.pageDown) {
        setExpandedScrollOffset(expandedScrollOffset + 10);
      } else if (key.pageUp) {
        setExpandedScrollOffset(Math.max(0, expandedScrollOffset - 10));
      } else if (key.ctrl && input === 's') {
        await handleCopyFull();
      } else if (input === 'n') {
        // Next result
        setSelectedIndex(Math.min(results.length - 1, selectedIndex + 1));
        setExpandedScrollOffset(0);
      } else if (input === 'p') {
        // Previous result
        setSelectedIndex(Math.max(0, selectedIndex - 1));
        setExpandedScrollOffset(0);
      } else if (key.escape) {
        setViewMode('list');
      }
    } else if (viewMode === 'multi') {
      if (input === ' ') {
        toggleSelection(selectedIndex);
      } else if (key.ctrl && input === 'a') {
        selectAll();
      } else if (key.ctrl && input === 's') {
        await handleCopyMultiple();
      } else if (key.escape) {
        setViewMode('list');
      }
    }
  });

  const handleCopyCompact = async () => {
    const result = results[selectedIndex];
    const charCount = await clipboardManager.copySingleMessage(
      result.message,
      result.context,
      { includeMetadata: true }
    );
    showNotification(`✅ ${charCount} caractères copiés`);
  };

  const handleCopyFull = async () => {
    const result = results[selectedIndex];
    const charCount = await clipboardManager.copySingleMessage(
      result.message,
      result.context,
      { includeMetadata: true }
    );
    showNotification(`✅ Message complet copié (${charCount} chars)`);
  };

  const handleCopyMultiple = async () => {
    const selectedResults = Array.from(selectedItems).map(i => results[i]);
    const charCount = await clipboardManager.copyMultipleMessages(
      selectedResults.map(r => ({ message: r.message, context: r.context }))
    );
    showNotification(`✅ ${selectedItems.size} messages copiés (${charCount} chars)`);
  };

  const handlePasteToInput = async () => {
    const content = await clipboardManager.readClipboard();
    // TODO: Inject into input
    showNotification(`📋 Collé depuis clipboard (${content.length} chars)`);
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Render based on mode
  return (
    <Box flexDirection="column">
      {viewMode === 'list' && <ListView {...props} />}
      {viewMode === 'expanded' && <ExpandedView {...props} />}
      {viewMode === 'multi' && <MultiSelectView {...props} />}
      
      {notification && (
        <Box marginTop={1} borderStyle="round" borderColor="green" padding={1}>
          <Text color="green">{notification}</Text>
        </Box>
      )}
    </Box>
  );
};
```

---

## 📋 Plan d'Implémentation

### **Phase 1 : Backend + Clipboard (2h)**
- [x] Créer `ClipboardManager` avec `clipboardy`
- [ ] Installer `clipboardy` : `npm install clipboardy`
- [ ] Implémenter `copySingleMessage()`, `copyMultipleMessages()`
- [ ] Formatter plain text avec métadonnées
- [ ] Tests unitaires

### **Phase 2 : UI Mode 1 - Liste Compacte (3h)**
- [ ] `SplitLayout` component
- [ ] `SearchResults` avec navigation `↑` / `↓`
- [ ] `HighlightedText` component (pattern surligné)
- [ ] Intégration Ctrl+S → clipboard
- [ ] Notifications visuelles

### **Phase 3 : UI Mode 2 - Expanded (2h)**
- [ ] `ExpandedView` component avec scroll
- [ ] Gestion `PgUp` / `PgDn`
- [ ] Navigation `n` / `p` entre résultats
- [ ] Ctrl+S → copie complète

### **Phase 4 : Input Integration (1h)**
- [ ] Détecter `/search` dans input handler
- [ ] Ctrl+P → paste clipboard dans input
- [ ] Toggle search mode (Esc)

### **Phase 5 : Polish (1h)**
- [ ] Bordures et styling
- [ ] Empty states
- [ ] Help overlay (`?`)
- [ ] Optimisations performance

### **Phase 6 : Mode 3 - Multi-Select (optionnel, 2h)**
- [ ] Gestion multi-selection
- [ ] Checkboxes `☑` / `☐`
- [ ] Ctrl+A, Ctrl+D
- [ ] Copie multiple

---

## 🎯 Avantages de cette Approche

### **Pourquoi Clipboard Système > Copie Auto Prompt**

| Critère | Clipboard Système | Auto Prompt |
|---------|-------------------|-------------|
| **Flexibilité** | ✅ Copier vers éditeur externe, autre app | ❌ Bloqué dans le prompt |
| **Édition** | ✅ Modifier dans VSCode, vim, etc. | ❌ Difficile d'éditer |
| **Multi-usage** | ✅ Réutiliser dans plusieurs contextes | ❌ Usage unique |
| **Contrôle** | ✅ User décide quand/où coller | ❌ Automatique = moins de contrôle |
| **Workflow** | ✅ Compatible workflow CLI avancé | ⚠️ Workflow basique |

**Exemple workflow avancé** :
```bash
# 1. Chercher dans Grok CLI
/search "fonction async"

# 2. Copier résultat avec Ctrl+S
# ✅ Clipboard rempli

# 3. Ouvrir éditeur externe
vim analysis.md

# 4. Coller dans vim
i  # Insert mode
Ctrl+Shift+V  # Paste

# 5. Éditer, ajouter contexte
# ...

# 6. Retour vers Grok CLI
# 7. Coller version éditée avec Ctrl+P
```

---

## 💡 Améliorations Futures

### **Export Formats**
```bash
/search-export sqlite --format=markdown > results.md
/search-export sqlite --format=json > results.json
```

### **Smart Search**
```bash
/search "sqlite performance" --similar  # Semantic search
/search --regex "function.*async.*await"
```

### **Search History**
```bash
/search-history  # Voir dernières recherches
↑ / ↓           # Naviguer
Enter           # Relancer
```

---

## ❓ Questions pour Zack

1. **Clipboard library** : `clipboardy` OK ou tu préfères une autre ?

2. **Copie format** : 
   - Plain text simple (comme proposé)
   - Ou avec Markdown formatting (`**bold**`, `- liste`)

3. **Ctrl+P behavior** :
   - Remplace tout l'input
   - Ou append au contenu existant

4. **Multi-select (Mode 3)** :
   - Priorité haute (Phase 1-2) 
   - Ou low priority (Phase 6 optionnelle)

5. **Notifications** :
   - Box en bas (comme proposé)
   - Ou toast discret coin supérieur droit

---

**Prêt à implémenter dès que tu valides ! 🚀**

Qu'est-ce qui te plaît le plus dans ce plan ? Des ajustements ?
