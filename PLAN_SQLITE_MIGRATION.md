# 📊 Plan Migration SQLite - Gestion Multi-Providers

## 🎯 Objectifs

1. **Migrer** de JSONL vers SQLite
2. **Associer** chaque conversation à :
   - Répertoire de travail
   - Provider (grok, claude, openai, mistral, deepseek, etc.)
   - Clé API utilisée
3. **Restaurer** automatiquement la bonne conversation au démarrage
4. **Switcher** de clé API en cours de conversation avec `/apikey`

---

## 📊 Avantages SQLite vs JSONL

### ✅ Avantages SQLite

| Critère | JSONL | SQLite |
|---------|-------|--------|
| **Requêtes complexes** | ❌ Doit tout lire | ✅ SELECT WHERE |
| **Performance** | ❌ O(n) lecture complète | ✅ O(log n) avec index |
| **Filtrage** | ❌ Filtrage en mémoire | ✅ Filtrage SQL natif |
| **Multi-sessions** | ❌ Un seul fichier global | ✅ Sessions par workdir |
| **Historique provider** | ❌ Pas de métadonnées | ✅ Tracking complet |
| **Migrations** | ❌ Difficile | ✅ ALTER TABLE |
| **Intégrité** | ❌ Manuelle | ✅ Contraintes SQL |
| **Recherche** | ❌ Grep manuel | ✅ LIKE, FTS5 |
| **Concurrence** | ❌ Risque corruption | ✅ ACID |
| **Statistiques** | ❌ Calcul manuel | ✅ Agrégations SQL |

### 🔍 Cas d'usage pratiques

**Exemple 1 : Restaurer conversation par workdir**
```sql
-- SQLite
SELECT * FROM messages WHERE session_id = (
  SELECT id FROM sessions WHERE working_dir = '/home/zack/project'
) ORDER BY created_at;

-- JSONL
# Lire tout le fichier, filtrer en mémoire, pas de lien workdir
```

**Exemple 2 : Changer de provider en cours**
```sql
-- SQLite
INSERT INTO messages (session_id, provider, content, ...) 
VALUES (..., 'claude', 'Continue avec Claude', ...);

-- JSONL
# Pas de tracking provider, nécessite parsing manuel
```

**Exemple 3 : Statistiques d'usage**
```sql
-- SQLite
SELECT provider, COUNT(*), AVG(token_count) 
FROM messages 
WHERE created_at > date('now', '-30 days')
GROUP BY provider;

-- JSONL
# Impossible sans parser tout le fichier
```

---

## 🗄️ Schéma de Base de Données

### Table `sessions`
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  working_dir TEXT NOT NULL,           -- /home/zack/project
  session_hash TEXT UNIQUE NOT NULL,   -- hash(working_dir)
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  
  -- Métadonnées
  title TEXT,                          -- "Migration SQLite discussion"
  tags TEXT,                           -- JSON array: ["dev", "database"]
  
  INDEX idx_working_dir (working_dir),
  INDEX idx_session_hash (session_hash),
  INDEX idx_last_activity (last_activity)
);
```

### Table `messages`
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  
  -- Type de message
  type TEXT NOT NULL,                  -- 'user' | 'assistant' | 'tool_result' | 'system'
  role TEXT NOT NULL,                  -- 'user' | 'assistant' | 'tool'
  
  -- Contenu
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',    -- 'text' | 'markdown' | 'code' | 'diff'
  
  -- Provider info
  provider TEXT NOT NULL,              -- 'grok' | 'claude' | 'openai' | 'mistral' | 'deepseek'
  model TEXT NOT NULL,                 -- 'grok-code-fast-1' | 'claude-sonnet-4' | ...
  api_key_hash TEXT,                   -- hash(api_key) pour tracking (pas la clé elle-même!)
  
  -- Métadonnées
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  token_count INTEGER DEFAULT 0,
  tool_calls TEXT,                     -- JSON des tool_calls
  tool_call_id TEXT,                   -- Si type='tool_result'
  is_streaming BOOLEAN DEFAULT 0,
  
  -- Relations
  parent_message_id INTEGER,           -- Pour threading
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  
  INDEX idx_session_timestamp (session_id, timestamp),
  INDEX idx_provider (provider),
  INDEX idx_type (type)
);
```

### Table `api_keys` (optionnel, pour historique)
```sql
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  key_hash TEXT NOT NULL,              -- hash(api_key)
  label TEXT,                          -- "Work", "Personal", "Trial"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used DATETIME,
  is_active BOOLEAN DEFAULT 1,
  
  UNIQUE(provider, key_hash),
  INDEX idx_provider_active (provider, is_active)
);
```

### Table `settings` (cache settings)
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                 -- JSON value
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🏗️ Architecture Nouvelle

```
src/
├── db/
│   ├── database.ts              # Connexion SQLite
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_add_providers.sql
│   │   └── migration-runner.ts
│   ├── models/
│   │   ├── session.ts           # Model Session
│   │   ├── message.ts           # Model Message
│   │   └── api-key.ts           # Model ApiKey
│   └── repositories/
│       ├── session-repository.ts
│       ├── message-repository.ts
│       └── api-key-repository.ts
│
├── commands/
│   ├── apikey.ts                # /apikey command
│   ├── sessions.ts              # /sessions command
│   └── export.ts                # /export (jsonl, markdown)
│
└── utils/
    ├── session-manager.ts       # Nouvelle version SQLite
    └── migration-helper.ts      # JSONL → SQLite
```

---

## 🛠️ Implémentation Progressive

### Phase 1 : Setup SQLite (1-2h)
✅ **Objectif** : Base SQLite fonctionnelle

1. **Installation dépendances**
```bash
npm install better-sqlite3 @types/better-sqlite3
```

2. **Créer `src/db/database.ts`**
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const DB_PATH = path.join(os.homedir(), '.grok', 'conversations.db');

export class GrokDatabase {
  private db: Database.Database;
  
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }
  
  private initialize() {
    // Créer tables si pas existantes
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        working_dir TEXT NOT NULL,
        session_hash TEXT UNIQUE NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        token_count INTEGER DEFAULT 0,
        tool_calls TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_timestamp 
        ON messages(session_id, timestamp);
    `);
  }
  
  getDb() { return this.db; }
  close() { this.db.close(); }
}

export const db = new GrokDatabase();
```

3. **Tests basiques**
```typescript
// Test création session
const stmt = db.getDb().prepare(`
  INSERT INTO sessions (working_dir, session_hash) 
  VALUES (?, ?)
`);
stmt.run('/home/zack/test', 'hash123');
```

### Phase 2 : Repositories (2-3h)
✅ **Objectif** : CRUD pour sessions et messages

**`src/db/repositories/session-repository.ts`**
```typescript
export class SessionRepository {
  constructor(private db: Database.Database) {}
  
  findOrCreateByWorkdir(workdir: string): Session {
    const hash = hashWorkdir(workdir);
    
    let session = this.db.prepare(`
      SELECT * FROM sessions WHERE session_hash = ?
    `).get(hash);
    
    if (!session) {
      const result = this.db.prepare(`
        INSERT INTO sessions (working_dir, session_hash) 
        VALUES (?, ?) RETURNING *
      `).get(workdir, hash);
      session = result;
    }
    
    return session as Session;
  }
  
  updateLastActivity(sessionId: number) {
    this.db.prepare(`
      UPDATE sessions SET last_activity = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(sessionId);
  }
}
```

**`src/db/repositories/message-repository.ts`**
```typescript
export class MessageRepository {
  constructor(private db: Database.Database) {}
  
  saveMessage(msg: MessageInput): Message {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        session_id, type, role, content, provider, model, 
        token_count, tool_calls, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    return stmt.get(
      msg.sessionId,
      msg.type,
      msg.role,
      msg.content,
      msg.provider,
      msg.model,
      msg.tokenCount || 0,
      msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      msg.timestamp || new Date().toISOString()
    ) as Message;
  }
  
  getSessionMessages(sessionId: number): Message[] {
    return this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `).all(sessionId) as Message[];
  }
  
  getRecentMessages(sessionId: number, limit: number): Message[] {
    return this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(sessionId, limit) as Message[];
  }
}
```

### Phase 3 : Migration JSONL → SQLite (1-2h)
✅ **Objectif** : Importer historique existant

**`src/utils/migration-helper.ts`**
```typescript
export async function migrateJsonlToSqlite() {
  const jsonlPath = path.join(os.homedir(), '.grok', 'chat-history.jsonl');
  
  if (!fs.existsSync(jsonlPath)) {
    console.log('No JSONL to migrate');
    return;
  }
  
  // Créer session "legacy"
  const sessionRepo = new SessionRepository(db.getDb());
  const session = sessionRepo.findOrCreateByWorkdir('__legacy__');
  
  // Lire JSONL ligne par ligne
  const lines = fs.readFileSync(jsonlPath, 'utf-8').split('\n');
  const messageRepo = new MessageRepository(db.getDb());
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const entry = JSON.parse(line);
    messageRepo.saveMessage({
      sessionId: session.id,
      type: entry.type,
      role: entry.type === 'user' ? 'user' : 'assistant',
      content: entry.content,
      provider: 'grok', // Default pour legacy
      model: 'unknown',
      timestamp: entry.timestamp,
      tokenCount: 0,
    });
  }
  
  console.log(`✅ Migrated ${lines.length} messages from JSONL`);
  
  // Backup puis supprimer JSONL
  fs.renameSync(jsonlPath, `${jsonlPath}.backup`);
}
```

### Phase 4 : Intégration GrokAgent (2h)
✅ **Objectif** : Utiliser SQLite dans l'agent

**Modifier `src/agent/grok-agent.ts`**
```typescript
export class GrokAgent {
  private sessionId: number | null = null;
  private currentProvider: string;
  private messageRepo: MessageRepository;
  
  constructor(...) {
    this.currentProvider = 'grok'; // ou detecté
    this.messageRepo = new MessageRepository(db.getDb());
    
    // Créer/charger session basée sur workdir
    const sessionRepo = new SessionRepository(db.getDb());
    const session = sessionRepo.findOrCreateByWorkdir(process.cwd());
    this.sessionId = session.id;
  }
  
  async processUserMessage(content: string): Promise<ChatEntry[]> {
    // Sauvegarder message user
    const userMsg = this.messageRepo.saveMessage({
      sessionId: this.sessionId!,
      type: 'user',
      role: 'user',
      content,
      provider: this.currentProvider,
      model: this.model,
    });
    
    // ... traitement AI ...
    
    // Sauvegarder réponse assistant
    const assistantMsg = this.messageRepo.saveMessage({
      sessionId: this.sessionId!,
      type: 'assistant',
      role: 'assistant',
      content: response,
      provider: this.currentProvider,
      model: this.model,
      tokenCount: usage?.total_tokens,
    });
    
    return [userMsg, assistantMsg];
  }
  
  restoreFromHistory() {
    if (!this.sessionId) return;
    
    const messages = this.messageRepo.getSessionMessages(this.sessionId);
    // Restaurer dans chatHistory
    this.chatHistory = messages;
  }
}
```

### Phase 5 : Commande `/apikey` (1h)
✅ **Objectif** : Changer provider en cours

**`src/commands/apikey.ts`**
```typescript
export function handleApiKeyCommand(agent: GrokAgent, args: string[]) {
  const [provider, apiKey] = args; // Ex: /apikey claude sk-...
  
  if (!provider || !apiKey) {
    console.log('Usage: /apikey <provider> <api-key>');
    console.log('Providers: grok, claude, openai, mistral, deepseek');
    return;
  }
  
  // Valider provider
  const validProviders = ['grok', 'claude', 'openai', 'mistral', 'deepseek'];
  if (!validProviders.includes(provider)) {
    console.log(`❌ Invalid provider: ${provider}`);
    return;
  }
  
  // Mettre à jour agent
  agent.switchProvider(provider, apiKey);
  
  // Enregistrer dans api_keys table (optionnel)
  const apiKeyRepo = new ApiKeyRepository(db.getDb());
  apiKeyRepo.saveKey(provider, apiKey, 'Switched in session');
  
  console.log(`✅ Switched to ${provider}`);
}
```

**Dans `GrokAgent`**
```typescript
switchProvider(provider: string, apiKey: string) {
  this.currentProvider = provider;
  this.apiKey = apiKey;
  
  // Mettre à jour baseURL selon provider
  const baseUrls = {
    grok: 'https://api.x.ai/v1',
    claude: 'https://api.anthropic.com/v1',
    openai: 'https://api.openai.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    deepseek: 'https://api.deepseek.com/v1',
  };
  
  this.baseURL = baseUrls[provider];
  this.client = new OpenAI({ apiKey, baseURL: this.baseURL });
}
```

### Phase 6 : Commandes supplémentaires (1-2h)

**`/sessions` - Liste sessions**
```typescript
export function handleSessionsCommand() {
  const sessions = sessionRepo.getActiveSessions();
  
  console.log('Active sessions:');
  sessions.forEach(s => {
    console.log(`- ${s.working_dir} (${s.message_count} messages)`);
  });
}
```

**`/export` - Export en JSONL ou Markdown**
```typescript
export function handleExportCommand(format: 'jsonl' | 'markdown') {
  const messages = messageRepo.getSessionMessages(sessionId);
  
  if (format === 'jsonl') {
    const output = messages.map(m => JSON.stringify(m)).join('\n');
    fs.writeFileSync('export.jsonl', output);
  } else {
    const markdown = messagesToMarkdown(messages);
    fs.writeFileSync('export.md', markdown);
  }
}
```

---

## 📋 Checklist Migration

### Préparation
- [ ] Backup fichier JSONL actuel
- [ ] Installer `better-sqlite3`
- [ ] Créer dossier `src/db/`

### Phase 1 - SQLite Setup
- [ ] `database.ts` créé et testé
- [ ] Tables créées (sessions, messages)
- [ ] Index créés
- [ ] Tests connexion OK

### Phase 2 - Repositories
- [ ] `SessionRepository` implémenté
- [ ] `MessageRepository` implémenté
- [ ] Tests CRUD OK

### Phase 3 - Migration
- [ ] Script migration JSONL → SQLite
- [ ] Test migration sur backup
- [ ] Validation données migrées

### Phase 4 - Intégration
- [ ] `GrokAgent` utilise SQLite
- [ ] `ChatInterface` charge depuis SQLite
- [ ] Tests conversations OK

### Phase 5 - Commandes
- [ ] `/apikey` implémenté
- [ ] Tests switch provider
- [ ] `/sessions` implémenté
- [ ] `/export` implémenté

### Phase 6 - Documentation
- [ ] README mis à jour
- [ ] Guide migration utilisateur
- [ ] Documentation API

---

## 🚀 Estimation Temps Total

| Phase | Durée | Priorité |
|-------|-------|----------|
| 1. SQLite Setup | 1-2h | 🔴 Critique |
| 2. Repositories | 2-3h | 🔴 Critique |
| 3. Migration JSONL | 1-2h | 🟡 Important |
| 4. Intégration Agent | 2h | 🔴 Critique |
| 5. Commande /apikey | 1h | 🟡 Important |
| 6. Commandes extra | 1-2h | 🟢 Nice-to-have |
| **TOTAL** | **8-12h** | |

---

## ⚠️ Points d'Attention

1. **Sécurité API Keys**
   - Ne JAMAIS stocker clés en clair
   - Utiliser hash pour tracking uniquement
   - Clés toujours en mémoire ou keyring système

2. **Performance**
   - Utiliser WAL mode pour concurrence
   - Index sur (session_id, timestamp)
   - Limit queries pour gros historiques

3. **Backward Compatibility**
   - Garder backup JSONL
   - Export JSONL toujours disponible
   - Migration automatique au démarrage

4. **Tests**
   - Tester migration avec gros JSONL
   - Tester switch provider
   - Tester sessions multiples

---

## 💡 Fonctionnalités Bonus Possibles

Avec SQLite, on peut facilement ajouter :

1. **Recherche full-text**
```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(content);
SELECT * FROM messages_fts WHERE content MATCH 'sqlite migration';
```

2. **Statistiques usage**
```sql
SELECT provider, COUNT(*), SUM(token_count) 
FROM messages 
WHERE timestamp > date('now', '-7 days')
GROUP BY provider;
```

3. **Export conversations par date**
```sql
SELECT * FROM messages 
WHERE timestamp BETWEEN '2024-01-01' AND '2024-01-31';
```

4. **Tags et catégorisation**
```sql
UPDATE sessions SET tags = '["dev", "database"]' WHERE id = 1;
```

5. **Sessions partagées** (multi-users)
```sql
ALTER TABLE sessions ADD COLUMN user_id TEXT;
```

---

## 🎯 Conclusion

### Pourquoi SQLite > JSONL ?

**Pour votre use case :**
- ✅ **Multi-providers** : Tracking natif provider/model par message
- ✅ **Multi-sessions** : Isolation par workdir
- ✅ **Switch API** : Changer en cours sans perdre contexte
- ✅ **Performance** : Chargement rapide même avec gros historique
- ✅ **Requêtes** : Filtrage, stats, export faciles
- ✅ **Évolutivité** : Facile d'ajouter features

**JSONL est bon pour :**
- ❌ Simplicité extrême (logs bruts)
- ❌ Append-only streams
- ❌ Pas de requêtes complexes

**Votre projet a dépassé la simplicité de JSONL** 🚀

---

## 📞 Next Steps

Voulez-vous que je :
1. ✅ **Commence Phase 1** (SQLite Setup) ?
2. ✅ **Crée le script de migration** JSONL → SQLite ?
3. ✅ **Implémente `/apikey`** directement ?
4. ✅ **Fasse tout progressivement** ?

Dites-moi par où commencer ! 😊
