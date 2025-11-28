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
      description: "Create a new conversation session (Git-like branching). Can create in different directory, import history from another session, filter by date range. Use for branching conversations or starting fresh contexts.",
      parameters: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Target directory for new session (absolute or relative path). Will be created if doesn't exist.",
          },
          import_history: {
            type: "boolean",
            description: "Whether to import conversation history from source session",
          },
          from_session_id: {
            type: "number",
            description: "Session ID to import from (default: current session)",
          },
          date_range_start: {
            type: "string",
            description: "Start date for history filtering (ISO 8601, YYYY-MM-DD, or DD/MM/YYYY)",
          },
          date_range_end: {
            type: "string",
            description: "End date for history filtering (ISO 8601, YYYY-MM-DD, or DD/MM/YYYY)",
          },
          model: {
            type: "string",
            description: "Model to use in new session (optional)",
          },
          provider: {
            type: "string",
            description: "Provider to use in new session (optional)",
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
        description: "Query timeline event log to understand what happened (file modifications, git operations, conversations)",
        parameters: {
          type: "object",
          properties: {
            startTime: { type: "string", description: "Start timestamp (ISO)" },
            endTime: { type: "string", description: "End timestamp (ISO)" },
            categories: { type: "array", items: { type: "string" }, description: "Event categories" },
            sessionId: { type: "number", description: "Filter by session ID" },
            limit: { type: "number", description: "Max results (default: 100)" },
            statsOnly: { type: "boolean", description: "Return only statistics" },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "rewind_to",
        description: "TIME MACHINE: Rewind to timestamp. **ALWAYS get user permission first.**",
        parameters: {
          type: "object",
          properties: {
            targetTimestamp: { type: "string", description: "Target timestamp (ISO)" },
            outputDir: { type: "string", description: "Output directory" },
            includeFiles: { type: "boolean", description: "Include files" },
            reason: { type: "string", description: "Reason" },
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
