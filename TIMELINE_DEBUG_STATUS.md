# Timeline LLM Event Bug - Debug Status

## Date: 2025-12-07 21:45

---

## 🎯 PROBLEM SUMMARY

**Bug:** timeline.db has ZERO LLM_MESSAGE_USER/LLM_MESSAGE_ASSISTANT events despite 85,493+ other events

**Impact:** Complete loss of LLM conversation audit trail in timeline.db

**Discovered by:** `tests/integration/db/multi-db-consistency.test.js`

---

## 📊 EVIDENCE

### Database Event Counts

```sql
-- timeline.db event distribution
FILE_MODIFIED          81,986  ✅ Working
TOOL_CALL_STARTED       1,339  ✅ Working
TOOL_CALL_SUCCESS       1,236  ✅ Working
FILE_CREATED              787  ✅ Working
SESSION_SWITCHED           11  ✅ Working
LLM_MESSAGE_USER            1  ⚠️ Only from test script!
LLM_MESSAGE_ASSISTANT       0  ❌ BROKEN
```

### Session #20 Analysis (Last Real Session)

- **conversations.db:** Has messages (confirmed by multi-db-consistency test)
- **timeline.db:** 32 events (SESSION_SWITCHED, TOOL_CALL_*) but **0 LLM_MESSAGE_* events**

**Conclusion:** LLMHook has NEVER worked in production

---

## 🔍 ROOT CAUSE INVESTIGATION

### Test Results

#### Test 1: Direct EventBus Test ✅ SUCCESS

**Script:** `tests/debug/test-eventbus-llm.js`

**Result:**
```
✅ Event emitted successfully!
✅ Event ID: 38d48c02-520b-4d3c-ad3e-8b0222bdebc1
✅ Sequence: 85494
✅ Event found in timeline.db
```

**Finding:** EventBus CAN log LLM events when called directly

---

#### Test 2: Debug Log Analysis ⚠️ NO ERRORS

**Searched for:** "Timeline logging failed", "LLMHook", "captureUserMessage", "captureAssistantMessage"

**Result:** NO errors found in `~/.grok/debug.log`

**Finding:** The try-catch blocks in grok-agent.ts are NOT catching exceptions

---

### Integration Points Verified

#### grok-agent.ts:645-663 (User Message Capture)

```typescript
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
  debugLog.log('⚠️  Timeline logging failed for user message:', error);
}
```

**Status:** Code looks correct, but no errors logged

---

#### grok-agent.ts:805-823 (Assistant Message Capture)

```typescript
try {
  const session = sessionManager.getCurrentSession();
  if (session) {
    await this.llmHook.captureAssistantMessage(
      assistantMessage.content || "",
      session.id,
      this.grokClient.getCurrentModel(),
      providerManager.detectProvider(this.grokClient.getCurrentModel())
    );
  }
} catch (error) {
  debugLog.log('⚠️  Timeline logging failed for assistant message:', error);
}
```

**Status:** Code looks correct, but no errors logged

---

## 🛠️ DEBUGGING STEPS TAKEN

### Step 1: Add EventBus Error Logging ✅

**File:** `src/timeline/event-bus.ts:98-100`

**Change:**
```typescript
// BEFORE (silent fail)
if (!logResult.success) {
  // Silent fail - don't pollute console with timeline errors
  return logResult;
}

// AFTER (with logging)
if (!logResult.success) {
  // Log timeline errors for debugging
  console.error('[EventBus] Timeline logging FAILED:', input.event_type, logResult.error);
  return logResult;
}
```

**Result:** Enabled, but didn't trigger (EventBus works when called directly)

---

### Step 2: Add Detailed LLMHook Tracing ✅

**File:** `src/agent/grok-agent.ts`

**Added Logging:**

1. **Before LLMHook calls:**
   - Log session ID (or NULL)
   - Log message/content length

2. **After successful LLMHook calls:**
   - Confirm capture succeeded

3. **When session is null:**
   - Explicit warning: "SKIPPED: No current session"

**Logging Format:**
```
📊 [LLM Timeline] User message capture - Session: X, Message length: Y
✅ [LLM Timeline] User message captured successfully - Session: X
⚠️  [LLM Timeline] SKIPPED: No current session
```

---

## 🎯 HYPOTHESES

### Hypothesis #1: Session is NULL ⭐⭐⭐⭐⭐

**Likelihood:** VERY HIGH

**Evidence:**
- No errors in debug.log (suggests code path with `if (session)` is not entered)
- sessions.db is empty (0 bytes)
- No SESSION_CREATED events in recent sessions

**Test:** Run actual CLI and check debug.log for:
```
⚠️  [LLM Timeline] SKIPPED: No current session
```

---

### Hypothesis #2: LLMHook.isEnabled() = false ⭐⭐

**Likelihood:** MEDIUM

**Evidence:**
- LLMHook has `enabled` config flag (default: true)
- No evidence of it being disabled

**Test:** Add logging to LLMHook.captureUserMessage to log when `!this.config.enabled`

---

### Hypothesis #3: EventBus Payload Issue ⭐

**Likelihood:** LOW

**Evidence:**
- Direct EventBus test worked with identical payload structure
- Other hooks (FileSystemHook, ToolExecutionHook) use similar payloads successfully

**Test:** Already tested with direct script (worked)

---

## 📝 NEXT STEPS

### Immediate Actions

1. **Run Grok CLI with New Logging**
   ```bash
   npm start
   # Send any message
   # Exit
   # Check debug.log
   ```

2. **Analyze Debug Log**
   ```bash
   tail -100 ~/.grok/debug.log | grep "LLM Timeline"
   ```

3. **Expected Outcomes:**
   - **If "SKIPPED: No current session"** → Session management bug
   - **If "User message captured successfully"** → EventBus/TimelineLogger bug
   - **If no logs at all** → Code path never reached (build issue?)

---

### Based on Results

#### Scenario A: Session is NULL

**Fix:**
1. Investigate sessionManager.getCurrentSession()
2. Check why sessions.db is empty (0 bytes)
3. Fix session creation/persistence
4. Re-test LLM event capture

---

#### Scenario B: LLMHook Disabled

**Fix:**
1. Check LLMHook initialization in grok-agent.ts
2. Verify config passed to LLMHook.getInstance()
3. Add logging to LLMHook constructor
4. Re-test

---

#### Scenario C: EventBus/TimelineLogger Bug

**Fix:**
1. Compare payload structure between test script and actual app
2. Check TimelineLogger.log() implementation
3. Add logging inside TimelineLogger.log()
4. Identify specific failure point

---

## 🧪 TEST SCRIPTS CREATED

### tests/debug/test-eventbus-llm.js ✅

**Purpose:** Test EventBus LLM event logging in isolation

**Result:** ✅ SUCCESS - EventBus works correctly

**Conclusion:** Bug is in integration, not EventBus itself

---

## 📈 PROGRESS

### Completed ✅

1. Identified bug via comprehensive DB tests
2. Confirmed EventBus works in isolation
3. Added error logging to EventBus
4. Added detailed tracing to grok-agent.ts LLMHook calls
5. Built and ready for testing

### Pending ⏳

1. Run actual Grok CLI session
2. Analyze debug.log output
3. Identify specific failure point
4. Implement fix
5. Verify fix with tests
6. Update baseline and commit

---

## 🎓 LESSONS LEARNED

1. **Silent failures are dangerous** - EventBus was silently failing for months
2. **Comprehensive tests reveal hidden bugs** - DB consistency test found this immediately
3. **Test hooks in isolation** - Direct EventBus test proved EventBus itself works
4. **Layered debugging** - Add logging at multiple levels to narrow down root cause
5. **Session management is critical** - Null session breaks event sourcing

---

## 📋 FILES MODIFIED

### src/timeline/event-bus.ts
- **Line 98-100:** Added error logging for failed timeline logging

### src/agent/grok-agent.ts
- **Lines 645-663:** Added detailed logging for user message capture
- **Lines 805-823:** Added detailed logging for assistant message capture

### tests/debug/test-eventbus-llm.js (NEW)
- Standalone test script for EventBus LLM event logging

---

**Status:** Waiting for manual test with actual Grok CLI session

**Next Action:** User should run `npm start`, send a message, exit, and check debug.log

---

## 🔗 RELATED DOCUMENTS

- `TIMELINE_BUG_REPORT.md` - Initial bug report
- `TIMELINE_INVESTIGATION.md` - Detailed investigation
- `TEST_SESSION_SUMMARY.md` - Overall test session summary
- `NEW_TESTS_REVIEW.md` - Review of DB tests that discovered bug
