# 🔍 Feature: Recherche dans l'Historique SQLite

## 🎯 Objectif

Permettre de chercher dans l'historique des conversations avec un split-screen interactif.

---

## 📋 Spécifications

### Commande
```bash
/search <pattern>
```

**Exemples** :
```bash
/search sqlite
/search "fonction async"
/search performance
/search /regex?/
```

### UI Split Screen

```
┌─────────────────────────────────────────────────────────────┐
│  GROK Banner                                                │
├──────────────────────────┬──────────────────────────────────┤
│  Conversation Actuelle   │  Résultats Recherche             │
│  (50% largeur)           │  (50% largeur)                   │
│                          │                                  │
│  > Hello                 │  📊 3 résultats pour "sqlite"   │
│  ⏺ Hi!                   │  ─────────────────────────────  │
│                          │                                  │
│  > /search sqlite        │  [1/3] Session #1 - 2024-11-20  │
│                          │  > Migrer vers sqlite            │
│  ┌──────────────────┐   │  ⏺ SQLite est meilleur que JSONL│
│  │ ❯ Ask...        │   │     [sqlite] offre...            │
│  └──────────────────┘   │                                  │
│  ⏸ auto-edit: off       │  [2/3] Session #2 - 2024-11-19  │
│                          │  > Pourquoi sqlite ?             │
│                          │  ⏺ [SQLite] permet...           │
│                          │                                  │
│                          │  [3/3] Session #1 - 2024-11-20  │
│                          │  > Base [sqlite] fonctionne      │
│                          │                                  │
│                          │  ↑/↓: Navigate  Enter: Select   │
│                          │  Esc: Close                      │
└──────────────────────────┴──────────────────────────────────┘
```

---

## 🏗️ Architecture Technique

### 1. Recherche SQL (3 options)

#### Option A : LIKE (Simple, immédiat)
```sql
SELECT m.*, s.working_dir 
FROM messages m
JOIN sessions s ON m.session_id = s.id
WHERE m.content LIKE '%pattern%'
ORDER BY m.timestamp DESC
LIMIT 50;
```

**Pros** :
- ✅ Aucune migration nécessaire
- ✅ Fonctionne immédiatement
- ✅ Case-insensitive avec COLLATE NOCASE

**Cons** :
- ⚠️ Lent sur gros volumes (pas d'index)
- ⚠️ Pas de ranking de pertinence

---

#### Option B : FTS5 (Full-Text Search) ⭐ RECOMMANDÉ
```sql
-- Migration : Créer table FTS5
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content_row_id UNINDEXED
);

-- Populer depuis messages existants
INSERT INTO messages_fts(rowid, content)
SELECT id, content FROM messages;

-- Recherche
SELECT m.*, rank 
FROM messages_fts fts
JOIN messages m ON fts.rowid = m.id
WHERE messages_fts MATCH 'pattern'
ORDER BY rank;
```

**Pros** :
- ✅ Très rapide (index tokenisé)
- ✅ Ranking de pertinence
- ✅ Support phrase exacte ("exact phrase")
- ✅ Opérateurs : AND, OR, NOT
- ✅ Prefix search (sqlite*)

**Cons** :
- ⚠️ Nécessite migration
- ⚠️ Table FTS5 = 2x espace disque

---

#### Option C : Regex (Avancé)
```sql
-- Nécessite extension sqlite3-pcre
SELECT * FROM messages 
WHERE content REGEXP 'pattern'
```

**Pros** :
- ✅ Patterns complexes

**Cons** :
- ❌ Nécessite extension C
- ❌ Plus lent que FTS5

---

### 2. UI Components (Ink)

#### A. Split Layout Component

**`src/ui/components/split-layout.tsx`**
```tsx
interface SplitLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  splitRatio?: number; // 0.5 = 50/50
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  left,
  right,
  splitRatio = 0.5,
}) => {
  const { stdout } = useStdout();
  const width = stdout.columns;
  const leftWidth = Math.floor(width * splitRatio);
  const rightWidth = width - leftWidth;

  return (
    <Box flexDirection="row">
      <Box width={leftWidth} flexDirection="column" borderStyle="single" borderRight>
        {left}
      </Box>
      <Box width={rightWidth} flexDirection="column" borderStyle="single">
        {right}
      </Box>
    </Box>
  );
};
```

---

#### B. Search Results Component

**`src/ui/components/search-results.tsx`**
```tsx
interface SearchResult {
  messageId: number;
  sessionId: number;
  sessionDate: string;
  type: 'user' | 'assistant';
  content: string;
  matchPositions: number[]; // Positions du pattern dans le texte
  context: {
    before: string;
    after: string;
  };
}

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  results,
  selectedIndex,
  onSelect,
  onClose,
}) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📊 {results.length} résultats pour "{query}"
        </Text>
      </Box>
      
      <Box borderStyle="single" borderColor="gray" marginBottom={1} />
      
      <Box flexDirection="column" flexGrow={1}>
        {results.map((result, index) => (
          <SearchResultItem
            key={result.messageId}
            result={result}
            query={query}
            isSelected={index === selectedIndex}
            index={index + 1}
            total={results.length}
          />
        ))}
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓: Navigate  Enter: Copy  Esc: Close
        </Text>
      </Box>
    </Box>
  );
};
```

---

#### C. Highlighted Text Component

**`src/ui/components/highlighted-text.tsx`**
```tsx
interface HighlightedTextProps {
  text: string;
  query: string;
  highlightColor?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  query,
  highlightColor = 'yellow',
}) => {
  // Échapper regex spécial chars
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  return (
    <Text>
      {parts.map((part, i) => {
        const isMatch = regex.test(part);
        return isMatch ? (
          <Text key={i} backgroundColor={highlightColor} color="black">
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        );
      })}
    </Text>
  );
};
```

---

### 3. Search Manager (Business Logic)

**`src/utils/search-manager.ts`**
```typescript
import { db } from '../db/database.js';
import { Message } from '../db/types.js';

export interface SearchOptions {
  query: string;
  sessionId?: number; // Limit to specific session
  type?: 'user' | 'assistant'; // Filter by message type
  limit?: number;
  caseSensitive?: boolean;
}

export interface SearchResult {
  message: Message;
  sessionDir: string;
  matchCount: number;
  matchPositions: number[];
  contextBefore?: Message; // Message précédent pour contexte
  contextAfter?: Message; // Message suivant
}

export class SearchManager {
  private db: Database.Database;

  constructor() {
    this.db = db.getDb();
  }

  /**
   * Search messages with LIKE (simple)
   */
  searchSimple(options: SearchOptions): SearchResult[] {
    const { query, sessionId, type, limit = 50, caseSensitive = false } = options;
    
    let sql = `
      SELECT m.*, s.working_dir as session_dir
      FROM messages m
      JOIN sessions s ON m.session_id = s.id
      WHERE m.content LIKE ?
    `;
    
    const params: any[] = [caseSensitive ? `%${query}%` : `%${query}%`];
    
    if (sessionId) {
      sql += ' AND m.session_id = ?';
      params.push(sessionId);
    }
    
    if (type) {
      sql += ' AND m.type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY m.timestamp DESC LIMIT ?';
    params.push(limit);
    
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.enrichResult(row, query));
  }

  /**
   * Enrich result with context and match positions
   */
  private enrichResult(row: any, query: string): SearchResult {
    const message: Message = {
      id: row.id,
      session_id: row.session_id,
      type: row.type,
      role: row.role,
      content: row.content,
      content_type: row.content_type,
      provider: row.provider,
      model: row.model,
      api_key_hash: row.api_key_hash,
      timestamp: row.timestamp,
      token_count: row.token_count,
      tool_calls: row.tool_calls,
      tool_call_id: row.tool_call_id,
      is_streaming: row.is_streaming,
      parent_message_id: row.parent_message_id,
    };

    // Find match positions
    const matchPositions = this.findMatchPositions(row.content, query);
    
    // Get context messages
    const contextBefore = this.getContextMessage(row.id, row.session_id, 'before');
    const contextAfter = this.getContextMessage(row.id, row.session_id, 'after');

    return {
      message,
      sessionDir: row.session_dir,
      matchCount: matchPositions.length,
      matchPositions,
      contextBefore,
      contextAfter,
    };
  }

  /**
   * Find all positions where query matches in text
   */
  private findMatchPositions(text: string, query: string): number[] {
    const positions: number[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let pos = lowerText.indexOf(lowerQuery);
    while (pos !== -1) {
      positions.push(pos);
      pos = lowerText.indexOf(lowerQuery, pos + 1);
    }
    
    return positions;
  }

  /**
   * Get message before or after for context
   */
  private getContextMessage(
    messageId: number,
    sessionId: number,
    direction: 'before' | 'after'
  ): Message | undefined {
    const operator = direction === 'before' ? '<' : '>';
    const order = direction === 'before' ? 'DESC' : 'ASC';
    
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ? AND id ${operator} ?
      ORDER BY id ${order}
      LIMIT 1
    `);
    
    return stmt.get(sessionId, messageId) as Message | undefined;
  }
}

export const searchManager = new SearchManager();
```

---

### 4. Command Handler

**`src/commands/search.ts`**
```typescript
import { searchManager, SearchOptions } from '../utils/search-manager.js';

export interface SearchCommand {
  type: 'search';
  query: string;
  options?: Partial<SearchOptions>;
}

export function parseSearchCommand(input: string): SearchCommand | null {
  const match = input.match(/^\/search\s+(.+)$/);
  if (!match) return null;

  const query = match[1].trim();
  
  // Parse options si format avancé: /search "pattern" --session=1 --type=user
  // Pour l'instant, simple query
  
  return {
    type: 'search',
    query,
  };
}

export function handleSearchCommand(command: SearchCommand) {
  const results = searchManager.searchSimple({
    query: command.query,
    limit: 50,
  });

  return results;
}
```

---

### 5. Integration dans Chat Interface

**Modifications à `src/ui/components/chat-interface.tsx`**

```typescript
// Ajouter états
const [searchMode, setSearchMode] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

// Dans useInputHandler, détecter /search
const handleCommand = (input: string) => {
  const searchCmd = parseSearchCommand(input);
  
  if (searchCmd) {
    const results = handleSearchCommand(searchCmd);
    setSearchQuery(searchCmd.query);
    setSearchResults(results);
    setSearchMode(true);
    setSelectedSearchIndex(0);
    return;
  }
  
  // ... autres commandes
};

// Navigation dans résultats (avec useInput)
useInput((input, key) => {
  if (!searchMode) return;
  
  if (key.upArrow) {
    setSelectedSearchIndex(Math.max(0, selectedSearchIndex - 1));
  } else if (key.downArrow) {
    setSelectedSearchIndex(Math.min(searchResults.length - 1, selectedSearchIndex + 1));
  } else if (key.return) {
    // Enter : Copy to input
    const selected = searchResults[selectedSearchIndex];
    setInput(selected.message.content);
    setSearchMode(false);
  } else if (key.escape) {
    setSearchMode(false);
  }
});

// Render
return searchMode ? (
  <SplitLayout
    left={<ChatView />} // Conversation actuelle
    right={
      <SearchResults
        query={searchQuery}
        results={searchResults}
        selectedIndex={selectedSearchIndex}
        onSelect={handleSelectResult}
        onClose={() => setSearchMode(false)}
      />
    }
  />
) : (
  <ChatView /> // Normal full-screen
);
```

---

## 🎨 UX Features

### Navigation Clavier

| Touche | Action |
|--------|--------|
| `↑` / `↓` | Naviguer dans les résultats |
| `Enter` | Copier le message sélectionné dans l'input |
| `Esc` | Fermer la recherche |
| `Tab` | Basculer focus gauche/droite (future) |
| `Ctrl+C` | Copier texte surligné (future) |

### Highlight Colors

- 🟡 **Jaune** : Match exact du pattern
- 🔵 **Bleu** : Résultat sélectionné (background)
- ⚪ **Gris** : Contexte (messages avant/après)

---

## 📋 Plan d'Implémentation

### Phase 1 : Search Backend (1-2h)
- [ ] Créer `SearchManager` avec recherche LIKE simple
- [ ] Créer `search-manager.ts`
- [ ] Créer `commands/search.ts`
- [ ] Tests unitaires

### Phase 2 : UI Components (2-3h)
- [ ] `SplitLayout` component
- [ ] `SearchResults` component
- [ ] `HighlightedText` component
- [ ] `SearchResultItem` component

### Phase 3 : Integration (1-2h)
- [ ] Intégrer dans `chat-interface.tsx`
- [ ] Détecter `/search` command
- [ ] Navigation clavier
- [ ] Mode switch (normal ↔ search)

### Phase 4 : Polish (1h)
- [ ] Styling et colors
- [ ] Empty states ("No results")
- [ ] Loading states
- [ ] Keyboard shortcuts help

### Phase 5 : Advanced (optionnel)
- [ ] Migration vers FTS5
- [ ] Regex support
- [ ] Filtres avancés (--session, --type, --date)
- [ ] Export résultats

---

## 🚀 Alternative : Approche Plus Simple

Si split-screen trop complexe, **approche progressive** :

### V1 : Inline Results (Plus simple)
```
> /search sqlite

📊 3 résultats pour "sqlite" :

[1] Session #1 - 2024-11-20 09:00
> Migrer vers [sqlite]
⏺ SQLite est meilleur que JSONL car [sqlite] offre...

[2] Session #2 - 2024-11-19 15:30
> Pourquoi [sqlite] ?

[3] Session #1 - 2024-11-20 09:05
> Base [sqlite] fonctionne

Commands: /search-copy 1  (copie résultat #1)
          /search-more    (voir plus)
          /search-clear   (fermer)
```

**Pros** :
- ✅ Beaucoup plus simple à implémenter (30min)
- ✅ Pas de split screen complexe
- ✅ Fonctionnel immédiatement

**Cons** :
- ⚠️ Moins interactif
- ⚠️ Pas de navigation au curseur

---

## 💡 Recommandation

**Je recommande approche progressive** :

1. **V1** (Inline Results) → 30 min → Fonctionnel immédiatement
2. **V2** (Split Screen) → +4h → Plus riche
3. **V3** (FTS5 + Advanced) → +2h → Production-ready

**Commencer par V1 pour valider le concept, puis upgrader si ça marche bien.**

---

## ❓ Questions

1. **Approche préférée** : Inline (V1) ou Split-screen (V2) direct ?
2. **FTS5** : Migrer maintenant ou rester sur LIKE ?
3. **Scope initial** : Recherche simple ou avec filtres (--session, --type) ?
4. **Copy behavior** : Copie tout le message ou juste la partie surlignée ?

---

**Prêt à implémenter ?** Dites-moi quelle version vous voulez ! 🚀
