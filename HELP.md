# 📚 Grokinou CLI - Complete Help & Reference Guide

**Version:** 2.0.0 (with Execution Viewer & Timeline)  
**Last Updated:** 2025-11-30

---

## 🎯 Quick Start

```bash
# Start Grokinou
npm start

# Get help
/help

# Exit
exit  ou  quit  ou  /exit
```

---

## 📑 Table of Contents

1. [User Commands](#-user-commands) - Commands you type in the CLI
2. [LLM Tools](#-llm-tools) - Tools the AI can use
3. [Keyboard Shortcuts](#%EF%B8%8F-keyboard-shortcuts)
4. [Execution Viewer](#-execution-viewer)
5. [Timeline & Time Machine](#-timeline--time-machine)
6. [Session Management](#-session-management)
7. [Configuration](#%EF%B8%8F-configuration)

---

## 💬 User Commands

These are commands **you** type directly in the CLI (prefixed with `/`).

### 🔧 General Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show help information | `/help` |
| `/status` | Show current model, provider, and config | `/status` |
| `/clear` | Clear chat history (memory + disk) | `/clear` |
| `/clear-session` | Clear in-memory session only | `/clear-session` |
| `/clear-disk-session` | Delete persisted session and clear memory | `/clear-disk-session` |
| `/exit` | Exit the application | `/exit` |
| `exit` or `quit` | Exit without `/` prefix | `exit` |

---

### 🔍 Search Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/search <query>` | Search in conversation history | `/search bug fix` |
| `/search` | Interactive search mode | `/search` |

**Search Features:**
- Fuzzy matching
- Highlight results
- Navigation: `↑/↓` to navigate, `Enter` to select, `Esc` to exit
- Supports regex patterns

---

### 🗂️ Session Management

| Command | Description | Example |
|---------|-------------|---------|
| `/list_sessions` | List all sessions in current directory | `/list_sessions` |
| `/switch-session <id>` | Switch to a different session | `/switch-session 5` |
| `/rename_session <name>` | Rename the current session | `/rename_session my-project` |
| `/new-session <dir>` | Create new session | `/new-session ./my-project` |

**`/new-session` Options:**

```bash
# Create empty session
/new-session ./target-dir

# Clone current Git repository
/new-session ./target-dir --clone-git

# Copy current files (excluding .git, node_modules)
/new-session ./target-dir --copy-files

# Initialize from timeline rewind
/new-session ./target-dir --from-rewind 2025-11-28T15:00:00Z

# Import conversation history
/new-session ./target-dir --import-history
/new-session ./target-dir --import-history --from-session 5
/new-session ./target-dir --import-history --date-range-start 2025-11-01 --date-range-end 2025-11-30

# Set model for new session
/new-session ./target-dir --model gpt-4 --provider openai
```

**Date Formats Supported:**
- `DD/MM/YYYY` (e.g., `01/11/2025`)
- `YYYY-MM-DD` (e.g., `2025-11-01`)
- Relative: `today`, `yesterday`

---

### ⏰ Timeline & Time Machine

| Command | Description | Example |
|---------|-------------|---------|
| `/timeline <query>` | Query timeline events | `/timeline --type FILE_CREATED --since 2025-11-28` |
| `/rewind <timestamp>` | Rewind to specific time | `/rewind 2025-11-28T15:00:00Z --git-mode full` |
| `/snapshots` | List available snapshots | `/snapshots` |
| `/rewind-history` | Show history of rewind operations | `/rewind-history` |

#### **`/timeline` Options:**

```bash
# Query by event type
/timeline --type FILE_CREATED
/timeline --type FILE_MODIFIED
/timeline --type GIT_COMMIT
/timeline --type CONVERSATION_MESSAGE

# Query by time range
/timeline --since 2025-11-28
/timeline --since yesterday
/timeline --before 2025-11-30
/timeline --since 2025-11-01 --before 2025-11-30

# Query by file path
/timeline --path src/index.ts

# Query by actor
/timeline --actor user

# Limit results
/timeline --limit 50

# Combined queries
/timeline --type FILE_MODIFIED --path src/ --since today --limit 20
```

**Event Types:**
- `FILE_CREATED`, `FILE_MODIFIED`, `FILE_DELETED`, `FILE_RENAMED`
- `GIT_COMMIT`, `GIT_CHECKOUT`, `GIT_MERGE`
- `CONVERSATION_MESSAGE`, `CONVERSATION_START`, `CONVERSATION_END`
- `SESSION_CREATED`, `SESSION_SWITCHED`, `REWIND`, `SNAPSHOT_CREATED`

#### **`/rewind` Options:**

```bash
# Basic rewind
/rewind 2025-11-28T15:00:00Z

# Git modes
/rewind 2025-11-28T15:00:00Z --git-mode none      # No Git reconstruction
/rewind 2025-11-28T15:00:00Z --git-mode metadata  # Git index only
/rewind 2025-11-28T15:00:00Z --git-mode full      # Full Git history ✅ (default)

# Output directory
/rewind 2025-11-28T15:00:00Z --output ~/rewind-test

# Create session automatically
/rewind 2025-11-28T15:00:00Z --create-session

# Auto-checkout to rewinded directory
/rewind 2025-11-28T15:00:00Z --auto-checkout

# Compare with another directory
/rewind 2025-11-28T15:00:00Z --compare-with ./current-version
```

**Timestamp Formats:**
- ISO 8601: `2025-11-28T15:00:00Z`
- Unix timestamp: `1732809600`
- Relative: `1h ago`, `2d ago`, `1w ago`

---

### 🤖 Model & Provider Management

| Command | Description | Example |
|---------|-------------|---------|
| `/models` | Interactive model selection | `/models` |
| `/models <name>` | Switch to specific model | `/models gpt-4` |
| `/model-default <name>` | Set global default model | `/model-default gpt-4` |
| `/apikey <provider> <key>` | Set API key | `/apikey openai sk-...` |
| `/apikey show <provider>` | Show current API key | `/apikey show openai` |
| `/list_tools` | List all available LLM tools | `/list_tools` |

**Supported Providers:**
- `openai` - GPT-3.5, GPT-4, GPT-4-turbo
- `anthropic` - Claude 3 (Opus, Sonnet, Haiku)
- `xai` - Grok models
- `mistral` - Mistral models
- `deepseek` - DeepSeek models

---

### 🔗 Git Integration

| Command | Description | Example |
|---------|-------------|---------|
| `/commit-and-push` | AI-powered commit & push | `/commit-and-push` |

**Features:**
- Analyzes `git status` and `git diff`
- Generates contextual commit message
- Reviews recent commits for style
- Commits and pushes to remote

---

## 🛠️ LLM Tools

These tools are **automatically available to the AI** (you don't type these directly).

### 📁 File Operations

| Tool | Description | Parameters |
|------|-------------|------------|
| `view_file` | View file contents or list directory | `path`, `start_line`, `end_line` |
| `create_file` | Create a new file | `path`, `content` |
| `str_replace_editor` | Replace text in a file | `path`, `old_str`, `new_str`, `replace_all` |
| `apply_patch` | Apply unified diff patch | `patch`, `dry_run` |

**Examples:**

```typescript
// View file
view_file({ path: "src/index.ts" })
view_file({ path: "src/index.ts", start_line: 10, end_line: 50 })

// Create file
create_file({ 
  path: "src/utils/helper.ts", 
  content: "export const helper = () => { return 'Hello'; };" 
})

// Replace text
str_replace_editor({ 
  path: "src/index.ts", 
  old_str: "const foo = 'bar'", 
  new_str: "const foo = 'baz'" 
})

// Apply patch
apply_patch({ 
  patch: `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-const foo = 'bar'
+const foo = 'baz'`, 
  dry_run: false 
})
```

---

### 🔍 Search & Discovery

| Tool | Description | Parameters |
|------|-------------|------------|
| `search` | Unified search for text/files | `query`, `search_type`, `include_pattern`, `exclude_pattern`, `case_sensitive`, `whole_word`, `regex`, `max_results`, `file_types`, `include_hidden` |

**Examples:**

```typescript
// Search for text
search({ query: "TODO", search_type: "text" })

// Search for files
search({ query: "index", search_type: "files" })

// Advanced search
search({ 
  query: "function.*export", 
  search_type: "text",
  regex: true,
  file_types: ["ts", "js"],
  max_results: 100
})
```

---

### ⚙️ Execution & System

| Tool | Description | Parameters |
|------|-------------|------------|
| `bash` | Execute bash command | `command` |

**Examples:**

```typescript
// Run command
bash({ command: "ls -la" })
bash({ command: "git status" })
bash({ command: "npm test" })
```

**⚠️ Important:** 
- NEVER use `2>&1` in commands (stdout/stderr captured separately)
- Exit codes tracked automatically
- Stderr displayed in red in Execution Viewer

---

### 📋 Task Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_todo_list` | Create new todo list | `todos` (array) |
| `update_todo_list` | Update existing todos | `updates` (array) |

**Examples:**

```typescript
// Create todos
create_todo_list({ 
  todos: [
    { id: "1", content: "Implement feature X", status: "pending", priority: "high" },
    { id: "2", content: "Fix bug Y", status: "in_progress", priority: "medium" }
  ] 
})

// Update todos
update_todo_list({ 
  updates: [
    { id: "1", status: "completed" },
    { id: "2", content: "Fix critical bug Y", priority: "high" }
  ] 
})
```

---

### 🗂️ Session Management (LLM)

| Tool | Description | Parameters |
|------|-------------|------------|
| `session_list` | List all sessions | None |
| `session_switch` | Switch to different session | `session_id` |
| `session_new` | Create new session | `directory`, `init_mode`, `rewind_timestamp`, `rewind_git_mode`, `import_history`, `from_session_id`, `date_range_start`, `date_range_end`, `model`, `provider` |
| `session_rewind` | Rewind session (alias) | Same as `rewind_to` |

**Examples:**

```typescript
// List sessions
session_list({})

// Switch session
session_switch({ session_id: 5 })

// Create new session (empty)
session_new({ directory: "./my-project" })

// Create from Git clone
session_new({ directory: "./new-proj", init_mode: "clone-git" })

// Create from rewind
session_new({ 
  directory: "./rewinded-state", 
  init_mode: "from-rewind",
  rewind_timestamp: "2025-11-28T15:00:00Z",
  rewind_git_mode: "full"
})

// Create with history import
session_new({ 
  directory: "./new-session", 
  import_history: true,
  from_session_id: 5,
  date_range_start: "2025-11-01",
  date_range_end: "2025-11-30"
})
```

**init_mode options:**
- `empty` - Create empty directory (default)
- `clone-git` - Clone current Git repo (HEAD state)
- `copy-files` - Copy files (exclude .git, node_modules, hidden)
- `from-rewind` - Initialize from timeline rewind

⚠️ **Proactive Clarification:**  
When user intent is ambiguous between `session_new` and `rewind_to`, the LLM will ask:

```
I can help with this in two ways:
1. session_new: Create a new session directory (better for: ...)
2. rewind_to: Time-travel to exact state (better for: ...)

Which approach would you prefer?
```

---

### ⏰ Timeline Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `timeline_query` | Query timeline events | `event_type`, `since`, `before`, `path`, `actor`, `limit` |
| `rewind_to` | Rewind to specific timestamp | `timestamp`, `target_directory`, `gitMode`, `createSession`, `autoCheckout`, `compareWith` |
| `list_time_points` | List available time points | `limit` |

**Examples:**

```typescript
// Query timeline
timeline_query({ 
  event_type: "FILE_MODIFIED", 
  since: "2025-11-28T00:00:00Z",
  path: "src/",
  limit: 50
})

// Rewind
rewind_to({ 
  timestamp: "2025-11-28T15:00:00Z",
  target_directory: "~/rewind-test",
  gitMode: "full",
  createSession: true,
  autoCheckout: false,
  compareWith: "./current-version"
})

// List time points
list_time_points({ limit: 100 })
```

**gitMode options:**
- `none` - No Git reconstruction
- `metadata` - Git index only
- `full` - Full Git history (default)

---

### 🆔 Identity & Info

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_my_identity` | Get model identity & config | None |

**Example:**

```typescript
// Check identity
get_my_identity({})
```

Returns:
- Current model name
- Provider info
- Configuration details
- API endpoint

---

## ⌨️ Keyboard Shortcuts

### General

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Cancel current operation |
| `Ctrl+D` | Exit application |
| `↑/↓` | Navigate command history |
| `Tab` | Autocomplete commands |

### Search Mode

| Shortcut | Action |
|----------|--------|
| `↑/↓` | Navigate results |
| `Enter` | Select result |
| `Esc` | Exit search |
| `/` | Open search |

### Model Selection

| Shortcut | Action |
|----------|--------|
| `↑/↓` | Navigate models |
| `Tab` or `Enter` | Select model |
| `Esc` | Cancel |

### Execution Viewer

| Shortcut | Action |
|----------|--------|
| `Ctrl+E` | Toggle viewer (hide/split) |
| `Ctrl+F` | Toggle fullscreen |
| `Esc` | Hide viewer |
| `Ctrl+Shift+E` | Cycle modes (hidden → split → fullscreen) |
| `Tab` | Switch focus (chat ↔ viewer) |
| `Ctrl+C` | Copy execution output |
| `Ctrl+S` | Save execution to file |
| `Ctrl+D` | Toggle details mode |

---

## 🖥️ Execution Viewer

Real-time display of LLM execution with Chain of Thought (COT) and command outputs.

### Features

- **3 Modes:**
  - `hidden` - Viewer hidden (default on startup)
  - `split` - Horizontal split (chat left, viewer right)
  - `fullscreen` - Viewer takes full screen
  
- **COT Tracking:**
  - `thinking` - LLM's thought process
  - `action` - Tool being executed
  - `observation` - Result observation
  - `decision` - Next step decision
  
- **Command Output:**
  - Separate `stdout` (white) and `stderr` (red with ⚠️)
  - Exit code tracking
  - Timestamp for each command
  
- **Auto-show/hide:**
  - Configurable auto-show on execution start
  - Configurable auto-hide on completion (with delay)

### Configuration

Edit `.grok/settings.json`:

```json
{
  "executionViewer": {
    "enabled": true,
    "defaultMode": "hidden",
    "autoShow": true,
    "autoHide": false,
    "autoHideDelay": 3000,
    "splitRatio": 0.6,
    "layout": "horizontal",
    "showCOT": true,
    "showCommands": true,
    "detailsMode": false,
    "maxExecutionsShown": 10,
    "colorScheme": "default"
  }
}
```

---

## ⏰ Timeline & Time Machine

Event sourcing system for complete project history.

### Event Types

**File Events:**
- `FILE_CREATED`, `FILE_MODIFIED`, `FILE_DELETED`, `FILE_RENAMED`

**Git Events:**
- `GIT_COMMIT`, `GIT_CHECKOUT`, `GIT_MERGE`

**Conversation Events:**
- `CONVERSATION_MESSAGE`, `CONVERSATION_START`, `CONVERSATION_END`

**System Events:**
- `SESSION_CREATED`, `SESSION_SWITCHED`, `REWIND`, `SNAPSHOT_CREATED`

### Storage

- **Database:** `~/.grok/timeline.db` (SQLite)
- **Schema:** Append-only event log (immutable)
- **Size:** Efficient with compression & deduplication
- **Integrity:** SHA256 checksums for tamper detection

### Rewind Process

1. **Query** timeline for target timestamp
2. **Replay** events from beginning to target
3. **Reconstruct** file system state
4. **Rebuild** Git history (if enabled)
5. **Create** new directory with exact state

---

## 🗂️ Session Management

Git-like conversation sessions with directory isolation.

### Features

- **Multiple sessions** per directory
- **Automatic persistence** to SQLite
- **Conversation history** import/export
- **Model switching** per session
- **CWD management** (`process.chdir()` on switch)

### Workflow

```bash
# List sessions
/list_sessions

# Create new session
/new-session ./my-feature

# Switch to session
/switch-session 5

# Rename session
/rename_session feature-auth

# Import history
/new-session ./project --import-history --from-session 3
```

---

## ⚙️ Configuration

### Files

| File | Purpose | Location |
|------|---------|----------|
| `.grok/settings.json` | User settings | `~/.grok/` or project root |
| `.grok/conversations.db` | Session database | Project root |
| `.grok/timeline.db` | Event log | `~/.grok/` |
| `.grok/models.json` | Model configuration | `~/.grok/` |

### API Keys

```bash
# Set API key
/apikey openai sk-...
/apikey anthropic sk-ant-...
/apikey xai xai-...

# Show API key
/apikey show openai
```

### Models

Edit `.grok/models.json`:

```json
{
  "models": [
    { "model": "gpt-4" },
    { "model": "gpt-4-turbo" },
    { "model": "claude-3-opus-20240229" },
    { "model": "grok-beta" }
  ]
}
```

---

## 🚀 Advanced Usage

### Combining Commands

```bash
# Create session from rewind with history import
/new-session ./my-feature \
  --from-rewind 2025-11-28T15:00:00Z \
  --import-history \
  --from-session 5 \
  --model gpt-4

# Rewind with all options
/rewind 2025-11-28T15:00:00Z \
  --output ~/rewind-test \
  --git-mode full \
  --create-session \
  --auto-checkout \
  --compare-with ./current
```

### LLM Automation

The LLM can chain tools:

```typescript
// 1. Search for bugs
search({ query: "TODO|FIXME", search_type: "text", regex: true })

// 2. Create todo list
create_todo_list({ todos: [...bugs_found...] })

// 3. Fix files
str_replace_editor({ path: "src/bug.ts", old_str: "...", new_str: "..." })

// 4. Commit
bash({ command: "git add . && git commit -m 'fix: resolve todos'" })
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue:** `UNIQUE constraint failed: events.sequence_number`

**Solution:** Fixed in v2.0.0 with auto-repair logic. Rebuild app:

```bash
npm run build
npm start
```

**Issue:** Search not working

**Solution:** Use `/search` (interactive) or `/search <query>` (direct)

**Issue:** Model switch fails

**Solution:** Check API key:

```bash
/apikey show openai
/apikey openai sk-...
```

**Issue:** Execution Viewer not showing

**Solution:** Enable in settings:

```bash
# Edit .grok/settings.json
"executionViewer": { "enabled": true }
```

---

## 📖 Documentation

- **Full Docs:** `docs/` directory
- **Testing Guide:** `MANUAL_TESTING_GUIDE.md`
- **Features:**
  - `REWIND_FEATURES.md` - Time Machine guide
  - `NEW_SESSION_FEATURES.md` - Session management
  - `EXECUTION_VIEWER_COMPLETE.md` - Execution Viewer
  - `LLM_TOOLS_OPTIONS_REFERENCE.md` - LLM tools reference

---

## 🎉 Tips & Best Practices

### For Users

1. **Use `/status`** to verify current configuration
2. **Use `/list_sessions`** before switching
3. **Use `/timeline`** to understand project history
4. **Use `/rewind-history`** to see past time-travels
5. **Enable Execution Viewer** for debugging (Ctrl+E)

### For LLMs

1. **Use `get_my_identity`** if confused about your model
2. **Ask user** when ambiguous between `session_new` and `rewind_to`
3. **Never use `2>&1`** in bash commands (stderr captured separately)
4. **Use `timeline_query`** before `rewind_to` to find timestamps
5. **Use `session_list`** before `session_switch` to verify ID

---

## 📝 Version History

- **v2.0.0** (2025-11-30) - Execution Viewer, Schema fixes, Auto-repair
- **v1.5.0** (2025-11-29) - Timeline Time Machine, Session tools
- **v1.0.0** (2025-11-28) - Initial release

---

**Last Updated:** 2025-11-30  
**Maintained By:** Grokinou Development Team  
**License:** MIT  
**Repository:** https://github.com/Kenchan1111/Grokinou

---

For issues or feature requests, please open an issue on GitHub.

**Happy Coding with Grokinou! 🚀**
