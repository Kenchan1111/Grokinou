# Environment Variables

This lists the key environment variables supported by Grokinou.

## Search + FTS
- `GROKINOU_FTS_REBUILD_LOCK_TIMEOUT_MS` (optional)
- `GROKINOU_FTS_BATCH_SIZE` (optional)

## Semantic Search
- `GROKINOU_SEMANTIC_ENABLED` (true|false, default: false)
- `GROKINOU_SEMANTIC_RERANK_MAX` (default: 200)
- `GROKINOU_SEMANTIC_WEIGHT` (default: 50)
- `GROKINOU_SEMANTIC_MIN_SIM` (default: 0)
- `GROKINOU_SEMANTIC_MAX_CHUNKS` (default: 2000)
- `GROKINOU_SEMANTIC_CHUNK_SIZE` (default: 1200 chars)
- `GROKINOU_SEMANTIC_CHUNK_OVERLAP` (default: 200 chars)
- `GROKINOU_EMBEDDING_PROVIDER` (e.g., openai|grok|mock)
- `GROKINOU_EMBEDDING_MODEL` (default: text-embedding-3-small)
- `GROKINOU_EMBEDDING_BASE_URL` (optional override)
- `GROKINOU_EMBEDDING_API_KEY` (optional override)

## WAL / Backup
- `GROKINOU_WAL_SNAPSHOT_INTERVAL_MS` (default: 3600000)
- `GROKINOU_WAL_COPY_INTERVAL_MS` (default: 30000)
- `GROKINOU_WAL_RETENTION_BYTES` (default: 2GB)
- `GROKINOU_WAL_RETENTION_COUNT` (default: 200)
- `GROKINOU_WAL_SHIP_CMD` (optional external hook)
- `GROKINOU_WAL_SHIP_CMD_CONV` (override for conversations)
- `GROKINOU_WAL_SHIP_CMD_TIMELINE` (override for timeline)
- `GROKINOU_JSONL_EXPORT_INTERVAL_MS` (default: 21600000)

## Timeline Logging
- `GROKINOU_TIMELINE_MAX_RESULT_SIZE` (default: 0 = unlimited)

## Model Parameters
- `GROKINOU_TEMPERATURE` (optional override; Grok defaults to server value if unset)

## Startup Verification
- `GROKINOU_STARTUP_VERIFY` (off|soft|strict)

## Testing / CI (used by integration tests)
- `GROKINOU_TEST_FORCE_SEARCH_MODE`
- `GROKINOU_TEST_ALLOW_INPUT_IN_SEARCH`
- `GROKINOU_TEST_AUTO_EXIT_SEARCH_MS`
- `GROKINOU_TEST_LOG_REVIEW_APPLY`
