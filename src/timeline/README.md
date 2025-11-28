# 🕐 Timeline - Event Sourcing & Time Machine

**Status**: 🟡 **IN DEVELOPMENT** (Isolated from main app)  
**Version**: 1.0.0 (Alpha)  
**Date**: 2025-11-28

---

## 📋 Overview

The **Timeline** module implements a complete **Event Sourcing** system for grok-cli, enabling:
- ⏪ **Time travel**: Rewind to any point in history
- 🔍 **Full audit trail**: Every action is logged immutably
- 🔗 **Merkle DAG**: Git-like file versioning
- 📊 **Query system**: Search patterns in conversations and actions
- 🚀 **Zero regression**: Completely isolated from existing app

---

## 🏗️ Architecture

```
┌──────────────────────────────────────┐
│         EventBus (Central)           │  ← All mutations go through here
└───────────┬────────────┬─────────────┘
            │            │
            ▼            ▼
  ┌─────────────┐  ┌──────────────┐
  │ timeline.db │  │conversations │
  │ (SSOT)      │  │    .db       │
  │             │  │ (Read Model) │
  │ • Events    │  │ • Sessions   │
  │ • Snapshots │  │ • Messages   │
  │ • Merkle    │  │ • Search     │
  └─────────────┘  └──────────────┘
        ↓                  ↓
    Rewind            Fast Queries
   (write)             (read-only)
```

---

## 📁 Structure

```
src/timeline/
├── schema.sql              # SQLite schema (events, snapshots, merkle DAG)
├── event-types.ts          # Complete event taxonomy
├── database.ts             # Database manager (singleton)
├── event-bus.ts            # Central event dispatcher
├── timeline-logger.ts      # Event logger
├── rewind-engine.ts        # State reconstruction engine
├── hooks/                  # Automatic event capture
│   ├── llm-hook.ts         # LLM messages
│   ├── tool-hook.ts        # Tool calls
│   ├── file-hook.ts        # File operations
│   └── git-hook.ts         # Git commands
├── storage/                # Merkle DAG storage
│   ├── merkle-dag.ts       # Blob storage
│   ├── delta-encoder.ts    # Delta compression
│   └── compressor.ts       # zlib compression
└── README.md               # This file
```

---

## 🔒 Key Principles

### 1. **Immutability**
```typescript
// ✅ ALLOWED
db.run('INSERT INTO events ...');

// ❌ FORBIDDEN (will throw error)
db.run('UPDATE events ...');
db.run('DELETE FROM events ...');
```

### 2. **Event-First Architecture**
```typescript
// ALL mutations must go through EventBus
await eventBus.emit({
  type: EventType.FILE_MODIFIED,
  payload: { ... }
});

// This automatically:
// 1. Logs to timeline.db
// 2. Updates conversations.db (if applicable)
// 3. Stores in Merkle DAG (if file change)
```

### 3. **Isolation from Main App**
```typescript
// Timeline is OPTIONAL
// If timeline.db fails, app continues normally

try {
  await timelineLogger.log(event);
} catch (error) {
  console.error('Timeline logging failed:', error);
  // App continues ✅
}
```

---

## 🚀 Usage

### Initialize Timeline (One-Time Setup)

```typescript
import { getTimelineDb } from './timeline/database';

// Initialize timeline database
const timeline = getTimelineDb();

// Check health
if (timeline.healthCheck()) {
  console.log('✅ Timeline ready');
}
```

### Log an Event

```typescript
import { EventBus } from './timeline/event-bus';
import { EventType } from './timeline/event-types';

const eventBus = EventBus.getInstance();

await eventBus.emit({
  type: EventType.LLM_MESSAGE_USER,
  actor: 'user',
  aggregate_id: session.id.toString(),
  aggregate_type: 'session',
  payload: {
    role: 'user',
    content: 'Fix the bug in auth.ts',
    session_id: session.id,
    model: 'gpt-4',
    provider: 'openai'
  }
});
```

### Query Events

```typescript
import { TimelineQuery } from './timeline/query';

const query = new TimelineQuery();

// Get all events in last hour
const events = await query.getEventsSince(Date.now() - 3600000);

// Search for file modifications
const fileChanges = await query.getEventsByType(EventType.FILE_MODIFIED);

// Get events for specific session
const sessionEvents = await query.getEventsByAggregate('session', sessionId);
```

### Rewind to Timestamp

```typescript
import { RewindEngine } from './timeline/rewind-engine';

const rewind = new RewindEngine();

// Rewind to 2 hours ago
const targetTime = Date.now() - 2 * 3600000;
const outputDir = '/tmp/rewind_2025-11-28_01h00';

await rewind.rewindTo(targetTime, outputDir);

// Result:
// - All files restored to state at targetTime
// - conversations.db recreated with messages up to targetTime
// - New Git branch created (optional)
```

---

## 🔧 Integration Points

### Current Status: **NOT INTEGRATED** ✅

The timeline module is currently **isolated** and has **zero impact** on the main app.

### Future Integration (Phase 2)

1. **Hook into GrokAgent** (LLM messages)
2. **Hook into ToolExecutor** (Tool calls)
3. **Hook into SessionManager** (Session lifecycle)
4. **Add `/rewind` command** (User-facing tool)
5. **Add LLM tool `rewind_to`** (LLM-accessible)

---

## 📊 Database Schema

### Events Table

```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,              -- UUID
    timestamp INTEGER NOT NULL,       -- Unix microseconds
    sequence_number INTEGER NOT NULL, -- Strict ordering
    actor TEXT NOT NULL,              -- 'user' | 'llm:<model>' | 'tool:<name>'
    event_type TEXT NOT NULL,         -- EventType enum
    aggregate_id TEXT,                -- Entity ID
    aggregate_type TEXT,              -- 'session' | 'file' | 'git'
    payload TEXT NOT NULL,            -- JSON
    correlation_id TEXT,              -- Transaction ID
    causation_id TEXT,                -- Parent event
    metadata TEXT,                    -- Additional context
    checksum TEXT NOT NULL            -- SHA256(payload)
);
```

### Snapshots Table

```sql
CREATE TABLE snapshots (
    aggregate_id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    state_compressed BLOB NOT NULL,   -- zlib compressed
    checksum TEXT NOT NULL
);
```

### Merkle DAG

```sql
CREATE TABLE file_blobs (
    hash TEXT PRIMARY KEY,
    content BLOB NOT NULL,            -- zlib compressed
    is_delta INTEGER DEFAULT 0,       -- Delta encoding
    base_hash TEXT,
    size INTEGER NOT NULL,
    compressed_size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
```

---

## 🧪 Testing

### Run Timeline Tests

```bash
# Unit tests
npm test -- timeline

# Integration tests
npm test -- timeline.integration

# Performance tests
npm test -- timeline.performance
```

### Manual Testing

```bash
# Initialize timeline
node -e "require('./dist/timeline/database').getTimelineDb().healthCheck()"

# Log test event
node -e "const {EventBus} = require('./dist/timeline/event-bus'); EventBus.getInstance().emit({type: 'CLI_STARTED', actor: 'system', payload: {}})"

# Check stats
node -e "console.log(require('./dist/timeline/database').getTimelineDb().getStats())"
```

---

## 🔍 Verification

### Check Timeline Integrity

```bash
# Verify all events have valid checksums
SELECT COUNT(*) as invalid_events
FROM events
WHERE checksum != hex(sha256(payload));

# Should return 0
```

### Check Chain Integrity

```bash
# Verify causation_id references valid events
SELECT COUNT(*) as broken_chains
FROM events e1
LEFT JOIN events e2 ON e1.causation_id = e2.id
WHERE e1.causation_id IS NOT NULL AND e2.id IS NULL;

# Should return 0
```

---

## 📈 Performance

### Expected Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Log event | < 1ms | Synchronous write |
| Query events (100) | < 5ms | Indexed query |
| Rewind (no snapshot) | ~50ms/1k events | Linear replay |
| Rewind (with snapshot) | < 500ms | Jump to snapshot + replay delta |
| Snapshot creation | ~100-500ms | Depends on state size |

### Optimization Strategies

1. **Snapshots**: Every 10,000 events OR after git commit
2. **Delta encoding**: For file blobs (like Git pack files)
3. **zlib compression**: ~70% size reduction
4. **Indexes**: All major query patterns covered
5. **WAL mode**: Write-ahead logging for concurrent reads

---

## ⚠️ Limitations

### Current Limitations

1. **No distributed support**: Single-node only (for now)
2. **No encryption**: Events stored in plain text (future: encrypt payloads)
3. **No retention policy**: Events kept forever (future: auto-purge > 1 year)
4. **No export/import**: Can't transfer timeline between machines (future: export to JSONL)

### Known Issues

- None yet (module not integrated)

---

## 🛠️ Maintenance

### Garbage Collection

```typescript
// Purge events older than 90 days
await timeline.garbageCollect({
  retentionDays: 90,
  createFinalSnapshot: true  // Snapshot before deletion
});
```

### Vacuum Database

```bash
# Reclaim space after garbage collection
node -e "require('./dist/timeline/database').getTimelineDb().vacuum()"
```

### Optimize Performance

```bash
# Rebuild indexes and analyze query plans
node -e "require('./dist/timeline/database').getTimelineDb().optimize()"
```

---

## 📚 References

- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Git Internals](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)
- [Certificate Transparency RFC 6962](https://tools.ietf.org/html/rfc6962)

---

## 🤝 Contributing

Since this module is isolated, it's safe to experiment:

1. All changes are **backward compatible** (append-only schema)
2. No impact on main app
3. Extensive tests required before integration

---

## 📞 Questions?

- **Architecture**: See `ARCHITECTURE_TIME_MACHINE_ANALYSIS.md`
- **Event Types**: See `event-types.ts`
- **Database Schema**: See `schema.sql`

---

**Next Steps**:
1. ✅ Basic structure created
2. ⏳ Implement EventBus
3. ⏳ Implement TimelineLogger
4. ⏳ Implement Hooks (LLM, Tools, Files, Git)
5. ⏳ Implement RewindEngine
6. ⏳ Integration with main app
7. ⏳ Add `/rewind` command
8. ⏳ Add LLM tools

**Status**: Phase 1 - Foundations (Week 1-2)
