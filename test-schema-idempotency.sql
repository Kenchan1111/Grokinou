-- Test Schema Idempotency
-- This script verifies that re-running the schema doesn't reset last_sequence

-- 1. Check current last_sequence
SELECT '=== BEFORE ===' as stage;
SELECT key, value FROM metadata WHERE key = 'last_sequence';

-- 2. Re-run the metadata initialization (simulating schema re-execution)
INSERT OR IGNORE INTO metadata (key, value, updated_at) VALUES
    ('schema_version', '1.0.0', strftime('%s', 'now') * 1000000),
    ('created_at', strftime('%s', 'now') * 1000000, strftime('%s', 'now') * 1000000),
    ('last_sequence', '0', strftime('%s', 'now') * 1000000),
    ('last_snapshot_sequence', '0', strftime('%s', 'now') * 1000000);

UPDATE metadata 
SET value = '1.0.0', updated_at = strftime('%s', 'now') * 1000000
WHERE key = 'schema_version';

-- 3. Verify last_sequence was NOT reset
SELECT '=== AFTER ===' as stage;
SELECT key, value FROM metadata WHERE key = 'last_sequence';

-- 4. Expected result: last_sequence should be unchanged (404, not 0)
SELECT 
    CASE 
        WHEN value = '404' THEN '✅ PASS: last_sequence preserved'
        WHEN value = '0' THEN '❌ FAIL: last_sequence was reset'
        ELSE '⚠️  UNKNOWN: unexpected value'
    END as test_result
FROM metadata 
WHERE key = 'last_sequence';
