# PLAN DE TESTS COMPLET - Grok CLI
## Version 1.0 - 2025-12-07

**Objectif:** Couverture de test complète (100%) de toutes les fonctionnalités critiques

---

## ANALYSE DE LA SITUATION ACTUELLE

### État des Tests

**Tests existants:** 6 fichiers
- ✅ `tests/static/source_hash_integrity.test.js` - Intégrité code source
- ⚠️ `tests/regression/tool_calls_restore.test.js` - Régression tool_calls (faux positif)
- ✅ `tests/regression/placeholder_skip.test.js` - Régression placeholder
- ⚠️ `tests/integration/tool_usage_monitor.js` - Monitoring usage tools
- ✅ `tests/performance/measure_startup.sh` - Performance startup
- ✅ `scripts/integrity/update-source-hashes.sh` - Mise à jour baseline

**Couverture estimée:** <5% (6 tests pour 89 fichiers source)

---

### Structure de l'Application

| Module | Fichiers | Criticité | Tests Actuels |
|--------|----------|-----------|---------------|
| **agent** | 2 | ⭐⭐⭐⭐⭐ CRITIQUE | 2 (régressions) |
| **timeline** | 16 | ⭐⭐⭐⭐⭐ CRITIQUE | 0 |
| **db** | 7 | ⭐⭐⭐⭐⭐ CRITIQUE | 0 |
| **security** | 7 | ⭐⭐⭐⭐⭐ CRITIQUE | 0 |
| **utils** | 22 | ⭐⭐⭐⭐ HAUTE | 0 |
| **tools** | 12 | ⭐⭐⭐⭐ HAUTE | 1 (monitoring) |
| **execution** | 3 | ⭐⭐⭐⭐ HAUTE | 0 |
| **grok** | 2 | ⭐⭐⭐⭐ HAUTE | 0 |
| **mcp** | 3 | ⭐⭐⭐ MOYENNE | 0 |
| **ui** | 6 | ⭐⭐⭐ MOYENNE | 0 |
| **commands** | 4 | ⭐⭐ BASSE | 0 |
| **hooks** | 3 | ⭐⭐ BASSE | 0 |
| **types** | 1 | ⭐ TRIVIALE | 0 |

---

### Bases de Données

**4 Databases identifiées:**
1. `~/.grok/timeline.db` - Event sourcing (timeline)
2. `~/.grok/grok.db` - Base principale (?)
3. `~/.grok/conversations.db` - Historique conversations
4. `~/.grok/sessions.db` - Sessions utilisateur

**Tests actuels:** 0 tests de consistance DB

---

## PLAN DE TESTS PAR MODULE

### PRIORITÉ 1: MODULES CRITIQUES

---

## 1. DATABASE (db/) - 7 fichiers

### 1.1 Tests de Schéma

**Fichier:** `tests/unit/db/schema.test.js`

**Tests:**
- ✓ Vérifier toutes les tables existent
- ✓ Vérifier tous les index existent
- ✓ Vérifier contraintes (CHECK, UNIQUE, FK)
- ✓ Vérifier types de colonnes
- ✓ Vérifier valeurs par défaut

**Exemple:**
```javascript
describe('Database Schema', () => {
  test('sessions.db has correct schema', () => {
    const db = new Database('~/.grok/sessions.db');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

    expect(tables).toContainEqual({ name: 'sessions' });
    expect(tables).toContainEqual({ name: 'messages' });
  });

  test('sessions table has required columns', () => {
    const columns = db.pragma('table_info(sessions)');

    expect(columns).toContainEqual(expect.objectContaining({
      name: 'id',
      type: 'TEXT',
      notnull: 1,
      pk: 1
    }));
  });
});
```

---

### 1.2 Tests de Consistance DB

**Fichier:** `tests/integration/db/consistency.test.js`

**Tests:**
- ✓ Intégrité référentielle (FK)
- ✓ Pas de sessions orphelines
- ✓ Pas de messages sans session
- ✓ Timestamps cohérents (pas de dates futures)
- ✓ IDs uniques
- ✓ Checksums valides

**Exemple:**
```javascript
describe('Database Consistency', () => {
  test('No orphaned messages', () => {
    const orphans = db.prepare(`
      SELECT m.id
      FROM messages m
      LEFT JOIN sessions s ON m.session_id = s.id
      WHERE s.id IS NULL
    `).all();

    expect(orphans).toHaveLength(0);
  });

  test('All timestamps are valid', () => {
    const future = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE timestamp > ?
    `).get(Date.now());

    expect(future.count).toBe(0);
  });
});
```

---

### 1.3 Tests de Migration

**Fichier:** `tests/integration/db/migrations.test.js`

**Tests:**
- ✓ Migrations s'exécutent sans erreur
- ✓ Migrations sont idempotentes (réexécution safe)
- ✓ Données préservées après migration
- ✓ Rollback fonctionne

---

### 1.4 Tests de Performance DB

**Fichier:** `tests/performance/db/queries.test.js`

**Tests:**
- ✓ Requêtes < 100ms (sessions actives)
- ✓ Requêtes < 500ms (historique complet)
- ✓ Pagination efficace
- ✓ Index utilisés (EXPLAIN QUERY PLAN)

---

## 2. TIMELINE (timeline/) - 16 fichiers

### 2.1 Tests Event Sourcing

**Fichier:** `tests/unit/timeline/event-bus.test.js`

**Tests:**
- ✓ Événements publiés correctement
- ✓ Listeners reçoivent événements
- ✓ Ordre des événements préservé
- ✓ Pas de perte d'événements

---

### 2.2 Tests Merkle DAG

**Fichier:** `tests/unit/timeline/merkle-dag.test.js`

**Tests:**
- ✓ Hashes calculés correctement
- ✓ DAG maintient l'intégrité
- ✓ Détection de tampering
- ✓ Vérification de chaîne

**Exemple:**
```javascript
describe('Merkle DAG Integrity', () => {
  test('Detects tampered events', () => {
    const dag = new MerkleDAG();
    dag.addEvent({ id: '1', data: 'original' });

    // Tamper with DB directly
    db.prepare('UPDATE events SET payload = ? WHERE id = ?')
      .run(JSON.stringify({ data: 'tampered' }), '1');

    const isValid = dag.verifyIntegrity();
    expect(isValid).toBe(false);
  });
});
```

---

### 2.3 Tests Rewind Engine

**Fichier:** `tests/unit/timeline/rewind-engine.test.js`

**Tests:**
- ✓ Rewind à timestamp donné
- ✓ État restauré correctement
- ✓ Événements après rewind ignorés
- ✓ Rewind préserve intégrité

---

### 2.4 Tests Hooks

**Fichiers:**
- `tests/unit/timeline/hooks/tool-hook.test.js`
- `tests/unit/timeline/hooks/session-hook.test.js`
- `tests/unit/timeline/hooks/file-hook.test.js`
- `tests/unit/timeline/hooks/git-hook.test.js`
- `tests/unit/timeline/hooks/llm-hook.test.js`

**Tests par hook:**
- ✓ Événements capturés
- ✓ Payload correct
- ✓ Timestamps précis
- ✓ Pas de doublons

---

### 2.5 Tests Snapshot Manager

**Fichier:** `tests/unit/timeline/snapshot-manager.test.js`

**Tests:**
- ✓ Snapshots créés
- ✓ Restauration depuis snapshot
- ✓ Compression fonctionne
- ✓ Cleanup des vieux snapshots

---

### 2.6 Tests Query Engine

**Fichier:** `tests/unit/timeline/query-engine.test.js`

**Tests:**
- ✓ Requêtes par type d'événement
- ✓ Requêtes par plage temporelle
- ✓ Filtrage par actor
- ✓ Agrégations (count, sum)

---

### 2.7 Tests Consistance Timeline

**Fichier:** `tests/integration/timeline/consistency.test.js`

**Tests:**
- ✓ Sequence numbers continus (pas de trous)
- ✓ Timestamps monotoniques
- ✓ Checksums valides
- ✓ Correlation IDs corrects
- ✓ Causation chain valide

**Exemple:**
```javascript
describe('Timeline Consistency', () => {
  test('Sequence numbers are continuous', () => {
    const gaps = db.prepare(`
      WITH sequences AS (
        SELECT sequence_number, LAG(sequence_number) OVER (ORDER BY sequence_number) as prev
        FROM events
      )
      SELECT * FROM sequences WHERE sequence_number != prev + 1 AND prev IS NOT NULL
    `).all();

    expect(gaps).toHaveLength(0);
  });

  test('Timestamps are monotonic', () => {
    const violations = db.prepare(`
      WITH ordered AS (
        SELECT timestamp, LAG(timestamp) OVER (ORDER BY sequence_number) as prev_ts
        FROM events
      )
      SELECT * FROM ordered WHERE timestamp < prev_ts
    `).all();

    expect(violations).toHaveLength(0);
  });
});
```

---

## 3. SECURITY (security/) - 7 fichiers

### 3.1 Tests Integrity Watcher

**Fichier:** `tests/unit/security/integrity-watcher.test.js`

**Tests:**
- ✓ Détection de modifications fichiers
- ✓ Alertes déclenchées
- ✓ Whitelist respectée
- ✓ Performance acceptable

---

### 3.2 Tests Self-Integrity

**Fichier:** `tests/unit/security/self-integrity.test.js`

**Tests:**
- ✓ Baseline générée correctement
- ✓ Vérification détecte modifications
- ✓ Hashes cryptographiques corrects
- ✓ Anchoring fonctionne (OTS, TSA, Sigstore)

---

### 3.3 Tests LLM Guard

**Fichier:** `tests/unit/security/llm-guard.test.js`

**Tests:**
- ✓ Injection détectée
- ✓ Commandes dangereuses bloquées
- ✓ Faux positifs minimisés
- ✓ Performance < 50ms

---

### 3.4 Tests Watcher Daemon

**Fichier:** `tests/integration/security/watcher-daemon.test.js`

**Tests:**
- ✓ Daemon démarre
- ✓ Daemon surveille fichiers
- ✓ Daemon persiste entre redémarrages
- ✓ Logs correctement

---

## 4. AGENT (agent/) - 2 fichiers

### 4.1 Tests GrokAgent - Unit

**Fichier:** `tests/unit/agent/grok-agent.test.js`

**Tests:**
- ✓ restoreFromHistory avec tool_calls vides
- ✓ Placeholder skip (early return)
- ✓ Message history correcte
- ✓ Provider detection
- ✓ Tool format conversion (OpenAI/Claude/Grok)
- ✓ Error handling

**Exemple:**
```javascript
describe('GrokAgent - Tool Calls Handling', () => {
  test('restoreFromHistory preserves empty tool_calls', () => {
    const agent = new GrokAgent({ model: 'gpt-4' });
    const history = [{
      role: 'assistant',
      content: 'Done',
      toolCalls: []  // Empty array
    }];

    agent.restoreFromHistory(history);

    const lastMsg = agent.messages[agent.messages.length - 1];
    expect(lastMsg).toHaveProperty('tool_calls');
    expect(lastMsg.tool_calls).toEqual([]);  // Not undefined!
  });

  test('Placeholder triggers early return', async () => {
    const agent = new GrokAgent({ model: 'gpt-5' });
    const mockResponse = { content: 'Using tools to help you...' };

    const entries = await agent.processUserMessage(mockResponse);

    // No summary generated
    expect(entries).not.toContainEqual(
      expect.objectContaining({ type: 'summary' })
    );
  });
});
```

---

### 4.2 Tests GrokAgent - Integration

**Fichier:** `tests/integration/agent/grok-agent.test.js`

**Tests:**
- ✓ Appel API réel (avec mocks)
- ✓ Tool execution complète
- ✓ Streaming fonctionne
- ✓ Context window respectée

---

## 5. TOOLS (tools/) - 12 fichiers

### 5.1 Tests par Tool

**Fichiers:** Un test file par tool
- `tests/unit/tools/bash.test.js`
- `tests/unit/tools/text-editor.test.js`
- `tests/unit/tools/morph-editor.test.js`
- `tests/unit/tools/apply-patch.test.js`
- `tests/unit/tools/search.test.js`
- `tests/unit/tools/confirmation-tool.test.js`
- `tests/unit/tools/todo-tool.test.js`
- `tests/unit/tools/timeline-query-tool.test.js`
- `tests/unit/tools/rewind-to-tool.test.js`
- `tests/unit/tools/session-tools.test.js`
- `tests/unit/tools/get-my-identity.test.js`

**Tests communs:**
- ✓ Schéma d'entrée validé
- ✓ Schéma de sortie correct
- ✓ Error handling
- ✓ Permissions vérifiées

**Exemple (bash.ts):**
```javascript
describe('Bash Tool', () => {
  test('Executes simple command', async () => {
    const result = await executeBash({ command: 'echo test' });
    expect(result).toContain('test');
  });

  test('Respects timeout', async () => {
    await expect(
      executeBash({ command: 'sleep 10', timeout: 100 })
    ).rejects.toThrow('timeout');
  });

  test('Handles command errors', async () => {
    const result = await executeBash({ command: 'nonexistent_cmd' });
    expect(result).toContain('command not found');
  });
});
```

---

## 6. EXECUTION (execution/) - 3 fichiers

### 6.1 Tests Execution Manager

**Fichier:** `tests/unit/execution/execution-manager.test.js`

**Tests:**
- ✓ Execution créée avec ID unique
- ✓ État mis à jour correctement
- ✓ Résultats capturés
- ✓ Cleanup après exécution

---

### 6.2 Tests Execution Utils

**Fichier:** `tests/unit/execution/execution-utils.test.js`

**Tests:**
- ✓ Parsing de sortie
- ✓ Extraction d'erreurs
- ✓ Formatting de résultats

---

## 7. UTILS (utils/) - 22 fichiers

### 7.1 Tests Session Manager

**Fichier:** `tests/unit/utils/session-manager.test.js`

**Tests:**
- ✓ Création session
- ✓ Sauvegarde session
- ✓ Restauration session
- ✓ Liste sessions
- ✓ Suppression session

---

### 7.2 Tests Settings

**Fichier:** `tests/unit/utils/settings.test.js`

**Tests:**
- ✓ Lecture settings
- ✓ Écriture settings
- ✓ Validation valeurs
- ✓ Migration anciennes versions

---

### 7.3 Tests Token Counter

**Fichier:** `tests/unit/utils/token-counter.test.js`

**Tests:**
- ✓ Comptage précis (comparaison avec tiktoken)
- ✓ Support multi-modèles
- ✓ Truncation correcte

---

### 7.4 Tests Provider Manager

**Fichier:** `tests/unit/utils/provider-manager.test.js`

**Tests:**
- ✓ Détection provider depuis model name
- ✓ Configuration API correcte
- ✓ Fallback sur erreur

---

### 7.5 Tests Search Manager

**Fichier:** `tests/unit/utils/search-manager.test.js`

**Tests:**
- ✓ Recherche fichiers (glob)
- ✓ Recherche contenu (grep)
- ✓ Performance sur gros repos
- ✓ Respect .gitignore

---

### 7.6 Tests Clipboard Manager

**Fichier:** `tests/unit/utils/clipboard-manager.test.js`

**Tests:**
- ✓ Copy to clipboard
- ✓ Paste from clipboard
- ✓ Image support
- ✓ Cross-platform

---

### 7.7 Tests Git Rewind

**Fichier:** `tests/unit/utils/git-rewind.test.js`

**Tests:**
- ✓ Détection repository
- ✓ Rewind à commit
- ✓ Restauration état
- ✓ Sécurité (pas de perte)

---

## PRIORITÉ 2: MODULES HAUTE IMPORTANCE

## 8. GROK (grok/) - 2 fichiers

### 8.1 Tests Grok Client

**Fichier:** `tests/unit/grok/client.test.js`

**Tests:**
- ✓ Connexion API
- ✓ Streaming responses
- ✓ Retry logic
- ✓ Rate limiting

---

### 8.2 Tests Grok Tools

**Fichier:** `tests/unit/grok/tools.test.js`

**Tests:**
- ✓ Tool definitions correctes
- ✓ Conversion format API
- ✓ Validation schemas

---

## 9. MCP (mcp/) - 3 fichiers

### 9.1 Tests MCP Client

**Fichier:** `tests/unit/mcp/client.test.js`

**Tests:**
- ✓ Connexion serveurs MCP
- ✓ Discovery de tools
- ✓ Exécution tools MCP
- ✓ Error handling

---

## 10. UI (ui/) - 6 fichiers

### 10.1 Tests UI Components

**Fichiers:**
- `tests/unit/ui/chat-history.test.js`
- `tests/unit/ui/chat-interface.test.js`
- `tests/unit/ui/execution-viewer.test.js`

**Tests:**
- ✓ Rendering sans crash
- ✓ Props validées
- ✓ Events handled
- ✓ Keyboard shortcuts

---

## TESTS CROSS-MODULE

### 11. Tests E2E (End-to-End)

**Fichier:** `tests/e2e/full-conversation.test.js`

**Scénarios:**
```javascript
describe('E2E: Full Conversation Flow', () => {
  test('User asks question → LLM uses tools → Response returned', async () => {
    // 1. Start session
    const session = await startSession();

    // 2. User message
    const userMsg = "What files are in the current directory?";
    await session.sendMessage(userMsg);

    // 3. Verify timeline events
    const events = await getTimelineEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ event_type: 'USER_MESSAGE' })
    );
    expect(events).toContainEqual(
      expect.objectContaining({ event_type: 'TOOL_CALL_STARTED' })
    );
    expect(events).toContainEqual(
      expect.objectContaining({ event_type: 'LLM_RESPONSE' })
    );

    // 4. Verify DB consistency
    const dbCheck = await verifyDBConsistency();
    expect(dbCheck.errors).toHaveLength(0);

    // 5. Verify session saved
    const savedSession = await loadSession(session.id);
    expect(savedSession.messages).toHaveLength(3); // user, tool, assistant
  });
});
```

---

### 12. Tests de Performance Globaux

**Fichier:** `tests/performance/full-app.test.js`

**Tests:**
- ✓ Startup < 2s
- ✓ First response < 5s
- ✓ Memory usage < 200MB
- ✓ No memory leaks (100 iterations)

---

### 13. Tests de Sécurité Globaux

**Fichier:** `tests/security/full-app.test.js`

**Tests:**
- ✓ Pas de secrets dans logs
- ✓ Pas de command injection
- ✓ Sanitization inputs
- ✓ File permissions correctes

---

## TESTS DE CONSISTANCE DATABASES

### 14. Tests Multi-DB Consistency

**Fichier:** `tests/integration/db/multi-db-consistency.test.js`

**Tests critiques:**

```javascript
describe('Multi-Database Consistency', () => {
  test('Session exists in both sessions.db and timeline.db', () => {
    // Sessions.db
    const sessionsDB = new Database('~/.grok/sessions.db');
    const sessions = sessionsDB.prepare('SELECT id FROM sessions').all();

    // Timeline.db
    const timelineDB = new Database('~/.grok/timeline.db');

    for (const session of sessions) {
      const events = timelineDB.prepare(`
        SELECT COUNT(*) as count
        FROM events
        WHERE aggregate_id = ? AND aggregate_type = 'session'
      `).get(session.id);

      expect(events.count).toBeGreaterThan(0);
    }
  });

  test('Message count matches between conversations.db and timeline.db', () => {
    const convoCount = conversationsDB.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE session_id = ?
    `).get(sessionId).count;

    const timelineCount = timelineDB.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE event_type IN ('USER_MESSAGE', 'LLM_RESPONSE')
        AND aggregate_id = ?
    `).get(sessionId).count;

    expect(convoCount).toBe(timelineCount);
  });

  test('All DBs have valid foreign keys', () => {
    const dbs = [
      '~/.grok/sessions.db',
      '~/.grok/conversations.db',
      '~/.grok/timeline.db',
      '~/.grok/grok.db'
    ];

    for (const dbPath of dbs) {
      const db = new Database(dbPath);
      const result = db.pragma('foreign_key_check');
      expect(result).toHaveLength(0); // No FK violations
    }
  });

  test('Timeline checksums are valid', () => {
    const events = timelineDB.prepare('SELECT * FROM events').all();

    for (const event of events) {
      const calculatedChecksum = calculateChecksum({
        id: event.id,
        timestamp: event.timestamp,
        payload: event.payload
      });

      expect(event.checksum).toBe(calculatedChecksum);
    }
  });

  test('No data corruption in JSON fields', () => {
    const events = timelineDB.prepare('SELECT payload FROM events').all();

    for (const event of events) {
      expect(() => JSON.parse(event.payload)).not.toThrow();
    }
  });
});
```

---

## STRUCTURE FINALE DES TESTS

```
tests/
├── unit/                          # Tests unitaires (isolés)
│   ├── agent/
│   │   ├── grok-agent.test.js
│   │   └── index.test.js
│   ├── db/
│   │   ├── database.test.js
│   │   ├── repositories/
│   │   │   ├── message-repository.test.js
│   │   │   └── session-repository.test.js
│   │   └── migrations/
│   │       └── migrations.test.js
│   ├── timeline/
│   │   ├── event-bus.test.js
│   │   ├── merkle-dag.test.js
│   │   ├── rewind-engine.test.js
│   │   ├── snapshot-manager.test.js
│   │   ├── query-engine.test.js
│   │   └── hooks/
│   │       ├── tool-hook.test.js
│   │       ├── session-hook.test.js
│   │       ├── file-hook.test.js
│   │       ├── git-hook.test.js
│   │       └── llm-hook.test.js
│   ├── security/
│   │   ├── integrity-watcher.test.js
│   │   ├── self-integrity.test.js
│   │   ├── llm-guard.test.js
│   │   └── watcher-daemon.test.js
│   ├── tools/
│   │   ├── bash.test.js
│   │   ├── text-editor.test.js
│   │   ├── morph-editor.test.js
│   │   ├── apply-patch.test.js
│   │   ├── search.test.js
│   │   ├── confirmation-tool.test.js
│   │   ├── todo-tool.test.js
│   │   ├── timeline-query-tool.test.js
│   │   ├── rewind-to-tool.test.js
│   │   ├── session-tools.test.js
│   │   └── get-my-identity.test.js
│   ├── execution/
│   │   ├── execution-manager.test.js
│   │   └── execution-utils.test.js
│   ├── grok/
│   │   ├── client.test.js
│   │   └── tools.test.js
│   ├── mcp/
│   │   ├── client.test.js
│   │   ├── transports.test.js
│   │   └── config.test.js
│   ├── utils/
│   │   ├── session-manager.test.js
│   │   ├── settings.test.js
│   │   ├── token-counter.test.js
│   │   ├── provider-manager.test.js
│   │   ├── search-manager.test.js
│   │   ├── clipboard-manager.test.js
│   │   ├── git-rewind.test.js
│   │   ├── paste-manager.test.js
│   │   ├── image-path-detector.test.js
│   │   └── ... (13 autres)
│   └── ui/
│       ├── chat-history.test.js
│       ├── chat-interface.test.js
│       └── execution-viewer.test.js
│
├── integration/                   # Tests d'intégration (multi-modules)
│   ├── agent/
│   │   └── grok-agent-integration.test.js
│   ├── db/
│   │   ├── consistency.test.js
│   │   ├── migrations.test.js
│   │   └── multi-db-consistency.test.js  # ⭐ CRITIQUE
│   ├── timeline/
│   │   ├── consistency.test.js           # ⭐ CRITIQUE
│   │   └── end-to-end.test.js
│   ├── security/
│   │   └── watcher-daemon.test.js
│   └── tool_usage_monitor.js              # ✅ Existant
│
├── e2e/                           # Tests end-to-end (app complète)
│   ├── full-conversation.test.js
│   ├── session-lifecycle.test.js
│   ├── tool-execution-flow.test.js
│   └── rewind-recovery.test.js
│
├── performance/                   # Tests de performance
│   ├── db/
│   │   └── queries.test.js
│   ├── full-app.test.js
│   └── measure_startup.sh                 # ✅ Existant
│
├── security/                      # Tests de sécurité
│   └── full-app.test.js
│
├── regression/                    # Tests de régression
│   ├── tool_calls_restore.test.js         # ⚠️ À fixer
│   └── placeholder_skip.test.js           # ✅ Existant
│
└── static/                        # Tests statiques (code)
    ├── source_hash_integrity.test.js     # ✅ Existant
    └── source-hashes.json                 # ✅ Existant
```

**Total estimé:** ~80-100 fichiers de tests

---

## PHASE D'IMPLÉMENTATION

### Phase 1: CRITIQUE (Semaine 1-2)

**Priorité Absolue:**

1. **Database Consistency Tests** (2 jours)
   - `tests/integration/db/multi-db-consistency.test.js`
   - `tests/integration/db/consistency.test.js`
   - `tests/unit/db/schema.test.js`

2. **Timeline Consistency Tests** (2 jours)
   - `tests/integration/timeline/consistency.test.js`
   - `tests/unit/timeline/merkle-dag.test.js`

3. **Agent Core Tests** (2 jours)
   - Fix `tool_calls_restore.test.js`
   - `tests/unit/agent/grok-agent.test.js`
   - `tests/integration/agent/grok-agent-integration.test.js`

4. **E2E Basic Flow** (2 jours)
   - `tests/e2e/full-conversation.test.js`

**Livrables Phase 1:**
- ✅ DBs vérifiées (consistance)
- ✅ Timeline vérifiée (intégrité)
- ✅ Agent core testé
- ✅ 1 E2E flow complet

---

### Phase 2: HAUTE PRIORITÉ (Semaine 3-4)

**Focus:**

5. **Tools Tests** (3 jours)
   - 12 fichiers de tests tools
   - Tests les plus critiques: bash, text-editor, search

6. **Security Tests** (2 jours)
   - Integrity watcher
   - LLM guard
   - Self-integrity

7. **Timeline Hooks** (2 jours)
   - 5 hooks testés

**Livrables Phase 2:**
- ✅ Tous les tools testés
- ✅ Sécurité vérifiée
- ✅ Hooks timeline testés

---

### Phase 3: MOYENNE PRIORITÉ (Semaine 5-6)

**Focus:**

8. **Utils Tests** (4 jours)
   - 22 fichiers utils
   - Prioriser: session-manager, settings, token-counter

9. **Execution Tests** (1 jour)

10. **Grok/MCP Tests** (2 jours)

**Livrables Phase 3:**
- ✅ Utils testés
- ✅ Execution testée
- ✅ Grok & MCP testés

---

### Phase 4: COMPLÉTION (Semaine 7-8)

**Focus:**

11. **UI Tests** (2 jours)

12. **Commands Tests** (1 jour)

13. **Performance Tests** (2 jours)

14. **Security Audit** (2 jours)

**Livrables Phase 4:**
- ✅ 100% modules couverts
- ✅ Performance benchmarks
- ✅ Security audit complet

---

## OUTILS & INFRASTRUCTURE

### Test Runner: Vitest

**Pourquoi Vitest?**
- ✅ Compatible ESM/TypeScript
- ✅ Fast (parallel execution)
- ✅ Built-in coverage
- ✅ Mock/spy facile
- ✅ Watch mode

**Installation:**
```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8
npm install -D @types/better-sqlite3
```

**Configuration:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**'],
      all: true,
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    },
    setupFiles: ['./tests/setup.ts']
  }
});
```

---

### Scripts NPM

**package.json:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:db": "vitest run tests/integration/db",
    "test:timeline": "vitest run tests/integration/timeline",
    "test:regression": "node tests/regression/placeholder_skip.test.js && node tests/regression/tool_calls_restore.test.js",
    "test:static": "node tests/static/source_hash_integrity.test.js",
    "test:perf": "bash tests/performance/measure_startup.sh",
    "test:all": "npm run test:static && npm run test:regression && npm run test && npm run test:perf"
  }
}
```

---

### CI/CD Integration

**GitHub Actions:** `.github/workflows/tests.yml`
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run build

      # Static tests
      - run: npm run test:static

      # Unit tests
      - run: npm run test:unit

      # Integration tests
      - run: npm run test:integration

      # E2E tests
      - run: npm run test:e2e

      # Coverage
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      # Performance
      - run: npm run test:perf
```

---

### Pre-commit Hooks

**Husky:** `.husky/pre-commit`
```bash
#!/bin/sh
npm run test:static
npm run test:regression
npm run test:unit
```

---

## MÉTRIQUES DE SUCCÈS

### Couverture de Code

**Objectifs:**
- ⭐⭐⭐⭐⭐ CRITIQUE modules: 90%+
- ⭐⭐⭐⭐ HAUTE modules: 80%+
- ⭐⭐⭐ MOYENNE modules: 70%+
- ⭐⭐ BASSE modules: 60%+

**Global: 80%+ couverture**

---

### Couverture Fonctionnelle

**Checklist:**
- [ ] Toutes les databases testées (schéma + consistance)
- [ ] Timeline intégrité vérifiée (Merkle DAG)
- [ ] Tous les tools testés (12/12)
- [ ] Tous les hooks testés (5/5)
- [ ] Agent core 100% testé
- [ ] Security 100% testée
- [ ] E2E flows critiques couverts
- [ ] Performance benchmarks établis

---

### Maintenance

**Process:**
1. **Nouveau feature** → Tests d'abord (TDD)
2. **Bug fix** → Regression test ajouté
3. **Refactoring** → Tests passent avant/après
4. **PR** → Tests obligatoires (CI)
5. **Release** → Full test suite passée

---

## PROCHAINES ÉTAPES IMMÉDIATES

1. **Installer Vitest** (5 min)
2. **Créer structure tests/** (10 min)
3. **Implémenter Phase 1 Day 1:**
   - `tests/integration/db/multi-db-consistency.test.js`
   - `tests/integration/db/consistency.test.js`
   - `tests/unit/db/schema.test.js`
4. **Fixer tool_calls_restore.test.js** (15 min)
5. **Setup CI** (30 min)

---

**Plan créé le:** 2025-12-07 21:30
**Auteur:** Claude (Sonnet 4.5)
**Version:** 1.0
**Estimation totale:** 8 semaines (1 développeur full-time)
**Tests estimés:** 80-100 fichiers
**Couverture cible:** 80%+
