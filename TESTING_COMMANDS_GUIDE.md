# 🧪 Testing Commands Guide - Complete Examples

**Purpose:** Comprehensive testing guide for all Grokinou user commands  
**Version:** 2.0.0  
**Last Updated:** 2025-11-30

---

## 📋 Table of Contents

1. [Setup](#-setup)
2. [General Commands](#-general-commands)
3. [Search Commands](#-search-commands)
4. [Session Management](#-session-management)
5. [Timeline & Time Machine](#-timeline--time-machine)
6. [Model & Provider](#-model--provider)
7. [Git Integration](#-git-integration)
8. [Edge Cases & Errors](#-edge-cases--errors)

---

## 🛠️ Setup

### Prerequisites

```bash
cd /home/zack/GROK_CLI/grok-cli
npm run build
npm start
```

### Test Environment

Create test directory:

```bash
mkdir -p ~/grok-test-env
cd ~/grok-test-env
git init
echo "# Test Project" > README.md
git add README.md
git commit -m "Initial commit"
```

---

## 1️⃣ General Commands

### `/help`

**Test:** Show help

```bash
/help
```

**Expected Output:**
- Help text displayed
- List of commands shown
- No errors

**Verification:**
- [ ] Help text is clear and complete
- [ ] All commands are listed
- [ ] Format is readable

---

### `/status`

**Test 1:** Show current status

```bash
/status
```

**Expected Output:**
```
Current Model: gpt-4
Provider: OpenAI
Endpoint: https://api.openai.com/v1
API Key: sk-...abc (configured ✓)
Session: /home/zack/grok-test-env
```

**Verification:**
- [ ] Model name displayed correctly
- [ ] Provider identified
- [ ] API key status shown
- [ ] Current directory shown

---

### `/clear`

**Test 1:** Clear chat history

```bash
# Send a few messages first
Hello, this is a test message
Another message
/clear
```

**Expected Output:**
```
✅ Chat history cleared
```

**Verification:**
- [ ] Chat history is empty
- [ ] Conversation database cleared
- [ ] No errors

**Test 2:** Clear when already empty

```bash
/clear
```

**Expected Output:**
```
✅ Chat history cleared
```

**Verification:**
- [ ] No errors (idempotent)

---

### `/clear-session`

**Test:** Clear in-memory session only

```bash
# Send messages
Test message 1
Test message 2
/clear-session
```

**Expected Output:**
```
✅ Session cleared (in-memory only)
```

**Verification:**
- [ ] In-memory conversation cleared
- [ ] Database unchanged
- [ ] No errors

---

### `/clear-disk-session`

**Test:** Delete persisted session

```bash
# Send messages
Test message
/clear-disk-session
```

**Expected Output:**
```
✅ Session cleared (memory + disk)
```

**Verification:**
- [ ] In-memory conversation cleared
- [ ] Database session deleted
- [ ] No errors

---

### `/exit`

**Test:** Exit application

```bash
/exit
```

**Expected Output:**
- Application exits cleanly

**Alternatives:**
```bash
exit
quit
```

**Verification:**
- [ ] App exits without errors
- [ ] No orphan processes
- [ ] Database connections closed

---

## 2️⃣ Search Commands

### `/search <query>`

**Test 1:** Basic text search

```bash
# Send messages with "test" keyword
This is a test message
Another test
/search test
```

**Expected Output:**
- Search results highlighted
- Both messages found
- Navigation controls shown

**Verification:**
- [ ] Results found correctly
- [ ] Highlighting works
- [ ] Navigation functional (↑/↓, Enter, Esc)

---

**Test 2:** Case-insensitive search

```bash
/search TEST
```

**Expected Output:**
- Same results as "test" (case-insensitive)

**Verification:**
- [ ] Case-insensitive by default

---

**Test 3:** No results

```bash
/search xyzabc123nonexistent
```

**Expected Output:**
```
No results found for: xyzabc123nonexistent
```

**Verification:**
- [ ] Clear "no results" message
- [ ] No crashes

---

**Test 4:** Interactive search mode

```bash
/search
```

**Expected Output:**
- Interactive search prompt appears
- Can type query
- Real-time filtering

**Verification:**
- [ ] Interactive mode opens
- [ ] Typing works
- [ ] Esc exits gracefully

---

## 3️⃣ Session Management

### `/list_sessions`

**Test 1:** List sessions (empty)

```bash
# In new directory
mkdir ~/test-empty-sessions && cd ~/test-empty-sessions
npm start
/list_sessions
```

**Expected Output:**
```
No sessions found in current directory
```

**Verification:**
- [ ] Clear empty message

---

**Test 2:** List sessions (with data)

```bash
# In existing project with sessions
cd ~/grok-test-env
/list_sessions
```

**Expected Output:**
```
📋 Sessions in /home/zack/grok-test-env

ID | Name | Model | Messages | Created | Last Modified
---|------|-------|----------|---------|---------------
1  | main | gpt-4 | 15       | 2025-11-28 10:00 | 2025-11-30 09:00
2  | feature-x | gpt-3.5-turbo | 8 | 2025-11-29 14:00 | 2025-11-29 16:00
```

**Verification:**
- [ ] All sessions listed
- [ ] IDs, names, models shown
- [ ] Message counts accurate
- [ ] Dates formatted correctly
- [ ] Table aligned

---

### `/switch-session <id>`

**Test 1:** Switch to existing session

```bash
/list_sessions
/switch-session 2
```

**Expected Output:**
```
✅ Switched to session: feature-x (ID: 2)
   Model: gpt-3.5-turbo
   Messages loaded: 8
   Last modified: 2025-11-29 16:00
```

**Verification:**
- [ ] Session switched
- [ ] Conversation history loaded
- [ ] CWD unchanged (stays in same directory)
- [ ] Model switched if different
- [ ] No duplicates in history

---

**Test 2:** Switch to non-existent session

```bash
/switch-session 9999
```

**Expected Output:**
```
❌ Session not found: 9999
```

**Verification:**
- [ ] Clear error message
- [ ] Current session unchanged

---

**Test 3:** Switch to current session (idempotent)

```bash
/switch-session 2
```

**Expected Output:**
```
ℹ️  Already in session 2
```

**Verification:**
- [ ] No errors
- [ ] Session unchanged

---

### `/rename_session <name>`

**Test 1:** Rename current session

```bash
/rename_session my-awesome-feature
```

**Expected Output:**
```
✅ Session renamed to: my-awesome-feature
```

**Verification:**
- [ ] Session renamed in database
- [ ] `/list_sessions` shows new name
- [ ] No errors

---

**Test 2:** Rename with special characters

```bash
/rename_session my-feature_v2.0
```

**Expected Output:**
```
✅ Session renamed to: my-feature_v2.0
```

**Verification:**
- [ ] Special characters handled
- [ ] No sanitization issues

---

**Test 3:** Empty name

```bash
/rename_session
```

**Expected Output:**
```
❌ Usage: /rename_session <new_name>
```

**Verification:**
- [ ] Clear usage message

---

### `/new-session <directory>`

**Test 1:** Create empty session

```bash
/new-session ~/test-new-session
```

**Expected Output:**
```
✅ Created new session in: /home/zack/test-new-session
   Session ID: 3
   Model: gpt-4 (inherited)
   Directory created: ✓
```

**Verification:**
- [ ] Directory created
- [ ] Session created in database
- [ ] CWD changed to new directory
- [ ] Empty conversation started

---

**Test 2:** Create with existing directory

```bash
mkdir ~/test-existing
/new-session ~/test-existing
```

**Expected Output:**
```
✅ Using existing directory: /home/zack/test-existing
   Session ID: 4
   Model: gpt-4
```

**Verification:**
- [ ] Existing directory used
- [ ] No errors

---

**Test 3:** Create with Git clone

```bash
/new-session ~/test-git-clone --clone-git
```

**Expected Output:**
```
✅ Cloning current repository...
   Source: /home/zack/grok-test-env
   Target: /home/zack/test-git-clone
   Git clone successful ✓
   Session ID: 5
```

**Verification:**
- [ ] Directory created
- [ ] Git repository cloned (HEAD state)
- [ ] `.git/` directory present
- [ ] All commits copied

---

**Test 4:** Create with file copy

```bash
/new-session ~/test-copy-files --copy-files
```

**Expected Output:**
```
✅ Copying files...
   Source: /home/zack/grok-test-env
   Target: /home/zack/test-copy-files
   Files copied: 15
   Excluded: .git, node_modules, .*, __pycache__
   Session ID: 6
```

**Verification:**
- [ ] Files copied
- [ ] `.git/` excluded
- [ ] `node_modules/` excluded
- [ ] Hidden files excluded

---

**Test 5:** Create from rewind

```bash
/new-session ~/test-rewind --from-rewind 2025-11-28T15:00:00Z
```

**Expected Output:**
```
✅ Rewinding to: 2025-11-28T15:00:00Z
   Target: /home/zack/test-rewind
   Events replayed: 127
   Files reconstructed: 23
   Git history: Full
   Session ID: 7
```

**Verification:**
- [ ] Directory created
- [ ] State reconstructed from timeline
- [ ] Git history rebuilt
- [ ] Files match snapshot

---

**Test 6:** Create with history import

```bash
/new-session ~/test-import --import-history --from-session 2 --date-range-start 2025-11-01 --date-range-end 2025-11-30
```

**Expected Output:**
```
✅ Importing conversation history...
   Source session: 2 (feature-x)
   Date range: 2025-11-01 to 2025-11-30
   Messages imported: 8
   Session ID: 8
```

**Verification:**
- [ ] Directory created
- [ ] Conversation history imported
- [ ] Only messages in date range included
- [ ] Messages in chronological order

---

**Test 7:** Create with model

```bash
/new-session ~/test-model --model gpt-3.5-turbo --provider openai
```

**Expected Output:**
```
✅ Session created with model: gpt-3.5-turbo
   Provider: OpenAI
   Session ID: 9
```

**Verification:**
- [ ] Session uses specified model
- [ ] Provider configured

---

**Test 8:** Date formats

```bash
# DD/MM/YYYY
/new-session ~/test-date1 --import-history --date-range-start 01/11/2025

# YYYY-MM-DD
/new-session ~/test-date2 --import-history --date-range-start 2025-11-01

# Relative
/new-session ~/test-date3 --import-history --date-range-start yesterday
/new-session ~/test-date4 --import-history --date-range-start today
```

**Verification:**
- [ ] All date formats accepted
- [ ] Correct date parsing

---

## 4️⃣ Timeline & Time Machine

### `/timeline <options>`

**Test 1:** Query all events

```bash
/timeline
```

**Expected Output:**
```
📅 Timeline Events (last 100)

Type           | Timestamp         | Actor | Details
---------------|-------------------|-------|--------
FILE_CREATED   | 2025-11-30 09:00  | user  | src/index.ts
GIT_COMMIT     | 2025-11-30 09:05  | user  | feat: add feature
CONVERSATION_  | 2025-11-30 09:10  | user  | Message sent
MESSAGE
...
```

**Verification:**
- [ ] Events displayed
- [ ] Table formatted
- [ ] Timestamps correct

---

**Test 2:** Query by event type

```bash
/timeline --type FILE_CREATED
/timeline --type FILE_MODIFIED
/timeline --type GIT_COMMIT
```

**Expected Output:**
- Only specified event type shown

**Verification:**
- [ ] Filtering works correctly
- [ ] No other event types shown

---

**Test 3:** Query by time range

```bash
/timeline --since 2025-11-28
/timeline --since yesterday
/timeline --before 2025-11-30
/timeline --since 2025-11-01 --before 2025-11-30
```

**Expected Output:**
- Events within specified time range

**Verification:**
- [ ] Time filtering works
- [ ] Relative dates work (yesterday, today)
- [ ] Combined filters work

---

**Test 4:** Query by path

```bash
/timeline --path src/index.ts
/timeline --path src/
```

**Expected Output:**
- Events related to specified path

**Verification:**
- [ ] Path filtering works
- [ ] Directory filtering includes subdirectories

---

**Test 5:** Query by actor

```bash
/timeline --actor user
/timeline --actor system
```

**Expected Output:**
- Events from specified actor

**Verification:**
- [ ] Actor filtering works

---

**Test 6:** Limit results

```bash
/timeline --limit 10
/timeline --limit 50
```

**Expected Output:**
- Limited number of results

**Verification:**
- [ ] Limit respected
- [ ] Most recent events shown

---

**Test 7:** Combined query

```bash
/timeline --type FILE_MODIFIED --path src/ --since today --limit 20
```

**Expected Output:**
- Events matching ALL criteria

**Verification:**
- [ ] All filters applied correctly
- [ ] AND logic (not OR)

---

### `/rewind <timestamp>`

**Test 1:** Basic rewind

```bash
/rewind 2025-11-28T15:00:00Z
```

**Expected Output:**
```
⏰ Rewinding to: 2025-11-28T15:00:00Z

📊 Analysis:
   Events to replay: 127
   Files affected: 23
   Git commits: 5

✅ Rewind completed!
   Output directory: ~/rewind/20251128T150000Z
   Files reconstructed: 23
   Git mode: full
   Duration: 2.5s
```

**Verification:**
- [ ] Directory created
- [ ] Files match state at timestamp
- [ ] Git history reconstructed
- [ ] No errors

---

**Test 2:** Rewind with output directory

```bash
/rewind 2025-11-28T15:00:00Z --output ~/my-rewind-test
```

**Expected Output:**
```
✅ Rewind completed!
   Output directory: /home/zack/my-rewind-test
```

**Verification:**
- [ ] Custom directory used
- [ ] Directory created if not exists

---

**Test 3:** Rewind with git modes

```bash
# No Git
/rewind 2025-11-28T15:00:00Z --git-mode none --output ~/rewind-nogit

# Metadata only
/rewind 2025-11-28T15:00:00Z --git-mode metadata --output ~/rewind-meta

# Full Git
/rewind 2025-11-28T15:00:00Z --git-mode full --output ~/rewind-full
```

**Expected Output:**
- `none`: No `.git/` directory
- `metadata`: `.git/` with index only
- `full`: `.git/` with complete history

**Verification:**
- [ ] Git mode respected
- [ ] Correct `.git/` structure

---

**Test 4:** Rewind with session creation

```bash
/rewind 2025-11-28T15:00:00Z --create-session
```

**Expected Output:**
```
✅ Rewind completed!
   Output directory: ~/rewind/20251128T150000Z
   Session created: ID 10
   Switched to new session ✓
```

**Verification:**
- [ ] Session created
- [ ] Switched to new session
- [ ] CWD changed

---

**Test 5:** Rewind with auto-checkout

```bash
/rewind 2025-11-28T15:00:00Z --auto-checkout
```

**Expected Output:**
```
✅ Rewind completed!
   Output directory: ~/rewind/20251128T150000Z
   CWD changed: ✓
```

**Verification:**
- [ ] CWD changed to rewind directory
- [ ] `process.cwd()` updated

---

**Test 6:** Rewind with comparison

```bash
/rewind 2025-11-28T15:00:00Z --compare-with ./current-version
```

**Expected Output:**
```
✅ Rewind completed!
   Output directory: ~/rewind/20251128T150000Z

📊 Comparison Report:
   Compared with: ./current-version
   Files added: 3
   Files removed: 1
   Files modified: 5
   Total differences: 9
```

**Verification:**
- [ ] Comparison performed
- [ ] Differences listed
- [ ] Report accurate

---

**Test 7:** Combined options

```bash
/rewind 2025-11-28T15:00:00Z \
  --output ~/full-test \
  --git-mode full \
  --create-session \
  --auto-checkout \
  --compare-with ~/current
```

**Expected Output:**
```
✅ Rewind completed!
   Output directory: /home/zack/full-test
   Git mode: full
   Session created: ID 11
   CWD changed: ✓
   Comparison: 9 differences found
```

**Verification:**
- [ ] All options applied correctly
- [ ] No conflicts between options

---

**Test 8:** Invalid timestamp

```bash
/rewind invalid-timestamp
```

**Expected Output:**
```
❌ Invalid timestamp format
   Supported formats:
   - ISO 8601: 2025-11-28T15:00:00Z
   - Unix: 1732809600
   - Relative: 1h ago, 2d ago
```

**Verification:**
- [ ] Clear error message
- [ ] Format guidance provided

---

### `/snapshots`

**Test 1:** List snapshots

```bash
/snapshots
```

**Expected Output:**
```
📸 Available Snapshots

Timestamp           | Events | Files | Size  | Type
--------------------|--------|-------|-------|------
2025-11-30 10:00:00 | 500    | 45    | 2.5MB | auto
2025-11-29 15:00:00 | 400    | 42    | 2.3MB | auto
2025-11-28 12:00:00 | 300    | 38    | 2.1MB | manual
```

**Verification:**
- [ ] Snapshots listed chronologically
- [ ] Details accurate
- [ ] Sizes formatted

---

**Test 2:** No snapshots

```bash
# In new database
/snapshots
```

**Expected Output:**
```
No snapshots available
```

**Verification:**
- [ ] Clear empty message

---

### `/rewind-history`

**Test 1:** Show rewind history

```bash
/rewind-history
```

**Expected Output:**
```
⏰ Rewind History

Timestamp           | Target Time         | Output Dir        | Git Mode | Status
--------------------|---------------------|-------------------|----------|-------
2025-11-30 10:00:00 | 2025-11-28 15:00:00 | ~/rewind/test1    | full     | ✅
2025-11-30 09:00:00 | 2025-11-27 12:00:00 | ~/rewind/test2    | metadata | ✅
```

**Verification:**
- [ ] All rewind operations listed
- [ ] Details accurate
- [ ] Status shown

---

**Test 2:** No rewind history

```bash
# Before any rewinds
/rewind-history
```

**Expected Output:**
```
No rewind operations found
```

**Verification:**
- [ ] Clear empty message

---

## 5️⃣ Model & Provider

### `/models`

**Test 1:** Interactive model selection

```bash
/models
```

**Expected Output:**
```
📋 Available Models (use ↑/↓, Tab/Enter to select)

> gpt-4
  gpt-4-turbo
  gpt-3.5-turbo
  claude-3-opus-20240229
  grok-beta
```

**Verification:**
- [ ] Interactive menu shown
- [ ] ↑/↓ navigation works
- [ ] Enter/Tab selects model
- [ ] Esc cancels

---

**Test 2:** Direct model switch

```bash
/models gpt-4-turbo
```

**Expected Output:**
```
✅ Switched to gpt-4-turbo
   Provider: OpenAI
   Endpoint: https://api.openai.com/v1
   API Key: Configured ✓
```

**Verification:**
- [ ] Model switched immediately
- [ ] No interactive menu
- [ ] Settings saved

---

**Test 3:** Unknown model

```bash
/models unknown-model-xyz
```

**Expected Output:**
```
❌ Model not found: unknown-model-xyz
   Available models: gpt-4, gpt-4-turbo, ...
```

**Verification:**
- [ ] Clear error message
- [ ] List of available models shown

---

### `/model-default <name>`

**Test 1:** Set default model

```bash
/model-default gpt-4
```

**Expected Output:**
```
✅ Default model set to: gpt-4
   Saved to: ~/.grok/settings.json
   Will be used for new sessions
```

**Verification:**
- [ ] Default saved in settings
- [ ] New sessions use this model

---

**Test 2:** Invalid model

```bash
/model-default invalid-model
```

**Expected Output:**
```
❌ Model not found: invalid-model
```

**Verification:**
- [ ] Clear error message
- [ ] Default unchanged

---

### `/apikey <provider> <key>`

**Test 1:** Set API key

```bash
/apikey openai sk-test123abc
```

**Expected Output:**
```
✅ API key set for: openai
   Key: sk-...abc (last 3 chars shown)
   Saved to: ~/.grok/settings.json
```

**Verification:**
- [ ] API key saved
- [ ] Key partially masked in output
- [ ] Settings persisted

---

**Test 2:** Show API key

```bash
/apikey show openai
```

**Expected Output:**
```
🔑 API key for openai:
   Key: sk-test123abc
   ⚠️  Keep this secure!
```

**Verification:**
- [ ] Full key displayed
- [ ] Security warning shown

---

**Test 3:** Missing provider

```bash
/apikey
```

**Expected Output:**
```
❌ Usage: /apikey <provider> <key>
   Supported providers: openai, anthropic, xai, mistral, deepseek
   
   Or: /apikey show <provider>
```

**Verification:**
- [ ] Clear usage message
- [ ] Provider list shown

---

### `/list_tools`

**Test:** List all LLM tools

```bash
/list_tools
```

**Expected Output:**
```
🛠️  Available LLM Tools

File Operations:
- view_file: View file contents or list directory
- create_file: Create a new file
- str_replace_editor: Replace text in a file
- apply_patch: Apply unified diff patch

Execution:
- bash: Execute bash command

Search:
- search: Unified search for text/files

Task Management:
- create_todo_list: Create new todo list
- update_todo_list: Update existing todos

Session Management:
- session_list: List all sessions
- session_switch: Switch to different session
- session_new: Create new session
- session_rewind: Rewind session

Timeline:
- timeline_query: Query timeline events
- rewind_to: Rewind to specific timestamp
- list_time_points: List available time points

Identity:
- get_my_identity: Get model identity

MCP Tools:
(dynamically loaded)
```

**Verification:**
- [ ] All tools listed
- [ ] Grouped by category
- [ ] Descriptions shown

---

## 6️⃣ Git Integration

### `/commit-and-push`

**Test 1:** Commit and push changes

```bash
# Make changes
echo "new content" > test.txt
git add test.txt

/commit-and-push
```

**Expected Output:**
```
🔍 Analyzing changes...
   Files staged: 1
   Lines added: 1
   Lines removed: 0

📝 Generated commit message:
   "feat: add test content file"

🤖 Creating commit...
   ✅ Commit created: abc123f

📤 Pushing to remote...
   ✅ Pushed to origin/main

✅ Commit and push successful!
```

**Verification:**
- [ ] Git status analyzed
- [ ] Commit message generated
- [ ] Commit created
- [ ] Pushed to remote

---

**Test 2:** No changes to commit

```bash
/commit-and-push
```

**Expected Output:**
```
ℹ️  No changes to commit
   Working directory clean
```

**Verification:**
- [ ] Clear message
- [ ] No errors

---

**Test 3:** No remote configured

```bash
# In repo without remote
/commit-and-push
```

**Expected Output:**
```
⚠️  No remote repository configured
   Commit created: abc123f
   Push skipped (no remote)
```

**Verification:**
- [ ] Commit still created
- [ ] Push skipped gracefully

---

## 7️⃣ Edge Cases & Errors

### Empty Input

**Test:**

```bash
(press Enter without typing)
```

**Expected Output:**
- No action (silent)

**Verification:**
- [ ] No errors
- [ ] No empty messages added

---

### Invalid Command

**Test:**

```bash
/unknowncommand
```

**Expected Output:**
```
❌ Unknown command: /unknowncommand
   Type /help for available commands
```

**Verification:**
- [ ] Clear error message
- [ ] Help suggestion

---

### Command with Wrong Arguments

**Test:**

```bash
/switch-session
```

**Expected Output:**
```
❌ Usage: /switch-session <session_id>
```

**Verification:**
- [ ] Clear usage message

---

### Database Corruption

**Test:**

```bash
# Corrupt timeline.db
rm ~/.grok/timeline.db

# Restart app
/timeline
```

**Expected Output:**
```
⚠️  Timeline database not found
   Creating new database...
   ✅ Database initialized
```

**Verification:**
- [ ] Auto-recovery works
- [ ] New database created
- [ ] No crash

---

### Very Long Input

**Test:**

```bash
(type a very long message, 10,000+ characters)
```

**Expected Output:**
- Message handled
- No truncation errors

**Verification:**
- [ ] Long input accepted
- [ ] No buffer overflow
- [ ] API limits respected

---

## 🎯 Summary

**Total Tests:** 87 test cases

**Categories:**
- General: 7 tests
- Search: 4 tests
- Session Management: 14 tests
- Timeline: 18 tests
- Model & Provider: 11 tests
- Git Integration: 3 tests
- Edge Cases: 6 tests

**Next Steps:**
1. Run all tests systematically
2. Document any failures in `TESTING_CHECKLIST.md`
3. Report bugs found
4. Validate fixes

---

**Created:** 2025-11-30  
**For:** Grokinou CLI v2.0.0  
**By:** Testing Team
