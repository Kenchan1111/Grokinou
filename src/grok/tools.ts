import { GrokTool } from "./client.js";
import { MCPManager, MCPTool } from "../mcp/client.js";
import { loadMCPConfig } from "../mcp/config.js";

const BASE_GROK_TOOLS: GrokTool[] = [
  {
    type: "function",
    function: {
      name: "view_file",
      description: "View contents of a file or list directory contents",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to file or directory to view",
          },
          start_line: {
            type: "number",
            description:
              "Starting line number for partial file view (optional)",
          },
          end_line: {
            type: "number",
            description: "Ending line number for partial file view (optional)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_patch",
      description:
        "Apply a unified diff (git-style) patch to the workspace. Use this for multi-file edits.",
      parameters: {
        type: "object",
        properties: {
          patch: {
            type: "string",
            description: "Unified diff content. Include ---/+++ and @@ hunks.",
          },
          dry_run: {
            type: "boolean",
            description: "If true, validate without writing changes.",
          },
        },
        required: ["patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Create a new file with specified content",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path where the file should be created",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "str_replace_editor",
      description: "Replace specific text in a file. Use this for single line edits only",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to edit",
          },
          old_str: {
            type: "string",
            description:
              "Text to replace (must match exactly, or will use fuzzy matching for multi-line strings)",
          },
          new_str: {
            type: "string",
            description: "Text to replace with",
          },
          replace_all: {
            type: "boolean",
            description:
              "Replace all occurrences (default: false, only replaces first occurrence)",
          },
        },
        required: ["path", "old_str", "new_str"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "bash",
      description: "Execute a bash command",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description:
        "Unified search tool for finding text content or files (similar to Cursor's search)",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text to search for or file name/path pattern",
          },
          search_type: {
            type: "string",
            enum: ["text", "files", "both"],
            description:
              "Type of search: 'text' for content search, 'files' for file names, 'both' for both (default: 'both')",
          },
          include_pattern: {
            type: "string",
            description:
              "Glob pattern for files to include (e.g. '*.ts', '*.js')",
          },
          exclude_pattern: {
            type: "string",
            description:
              "Glob pattern for files to exclude (e.g. '*.log', 'node_modules')",
          },
          case_sensitive: {
            type: "boolean",
            description:
              "Whether search should be case sensitive (default: false)",
          },
          whole_word: {
            type: "boolean",
            description: "Whether to match whole words only (default: false)",
          },
          regex: {
            type: "boolean",
            description: "Whether query is a regex pattern (default: false)",
          },
          max_results: {
            type: "number",
            description: "Maximum number of results to return (default: 50)",
          },
          file_types: {
            type: "array",
            items: { type: "string" },
            description: "File types to search (e.g. ['js', 'ts', 'py'])",
          },
          include_hidden: {
            type: "boolean",
            description: "Whether to include hidden files (default: false)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_todo_list",
      description: "Create a new todo list for planning and tracking tasks",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "Array of todo items",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Unique identifier for the todo item",
                },
                content: {
                  type: "string",
                  description: "Description of the todo item",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Current status of the todo item",
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "Priority level of the todo item",
                },
              },
              required: ["id", "content", "status", "priority"],
            },
          },
        },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_todo_list",
      description: "Update existing todos in the todo list",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            description: "Array of todo updates",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "ID of the todo item to update",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "New status for the todo item",
                },
                content: {
                  type: "string",
                  description: "New content for the todo item",
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "New priority for the todo item",
                },
              },
              required: ["id"],
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_identity",
      description: "Get factual information about your own model identity, provider, and configuration. Use this if you need to verify who you are, especially after noticing inconsistencies in conversation history.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  
  // ============================================
  // SESSION MANAGEMENT TOOLS (Git-like)
  // ============================================
  
  {
    type: "function",
    function: {
      name: "session_list",
      description: "List all conversation sessions with details (ID, directory, model, message count, dates). Use this to see available sessions before switching or for conversation management.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  
  {
    type: "function",
    function: {
      name: "session_switch",
      description: "Switch to a different conversation session. Changes working directory and loads conversation history. **CRITICAL: ALWAYS ask user permission before calling.** Explain what will happen and get explicit approval.",
      parameters: {
        type: "object",
        properties: {
          session_id: {
            type: "number",
            description: "ID of the session to switch to (use session_list to see available sessions)",
          },
        },
        required: ["session_id"],
      },
    },
  },
  
  {
    type: "function",
    function: {
      name: "session_new",
      description: `⚠️ CRITICAL: Before using this tool, ASK USER to clarify their intent!

═══════════════════════════════════════════════════════════════════
TWO TOOLS AVAILABLE FOR SESSION/STATE CREATION - Ask user to choose:
═══════════════════════════════════════════════════════════════════

┌───────────────────────────────────────────────────────────────────┐
│ 📁 session_new (THIS TOOL) - Simple Session Creation             │
│                                                                   │
│ BEST FOR:                                                         │
│ • Starting fresh conversation in new directory                   │
│ • Git repository cloning (CURRENT HEAD state)                    │
│ • File copying (CURRENT files, excluding .git/node_modules)      │
│ • Importing conversation history by date range                   │
│ • Simple event sourcing initialization (via from-rewind mode)    │
│                                                                   │
│ INITIALIZATION MODES (init_mode parameter):                      │
│ • 'empty': Empty directory (default)                             │
│ • 'clone-git': Clone current Git repo at HEAD                    │
│ • 'copy-files': Copy current files (excludes .git, node_modules) │
│ • 'from-rewind': Initialize from event sourcing timestamp        │
│   └─> Requires: rewind_timestamp (ISO 8601)                      │
│   └─> Optional: rewind_git_mode ('none'/'metadata'/'full')      │
│                                                                   │
│ CONVERSATION IMPORT OPTIONS:                                     │
│ • import_history: Import conversation history (boolean)          │
│ • from_session_id: Source session ID (default: current)          │
│ • date_range_start: Filter start date (ISO 8601 / YYYY-MM-DD)   │
│ • date_range_end: Filter end date (ISO 8601 / YYYY-MM-DD)       │
│                                                                   │
│ MODEL/PROVIDER OPTIONS:                                          │
│ • model: Model to use (e.g., 'grok-2-1212', 'claude-sonnet-4')  │
│ • provider: Provider (e.g., 'xai', 'anthropic')                  │
│                                                                   │
│ LIMITATIONS:                                                      │
│ • 'from-rewind' has limited options vs rewind_to tool            │
│ • No autoCheckout, compareWith options                           │
│ • For advanced rewind: use rewind_to tool instead                │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ ⏰ rewind_to - TIME MACHINE (Event Sourcing Alternative)          │
│                                                                   │
│ BEST FOR:                                                         │
│ • Recovering EXACT state at specific past timestamp              │
│ • Event sourcing replay from timeline.db                         │
│ • Full Git repository reconstruction (ANY commit, not just HEAD) │
│ • Advanced options: compare dirs, auto-checkout, git modes       │
│ • Automatically create session in rewinded state                 │
│                                                                   │
│ POWERFUL FEATURES:                                                │
│ • gitMode: 'none', 'metadata', or 'full' Git reconstruction      │
│ • autoCheckout: Automatically cd to rewinded directory           │
│ • compareWith: Generate diff report with another directory       │
│ • createSession: Auto-create session in past state               │
│ • Merkle DAG: Reconstruct exact file contents from blobs         │
│                                                                   │
│ REQUIREMENTS:                                                     │
│ • Exact timestamp (use timeline_query to find available times)   │
│ • Timeline.db with event history                                 │
└───────────────────────────────────────────────────────────────────┘

🔴 MANDATORY: ASK USER BEFORE PROCEEDING:

"I can help you create a new session. There are TWO approaches available:

1️⃣ **Simple Session Creation** (session_new - CURRENT state):
   ✓ Clone current Git repository (HEAD) - init_mode='clone-git'
   ✓ Copy current files to new directory - init_mode='copy-files'
   ✓ Start with empty directory - init_mode='empty' (default)
   ✓ Import conversation history by date range
   ✓ Basic event sourcing init - init_mode='from-rewind'
   
   Available Options:
   • init_mode: 'empty', 'clone-git', 'copy-files', 'from-rewind'
   • rewind_timestamp: For 'from-rewind' mode (ISO 8601)
   • rewind_git_mode: Git mode for rewind ('none'/'metadata'/'full')
   • import_history, from_session_id, date_range_start/end
   • model, provider
   
   Limitations:
   ✗ from-rewind has fewer options than rewind_to
   ✗ No autoCheckout, compareWith features

2️⃣ **Time Machine Recovery** (rewind_to - PAST state):
   ✓ Recover EXACT state from any past timestamp
   ✓ Event sourcing replay from timeline.db
   ✓ Full Git reconstruction at specific commit
   ✓ Advanced options (compare, auto-checkout, git modes)
   ✓ Can create session automatically in past state
   ✗ Requires exact timestamp
   ✗ More complex operation

Your request: [describe what you understood]

Which approach do you need?
• Work with CURRENT state → I'll use session_new
• Recover a PAST state at specific time → I'll use rewind_to

Please confirm your choice so I can proceed correctly."

═══════════════════════════════════════════════════════════════════

PROCEED WITH session_new ONLY AFTER USER CONFIRMS "current state" approach.`,
      parameters: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Target directory for new session (absolute or relative path). Will be created if doesn't exist.",
          },
          init_mode: {
            type: "string",
            enum: ["empty", "clone-git", "copy-files", "from-rewind"],
            description: `Directory initialization mode (default: 'empty'):
• 'empty': Create empty directory
• 'clone-git': Clone current Git repository (HEAD state) to target directory
• 'copy-files': Copy current files (excluding .git, node_modules, hidden files) to target directory
• 'from-rewind': Initialize from event sourcing rewind at specific timestamp (requires rewind_timestamp)

⚠️ For 'from-rewind': Consider using rewind_to tool instead for full control over gitMode, autoCheckout, compareWith options.`,
          },
          rewind_timestamp: {
            type: "string",
            description: "Timestamp for 'from-rewind' init mode (ISO 8601: 2025-11-28T15:00:00Z). Only used when init_mode='from-rewind'. Reconstructs directory state via event sourcing.",
          },
          rewind_git_mode: {
            type: "string",
            enum: ["none", "metadata", "full"],
            description: "Git mode for 'from-rewind' (default: 'full'). Only used when init_mode='from-rewind'. See rewind_to tool for detailed gitMode documentation.",
          },
          import_history: {
            type: "boolean",
            description: "Whether to import conversation history from source session (default: false)",
          },
          from_session_id: {
            type: "number",
            description: "Session ID to import conversation history from (default: current session). Used when import_history=true.",
          },
          date_range_start: {
            type: "string",
            description: "Start date for conversation history filtering (ISO 8601, YYYY-MM-DD, or DD/MM/YYYY). Used when import_history=true.",
          },
          date_range_end: {
            type: "string",
            description: "End date for conversation history filtering (ISO 8601, YYYY-MM-DD, or DD/MM/YYYY). Used when import_history=true.",
          },
          model: {
            type: "string",
            description: "Model to use in new session (optional, e.g., 'grok-2-1212', 'claude-sonnet-4')",
          },
          provider: {
            type: "string",
            description: "Provider to use in new session (optional, e.g., 'xai', 'anthropic')",
          },
        },
        required: ["directory"],
      },
    },
  },
  
  {
    type: "function",
    function: {
      name: "session_rewind",
      description: "Perform Git rewind: synchronize conversation history AND code state to a specific date range. Creates new session in target directory with filtered conversation messages and Git repository at corresponding commit. **CRITICAL: This is the most powerful operation - ALWAYS explain the plan in detail and get explicit user permission before calling.** This modifies filesystem and Git state.",
      parameters: {
        type: "object",
        properties: {
          target_directory: {
            type: "string",
            description: "Directory for rewound session (will be created, must not exist)",
          },
          date_range_start: {
            type: "string",
            description: "Start date for rewind (ISO 8601, YYYY-MM-DD, or DD/MM/YYYY)",
          },
          date_range_end: {
            type: "string",
            description: "End date for rewind (ISO 8601, YYYY-MM-DD, or DD/MM/YYYY)",
          },
          from_session_id: {
            type: "number",
            description: "Session to rewind from (default: current session)",
          },
          preserve_git_history: {
            type: "boolean",
            description: "If true, clone full Git history. If false, use git archive (lightweight). Default: false",
          },
        },
        required: ["target_directory", "date_range_start", "date_range_end"],
      },
    },
  },
];

// Morph Fast Apply tool (conditional)
const MORPH_EDIT_TOOL: GrokTool = {
  type: "function",
  function: {
    name: "edit_file",
    description: "Use this tool to make an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nFor example:\n\n// ... existing code ...\nFIRST_EDIT\n// ... existing code ...\nSECOND_EDIT\n// ... existing code ...\nTHIRD_EDIT\n// ... existing code ...\n\nYou should still bias towards repeating as few lines of the original file as possible to convey the change.\nBut, each edit should contain sufficient context of unchanged lines around the code you're editing to resolve ambiguity.\nDO NOT omit spans of pre-existing code (or comments) without using the // ... existing code ... comment to indicate its absence. If you omit the existing code comment, the model may inadvertently delete these lines.\nIf you plan on deleting a section, you must provide context before and after to delete it. If the initial code is ```code \\n Block 1 \\n Block 2 \\n Block 3 \\n code```, and you want to remove Block 2, you would output ```// ... existing code ... \\n Block 1 \\n  Block 3 \\n // ... existing code ...```.\nMake sure it is clear what the edit should be, and where it should be applied.\nMake edits to a file in a single edit_file call instead of multiple edit_file calls to the same file. The apply model can handle many distinct edits at once.",
    parameters: {
      type: "object",
      properties: {
        target_file: {
          type: "string",
          description: "The target file to modify."
        },
        instructions: {
          type: "string",
          description: "A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Use the first person to describe what you are going to do. Use it to disambiguate uncertainty in the edit."
        },
        code_edit: {
          type: "string",
          description: "Specify ONLY the precise lines of code that you wish to edit. NEVER specify or write out unchanged code. Instead, represent all unchanged code using the comment of the language you're editing in - example: // ... existing code ..."
        }
      },
      required: ["target_file", "instructions", "code_edit"]
    }
  }
};

// Function to build tools array conditionally
function buildGrokTools(): GrokTool[] {
  const tools = [...BASE_GROK_TOOLS];
  
  // Add Morph Fast Apply tool if API key is available
  if (process.env.MORPH_API_KEY) {
    tools.splice(3, 0, MORPH_EDIT_TOOL); // Insert after str_replace_editor
  }
  
  // Add timeline tools
  tools.push(
    {
      type: "function",
      function: {
        name: "timeline_query",
        description: "Query timeline event log to understand what happened (file modifications, git operations, conversations, tool calls, rewinds).",
        parameters: {
          type: "object",
          properties: {
            startTime: { type: "string", description: "Start timestamp (ISO string or relative, e.g. '2025-11-28T00:00:00Z' or '2 hours ago')" },
            endTime: { type: "string", description: "End timestamp (ISO string)" },
            categories: {
              type: "array",
              items: {
                type: "string",
                enum: ["SESSION", "LLM", "TOOL", "FILE", "GIT", "REWIND"],
              },
              description: "High-level event categories to filter.",
            },
            eventTypes: {
              type: "array",
              items: { type: "string" },
              description: "Specific event types (e.g. FILE_MODIFIED, GIT_COMMIT, REWIND_COMPLETED).",
            },
            actor: {
              type: "string",
              description: "Filter by actor (e.g. 'user', 'system', 'git:username').",
            },
            sessionId: {
              type: "number",
              description: "Filter by session ID.",
            },
            aggregateId: {
              type: "string",
              description: "Filter by aggregate ID (e.g. file path).",
            },
            limit: {
              type: "number",
              description: "Max results (default: 100, max: 1000).",
            },
            searchText: {
              type: "string",
              description: "Search text in event payloads (useful to find specific errors or operations).",
            },
            order: {
              type: "string",
              enum: ["asc", "desc"],
              description: "Sort order: 'asc' (oldest first) or 'desc' (newest first, default).",
            },
            statsOnly: {
              type: "boolean",
              description: "Return only aggregated statistics instead of full event list.",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "rewind_to",
        description: `⚠️ CRITICAL: Before using this tool, ASK USER to clarify their intent AND get explicit permission!

═══════════════════════════════════════════════════════════════════
TWO TOOLS AVAILABLE FOR SESSION/STATE CREATION - Ask user to choose:
═══════════════════════════════════════════════════════════════════

┌───────────────────────────────────────────────────────────────────┐
│ ⏰ rewind_to (THIS TOOL) - TIME MACHINE via Event Sourcing        │
│                                                                   │
│ BEST FOR:                                                         │
│ • Recovering EXACT state at specific past timestamp              │
│ • Event sourcing replay from timeline.db Merkle DAG              │
│ • Full Git repository reconstruction at ANY commit               │
│ • Advanced operations with multiple options                      │
│ • Creating session automatically in rewinded past state          │
│                                                                   │
│ POWERFUL FEATURES:                                                │
│ • gitMode: 'none' | 'metadata' | 'full'                          │
│   - none: No Git information                                     │
│   - metadata: git_state.json with commit/branch info             │
│   - full: Complete .git repository at target commit              │
│ • autoCheckout: Auto cd to rewinded directory after rewind       │
│ • compareWith: Generate detailed diff report vs another dir      │
│ • createSession: Auto-create grokinou session in rewinded state  │
│ • includeFiles: Reconstruct file contents from Merkle DAG blobs  │
│ • includeConversations: Import conversation history              │
│                                                                   │
│ HOW IT WORKS (Event Sourcing):                                    │
│ 1. Query timeline.db for all events before targetTimestamp       │
│ 2. Find nearest snapshot (if exists) for optimization            │
│ 3. Replay events from snapshot → target time                     │
│ 4. Reconstruct files from Merkle DAG blob storage                │
│ 5. Materialize Git repository at exact commit (if gitMode≠none)  │
│ 6. Create session in rewinded directory (if createSession=true)  │
│                                                                   │
│ REQUIREMENTS:                                                     │
│ • Exact timestamp (ISO 8601: 2025-11-28T14:30:00Z)               │
│ • Use timeline_query first to find available timestamps          │
│ • Timeline.db must have event history for target period          │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ 📁 session_new - Simple Session Creation (Alternative)           │
│                                                                   │
│ BEST FOR:                                                         │
│ • Working with CURRENT state (not past)                          │
│ • Simple Git clone (HEAD state only)                             │
│ • File copying (current files)                                   │
│ • Basic session creation                                         │
│                                                                   │
│ LIMITATIONS:                                                      │
│ • No event sourcing / time travel                                │
│ • Works only with current state                                  │
│ • No advanced rewind options                                     │
│ • Cannot recover past timestamps                                 │
└───────────────────────────────────────────────────────────────────┘

🔴 MANDATORY: ASK USER BEFORE PROCEEDING:

"I can help you with time-based operations. There are TWO approaches:

1️⃣ **Time Machine** (rewind_to - PAST state):
   ✓ Recover EXACT state from specific timestamp
   ✓ Event sourcing replay from timeline.db
   ✓ Full Git reconstruction at any commit
   ✓ Advanced options:
     - gitMode: none/metadata/full
     - autoCheckout: Auto cd after rewind
     - compareWith: Diff with another directory
     - createSession: Auto-create session
   ✓ Merkle DAG for file reconstruction
   ✗ Requires exact timestamp
   ✗ More complex operation

2️⃣ **Simple Session** (session_new - CURRENT state):
   ✓ Clone current Git repository (HEAD)
   ✓ Copy current files
   ✓ Simpler operation
   ✗ No time travel / event sourcing
   ✗ Current state only

Your request: [describe what you understood]

Questions to clarify:
• Do you need a PAST state at specific timestamp? → rewind_to
• Do you need CURRENT state in new directory? → session_new

If using rewind_to, you MUST provide:
1. Exact timestamp (use timeline_query to find available times)
   Example: timeline_query with startTime/endTime to see events
2. Confirmation of options:
   - gitMode? (none/metadata/full)
   - autoCheckout? (true/false)
   - createSession? (true/false)
   - compareWith? (optional directory path)

**This is a powerful operation that reconstructs exact past state.**
**I need your explicit permission to proceed.**

Please confirm:
• Exact timestamp you want to rewind to
• Which options you want (gitMode, autoCheckout, etc.)
• Permission to execute the rewind"

═══════════════════════════════════════════════════════════════════

PROCEED WITH rewind_to ONLY AFTER:
1. User confirms they need PAST state (not current)
2. User provides exact timestamp
3. User gives explicit permission
4. User confirms desired options (gitMode, autoCheckout, compareWith, createSession)`,
        parameters: {
          type: "object",
          properties: {
            targetTimestamp: { type: "string", description: "Target timestamp (ISO format: 2025-11-28T12:00:00Z)" },
            outputDir: { type: "string", description: "Output directory (default: auto-generated ~/grokinou_rewind_TIMESTAMP)" },
            includeFiles: { type: "boolean", description: "Include file contents reconstruction from Merkle DAG (default: true)" },
            includeConversations: { type: "boolean", description: "Include conversation history import (default: true)" },
            gitMode: { 
              type: "string", 
              enum: ["none", "metadata", "full"],
              description: "Git mode: 'none'=no git, 'metadata'=git_state.json only, 'full'=complete .git repo (default: metadata)" 
            },
            createSession: { type: "boolean", description: "Create a new grokinou session in rewinded directory (default: false)" },
            autoCheckout: { type: "boolean", description: "Automatically change working directory (process.cwd) to rewinded directory (default: false)" },
            compareWith: { type: "string", description: "Compare rewinded state with another directory - generates detailed diff report (optional)" },
            reason: { type: "string", description: "Human-readable reason for rewind (for logging and audit trail)" },
          },
          required: ["targetTimestamp"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_time_points",
        description: "List available snapshots and recent events for rewinding",
        parameters: { 
          type: "object" as const, 
          properties: {}, 
          required: [] 
        },
      },
    }
  );
  
  return tools;
}

// Export dynamic tools array
export const GROK_TOOLS: GrokTool[] = buildGrokTools();

// Global MCP manager instance
let mcpManager: MCPManager | null = null;

export function getMCPManager(): MCPManager {
  if (!mcpManager) {
    mcpManager = new MCPManager();
  }
  return mcpManager;
}

export async function initializeMCPServers(): Promise<void> {
  const manager = getMCPManager();
  const config = loadMCPConfig();
  
  // Store original stderr.write
  const originalStderrWrite = process.stderr.write;
  
  // Temporarily suppress stderr to hide verbose MCP connection logs
  process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    // Filter out mcp-remote verbose logs
    const chunkStr = chunk.toString();
    if (chunkStr.includes('[') && (
        chunkStr.includes('Using existing client port') ||
        chunkStr.includes('Connecting to remote server') ||
        chunkStr.includes('Using transport strategy') ||
        chunkStr.includes('Connected to remote server') ||
        chunkStr.includes('Local STDIO server running') ||
        chunkStr.includes('Proxy established successfully') ||
        chunkStr.includes('Local→Remote') ||
        chunkStr.includes('Remote→Local')
      )) {
      // Suppress these verbose logs
      if (callback) callback();
      return true;
    }
    
    // Allow other stderr output
    return originalStderrWrite.call(this, chunk, encoding, callback);
  };
  
  try {
    for (const serverConfig of config.servers) {
      try {
        await manager.addServer(serverConfig);
      } catch (error) {
        console.warn(`Failed to initialize MCP server ${serverConfig.name}:`, error);
      }
    }
  } finally {
    // Restore original stderr.write
    process.stderr.write = originalStderrWrite;
  }
}

export function convertMCPToolToGrokTool(mcpTool: MCPTool): GrokTool {
  return {
    type: "function",
    function: {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      }
    }
  };
}

export function addMCPToolsToGrokTools(baseTools: GrokTool[]): GrokTool[] {
  if (!mcpManager) {
    return baseTools;
  }
  
  const mcpTools = mcpManager.getTools();
  const grokMCPTools = mcpTools.map(convertMCPToolToGrokTool);
  
  return [...baseTools, ...grokMCPTools];
}

export async function getAllGrokTools(): Promise<GrokTool[]> {
  const manager = getMCPManager();
  // Try to initialize servers if not already done, but don't block
  manager.ensureServersInitialized().catch(() => {
    // Ignore initialization errors to avoid blocking
  });
  return addMCPToolsToGrokTools(GROK_TOOLS);
}
