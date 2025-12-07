#!/usr/bin/env bash
# Recompute SHA-256 hashes for all src/**/*.ts files and update tests/static/source-hashes.json.
# Use when source changes are intentional.

set -euo pipefail

cd "$(dirname "$0")/../.."

TMP="$(mktemp)"

find src -type f -name "*.ts" -print0 | sort -z | xargs -0 sha256sum \
  | awk '{print $2 " " $1}' \
  | sed 's|^./||' \
  | python3 - <<'PY'
import sys, json
data = {}
for line in sys.stdin:
    path, digest = line.strip().split()
    data[path] = digest
print(json.dumps(data, indent=2, sort_keys=True))
PY > "$TMP"

mv "$TMP" tests/static/source-hashes.json
echo "Updated tests/static/source-hashes.json"
