#!/usr/bin/env bash
# Recompute SHA-256 hashes for all src/**/*.ts files and update tests/static/source-hashes.json.
# Use when source changes are intentional.

set -euo pipefail

cd "$(dirname "$0")/../.."

TMP="$(mktemp)"
TMP_LIST="$(mktemp)"
TMP_HASHES="$(mktemp)"
TMP_PAIRS="$(mktemp)"

# 1) Collect file list (stable order)
find src -type f -name "*.ts" -print0 | sort -z > "$TMP_LIST"

# 2) Compute hashes
xargs -0 sha256sum < "$TMP_LIST" > "$TMP_HASHES"

# 3) Normalize to "path<TAB>hash" (strip leading ./)
awk -v OFS="\t" '{print $2, $1}' "$TMP_HASHES" | sed 's|^./||' > "$TMP_PAIRS"

# 4) Build JSON
python3 - <<'PY' "$TMP_PAIRS" > "$TMP"
import sys, json
data = {}
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    for line in fh:
        path, digest = line.rstrip("\n").split("\t", 1)
        data[path] = digest
print(json.dumps(data, indent=2, sort_keys=True))
PY

mv "$TMP" tests/static/source-hashes.json
rm -f "$TMP_LIST" "$TMP_HASHES" "$TMP_PAIRS"
echo "Updated tests/static/source-hashes.json"
