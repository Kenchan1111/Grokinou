# Tests & Monitoring (Added without touching existing code)

This folder documents the regression/integration/performance guards that were added without modifying existing source files.

## Quick run

```bash
# Regression: detect the tool_calls omission bug in restoreFromHistory
node tests/regression/tool_calls_restore.test.js

# Integration: flag abnormal drop in tool usage (timeline.db)
node tests/integration/tool_usage_monitor.js

# Performance: measure CLI --help startup and log to logs/
tests/performance/measure_startup.sh

# Changelog: generate recent commit summary (stdout)
scripts/changelog/gen-auto-changelog.sh
```

## What they catch

- **tool_calls_restore.test.js** — Static guard on `src/agent/grok-agent.ts` to ensure `tool_calls` are preserved even when empty (catches the known regression).
- **placeholder_skip.test.js** — Verifies the placeholder `"Using tools to help you..."` is handled by an early return (not treated as a real answer needing summary).
- **db/schema.test.js** — Non-destructive schema sanity for sessions/conversations/timeline DBs (skips if missing).
- **db/consistency.test.js** — Orphans/timestamps/JSON validity checks (skips if DBs missing).
- **db/multi-db-consistency.test.js** — Cross-DB checks (sessions ↔ timeline, conversations ↔ timeline; sampled, skips if missing).
- **tool_usage_monitor.js** — Compares today vs yesterday `TOOL_CALL_STARTED` counts from `~/.grok/timeline.db` (fails if today < 50% of yesterday; threshold via `TOOL_USAGE_RATIO_MIN`).
- **measure_startup.sh** — Records startup latency for `node dist/index.js --help` to `logs/perf-startup-*.log`.
- **gen-auto-changelog.sh** — Produces a minimal changelog from git commit messages (no file edits by default).
- **source_hash_integrity.test.js** — Verifies SHA-256 of every `src/**/*.ts` against `tests/static/source-hashes.json` (fails on any source change).
  - Update baseline intentionally with `scripts/integrity/update-source-hashes.sh` after approved changes.

## Notes

- The regression test will currently fail until the `tool_calls` handling is fixed in `restoreFromHistory` (by design, to surface the issue).
- The integration monitor requires `~/.grok/timeline.db` and uses `better-sqlite3` (already in dependencies); threshold configurable via `TOOL_USAGE_RATIO_MIN`.
- The DB tests are non-destructive and skip gracefully if DB files/tables are missing.
- The source hash test will fail on any source modification; update `tests/static/source-hashes.json` intentionally when changes are expected.
- No existing repository files were modified; only new scripts/docs were added.
