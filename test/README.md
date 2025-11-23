# 🧪 Grokinou Test Suite

This directory contains test scripts to validate Grokinou's features.

## 📁 Test Files

### 1. `test-list-sessions.js`
**Purpose:** Test the `listSessions()` API method directly via Node.js  
**Feature:** Phase 1.2 - List sessions with enriched metadata  
**Usage:**
```bash
node test/test-list-sessions.js
```

**What it tests:**
- ✅ `SessionManagerSQLite.listSessions()` method
- ✅ Filtering by status (active, completed, archived)
- ✅ Sorting by message_count DESC
- ✅ Filtering by minimum message count (100+)
- ✅ Computed fields (age_days, last_activity_relative)

**Expected output:**
```
📚 Sessions in Current Directory
Found 1 session(s):

Session #1:
  ID: 1
  Name: (unnamed)
  Provider: mistral
  Model: codestral-latest
  Messages: 467
  Status: active
  Created: 3 days ago
  Last activity: 5h ago
  Favorite: ☆
  First message: "Bonjour grok ..."
```

---

### 2. `test-list-sessions-ui.sh`
**Purpose:** Test the `/list_sessions` command in the interactive UI  
**Feature:** Phase 2.1 - In-session command to list sessions  
**Usage:**
```bash
./test/test-list-sessions-ui.sh
```

**What it tests:**
- ✅ `/list_sessions` command handler
- ✅ Rich formatted display in UI
- ✅ Status indicators (🟢 Active, ⚪ Completed, 📦 Archived)
- ✅ Favorite markers (⭐)
- ✅ Legend display

**Note:** This is a bash script that pipes the command to `grok`. Press Ctrl+C to exit after viewing results.

---

### 3. `test-auto-stats.sh`
**Purpose:** Test real-time statistics updates and auto-naming  
**Feature:** Phase 2.2 - Auto-stats update & Auto-naming from first message  
**Usage:**
```bash
./test/test-auto-stats.sh
```

**What it tests:**
- ✅ `message_count` updates after each message
- ✅ `total_tokens` calculation (sum of all token_count)
- ✅ `first_message_preview` from first user message
- ✅ `last_message_preview` from last user/assistant message
- ✅ `session_name` auto-generated from first user message

**Manual test procedure:**
1. Run `grok` in a **new directory**
2. Send first message: `"Hello, this is my first test message"`
3. Send a few more messages
4. Run `/list_sessions` to verify:
   - ✅ Session name: "Hello this is my first test message"
   - ✅ Message count reflects actual count
   - ✅ First message preview is correct
   - ✅ Last message preview is current

**Direct DB verification:**
```bash
sqlite3 ~/.grok/conversations.db "
SELECT 
  id, 
  session_name, 
  message_count, 
  total_tokens,
  first_message_preview 
FROM sessions 
ORDER BY last_activity DESC 
LIMIT 5;
"
```

---

## 🚀 Quick Test All

Run all tests in sequence:

```bash
# Test 1: Direct API
node test/test-list-sessions.js

# Test 2: UI Command (manual - requires grok to be running)
# Start grok, type /list_sessions

# Test 3: Auto-stats DB check
./test/test-auto-stats.sh
```

---

## 📊 What Each Phase Tests

| Phase | Feature | Test File |
|-------|---------|-----------|
| 1.1 | DB Migration (add search fields) | Manual DB check |
| 1.2 | `listSessions()` API method | `test-list-sessions.js` |
| 2.1 | `/list_sessions` UI command | `test-list-sessions-ui.sh` |
| 2.2 | Auto-stats + Auto-naming | `test-auto-stats.sh` |

---

## 🐛 Troubleshooting

### Error: "sessionManager.listSessions is not a function"
**Solution:** Rebuild the project
```bash
npm run build
npm link
```

### Error: "No sessions found"
**Solution:** Create a session first
```bash
grok
# Type a message
# Exit (Ctrl+C twice)
# Run test again
```

### Database locked error
**Solution:** Close all `grok` instances
```bash
pkill -f grok
```

---

## 📝 Adding New Tests

When adding a new feature, create a test file:

1. **API tests** → `test-feature-name.js` (Node.js script)
2. **UI tests** → `test-feature-name.sh` (Bash script)
3. Update this README with usage instructions

**Example:**
```bash
# Create test
cat > test/test-new-feature.js << 'EOF'
#!/usr/bin/env node
import { sessionManager } from '../dist/utils/session-manager-sqlite.js';
// ... test code ...
EOF

chmod +x test/test-new-feature.js
node test/test-new-feature.js
```

---

## ✅ Test Coverage

Current test coverage:
- ✅ Session listing (API + UI)
- ✅ Session statistics (real-time updates)
- ✅ Session naming (auto-generation)
- ✅ Database queries (filtering, sorting)
- ✅ Relative time formatting
- ⏸️ Session creation
- ⏸️ Session switching
- ⏸️ Multi-provider management
- ⏸️ Cross-directory search

---

## 📚 Related Documentation

- [Session Management](../README.md#session-management)
- [Database Schema](../src/db/migrations/)
- [API Reference](../src/utils/session-manager-sqlite.ts)
