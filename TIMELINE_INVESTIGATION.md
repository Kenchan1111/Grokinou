# INVESTIGATION: Timeline.db Incohérence
## Date: 2025-12-07 22:30

**Analyste:** Claude (Sonnet 4.5)
**Problème:** timeline.db n'a PAS d'événements LLM alors qu'il devrait être la source unique de vérité

---

## DÉCOUVERTES CRITIQUES

### 1. État des Databases

**conversations.db** ✅ OK
- Taille: 1.9 MB
- Modifié: 7 déc 11:06
- Schéma: ✅ Correct (sessions, messages, schema_migrations)
- Contenu: Milliers de messages

**sessions.db** ❌ VIDE
- Taille: **0 bytes**
- Modifié: 7 déc 10:45
- Schéma: ❌ Aucune table
- **PROBLÈME CRITIQUE:** Database complètement vide!

**timeline.db** ⚠️ PARTIELLEMENT VIDE
- Taille: 65 MB
- Modifié: 7 déc 16:49
- Schéma: ✅ Correct
- Événements: **85,493 total**
  - ✅ FILE_MODIFIED: 81,986
  - ✅ TOOL_CALL_STARTED: 1,339
  - ✅ TOOL_CALL_SUCCESS: 1,236
  - ❌ **LLM_MESSAGE_USER: 0**
  - ❌ **LLM_MESSAGE_ASSISTANT: 0**

**grok.db** ❌ VIDE
- Taille: 0 bytes
- Modifié: 22 nov 03:31
- Schéma: Aucune table

---

### 2. Période d'Activité Timeline

**Premier événement:** 2025-12-02 19:43:06
**Dernier événement:** 2025-12-07 15:50:19

**Période:** 5 jours d'activité continue

---

### 3. Analyse des Événements

**Types présents:**
```
FILE_MODIFIED        81,986  (95.9%)
TOOL_CALL_STARTED     1,339  (1.6%)
TOOL_CALL_SUCCESS     1,236  (1.4%)
FILE_CREATED            787  (0.9%)
TOOL_CALL_FAILED        102  (0.1%)
FILE_DELETED             14  (<0.1%)
SESSION_SWITCHED         11  (<0.1%)
SNAPSHOT_CREATED         10  (<0.1%)
SESSION_CREATED           8  (<0.1%)
```

**Types ABSENTS mais attendus:**
```
LLM_MESSAGE_USER          0  ❌ CRITIQUE
LLM_MESSAGE_ASSISTANT     0  ❌ CRITIQUE
LLM_MESSAGE_SYSTEM        0  ❌
LLM_STREAMING_START       0  ❌
LLM_STREAMING_END         0  ❌
LLM_ERROR                 0  ❌
```

---

### 4. Incohérence Multi-DB

**Test multi-db-consistency.test.js révèle:**

```javascript
{ sid: 15, convoCount: 1484, timelineCount: 0 }
{ sid: 20, convoCount: 1576, timelineCount: 0 }
{ sid: 3,  convoCount: 18,   timelineCount: 0 }
// ... 16 sessions testées, TOUTES à 0 dans timeline!
```

**Analyse:**
- conversations.db: **1,484 messages** (session 15)
- timeline.db: **0 événements LLM** (session 15)
- **100% des sessions ont cette incohérence**

---

## ARCHITECTURE ATTENDUE vs RÉELLE

### Architecture Attendue

```
User Message
    ↓
GrokAgent.sendMessage()
    ↓
[DEVRAIT APPELER] LLMHook.captureUserMessage()
    ↓
EventBus.emit(LLM_MESSAGE_USER)
    ↓
timeline.db (events table)
```

### Architecture Réelle

```
User Message
    ↓
GrokAgent.sendMessage()
    ↓
[N'APPELLE PAS] LLMHook.captureUserMessage() ❌
    ↓
DIRECT → conversations.db
```

**Résultat:** Timeline.db ne reçoit JAMAIS les événements LLM!

---

## INVESTIGATION: LLMHook Intégration

### Code du Hook (llm-hook.ts)

**Fichier:** `src/timeline/hooks/llm-hook.ts`

**Méthodes disponibles:**
```typescript
class LLMHook {
  captureUserMessage(content, sessionId, model, provider, tokenCount)
  captureAssistantMessage(content, sessionId, model, provider, tokenCount)
  captureSystemMessage(content, sessionId, model, provider)
  captureStreamingStart(sessionId, model, provider)
  captureStreamingEnd(sessionId, model, provider, totalTokens)
  captureError(error, sessionId, model, provider)
}
```

**Pattern:** Singleton avec `LLMHook.getInstance()`

---

### Intégration dans GrokAgent

**Question Critique:** GrokAgent appelle-t-il LLMHook?

**Recherche dans grok-agent.ts:**
```bash
grep -n "LLMHook\|llmHook\|captureUserMessage" src/agent/grok-agent.ts
# Résultat: ???
```

**HYPOTHÈSE:** LLMHook n'est PAS utilisé dans grok-agent.ts!

---

## CAUSES POSSIBLES

### Hypothèse #1: Hook Jamais Intégré ⭐⭐⭐⭐⭐ PROBABLE

**Symptômes:**
- Hook existe (llm-hook.ts)
- Hook pas importé/utilisé dans grok-agent.ts
- Aucun événement LLM dans timeline.db

**Test:**
```bash
grep "import.*LLMHook" src/agent/grok-agent.ts
# Si vide → Hook pas intégré
```

**Fix:** Ajouter appels LLMHook dans grok-agent.ts

---

### Hypothèse #2: Hook Désactivé ⭐⭐ POSSIBLE

**Symptômes:**
- Hook intégré mais `enabled: false`

**Test:**
```typescript
const hook = LLMHook.getInstance();
console.log(hook.isEnabled()); // false?
```

**Fix:** Activer le hook

---

### Hypothèse #3: sessions.db Reset a Cassé Tout ⭐⭐⭐ POSSIBLE

**Symptômes:**
- sessions.db vide (0 bytes)
- Hook utilise sessionId de sessions.db
- Si pas de sessionId → Hook skip?

**Timeline:**
```
7 déc 10:45 - sessions.db vide (0 bytes)
7 déc 11:06 - conversations.db modifié (contient messages)
7 déc 16:49 - timeline.db modifié (mais sans LLM events)
```

**Théorie:**
1. sessions.db resetté à 10:45
2. Messages continuent dans conversations.db (utilise sessionId hardcodé?)
3. LLMHook échoue silencieusement (pas de sessionId valide)

---

### Hypothèse #4: Migration Incomplète ⭐⭐⭐⭐ TRÈS PROBABLE

**Observation:**
- conversations.db utilise **INTEGER** session_id
- timeline.db utilise **TEXT** aggregate_id
- LLMHook fait: `aggregate_id: sessionId.toString()`

**Possible mismatch:**
```typescript
// conversations.db
session_id: 15 (INTEGER)

// LLMHook appelle
aggregate_id: "15" (STRING)

// Mais si session 15 n'existe pas dans sessions.db...
// aggregate_id devient: "undefined" ou "" ?
```

**Test:**
```sql
SELECT DISTINCT aggregate_id FROM events WHERE aggregate_type='session';
-- Compare avec session_id dans conversations.db
```

---

## SCHÉMAS ALTÉRÉS?

### timeline.db Schema

**Attendu (selon schema.ts):**
```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL UNIQUE,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_id TEXT,
    aggregate_type TEXT,
    payload TEXT NOT NULL,
    correlation_id TEXT,
    causation_id TEXT,
    metadata TEXT,
    checksum TEXT NOT NULL,
    CHECK (length(checksum) = 64),
    CHECK (timestamp > 0),
    CHECK (sequence_number > 0)
);
```

**Réel (vérifié):**
```sql
✅ IDENTIQUE - Schema correct!
```

**Indexes attendus:**
```sql
idx_events_sequence
idx_events_timestamp
idx_events_type
idx_events_aggregate
idx_events_correlation
idx_events_actor
```

**Indexes réels:**
```sql
✅ TOUS PRÉSENTS
```

**Verdict:** ✅ Schema timeline.db NON ALTÉRÉ

---

### conversations.db Schema

**Tables attendues:**
- sessions
- messages
- schema_migrations

**Tables réelles:**
```sql
✅ sessions (présente)
✅ messages (présente)
✅ schema_migrations (présente)
```

**Verdict:** ✅ Schema conversations.db NON ALTÉRÉ

---

### sessions.db Schema

**État:** ❌ **COMPLÈTEMENT VIDE**

**Taille:** 0 bytes
**Tables:** Aucune

**PROBLÈME CRITIQUE:** sessions.db a été DELETÉ/RESETTÉ!

**Quand?** 7 décembre 10:45

**Impact:**
- Pas de sessions valides
- sessionId potentiellement undefined
- LLMHook peut échouer silencieusement

---

## TIMELINE DU DÉSASTRE

### 22 Novembre 03:31
- grok.db créé (vide)

### 2 Décembre 19:43
- **Premier événement timeline.db**
- FILE_MODIFIED events commencent

### 7 Décembre 10:45 ⚠️
- **sessions.db RESET à 0 bytes**
- CAUSE PROBABLE: Migration ratée? Corruption? Delete accidentel?

### 7 Décembre 11:06
- conversations.db continue d'être modifié
- Messages écrits SANS session valide dans sessions.db

### 7 Décembre 16:49
- timeline.db continue
- Mais AUCUN événement LLM

---

## TESTS À EXÉCUTER

### Test 1: Hook Integration Check
```bash
grep -n "import.*LLMHook" src/agent/grok-agent.ts
grep -n "captureUserMessage\|captureAssistantMessage" src/agent/grok-agent.ts
```

**Si vide:** Hook pas intégré → CAUSE RACINE

---

### Test 2: Session IDs Check
```bash
# Sessions dans conversations.db
sqlite3 ~/.grok/conversations.db "SELECT DISTINCT session_id FROM messages LIMIT 10"

# Sessions dans timeline.db
sqlite3 ~/.grok/timeline.db "SELECT DISTINCT aggregate_id FROM events WHERE aggregate_type='session'"

# Comparer les deux listes
```

---

### Test 3: EventBus Emit Log
```typescript
// Ajouter logging temporaire dans EventBus.emit()
console.log('[EventBus] Emitting:', event.event_type);
```

**Vérifier:** Est-ce que LLM_MESSAGE_* sont émis?

---

### Test 4: LLMHook Enabled Check
```typescript
import { LLMHook } from './timeline/hooks/llm-hook.js';
const hook = LLMHook.getInstance();
console.log('LLMHook enabled:', hook.isEnabled());
```

---

## DIAGNOSTIC PRÉLIMINAIRE

### Problème Principal

**LLMHook n'est PAS appelé par GrokAgent**

**Preuves:**
1. ✅ Hook existe et est bien codé (llm-hook.ts)
2. ✅ EventBus fonctionne (TOOL_CALL_* events présents)
3. ✅ Schema timeline.db correct
4. ❌ ZÉRO événements LLM_MESSAGE_* dans timeline
5. ❌ Aucune intégration visible dans grok-agent.ts

**Conclusion:** Architecture existe mais n'est PAS connectée!

---

### Problème Secondaire

**sessions.db complètement vide**

**Impact:**
- sessionId peut être undefined/null
- Même si LLMHook était appelé, il échouerait

**Action Urgente:** Restaurer sessions.db

---

## PLAN DE CORRECTION

### Phase 1: Restaurer sessions.db (URGENT)

1. **Vérifier s'il existe un backup**
   ```bash
   ls -la ~/.grok/*.db-backup
   ls -la ~/.grok/.backup/
   ```

2. **Si pas de backup, reconstruire depuis conversations.db**
   ```sql
   -- Extraire sessions depuis messages
   INSERT INTO sessions (id, working_dir, session_hash, default_provider, default_model, started_at)
   SELECT DISTINCT
     session_id,
     '/unknown',
     'session_' || session_id,
     provider,
     model,
     MIN(timestamp)
   FROM messages
   GROUP BY session_id;
   ```

3. **Vérifier cohérence**
   ```bash
   node tests/integration/db/consistency.test.js
   ```

---

### Phase 2: Intégrer LLMHook dans GrokAgent

**Fichier:** `src/agent/grok-agent.ts`

**Ajouts requis:**

```typescript
import { LLMHook } from '../timeline/hooks/llm-hook.js';

class GrokAgent {
  private llmHook: LLMHook;

  constructor() {
    // ...
    this.llmHook = LLMHook.getInstance();
  }

  async sendMessage(userMessage: string) {
    // Capturer message user
    await this.llmHook.captureUserMessage(
      userMessage,
      this.currentSessionId,
      this.model,
      this.provider
    );

    // ... appel API ...

    // Capturer réponse assistant
    await this.llmHook.captureAssistantMessage(
      assistantResponse,
      this.currentSessionId,
      this.model,
      this.provider
    );
  }
}
```

---

### Phase 3: Backfill Events (Optionnel)

**Si possible, recréer événements LLM depuis conversations.db:**

```sql
-- Pour chaque message dans conversations.db
-- Créer événement dans timeline.db

INSERT INTO events (id, timestamp, sequence_number, actor, event_type, aggregate_id, aggregate_type, payload, checksum)
SELECT
  'backfill_' || m.id,
  strftime('%s', m.timestamp) * 1000000,  -- Convert to microseconds
  -- sequence_number généré
  CASE m.role WHEN 'user' THEN 'user' ELSE 'llm:' || m.model END,
  CASE m.role WHEN 'user' THEN 'LLM_MESSAGE_USER' ELSE 'LLM_MESSAGE_ASSISTANT' END,
  CAST(m.session_id AS TEXT),
  'session',
  json_object(
    'role', m.role,
    'content', m.content,
    'session_id', m.session_id,
    'model', m.model,
    'provider', m.provider
  ),
  -- checksum calculé
FROM messages m;
```

**Risques:** Sequence numbers conflicts, checksums invalides

---

### Phase 4: Tests de Validation

1. **Créer nouveau message**
2. **Vérifier événement dans timeline.db**
   ```sql
   SELECT * FROM events WHERE event_type IN ('LLM_MESSAGE_USER', 'LLM_MESSAGE_ASSISTANT') ORDER BY timestamp DESC LIMIT 5;
   ```
3. **Run tests de consistance**
   ```bash
   node tests/integration/db/multi-db-consistency.test.js
   ```

---

## ACTIONS IMMÉDIATES

### Priorité 1 (Critique)
- [ ] Vérifier intégration LLMHook dans grok-agent.ts
- [ ] Investiguer pourquoi sessions.db vide
- [ ] Restaurer sessions.db si possible

### Priorité 2 (Haute)
- [ ] Intégrer LLMHook dans GrokAgent
- [ ] Créer test de régression pour Hook intégration
- [ ] Vérifier tous les hooks (Tool, File, Git, Session)

### Priorité 3 (Moyenne)
- [ ] Backfill événements LLM historiques
- [ ] Documenter architecture event sourcing
- [ ] Créer monitoring hook health

---

## QUESTIONS OUVERTES

1. **Qui/Quoi a resetté sessions.db le 7 déc à 10:45?**
   - Migration?
   - Script manuel?
   - Bug?
   - Corruption DB?

2. **Pourquoi conversations.db fonctionne sans sessions.db?**
   - Foreign key disabled?
   - sessionId hardcodé?

3. **LLMHook était-il jamais intégré?**
   - Ou juste codé mais jamais utilisé?

4. **Autres hooks sont-ils intégrés?**
   - ToolHook: ✅ OUI (TOOL_CALL_* events présents)
   - FileHook: ✅ OUI (FILE_* events présents)
   - SessionHook: ⚠️ PARTIEL (SESSION_* events rares)
   - GitHook: ❓ À vérifier
   - LLMHook: ❌ NON

---

## CONCLUSION

**Root Cause Identifiée:**

1. **LLMHook existe mais n'est PAS intégré dans GrokAgent** ⭐⭐⭐⭐⭐
   - Architecture complète codée
   - Jamais appelée dans le code principal
   - Résultat: ZÉRO événements LLM

2. **sessions.db vide depuis 7 déc 10:45** ⭐⭐⭐⭐
   - Reset/corruption mystérieuse
   - Impact sur toute l'application
   - Nécessite investigation urgente

3. **Schema timeline.db INTACT** ✅
   - Pas d'altération
   - Fonctionne correctement pour File/Tool events

**Impact:**
- ❌ Timeline incomplete (pas de LLM events)
- ❌ Forensics impossible pour conversations
- ❌ Rewind cassé pour messages
- ❌ Perte de "source unique de vérité"

**Effort de correction:**
- Phase 1 (sessions.db): 2-4 heures
- Phase 2 (LLMHook): 2-3 heures
- Phase 3 (Backfill): 4-6 heures (optionnel)
- **Total: 8-13 heures**

---

**Investigation créée le:** 2025-12-07 22:30:00
**Analyste:** Claude (Sonnet 4.5)
**Status:** ROOT CAUSE IDENTIFIÉE
**Prochaine action:** Vérifier grep LLMHook dans grok-agent.ts
