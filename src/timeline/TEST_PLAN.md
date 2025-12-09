# 🧪 Timeline Module - Test Plan

**Status**: ✅ Hooks implémentés, prêts pour intégration  
**Date**: 2025-11-28

---

## 📋 Tests À Effectuer

### ✅ Test 1: Database Initialization

```typescript
import { getTimelineDb } from './timeline';

const db = getTimelineDb({ dbPath: '~/.grok/timeline.db' });
console.log(db.healthCheck()); // Should return true
console.log(db.getStats());
```

**Expected Output**:
```
true
{
  total_events: 0,
  total_snapshots: 0,
  total_blobs: 0,
  db_size_mb: 0.01,
  last_event_time: null
}
```

---

### ✅ Test 2: LLM Hook

```typescript
import { getLLMHook } from './timeline';

const llmHook = getLLMHook();

// Capture user message
await llmHook.captureUserMessage(
  'Hello, how are you?',
  1,  // sessionId
  'gpt-4',
  'openai',
  10  // token count
);

// Capture assistant message
await llmHook.captureAssistantMessage(
  'I am doing well, thank you!',
  1,
  'gpt-4',
  'openai',
  15
);
```

**Expected**: 2 events logged to timeline.db with type `LLM_MESSAGE_USER` and `LLM_MESSAGE_ASSISTANT`

---

### ✅ Test 3: Tool Hook

```typescript
import { getToolHook } from './timeline';

const toolHook = getToolHook();

// Start tool call
const startEventId = await toolHook.captureToolCallStarted(
  'view_file',
  { path: '/tmp/test.txt' },
  1
);

// Tool call success
await toolHook.captureToolCallSuccess(
  'view_file',
  { path: '/tmp/test.txt' },
  'File contents here',
  1,
  50,  // duration_ms
  startEventId  // causation_id
);
```

**Expected**: 2 events with causation chain (TOOL_CALL_STARTED → TOOL_CALL_SUCCESS)

---

### ✅ Test 4: Session Hook

```typescript
import { getSessionHook } from './timeline';

const sessionHook = getSessionHook();

// Create session
await sessionHook.captureSessionCreated(
  1,
  'Test Session',
  '/tmp/test-project',
  'gpt-4',
  'openai'
);

// Rename session
await sessionHook.captureSessionRenamed(
  1,
  'Test Session',
  'Renamed Test Session'
);
```

**Expected**: 2 events (SESSION_CREATED, SESSION_RENAMED)

---

### ✅ Test 5: Event Integrity

```typescript
import { getTimelineLogger } from './timeline';

const logger = getTimelineLogger();
const verification = logger.verifyAllEvents();

console.log(verification);
```

**Expected Output**:
```
{
  total: 6,
  valid: 6,
  invalid: 0,
  invalid_ids: []
}
```

---

### ✅ Test 6: Query Events

```typescript
import { getTimelineLogger } from './timeline';

const logger = getTimelineLogger();
const lastEvents = logger.getLastEvents(10);

lastEvents.forEach(event => {
  console.log(`[${event.sequence_number}] ${event.event_type} by ${event.actor}`);
});
```

**Expected Output**:
```
[6] SESSION_RENAMED by user
[5] SESSION_CREATED by system
[4] TOOL_CALL_SUCCESS by tool:view_file
[3] TOOL_CALL_STARTED by tool:view_file
[2] LLM_MESSAGE_ASSISTANT by llm:gpt-4
[1] LLM_MESSAGE_USER by user
```

---

## 🔌 Integration avec l'App

### Phase 1: Ajout dans GrokAgent

**Fichier**: `src/agent/grok-agent.ts`

```typescript
import { getLLMHook } from '../timeline';

export class GrokAgent {
  private llmHook = getLLMHook();
  
  async sendMessage(message: string, options: SendOptions) {
    // Capture user message
    await this.llmHook.captureUserMessage(
      message,
      this.currentSessionId,
      this.currentModel,
      this.currentProvider
    );
    
    // ... existing code ...
    
    // After response received
    await this.llmHook.captureAssistantMessage(
      response,
      this.currentSessionId,
      this.currentModel,
      this.currentProvider,
      tokenCount
    );
  }
}
```

---

### Phase 2: Ajout dans ConfirmationService

**Fichier**: `src/tools/confirmation-service.ts`

```typescript
import { getToolHook } from '../timeline';

export class ConfirmationService {
  private toolHook = getToolHook();
  
  async executeWithConfirmation(tool: any, args: any) {
    // Capture start
    const startEventId = await this.toolHook.captureToolCallStarted(
      tool.name,
      args,
      this.currentSessionId
    );
    
    try {
      const result = await tool.execute(args);
      
      // Capture success
      await this.toolHook.captureToolCallSuccess(
        tool.name,
        args,
        result,
        this.currentSessionId,
        duration,
        startEventId
      );
      
      return result;
    } catch (error) {
      // Capture failure
      await this.toolHook.captureToolCallFailed(
        tool.name,
        args,
        error.message,
        this.currentSessionId,
        duration,
        startEventId
      );
      throw error;
    }
  }
}
```

---

### Phase 3: Ajout dans SessionManager

**Fichier**: `src/utils/session-manager-sqlite.ts`

```typescript
import { getSessionHook } from '../timeline';

export class SessionManagerSQLite {
  private sessionHook = getSessionHook();
  
  initSession(workdir: string, provider: string, model: string) {
    const session = this.sessionRepo.findOrCreate(...);
    
    // Capture session created
    if (session.is_new) {
      await this.sessionHook.captureSessionCreated(
        session.id,
        session.session_name,
        workdir,
        model,
        provider
      );
    }
    
    return session;
  }
  
  switchSession(sessionId: number) {
    const fromId = this.currentSession?.id;
    const toSession = this.sessionRepo.findById(sessionId);
    
    // Capture switch
    await this.sessionHook.captureSessionSwitched(
      fromId,
      toSession.id,
      toSession.working_dir
    );
    
    return toSession;
  }
}
```

---

## ✅ Tests de Non-Régression

### Avant Intégration

```bash
# Test que l'app fonctionne sans timeline
grokinou --version  # Should work
echo "test" | grokinou  # Should work
```

### Après Intégration

```bash
# Test que l'app fonctionne avec timeline
grokinou --version  # Should work
echo "test" | grokinou  # Should work + log to timeline.db

# Vérifier timeline.db créé
ls -lh ~/.grok/timeline.db  # Should exist

# Vérifier events loggés
sqlite3 ~/.grok/timeline.db "SELECT COUNT(*) FROM events"  # Should be > 0
```

---

## 📊 Métriques de Succès

| Métrique | Objectif | Status |
|----------|----------|--------|
| Build sans erreur | ✅ | ✅ |
| Hooks créés | 3/3 | ✅ |
| Database schema | ✅ | ✅ |
| Event types | 118 | ✅ |
| Tests unitaires | N/A (hooks isolés) | ⏳ |
| Intégration app | Pas encore | ⏳ |
| Zero regression | ✅ | ✅ |

---

## 🚀 Prochaines Étapes

1. ✅ **Hooks implémentés** (Phase 2 complète)
2. ⏳ **Intégration dans l'app** (Phase 3)
3. ⏳ **File watcher** (Phase 4)
4. ⏳ **Git hook** (Phase 5)
5. ⏳ **Rewind engine** (Phase 6)

---

**Auteur**: Claude (Anthropic AI)  
**Date**: 2025-11-28  
**Status**: Phase 2 complète ✅
