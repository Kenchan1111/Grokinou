#!/usr/bin/env bash
# Simple performance probe: measure CLI startup time for `--help`.
# This does not modify code and keeps output in logs/perf-startup-*.log.

set -euo pipefail

LOG_DIR="logs"
mkdir -p "$LOG_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
log="$LOG_DIR/perf-startup-$ts.log"

echo "== Measuring CLI startup (node dist/index.js --help) ==" | tee "$log"
echo "UTC timestamp: $ts" | tee -a "$log"

start_ns=$(date +%s%N)
if node dist/index.js --help >/tmp/perf-help.out 2>/tmp/perf-help.err; then
  end_ns=$(date +%s%N)
  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
  echo "Elapsed: ${elapsed_ms} ms" | tee -a "$log"
  echo "Output saved to /tmp/perf-help.out (stderr in /tmp/perf-help.err)" | tee -a "$log"
  echo "✅ Performance probe completed" | tee -a "$log"
else
  end_ns=$(date +%s%N)
  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
  echo "Elapsed (failed): ${elapsed_ms} ms" | tee -a "$log"
  echo "❌ Performance probe failed, see /tmp/perf-help.err" | tee -a "$log"
  exit 1
fi
