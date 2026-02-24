# Grokinou CLI — Briefing Complet pour Développement Collaboratif

**Date**: 2026-02-23
**Projet**: Grokinou — CLI de développement assisté par IA
**Repo**: `~/GROK_CLI/grok-cli`
**Objectif**: Document de référence pour permettre à n'importe quel LLM (GPT, Claude, etc.) de contribuer au développement

---

## 1. Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js (ESM strict) |
| Langage | TypeScript |
| UI Terminal | React + Ink 4 |
| Base de données | SQLite via better-sqlite3 |
| API LLM | OpenAI SDK (wrapper universel) |
| Build | tsc → dist/ |
| Tests | Scripts manuels (test/*.test.ts) |

**Conventions ESM critiques**:
- `import`/`export` uniquement (jamais `require()`)
- Extension `.js` **obligatoire** dans tous les imports relatifs
- `"type": "module"` dans package.json

---

## 2. Architecture Haut Niveau

```
src/
├── index.ts                    # Point d'entrée CLI (Commander.js)
├── agent/
│   ├── grok-agent.ts           # Agent principal (orchestration LLM + tools)
│   └── prompt-loader.ts        # Chargement system prompt
├── grok/
│   ├── client.ts               # GrokClient (wrapper OpenAI SDK universel)
│   └── tools.ts                # Définitions des 22+ tools LLM
├── tools/
│   ├── text-editor.ts          # view_file, create_file, str_replace_editor
│   ├── bash.ts                 # Exécution commandes bash
│   ├── search.ts               # Recherche code (ripgrep + ranking)
│   ├── apply-patch.ts          # Unified diff patches
│   ├── morph-editor.ts         # edit_file via Morph API (conditionnel)
│   ├── todo-tool.ts            # Gestion todos (in-memory)
│   ├── session-tools.ts        # session_list/switch/new/rewind
│   ├── timeline-query-tool.ts  # Requêtes timeline events
│   ├── rewind-to-tool.ts       # Time machine (rewind_to + list_time_points)
│   ├── get-my-identity.ts      # Identité modèle
│   ├── conversation-fts.ts     # FTS5 sur conversations
│   └── index.ts                # Exports
├── skills/                     # NEW — Système multi-agent
│   ├── frontmatter.ts          # Parser YAML frontmatter maison
│   ├── skill-registry.ts       # Charge skills depuis .md (3 niveaux)
│   ├── sub-agent.ts            # Sous-agent isolé (GrokClient dédié)
│   ├── skill-runner.ts         # Orchestration séquentielle/parallèle
│   ├── index.ts                # Exports
│   └── builtins/               # 5 skills intégrés (.md)
│       ├── code-review.md
│       ├── security-scan.md
│       ├── explain.md
│       ├── refactor.md
│       └── test-gen.md
├── db/
│   ├── database.ts             # Init conversations.db + schema
│   ├── repositories/           # SessionRepository, MessageRepository
│   └── migrations/             # 3 migrations (001-003)
├── timeline/
│   ├── schema.ts               # Schema timeline.db (events, snapshots, blobs)
│   ├── database.ts             # Init timeline.db
│   ├── timeline-logger.ts      # Logger atomique vers timeline.db
│   ├── event-bus.ts            # Event bus (emit + listeners)
│   ├── event-types.ts          # 61 types d'événements
│   ├── query-engine.ts         # Requêtes sur events
│   ├── snapshot-manager.ts     # Snapshots auto (100 events / 5 min)
│   ├── rewind-engine.ts        # Reconstruction d'état passé
│   └── storage/
│       └── merkle-dag.ts       # Content-addressable storage (SHA256 + gzip)
├── mcp/
│   ├── client.ts               # MCPManager (Model Context Protocol)
│   └── config.ts               # Config MCP servers
├── hooks/
│   ├── use-input-handler.ts    # Hook principal (37+ slash commands)
│   └── use-enhanced-input.ts   # Input bas niveau (curseur, historique)
├── ui/
│   ├── app.tsx                 # Composant React/Ink principal
│   └── components/
│       ├── layout-manager.tsx  # Routage clavier (split/fullscreen)
│       ├── input-controller.tsx# Input avec React.memo
│       └── execution-viewer.tsx# Panel exécution avec scroll
├── utils/
│   ├── provider-manager.ts     # Multi-provider (Grok, Claude, OpenAI, DeepSeek, Mistral)
│   ├── session-manager-sqlite.ts # Persistence sessions SQLite
│   ├── settings-manager.ts     # Settings utilisateur
│   ├── wal-shipper.ts          # Backup WAL atomique
│   ├── jsonl-exporter.ts       # Export JSONL périodique
│   ├── search-cache.ts         # Cache SQLite pour recherche
│   └── ...
├── types/
│   └── index.ts                # ToolResult, Tool, EditorCommand
└── prompts/
    └── *.md                    # System prompts externalisés
```

---

## 3. Providers LLM Supportés

| Provider | Base URL | Modèles principaux | Env var clé |
|----------|----------|---------------------|-------------|
| **Grok (xAI)** | api.x.ai/v1 | grok-4-latest, grok-code-fast-1, grok-3-fast | GROK_API_KEY |
| **Claude (Anthropic)** | api.anthropic.com/v1 | claude-sonnet-4-5, claude-3-5-sonnet | ANTHROPIC_API_KEY |
| **OpenAI** | api.openai.com/v1 | gpt-5, gpt-4o, o3, o1 | OPENAI_API_KEY |
| **DeepSeek** | api.deepseek.com/v1 | deepseek-chat, deepseek-coder | DEEPSEEK_API_KEY |
| **Mistral** | api.mistral.ai/v1 | mistral-large, codestral | MISTRAL_API_KEY |

Tous passent par `GrokClient` (wrapper OpenAI SDK). Auto-détection du provider depuis le nom du modèle.

---

## 4. Bases de Données

### conversations.db (`~/.grok/conversations.db`)

PRAGMAS: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`

```sql
-- Sessions de conversation
sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  working_dir TEXT NOT NULL,
  session_hash TEXT UNIQUE NOT NULL,     -- SHA256 tronqué 16 chars
  default_provider TEXT NOT NULL DEFAULT 'grok',
  default_model TEXT NOT NULL,
  api_key_hash TEXT,
  started_at DATETIME, ended_at DATETIME,
  last_activity DATETIME,
  status TEXT DEFAULT 'active',          -- active|completed|archived
  title TEXT, tags TEXT, metadata TEXT, user_id TEXT,
  -- Champs dénormalisés (migration 002):
  session_name TEXT, created_at DATETIME,
  message_count INTEGER DEFAULT 0, total_tokens INTEGER DEFAULT 0,
  first_message_preview TEXT, last_message_preview TEXT,
  project_context TEXT, is_favorite INTEGER DEFAULT 0
);
-- 8 indexes

-- Messages (chat + tool calls)
messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL,                    -- user_message|assistant_message|tool_call|tool_result
  role TEXT NOT NULL,                    -- user|assistant|tool|system
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  provider TEXT NOT NULL, model TEXT NOT NULL,
  api_key_hash TEXT,
  timestamp DATETIME, token_count INTEGER DEFAULT 0,
  tool_calls TEXT,                       -- JSON (pour assistant avec tool_calls)
  tool_call_id TEXT,                     -- ID du tool call (pour tool results)
  is_streaming BOOLEAN DEFAULT 0,
  parent_message_id INTEGER REFERENCES messages(id)
);
-- 3 indexes
```

### timeline.db (`~/.grok/timeline.db`)

PRAGMAS: WAL + `cache_size=-64000` (64MB) + `temp_store=MEMORY` + `wal_autocheckpoint=1000`

```sql
-- Log immutable d'événements (event sourcing)
events (
  id TEXT PRIMARY KEY,                    -- UUID v4
  timestamp INTEGER NOT NULL,             -- Microsecondes Unix
  sequence_number INTEGER NOT NULL UNIQUE,
  actor TEXT NOT NULL,                    -- user|llm:<model>|tool:<name>|system
  event_type TEXT NOT NULL,               -- 61 types / 9 catégories
  aggregate_id TEXT,                      -- Entité (fichier, session, etc.)
  aggregate_type TEXT,                    -- session|file|conversation|git
  payload TEXT NOT NULL,                  -- JSON spécifique à l'événement
  correlation_id TEXT,                    -- Groupement transactionnel
  causation_id TEXT,                      -- Chaîne causale
  metadata TEXT,                          -- Contexte additionnel (JSON)
  checksum TEXT NOT NULL                  -- SHA256(payload)
);
-- 6 indexes

-- Snapshots d'état (pour accélération rewind)
snapshots (
  id TEXT PRIMARY KEY,
  timestamp INTEGER, sequence_number INTEGER,
  event_count INTEGER, session_id INTEGER, session_name TEXT,
  working_dir TEXT, git_commit_hash TEXT, git_branch TEXT,
  file_count INTEGER,
  compressed_size_bytes INTEGER, uncompressed_size_bytes INTEGER,
  snapshot_data BLOB NOT NULL,           -- gzip(SnapshotData JSON)
  created_at INTEGER
);

-- Merkle DAG content-addressable storage
file_blobs (
  hash TEXT PRIMARY KEY,                  -- SHA256 (64 chars)
  content BLOB NOT NULL,                  -- gzip(contenu fichier)
  is_delta INTEGER DEFAULT 0,             -- 0=complet, 1=delta
  base_hash TEXT REFERENCES file_blobs(hash),
  size INTEGER, compressed_size INTEGER,
  created_at INTEGER
);

-- Arborescences de fichiers
file_trees (
  hash TEXT PRIMARY KEY,                  -- SHA256 de la structure
  tree_json TEXT NOT NULL,                -- JSON arborescence
  parent_hash TEXT REFERENCES file_trees(hash),
  timestamp INTEGER, total_files INTEGER
);

-- Cache de rewind
rewind_cache (
  target_timestamp INTEGER PRIMARY KEY,
  snapshot_sequence INTEGER, tree_hash TEXT,
  state_json TEXT,                        -- État matérialisé
  created_at INTEGER, hit_count INTEGER DEFAULT 0
);

-- Métadonnées
metadata (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
```

**Catégories d'événements (61 types)**: SESSION (5), LLM (7), TOOL (6), FILE (7), DIRECTORY (4), GIT (15+), CLI (8), REWIND (6), SNAPSHOT (3)

---

## 5. Tools LLM (22 tools)

Définis dans `src/grok/tools.ts`, dispatch dans `src/agent/grok-agent.ts:executeTool()`.

| Tool | Fichier impl. | Infra | Status |
|------|--------------|-------|--------|
| `view_file` | text-editor.ts | fs | ✅ |
| `create_file` | text-editor.ts | fs, confirmation | ✅ |
| `str_replace_editor` | text-editor.ts | fs, confirmation | ✅ |
| `edit_file` | morph-editor.ts | MORPH_API_KEY | 🟡 Conditionnel |
| `apply_patch` | apply-patch.ts | fs, confirmation | ✅ |
| `bash` | bash.ts | child_process, confirm | ✅ |
| `search` | search.ts | ripgrep | ✅ |
| `search_conversation` | grok-agent.ts | conversations.db | ✅ |
| `search_conversation_advanced` | conversation-fts.ts | FTS5 | ✅ |
| `search_advanced` | search.ts | FTS5 + embeddings | 🟡 Semantic optionnel |
| `search_more` | search.ts | search cache | ✅ |
| `create_todo_list` | todo-tool.ts | mémoire | 🟡 Non persisté |
| `update_todo_list` | todo-tool.ts | mémoire | 🟡 Non persisté |
| `get_my_identity` | get-my-identity.ts | providerManager | ✅ |
| `session_list` | session-tools.ts | conversations.db | ✅ |
| `session_switch` | session-tools.ts | conversations.db, fs | ✅ |
| `session_new` | session-tools.ts | fs, git | ✅ |
| `session_rewind` | session-tools.ts | git, sessionManager | ✅ |
| `timeline_query` | timeline-query-tool.ts | timeline.db | ✅ |
| `rewind_to` | rewind-to-tool.ts | timeline.db, Merkle DAG | ✅ |
| `list_time_points` | rewind-to-tool.ts | snapshots | ✅ |
| `delegate_to_specialist` | skills/skill-runner.ts | providers LLM, skills MD | ✅ |
| MCP tools (dynamique) | mcp/client.ts | MCP servers | 🟡 Si configuré |

---

## 6. Commandes Utilisateur (37+)

Toutes dans `src/hooks/use-input-handler.ts:handleDirectCommand()`.

**Configuration**: `/models`, `/model-default`, `/apikey`, `/semantic-config`, `/user`, `/name`, `/status`
**Sessions**: `/list_sessions`, `/switch-session`, `/rename_session`, `/new-session`, `/clear`, `/clear-session`, `/clear-disk-session`
**Recherche**: `/search-conversation`, `/search-conversation-advanced`, `/search-code`, `/search-code-advanced`, `/search-more`
**FTS**: `/conversation-fts-status`, `/rebuild-conversation-fts`
**Timeline/Rewind**: `/timeline`, `/rewind`, `/snapshots`, `/rewind-history`, `/timeline-check`, `/timeline-rewind-test`
**DB ops**: `/db-verify`, `/db-restore`, `/db-export-jsonl`, `/backup-status`
**Review**: `/review-list`, `/review-view`
**Skills**: `/skills [list|run <name>|reload]`
**Dev**: `/commit-and-push`, `/list_tools`, `/help`

Toutes sont **async** (non-bloquantes) et **fully implemented**.

---

## 7. Système Multi-Agent / Skills

**Nouveau** (février 2026). Permet de déléguer des tâches à des sous-agents spécialisés.

### Format skill (fichier .md avec YAML frontmatter)
```markdown
---
name: code-review
description: Multi-perspective code review
model: gpt-4o              # optionnel
provider: openai            # optionnel
tools: [view_file, search]  # subset de tools
parallel: true
---
Prompt du skill ici...
```

### Chargement (3 niveaux, priorité décroissante)
1. `.grokinou/skills/*.md` (projet)
2. `~/.config/grokinou/skills/*.md` (user)
3. `src/skills/builtins/*.md` (built-in)

### Utilisation
- **Slash command**: `/skills run code-review <contexte>`
- **Tool LLM**: `delegate_to_specialist` (le LLM décide seul de déléguer)
- **Multi-provider**: Envoyer le même skill à GPT-5 + Claude + DeepSeek en parallèle

### Skills built-in
| Skill | Description |
|-------|-------------|
| code-review | Review multi-perspective (archi, sécu, perf, lisibilité) |
| security-scan | Audit OWASP Top 10 |
| explain | Explication pédagogique de code |
| refactor | Suggestions de refactoring avec avant/après |
| test-gen | Génération de tests |

---

## 8. Patterns Clés

### ToolResult (interface universelle)
```typescript
interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  stderr?: string;
  exitCode?: number;
  data?: any;
}
```

### GrokClient (wrapper universel)
```typescript
// Même client pour tous les providers (OpenAI SDK)
const client = new GrokClient(apiKey, model, baseURL);
const response = await client.chat(messages, tools, model);
// response.choices[0].message.content / .tool_calls
```

### providerManager (singleton)
```typescript
providerManager.detectProvider("gpt-5")        // → "openai"
providerManager.getProviderForModel("claude-3") // → ProviderConfig
providerManager.hasApiKey("openai")             // → boolean
```

### Confirmation workflow
Les tools destructifs (create_file, str_replace_editor, bash, apply_patch) passent par `ConfirmationService` qui demande confirmation à l'utilisateur avant exécution.

### ExecutionStream (COT)
Chaque exécution de tool émet des Chain-of-Thought events (`thinking`, `action`, `observation`, `decision`) pour l'UI.

---

## 9. Récupération de Session

En cas de perte de session ou compromission:

1. **`/db-verify conversations`** — Vérifier intégrité conversations.db
2. **`/db-verify timeline`** — Vérifier intégrité timeline.db
3. **`/backup-status`** — Voir les backups WAL disponibles
4. **`/db-restore conversations`** — Restaurer depuis snapshot + WAL
5. **`/db-export-jsonl conversations`** — Export en JSONL portable
6. **`/rebuild-conversation-fts`** — Reconstruire l'index FTS5
7. **`/rewind "2026-02-20T15:00:00Z"`** — Remonter le temps via event sourcing
8. **`/snapshots`** — Lister les points de restauration automatiques

---

## 10. Commandes Build

```bash
npm run build       # tsc + copie prompts + copie builtins skills + chmod
npm run dev         # Mode développement (bun)
npm run rebuild     # build + npm link
npm test            # Compile tests + exécute
```

---

## 11. Gaps Connus

| Gap | Sévérité | Détail |
|-----|----------|--------|
| Todos non persistés | Medium | `create_todo_list`/`update_todo_list` en mémoire seule |
| search_advanced rebuild FTS à chaque appel | Medium | Performance sur gros repos |
| Pas de tests unitaires pour commands | Medium | Couverture tests faible |
| Semantic search config manuelle | Low | Mode heuristic fonctionne par défaut |
| Morph edit_file conditionnel | Low | Nécessite MORPH_API_KEY |

---

## 12. Pour Contribuer

1. **Lire** les fichiers avant modification (comprendre les patterns existants)
2. **ESM strict** — `.js` dans les imports, pas de `require()`
3. **ToolResult** — Toujours retourner `{ success, output?, error? }`
4. **Tester le build** — `npm run build` avant tout commit
5. **Commits atomiques** — Format `type(scope): description`
6. **Pas de mocks** — Code production uniquement
7. **Pas de POC** — Implémentations complètes

---

*Généré le 2026-02-23 — Ce document est la référence pour le développement collaboratif multi-LLM de Grokinou CLI.*
