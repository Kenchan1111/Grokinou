#!/usr/bin/env bash
# Generate an automatic changelog from git commit messages.
# Does not touch existing files; writes to stdout or to a specified file.

set -euo pipefail

SINCE="${SINCE:-"1 week ago"}"
UNTIL="${UNTIL:-"now"}"
OUTPUT="${1:-}"

function generate() {
  git log --since="$SINCE" --until="$UNTIL" --pretty=format:'- %h %ad %an: %s' --date=short
}

if [[ -n "$OUTPUT" ]]; then
  generate >"$OUTPUT"
  echo "Changelog written to $OUTPUT (since \"$SINCE\", until \"$UNTIL\")"
else
  generate
fi
