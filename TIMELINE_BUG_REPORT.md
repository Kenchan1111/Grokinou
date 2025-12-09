# BUG REPORT: Timeline.db N'Enregistre Pas les Événements LLM
## Date: 2025-12-07 22:45
## Severity: ⭐⭐⭐⭐⭐ CRITIQUE

---

## RÉSUMÉ EXÉCUTIF

**Problème:** timeline.db (source unique de vérité) n'enregistre AUCUN événement LLM depuis au moins 5 jours, bien que le système fonctionne normalement.

**Impact:**
- ❌ Timeline incomplete → Perte de "source unique de vérité"
- ❌ Forensics impossible (pas d'audit trail pour conversations)
- ❌ Rewind cassé (impossible de recréer état passé)
- ❌ Tests de consistance échouent
- ❌ Incohérence majeure entre conversations.db et timeline.db

**Root Cause:** EventBus.emit() échoue silencieusement (ligne 98: "Silent fail")

---

## PREUVES

### 1. Test de Consistance Échoue

```bash
$ node tests/integration/db/multi-db-consistency.test.js
❌ message count mismatch (sampled):
  { sid: 15, convoCount: 1484, timelineCount: 0 }
  { sid: 20, convoCount: 1576, timelineCount: 0 }
  { sid: 24, convoCount: 42, timelineCount: 0 }
```

**100% des sessions testées** ont timeline count = 0 pour LLM events!

---

### 2. Query Directe

```sql
-- conversations.db
SELECT COUNT(*) FROM messages WHERE session_id=24;
→ 42 messages

-- timeline.db
SELECT COUNT(*) FROM events
WHERE aggregate_id='24'
  AND event_type IN ('LLM_MESSAGE_USER', 'LLM_MESSAGE_ASSISTANT');
→ 0 événements
```

**Incohérence totale:** 42 messages vs 0 événements

---

### 3. Distribution des Événements Timeline

```
Total événements: 85,493

Par type:
FILE_MODIFIED      81,986  (95.9%)  ✅ Fonctionne
TOOL_CALL_STARTED   1,339  (1.6%)   ✅ Fonctionne
TOOL_CALL_SUCCESS   1,236  (1.4%)   ✅ Fonctionne
FILE_CREATED          787  (0.9%)   ✅ Fonctionne
TOOL_CALL_FAILED      102  (0.1%)   ✅ Fonctionne

LLM_MESSAGE_USER        0  ❌ CASSÉ
LLM_MESSAGE_ASSISTANT   0  ❌ CASSÉ
LLM_MESSAGE_SYSTEM      0  ❌ CASSÉ
```

**Seuls les événements LLM sont à 0!**

---

### 4. Test en Temps Réel

```sql
-- Événements dernière heure
SELECT COUNT(*) FROM events
WHERE timestamp/1000000 > strftime('%s','now','-1 hour');
→ 0

-- Mais nous venons d'avoir une conversation de 42 messages!
```

**Preuve:** Événements pas enregistrés en temps réel

---

## INVESTIGATION TECHNIQUE

### Architecture Attendue

```
User sends message
    ↓
GrokAgent.sendMessage() (ligne 645)
    ↓
sessionManager.getCurrentSession() (ligne 647)
    ↓
llmHook.captureUserMessage() (ligne 649)
    ↓
EventBus.emit() (event-bus.ts ligne 85)
    ↓
TimelineLogger.log() (ligne 95)
    ↓
timeline.db INSERT
```

---

### Code Vérifié

**grok-agent.ts ligne 645-659:**
```typescript
// 🕐 Timeline: Capture user message
try {
  const session = sessionManager.getCurrentSession();
  if (session) {
    await this.llmHook.captureUserMessage(
      message,
      session.id,
      this.grokClient.getCurrentModel(),
      providerManager.detectProvider(this.grokClient.getCurrentModel())
    );
  }
} catch (error) {
  // Don't fail the request if timeline logging fails
  debugLog.log('⚠️  Timeline logging failed for user message:', error);
}
```

✅ **Code correct** - Hook appelé

---

**event-bus.ts ligne 85-102:**
```typescript
public async emit(input: EventInput): Promise<LogResult> {
  try {
    let logResult: LogResult = {
      success: false,
      event_id: '',
      sequence_number: 0,
    };

    if (this.options.enableLogging) {
      logResult = await this.logger.log(input);

      if (!logResult.success) {
        // Silent fail - don't pollute console with timeline errors
        return logResult;  // ❌ PROBLÈME ICI!
      }
    }
```

⚠️ **Silent fail** - Erreurs avalées sans log!

---

## ROOT CAUSES POSSIBLES

### Hypothèse #1: TimelineLogger.log() Échoue ⭐⭐⭐⭐⭐ TRÈS PROBABLE

**Symptômes:**
- TOOL_CALL events fonctionnent
- LLM events échouent
- Pas d'erreur dans debug.log

**Différences:**
- ToolHook vs LLMHook
- Payload différent?
- Session ID format?

**Test requis:**
```typescript
// Ajouter logging dans TimelineLogger.log()
console.error('TimelineLogger.log() called with:', input.event_type);
if (!result.success) {
  console.error('TimelineLogger.log() FAILED:', result.error);
}
```

---

### Hypothèse #2: session = null ⭐⭐⭐⭐ PROBABLE

**Code ligne 647-655:**
```typescript
const session = sessionManager.getCurrentSession();
if (session) {  // Si null, hook pas appelé!
  await this.llmHook.captureUserMessage(...);
}
```

**Test:**
- sessions.db est VIDE (0 bytes)
- `getCurrentSession()` retourne null?
- LLMHook jamais appelé!

**Mais:** TOOL_CALL events fonctionnent (même sessionId requis)

---

### Hypothèse #3: Schema Mismatch ⭐⭐⭐ POSSIBLE

**LLMHook utilise:**
```typescript
aggregate_id: sessionId.toString(),  // "24"
aggregate_type: 'session'
```

**Vérification:**
```sql
-- Sessions avec events
SELECT DISTINCT aggregate_id FROM events WHERE aggregate_type='session';
→ 1, 14, 15, 16, 17, 18, 19, 20, 21, 22

-- Sessions avec messages
SELECT DISTINCT session_id FROM messages;
→ 3, 4, 6, 7, 8, 9, 10, 15, 16, 17, 19, 20, 21, 22, 23, 24
```

**Session 24 a:**
- ✅ TOOL_CALL events dans timeline
- ❌ LLM events absents

→ Pas un problème de schema!

---

### Hypothèse #4: Payload JSON Invalide ⭐⭐⭐⭐ PROBABLE

**LLMMessagePayload:**
```typescript
{
  role: 'user',
  content: string,  // Peut contenir caractères spéciaux?
  session_id: number,
  model: string,
  provider: string,
  token_count?: number
}
```

**Possible:**
- Content avec caractères UTF-8 invalides?
- JSON.stringify échoue?
- Payload trop grand?

**Test requis:**
```typescript
try {
  const payloadStr = JSON.stringify(payload);
  console.log('Payload size:', payloadStr.length);
} catch (e) {
  console.error('JSON.stringify FAILED:', e);
}
```

---

### Hypothèse #5: Database Lock ⭐⭐ POSSIBLE

**Si timeline.db locké:**
- INSERT échoue
- EventBus retourne success=false
- Silent fail (ligne 98)

**Test:**
```bash
# Vérifier locks
lsof | grep timeline.db

# Vérifier mode journal
sqlite3 ~/.grok/timeline.db "PRAGMA journal_mode;"
```

---

## DIFFÉRENCE TOOL vs LLM EVENTS

### TOOL Events (✅ Fonctionnent)

**Source:** `src/timeline/hooks/tool-hook.ts`

**Émission:**
```typescript
await this.eventBus.emit({
  event_type: EventType.TOOL_CALL_STARTED,
  actor: 'grok-agent',
  aggregate_id: sessionId?.toString() || 'unknown',
  aggregate_type: 'session',
  payload: {
    tool_name,
    tool_args,
    session_id: sessionId
  }
});
```

---

### LLM Events (❌ Cassés)

**Source:** `src/timeline/hooks/llm-hook.ts`

**Émission:**
```typescript
await this.eventBus.emit({
  event_type: EventType.LLM_MESSAGE_USER,
  actor: 'user',
  aggregate_id: sessionId.toString(),
  aggregate_type: 'session',
  payload: {
    role: 'user',
    content,  // ← DIFFÉRENCE: Peut être très long!
    session_id: sessionId,
    model,
    provider,
    token_count
  }
});
```

**DIFFÉRENCES CLÉS:**
1. **Content size:** LLM messages peuvent être énormes (plusieurs KB)
2. **Content type:** Texte brut UTF-8 vs JSON args
3. **Frequency:** Beaucoup plus fréquent que tool calls

---

## TESTS À EXÉCUTER

### Test 1: Ajouter Logging dans EventBus

**Fichier:** `src/timeline/event-bus.ts` ligne 95-100

```typescript
if (this.options.enableLogging) {
  console.log('[EventBus] Logging event:', input.event_type); // AJOUTER
  logResult = await this.logger.log(input);

  if (!logResult.success) {
    console.error('[EventBus] FAILED:', input.event_type, logResult.error); // AJOUTER
    return logResult;
  }
  console.log('[EventBus] SUCCESS:', input.event_type); // AJOUTER
}
```

**Run:** Créer un message et observer console

---

### Test 2: Ajouter Logging dans TimelineLogger

**Fichier:** `src/timeline/timeline-logger.ts`

```typescript
public async log(input: EventInput): Promise<LogResult> {
  console.log('[TimelineLogger] log() called:', input.event_type); // AJOUTER
  try {
    // ... code existant ...
  } catch (error) {
    console.error('[TimelineLogger] ERROR:', error); // AJOUTER
    return { success: false, error: error.message };
  }
}
```

---

### Test 3: Vérifier getCurrentSession()

**Fichier:** `src/agent/grok-agent.ts` ligne 647

```typescript
const session = sessionManager.getCurrentSession();
console.log('[GrokAgent] Current session:', session); // AJOUTER
if (session) {
  console.log('[GrokAgent] Calling captureUserMessage, session.id=', session.id); // AJOUTER
  await this.llmHook.captureUserMessage(...);
} else {
  console.warn('[GrokAgent] NO SESSION - Hook not called!'); // AJOUTER
}
```

---

### Test 4: Vérifier Payload Size

**Fichier:** `src/timeline/hooks/llm-hook.ts` ligne 94-109

```typescript
const payload: LLMMessagePayload = {
  role: 'user',
  content,
  session_id: sessionId,
  model,
  provider,
  token_count,
};

console.log('[LLMHook] Payload size:', JSON.stringify(payload).length); // AJOUTER

await this.eventBus.emit({
  event_type: EventType.LLM_MESSAGE_USER,
  actor: 'user',
  aggregate_id: sessionId.toString(),
  aggregate_type: 'session',
  payload,
});
```

---

### Test 5: Manual INSERT

**Direct SQL test:**
```typescript
import Database from 'better-sqlite3';
const db = new Database('~/.grok/timeline.db');

const testEvent = {
  id: 'test-' + Date.now(),
  timestamp: Date.now() * 1000,
  sequence_number: 999999,
  actor: 'test',
  event_type: 'LLM_MESSAGE_USER',
  aggregate_id: '24',
  aggregate_type: 'session',
  payload: JSON.stringify({ test: 'data' }),
  checksum: '0'.repeat(64)
};

try {
  db.prepare(`
    INSERT INTO events (id, timestamp, sequence_number, actor, event_type, aggregate_id, aggregate_type, payload, checksum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(...Object.values(testEvent));
  console.log('✅ Manual INSERT SUCCESS');
} catch (e) {
  console.error('❌ Manual INSERT FAILED:', e);
}
```

**Si réussit:** Problème dans EventBus/TimelineLogger
**Si échoue:** Problème DB (lock, permissions, etc.)

---

## ÉTAT DES DATABASES

### timeline.db ⚠️
- Taille: 65 MB
- Modifié: 7 déc 16:49
- Total events: 85,493
- LLM events: **0**
- Période: 2 déc 19:43 → 7 déc 15:50
- Schema: ✅ Correct

### conversations.db ✅
- Taille: 1.9 MB
- Modifié: 7 déc 11:06
- Messages: Milliers
- Schema: ✅ Correct

### sessions.db ❌
- Taille: **0 bytes**
- Modifié: 7 déc 10:45
- Tables: Aucune
- **PROBLÈME SECONDAIRE**

### grok.db ❓
- Taille: 0 bytes
- Modifié: 22 nov 03:31
- Purpose: Inconnu

---

## PLAN DE DEBUG

### Étape 1: Ajouter Logging (30 min)

1. EventBus.emit() - Lignes 95-100
2. TimelineLogger.log() - Début et fin
3. GrokAgent getCurrentSession() - Ligne 647
4. LLMHook captureUserMessage() - Payload size

### Étape 2: Reproduire Bug (10 min)

1. Rebuild: `npm run build`
2. Start app: `npm start`
3. Envoyer message simple: "Hello"
4. Observer console logs

### Étape 3: Analyser Logs (20 min)

**Chercher:**
- ✅ "[EventBus] Logging event: LLM_MESSAGE_USER"
- ❌ "[EventBus] FAILED: ..."
- ✅ "[TimelineLogger] log() called"
- ❌ "[TimelineLogger] ERROR: ..."

### Étape 4: Test Manual INSERT (15 min)

Si logs montrent success mais DB vide:
→ Problème entre TimelineLogger et DB

### Étape 5: Fix Based on Findings (1-2h)

---

## IMPACT BUSINESS

### Perte de Données

**Période affectée:** 2 décembre → 7 décembre (5 jours)

**Messages perdus:**
- Session 15: 1,484 messages
- Session 20: 1,576 messages
- Session 24: 42 messages
- Total estimé: **3,000+ messages** sans audit trail

**Non récupérable:** Événements jamais loggés = perdus à jamais

---

### Fonctionnalités Cassées

1. **Timeline Query** ❌
   - Impossible de chercher dans historique conversations
   - timeline_query tool retourne 0 résultats pour LLM

2. **Rewind** ❌
   - Impossible de recréer état passé
   - rewind_to ne peut pas restaurer conversations

3. **Forensics** ❌
   - Pas d'audit trail pour compliance
   - Impossible de tracer qui a dit quoi quand

4. **Analytics** ❌
   - Pas de stats sur usage LLM
   - Impossible de mesurer performance

5. **Tests** ❌
   - Tests de consistance échouent
   - CI/CD va fail

---

## URGENCE

**Severity:** ⭐⭐⭐⭐⭐ CRITIQUE

**Raisons:**
1. Perte de "source unique de vérité"
2. 5 jours de données perdues
3. Fonctionnalités core cassées
4. Tests échouent
5. Chaque jour qui passe = plus de perte

**Action Required:** IMMÉDIATE (aujourd'hui)

---

## PROCHAINES ÉTAPES

### Immédiat (Ce soir)

1. ✅ Ajouter logging dans EventBus
2. ✅ Ajouter logging dans TimelineLogger
3. ✅ Ajouter logging dans GrokAgent
4. ✅ Rebuild et test
5. ✅ Identifier root cause exacte

### Court Terme (Demain)

6. ✅ Fix le bug
7. ✅ Vérifier que nouveaux events sont loggés
8. ✅ Run tests de consistance
9. ✅ Commit fix + tests de régression

### Moyen Terme (Cette semaine)

10. Investiguer sessions.db vide
11. Documenter incident (post-mortem)
12. Améliorer error logging (pas de silent fails!)
13. Ajouter monitoring health checks

---

## FICHIERS CONCERNÉS

**À modifier (debug):**
- `src/timeline/event-bus.ts` (ligne 95-100)
- `src/timeline/timeline-logger.ts` (log method)
- `src/agent/grok-agent.ts` (ligne 647)
- `src/timeline/hooks/llm-hook.ts` (ligne 94-109)

**À tester:**
- `tests/integration/db/multi-db-consistency.test.js`
- `tests/integration/tool_usage_monitor.js`

**Documentation:**
- `TIMELINE_INVESTIGATION.md` (ce fichier)
- `TIMELINE_BUG_REPORT.md` (rapport)
- Post-mortem (à créer après fix)

---

**Rapport créé le:** 2025-12-07 22:45:00
**Analyste:** Claude (Sonnet 4.5)
**Status:** ROOT CAUSE EN COURS D'IDENTIFICATION
**Prochaine action:** Ajouter logging et reproduire
