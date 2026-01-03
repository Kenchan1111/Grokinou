#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
USER_SETTINGS="$HOME/.grok/user-settings.json"
PROJECT_SETTINGS="$ROOT_DIR/.grok/settings.json"
BACKUP_DIR="$ROOT_DIR/.grok/diagnostics"
SESSION_FILE="$ROOT_DIR/.grok/session.jsonl"
mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"

backup_file() {
  local src="$1"
  if [ -f "$src" ]; then
    cp "$src" "$BACKUP_DIR/$(basename "$src").$stamp.bak"
    echo "Backed up $src -> $BACKUP_DIR/$(basename "$src").$stamp.bak"
  fi
}

backup_file "$USER_SETTINGS"
backup_file "$PROJECT_SETTINGS"
backup_file "$SESSION_FILE"

echo ""
echo "UI duplication diagnostics"
echo "-------------------------"
echo "This script will guide you through 4 runs."
echo "Press Ctrl+C anytime to stop."
echo ""

echo "Step 1/4: Viewer disabled (project settings)"
mkdir -p "$ROOT_DIR/.grok"
if [ -f "$PROJECT_SETTINGS" ]; then
  node -e "const fs=require('fs');const p='$PROJECT_SETTINGS';const s=JSON.parse(fs.readFileSync(p,'utf8'));s.executionViewer=s.executionViewer||{};s.executionViewer.enabled=false;fs.writeFileSync(p,JSON.stringify(s,null,2));"
else
  echo '{"executionViewer":{"enabled":false}}' > "$PROJECT_SETTINGS"
fi

echo "Launch the app now and observe:"
echo "  1) Does duplication appear on startup?"
echo "  2) Does it disappear after any refresh/scroll?"
echo ""
echo "Command: npm run start"
read -r -p "Press Enter after you finish step 1..."


echo "Step 2/4: Viewer enabled (project settings)"
node -e "const fs=require('fs');const p='$PROJECT_SETTINGS';const s=JSON.parse(fs.readFileSync(p,'utf8'));s.executionViewer=s.executionViewer||{};s.executionViewer.enabled=true;fs.writeFileSync(p,JSON.stringify(s,null,2));"

echo "Launch the app now and observe:"
echo "  1) Does duplication appear only when viewer is enabled?"
echo ""
echo "Command: npm run start"
read -r -p "Press Enter after you finish step 2..."


echo "Step 3/4: Force search mode on launch (env)"
echo "Launch the app with search mode forced and observe:"
echo "  1) Does duplication appear only in search mode?"
echo ""
echo "Command: GROKINOU_TEST_FORCE_SEARCH_MODE=1 npm run start"
read -r -p "Press Enter after you finish step 3..."


echo "Step 4/4: Session history vs empty session"
if [ -f "$SESSION_FILE" ]; then
  mv "$SESSION_FILE" "$BACKUP_DIR/session.jsonl.$stamp.disabled"
  echo "Temporarily moved session file to $BACKUP_DIR/session.jsonl.$stamp.disabled"
fi

echo "Launch with empty session and observe:"
echo "Command: npm run start"
read -r -p "Press Enter after you finish empty-session run..."

if [ -f "$BACKUP_DIR/session.jsonl.$stamp.disabled" ]; then
  mv "$BACKUP_DIR/session.jsonl.$stamp.disabled" "$SESSION_FILE"
  echo "Restored session file to $SESSION_FILE"
fi

echo "Launch with restored session history and observe:"
echo "Command: npm run start"
read -r -p "Press Enter after you finish history-session run..."

echo ""
echo "Diagnostics complete."
echo "If needed, restore backups from $BACKUP_DIR."
