# 🔍 Root Cause Analysis - Timeline Sequence Bug

**Date:** 2025-11-30  
**Issue:** `UNIQUE constraint failed: events.sequence_number`  
**Severity:** Critical  
**Status:** Root cause identified

---

## 🐛 **THE BUG: Schema Design Flaw**

### **Problematic Code in `schema.ts` (lines 108-112):**

```sql
INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES
    ('schema_version', '1.0.0', strftime('%s', 'now') * 1000000),
    ('created_at', strftime('%s', 'now') * 1000000, strftime('%s', 'now') * 1000000),
    ('last_sequence', '0', strftime('%s', 'now') * 1000000),          ⬅️ PROBLEM!
    ('last_snapshot_sequence', '0', strftime('%s', 'now') * 1000000);
```

---

## ❌ **THE CRITICAL FLAW**

### **`INSERT OR REPLACE` = Data Loss**

**What it does:**
- `INSERT OR REPLACE` is equivalent to:
  ```sql
  DELETE FROM metadata WHERE key = 'last_sequence';
  INSERT INTO metadata VALUES ('last_sequence', '0', ...);
  ```

**The problem:**
1. The schema is executed during `initializeSchema()` in `database.ts`
2. This happens **EVERY TIME** the database connection is created
3. If the schema runs again (rebuild, restart, etc.), it **RESETS** `last_sequence` to `'0'`
4. But the 85 existing events still have `sequence_number 1-85`
5. Next insert tries to use `sequence_number = 1` → **UNIQUE constraint failed**

---

## 🕐 **TIMELINE OF EVENTS**

### **What Happened:**

**Before the crash:**
1. ✅ Database had **85 events** (`sequence_number 1-85`)
2. ✅ `metadata.last_sequence` was correctly at `85`

**Trigger Event (2025-11-30 ~08:19:44):**
3. ❌ Schema was re-executed (possibly during app rebuild or restart)
4. ❌ `INSERT OR REPLACE` reset `last_sequence` to `'0'`
5. ❌ Database state became inconsistent:
   - Events table: 85 events (sequence 1-85)
   - Metadata: `last_sequence = 0`

**Crash (2025-11-30 ~08:20+):**
6. ❌ App started, FileHook logged event
7. ❌ `getNextSequence()` returned `1` (because metadata said `0`)
8. ❌ Tried to insert with `sequence_number = 1`
9. ❌ **UNIQUE constraint violation** → Crash loop

**Evidence from database:**
```sql
-- Metadata shows schema was re-initialized at 08:19:44
created_at: 1764490784000000  (2025-11-30 08:19:44 UTC)
schema_version: 1.0.0         (2025-11-30 08:19:44 UTC)

-- But 85 events existed from before this timestamp!
Total events: 85
First event: [before 08:19:44]
Last event: [before 08:19:44]
```

---

## 🔍 **WHY DID THE SCHEMA RUN AGAIN?**

### **Possible Triggers:**

#### **1. Code Rebuild** ⭐ MOST LIKELY
```typescript
// In database.ts constructor:
if (!config.readOnly) {
    this.initializeSchema();  // ⬅️ Runs schema EVERY TIME
}
```

**Scenario:**
- You ran `npm run build` (for Execution Viewer)
- Database connection was created
- `initializeSchema()` executed
- Schema ran with `INSERT OR REPLACE`
- → `last_sequence` reset to 0

#### **2. App Restart**
- Normal restart triggers `initializeSchema()`
- Schema is **NOT idempotent** (safe to run multiple times)
- → Data loss

#### **3. Database Corruption**
- SQLite WAL checkpoint
- System crash during write
- → Metadata table recreated

---

## 🛡️ **WHY THIS IS A DESIGN FLAW**

### **Schema Should Be Idempotent**

**Good pattern (PostgreSQL, MySQL):**
```sql
-- Only insert if NOT EXISTS
INSERT INTO metadata (key, value, updated_at)
SELECT 'last_sequence', '0', NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM metadata WHERE key = 'last_sequence'
);
```

**SQLite equivalent:**
```sql
-- Only insert if missing
INSERT OR IGNORE INTO metadata (key, value, updated_at) 
VALUES ('last_sequence', '0', strftime('%s', 'now') * 1000000);
```

**Current broken pattern:**
```sql
-- ALWAYS replaces, even if value exists!
INSERT OR REPLACE INTO metadata (key, value, updated_at) 
VALUES ('last_sequence', '0', ...);  ❌ DATA LOSS
```

---

## 📊 **IMPACT ANALYSIS**

### **Who Was Affected:**

**Every user who:**
1. ✅ Had existing events in timeline.db
2. ✅ Rebuilt the application (`npm run build`)
3. ✅ Restarted the application
4. ✅ Experienced any schema re-initialization

**Result:**
- ❌ Complete application crash
- ❌ Unable to log any new events
- ❌ FileHook enters infinite error loop
- ❌ Manual database repair required

---

## ✅ **THE FIX**

### **1. Immediate (Already Applied):**

**Database Repair:**
```sql
UPDATE metadata SET value = '85' WHERE key = 'last_sequence';
```

**Code Enhancement (Auto-Repair):**
```typescript
// In getNextSequence():
const currentSeq = parseInt(this.getMetadata('last_sequence') || '0', 10);
const maxSeq = this.db.prepare('SELECT COALESCE(MAX(sequence_number), 0) FROM events').get().max_seq;

if (currentSeq < maxSeq) {
    console.warn(`Auto-repairing sequence counter...`);
    nextSeq = maxSeq + 1;  // ✅ Prevents crash
}
```

### **2. Permanent Solution (Required):**

**Fix the Schema:**

```diff
- INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES
+ INSERT OR IGNORE INTO metadata (key, value, updated_at) VALUES
    ('schema_version', '1.0.0', strftime('%s', 'now') * 1000000),
    ('created_at', strftime('%s', 'now') * 1000000, strftime('%s', 'now') * 1000000),
    ('last_sequence', '0', strftime('%s', 'now') * 1000000),
    ('last_snapshot_sequence', '0', strftime('%s', 'now') * 1000000);
```

**What this does:**
- ✅ `INSERT OR IGNORE` = "Insert only if key doesn't exist"
- ✅ Preserves existing `last_sequence` value
- ✅ Schema becomes **idempotent** (safe to run multiple times)
- ✅ No more data loss on rebuild/restart

---

## 🎯 **LESSONS LEARNED**

### **1. Schema Idempotency is Critical** ⭐
- Migration scripts must be safe to run multiple times
- Use `IF NOT EXISTS`, `INSERT OR IGNORE`, or similar patterns
- Never use `INSERT OR REPLACE` for counters/state

### **2. Testing Edge Cases**
- Test schema re-initialization with existing data
- Test app restart with populated database
- Test rebuild scenarios

### **3. Defensive Programming**
- Our auto-repair logic saved us from permanent damage
- Always verify assumptions (counter vs. actual max)
- Use transactions for critical operations

### **4. Schema Versioning**
- Should have migration logic, not blind re-execution
- Check `schema_version` before applying changes
- Use proper database migration patterns

---

## 🚀 **RECOMMENDED ACTIONS**

### **Immediate (Priority 1):**
1. ✅ **Already done:** Auto-repair in `getNextSequence()`
2. ⏳ **TODO:** Fix schema to use `INSERT OR IGNORE`
3. ⏳ **TODO:** Test schema with existing data

### **Short-term (Priority 2):**
4. ⏳ Add schema migration system (e.g., schema version 1.0.0 → 1.0.1)
5. ⏳ Add database integrity check on startup
6. ⏳ Add automated tests for schema idempotency

### **Long-term (Priority 3):**
7. ⏳ Consider using database migration tools (e.g., `node-pg-migrate` equivalent)
8. ⏳ Add database backup/restore functionality
9. ⏳ Implement schema rollback capability

---

## 📋 **VERIFICATION CHECKLIST**

After applying the permanent fix:

- [ ] Schema uses `INSERT OR IGNORE` instead of `INSERT OR REPLACE`
- [ ] Test: Run schema twice, verify `last_sequence` not reset
- [ ] Test: Rebuild app with existing events, verify no crash
- [ ] Test: Restart app multiple times, verify no data loss
- [ ] Add integration test for schema idempotency
- [ ] Document schema migration procedures

---

## 🎉 **CONCLUSION**

### **Root Cause:** Schema design flaw using `INSERT OR REPLACE`

**Why it happened:**
- Schema executed on every app start/rebuild
- `INSERT OR REPLACE` always resets values
- No idempotency protection

**Why it's critical:**
- Silently corrupts database state
- Causes immediate crash on next insert
- Affects all users on rebuild/restart

**Solution:**
- ✅ Auto-repair protects against symptoms
- ⏳ Schema fix prevents root cause
- ⏳ Testing ensures no regression

**Status:** Partially fixed (auto-repair working), permanent fix pending

---

**Analysis Date:** 2025-11-30 09:45:00 UTC  
**Analyzed By:** Grokinou Development Team  
**Severity:** Critical (design flaw)  
**Fix Status:** Workaround deployed, permanent fix needed
