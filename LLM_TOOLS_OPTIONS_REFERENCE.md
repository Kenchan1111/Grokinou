# 🔧 LLM Tools - Complete Options Reference

**Version:** 1.0.0  
**Date:** 2025-11-13

---

## 📚 **Table of Contents**

1. [session_new - Simple Session Creation](#session_new)
2. [rewind_to - Time Machine (Event Sourcing)](#rewind_to)
3. [Quick Comparison](#comparison)
4. [Decision Tree](#decision-tree)

---

## 📁 **session_new - Simple Session Creation** {#session_new}

### **Purpose**
Create new conversation session with directory initialization options.

### **Best For**
- Working with **CURRENT state** (not past)
- Simple Git cloning (HEAD)
- File copying
- Conversation branching

### **All Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `directory` | string | ✅ Yes | - | Target directory path (absolute or relative) |
| `init_mode` | enum | ❌ No | 'empty' | **Initialization mode:** <br/>• 'empty': Empty directory<br/>• 'clone-git': Clone current Git repo (HEAD)<br/>• 'copy-files': Copy files (exclude .git, node_modules)<br/>• 'from-rewind': Event sourcing from timestamp |
| `rewind_timestamp` | string | ⚠️ Conditional | - | **Required if init_mode='from-rewind'**<br/>ISO 8601 timestamp (e.g., 2025-11-28T15:00:00Z) |
| `rewind_git_mode` | enum | ❌ No | 'full' | **Used with init_mode='from-rewind'**<br/>• 'none': No Git<br/>• 'metadata': git_state.json only<br/>• 'full': Complete .git repo |
| `import_history` | boolean | ❌ No | false | Import conversation history from another session |
| `from_session_id` | number | ❌ No | current | Source session ID for history import |
| `date_range_start` | string | ❌ No | - | Filter conversations from this date<br/>Formats: ISO 8601, YYYY-MM-DD, DD/MM/YYYY |
| `date_range_end` | string | ❌ No | - | Filter conversations until this date<br/>Formats: ISO 8601, YYYY-MM-DD, DD/MM/YYYY |
| `model` | string | ❌ No | current | Model to use (e.g., 'grok-2-1212', 'claude-sonnet-4') |
| `provider` | string | ❌ No | auto-detect | Provider (e.g., 'xai', 'anthropic') |

### **init_mode Examples**

#### 1. **Empty Directory** (Default)
```typescript
{
  directory: "~/new-project",
  init_mode: "empty"  // or omit (default)
}
```

#### 2. **Clone Current Git Repo**
```typescript
{
  directory: "~/feature-branch",
  init_mode: "clone-git"
}
// ✅ Clones current Git repository at HEAD to target directory
```

#### 3. **Copy Current Files** (No Git)
```typescript
{
  directory: "~/document-editing",
  init_mode: "copy-files"
}
// ✅ Copies files, excludes .git, node_modules, hidden files
```

#### 4. **From Event Sourcing Rewind**
```typescript
{
  directory: "~/recovered-state",
  init_mode: "from-rewind",
  rewind_timestamp: "2025-11-12T14:30:00Z",
  rewind_git_mode: "full",  // or 'metadata', 'none'
  import_history: true       // Also import conversations
}
// ✅ Reconstructs exact state from timeline.db at timestamp
```

### **Conversation Import Examples**

#### Import All History
```typescript
{
  directory: "~/session-copy",
  import_history: true
}
```

#### Import with Date Filter
```typescript
{
  directory: "~/filtered-session",
  import_history: true,
  date_range_start: "2025-11-01",
  date_range_end: "2025-11-07"
}
```

#### Import from Specific Session
```typescript
{
  directory: "~/branched-session",
  import_history: true,
  from_session_id: 5
}
```

### **Limitations**

❌ **from-rewind mode** has fewer options than `rewind_to` tool:
- No `autoCheckout` (auto cd to directory)
- No `compareWith` (diff with another directory)
- No `reason` (audit trail text)

✅ **Solution:** For advanced rewind options, use `rewind_to` tool with `createSession=true`

---

## ⏰ **rewind_to - Time Machine (Event Sourcing)** {#rewind_to}

### **Purpose**
Reconstruct exact past state via event sourcing from timeline.db.

### **Best For**
- Recovering **PAST state** at specific timestamp
- Event sourcing replay
- Full Git reconstruction (any commit)
- Advanced options (compare, auto-checkout)

### **All Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `targetTimestamp` | string | ✅ Yes | - | **Target timestamp** (ISO 8601: 2025-11-28T12:00:00Z)<br/>Use `timeline_query` to find available timestamps |
| `outputDir` | string | ❌ No | auto | Output directory (default: ~/grokinou_rewind_TIMESTAMP) |
| `includeFiles` | boolean | ❌ No | true | Reconstruct file contents from Merkle DAG blobs |
| `includeConversations` | boolean | ❌ No | true | Import conversation history |
| `gitMode` | enum | ❌ No | 'metadata' | **Git materialization mode:**<br/>• 'none': No Git information<br/>• 'metadata': git_state.json with commit/branch info<br/>• 'full': Complete .git repository at target commit |
| `createSession` | boolean | ❌ No | false | **Create new grokinou session** in rewinded directory |
| `autoCheckout` | boolean | ❌ No | false | **Automatically cd** to rewinded directory (changes process.cwd()) |
| `compareWith` | string | ❌ No | - | **Compare with directory** - generates detailed diff report |
| `reason` | string | ❌ No | - | Human-readable reason for rewind (for audit trail) |

### **Event Sourcing Process**

1. **Query** timeline.db for events before targetTimestamp
2. **Find** nearest snapshot (optimization)
3. **Replay** events from snapshot → target
4. **Reconstruct** files from Merkle DAG
5. **Materialize** Git repo (if gitMode ≠ 'none')
6. **Create** session (if createSession=true)

### **Examples**

#### 1. **Simple Rewind** (Metadata Only)
```typescript
{
  targetTimestamp: "2025-11-12T14:30:00Z"
}
// ✅ Creates ~/grokinou_rewind_20251112_143000
// ✅ Includes: files, conversations, git_state.json
```

#### 2. **Full Git Reconstruction**
```typescript
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  outputDir: "~/recovered-project",
  gitMode: "full"
}
// ✅ Complete .git repository at exact commit
```

#### 3. **Rewind + Create Session**
```typescript
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  createSession: true,
  gitMode: "full"
}
// ✅ Rewinds state
// ✅ Automatically creates new session in rewinded directory
```

#### 4. **Rewind + Auto-Checkout**
```typescript
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  autoCheckout: true,
  gitMode: "full"
}
// ✅ Rewinds state
// ✅ Automatically changes process.cwd() to rewinded directory
// ⚠️ Current directory changes!
```

#### 5. **Rewind + Compare**
```typescript
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  compareWith: "~/current-project"
}
// ✅ Rewinds state
// ✅ Generates detailed diff report:
//     - Added files
//     - Deleted files
//     - Modified files (with hashes)
//     - Unchanged files
```

#### 6. **Advanced: Full Recovery Workflow**
```typescript
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  outputDir: "~/critical-recovery",
  gitMode: "full",
  createSession: true,
  autoCheckout: true,
  compareWith: "~/broken-state",
  reason: "Critical bug recovery - reverting to last known good state"
}
// ✅ Full event sourcing replay
// ✅ Complete Git repo
// ✅ Session created automatically
// ✅ Auto cd to recovered directory
// ✅ Diff report vs broken state
// ✅ Audit trail with reason
```

#### 7. **Files Only** (No Git, No Conversations)
```typescript
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  gitMode: "none",
  includeConversations: false
}
// ✅ Only file reconstruction
// ❌ No Git information
// ❌ No conversation history
```

---

## ⚖️ **Quick Comparison** {#comparison}

| Feature | session_new | rewind_to |
|---------|-------------|-----------|
| **Primary Use** | Current state operations | Past state recovery |
| **Event Sourcing** | Basic (from-rewind mode) | Full (Merkle DAG replay) |
| **Git Cloning** | ✅ Current HEAD only | ✅ Any commit in history |
| **File Copying** | ✅ Current files | ✅ Past files (from timeline.db) |
| **Empty Directory** | ✅ Yes | ❌ No |
| **Conversation Import** | ✅ By date range | ✅ From timeline |
| **Git Modes** | ⚠️ Only for from-rewind | ✅ none/metadata/full |
| **Auto-Checkout** | ❌ No | ✅ Yes |
| **Compare Directories** | ❌ No | ✅ Yes |
| **Audit Trail (reason)** | ❌ No | ✅ Yes |
| **Requires Timestamp** | ⚠️ Only for from-rewind | ✅ Always |
| **Complexity** | 🟢 Simple | 🟡 Advanced |

---

## 🌳 **Decision Tree** {#decision-tree}

```
User Request: "Create a new session"
│
├─ Do you need CURRENT state?
│  ├─ Empty directory?
│  │  └─> session_new { init_mode: "empty" }
│  │
│  ├─ Clone Git (HEAD)?
│  │  └─> session_new { init_mode: "clone-git" }
│  │
│  ├─ Copy files (no Git)?
│  │  └─> session_new { init_mode: "copy-files" }
│  │
│  └─ Basic rewind (limited options)?
│     └─> session_new { init_mode: "from-rewind", rewind_timestamp: "..." }
│
└─ Do you need PAST state?
   ├─ Simple recovery?
   │  └─> rewind_to { targetTimestamp: "...", gitMode: "metadata" }
   │
   ├─ With full Git?
   │  └─> rewind_to { targetTimestamp: "...", gitMode: "full" }
   │
   ├─ With session creation?
   │  └─> rewind_to { targetTimestamp: "...", createSession: true }
   │
   ├─ With auto-checkout?
   │  └─> rewind_to { targetTimestamp: "...", autoCheckout: true }
   │
   ├─ With comparison?
   │  └─> rewind_to { targetTimestamp: "...", compareWith: "~/other-dir" }
   │
   └─ All options?
      └─> rewind_to { 
            targetTimestamp: "...",
            gitMode: "full",
            createSession: true,
            autoCheckout: true,
            compareWith: "~/compare",
            reason: "Recovery reason"
          }
```

---

## 🎯 **When to Use Which Tool**

### **Use `session_new` when:**

✅ You want to work with **current state** (not past)  
✅ Simple operations: clone HEAD, copy files, empty dir  
✅ Basic conversation import by date  
✅ You don't need advanced rewind options  

**Examples:**
- "Create a new session to work on feature X"
- "Clone current code to new directory"
- "Start fresh conversation with current files"

---

### **Use `rewind_to` when:**

✅ You need **exact past state** at specific timestamp  
✅ Event sourcing / time travel required  
✅ Full Git reconstruction at any commit  
✅ Advanced options needed:
  - `autoCheckout`: Auto cd to directory
  - `compareWith`: Generate diff report
  - `createSession`: Auto-create session
  - `reason`: Audit trail

**Examples:**
- "Recover state from yesterday at 3pm"
- "Rewind to before bug was introduced"
- "Compare current state with last week"
- "Create session from exact past state with full Git"

---

## 📋 **Parameter Validation**

### **session_new**

```typescript
// ✅ Valid: Empty directory
{ directory: "~/project" }

// ✅ Valid: Clone Git
{ directory: "~/project", init_mode: "clone-git" }

// ✅ Valid: From rewind
{ 
  directory: "~/recovered",
  init_mode: "from-rewind",
  rewind_timestamp: "2025-11-12T14:30:00Z"
}

// ❌ Invalid: from-rewind without timestamp
{
  directory: "~/recovered",
  init_mode: "from-rewind"
  // Missing: rewind_timestamp
}

// ❌ Invalid: clone-git when not in Git repo
{
  directory: "~/project",
  init_mode: "clone-git"
  // Error if current directory is not a Git repository
}
```

### **rewind_to**

```typescript
// ✅ Valid: Minimal
{ targetTimestamp: "2025-11-12T14:30:00Z" }

// ✅ Valid: Full options
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  outputDir: "~/recovered",
  gitMode: "full",
  createSession: true,
  autoCheckout: true,
  compareWith: "~/current"
}

// ❌ Invalid: Missing required targetTimestamp
{ outputDir: "~/recovered" }

// ❌ Invalid: Invalid gitMode
{
  targetTimestamp: "2025-11-12T14:30:00Z",
  gitMode: "invalid"  // Must be: 'none', 'metadata', 'full'
}
```

---

## 🔍 **Finding Available Timestamps**

Before using `rewind_to`, use `timeline_query` to find available timestamps:

```typescript
// 1. Query recent events
timeline_query({
  startTime: "2025-11-12T00:00:00Z",
  endTime: "2025-11-13T00:00:00Z",
  limit: 100
})

// 2. Check snapshots
list_time_points()

// 3. Use timestamp from results
rewind_to({
  targetTimestamp: "2025-11-12T14:30:45.123Z"
})
```

---

## 📚 **Related Documentation**

- **Rewind Features Guide:** `/home/zack/GROK_CLI/grok-cli/REWIND_FEATURES.md`
- **New Session Features Guide:** `/home/zack/GROK_CLI/grok-cli/NEW_SESSION_FEATURES.md`
- **LLM Clarification Guide:** `/home/zack/GROK_CLI/grok-cli/LLM_TOOL_CLARIFICATION_GUIDE.md`
- **Tool Definitions:** `/home/zack/GROK_CLI/grok-cli/src/grok/tools.ts`
- **Tool Implementations:**
  - `session_new`: `/home/zack/GROK_CLI/grok-cli/src/tools/session-tools.ts`
  - `rewind_to`: `/home/zack/GROK_CLI/grok-cli/src/tools/rewind-to-tool.ts`

---

**Last Updated:** 2025-11-13  
**Maintainer:** Zack  
**Version:** 1.0.0
