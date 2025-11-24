import { GrokClient, GrokMessage, GrokToolCall } from "../grok/client.js";
import {
  GROK_TOOLS,
  addMCPToolsToGrokTools,
  getAllGrokTools,
  getMCPManager,
  initializeMCPServers,
} from "../grok/tools.js";
import { loadMCPConfig } from "../mcp/config.js";
import {
  TextEditorTool,
  MorphEditorTool,
  BashTool,
  TodoTool,
  ConfirmationTool,
  SearchTool,
} from "../tools/index.js";
import { ToolResult } from "../types/index.js";
import { EventEmitter } from "events";
import { createTokenCounter, TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions } from "../utils/custom-instructions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { 
  appendChatEntry, 
  saveState, 
  sessionManager 
} from "../utils/session-manager-sqlite.js";
import { providerManager } from "../utils/provider-manager.js";
import { debugLog } from "../utils/debug-logger.js";

export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  timestamp: Date;
  toolCalls?: GrokToolCall[];
  toolCall?: GrokToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
}

export interface StreamingChunk {
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count";
  content?: string;
  toolCalls?: GrokToolCall[];
  toolCall?: GrokToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
}

export class GrokAgent extends EventEmitter {
  private grokClient: GrokClient;
  private textEditor: TextEditorTool;
  private morphEditor: MorphEditorTool | null;
  private bash: BashTool;
  private todoTool: TodoTool;
  private confirmationTool: ConfirmationTool;
  private search: SearchTool;
  private applyPatch?: import("../tools/apply-patch.js").ApplyPatchTool;
  private chatHistory: ChatEntry[] = [];
  private messages: GrokMessage[] = [];
  private tokenCounter: TokenCounter;
  private abortController: AbortController | null = null;
  private mcpInitialized: boolean = false;
  private maxToolRounds: number;
  private persistSession: boolean = true;
  private autoRestoreSession: boolean = true;

  constructor(
    apiKey: string,
    baseURL?: string,
    model?: string,
    maxToolRounds?: number
  ) {
    super();
    const manager = getSettingsManager();
    const savedModel = manager.getCurrentModel();
    const modelToUse = model || savedModel || "grok-code-fast-1";
    this.maxToolRounds = maxToolRounds || 400;
    this.grokClient = new GrokClient(apiKey, modelToUse, baseURL);
    this.textEditor = new TextEditorTool();
    this.morphEditor = process.env.MORPH_API_KEY ? new MorphEditorTool() : null;
    this.bash = new BashTool();
    this.todoTool = new TodoTool();
    this.confirmationTool = new ConfirmationTool();
    this.search = new SearchTool();
    this.tokenCounter = createTokenCounter(modelToUse);
    // applyPatch tool will be lazily imported on first use

    // Load project persistence settings
    try {
      const projectPersist = manager.getProjectSetting("persistSession");
      const projectAutoRestore = manager.getProjectSetting("autoRestoreSession");
      this.persistSession = projectPersist !== undefined ? !!projectPersist : true;
      this.autoRestoreSession = projectAutoRestore !== undefined ? !!projectAutoRestore : true;
    } catch {}

    // Initialize SQLite session for current workdir
    // Detect provider from baseURL
    let provider = 'grok';
    if (baseURL) {
      if (baseURL.includes('anthropic')) provider = 'claude';
      else if (baseURL.includes('openai')) provider = 'openai';
      else if (baseURL.includes('mistral')) provider = 'mistral';
      else if (baseURL.includes('deepseek')) provider = 'deepseek';
      else if (baseURL.includes('x.ai')) provider = 'grok';
    }
    sessionManager.initSession(process.cwd(), provider, modelToUse, apiKey);

    // Initialize MCP servers if configured
    this.initializeMCP();

    // Initialize with system message (will be updated on model switch)
    this.updateSystemMessage();
  }

  /**
   * Update system message with current model name
   * Called during initialization and when switching models
   */
  private updateSystemMessage(): void {
    const customInstructions = loadCustomInstructions();
    const customInstructionsSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n\nThe above custom instructions should be followed alongside the standard instructions below.`
      : "";

    const currentModel = this.grokClient.getCurrentModel();
    const systemMessage = {
      role: "system" as const,
      content: `You are ${currentModel}, a WORLD CLASS AI COLLABORATOR that helps with file editing, coding tasks, and system operations.${customInstructionsSection}

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (ALWAYS use this to edit or update existing files)${
        this.morphEditor
          ? "\n- edit_file: High-speed file editing with Morph Fast Apply (4,500+ tokens/sec with 98% accuracy)"
          : ""
      }
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)
- search: Unified search tool for finding text content or files (similar to Cursor's search functionality)
- create_todo_list: Create a visual todo list for planning and tracking tasks
- update_todo_list: Update existing todos in your todo list

REAL-TIME INFORMATION:
You have access to real-time web search and X (Twitter) data. When users ask for current information, latest news, or recent events, you automatically have access to up-to-date information from the web and social media.

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist - this will overwrite them completely
- ALWAYS use str_replace_editor to modify existing files, even for small changes
- Before editing a file, use view_file to see its current contents
- Use create_file ONLY when creating entirely new files that don't exist

SEARCHING AND EXPLORATION:
- Use search for fast, powerful text search across files or finding files by name (unified search tool)
- Examples: search for text content like "import.*react", search for files like "component.tsx"
- Use bash with commands like 'find', 'grep', 'rg', 'ls' for complex file operations and navigation
- view_file is best for reading specific files you already know exist

When a user asks you to edit, update, modify, or change an existing file:
1. First use view_file to see the current contents
2. Then use str_replace_editor to make the specific changes
3. Never use create_file for existing files

When a user asks you to create a new file that doesn't exist:
1. Use create_file with the full content

TASK PLANNING WITH TODO LISTS:
- For complex requests with multiple steps, ALWAYS write an implementation plan in markdown and ALWAYS create a todo list first to plan your approach
- Use create_todo_list to break down tasks into manageable items with priorities
- Mark tasks as 'in_progress' when you start working on them (only one at a time)
- Mark tasks as 'completed' immediately when finished
- Use update_todo_list to track your progress throughout the task
- Todo lists provide visual feedback with colors: ✅ Green (completed), 🔄 Cyan (in progress), ⏳ Yellow (pending)
- Always create todos with priorities: 'high' (🔴), 'medium' (🟡), 'low' (🟢)

USER CONFIRMATION SYSTEM:
File operations (create_file, str_replace_editor) and bash commands will automatically request user confirmation before execution. The confirmation system will show users the actual content or command before they decide. Users can choose to approve individual operations or approve all operations of that type for the session.

If a user rejects an operation, the tool will return an error and you should not proceed with that specific operation.

Be helpful, direct, smart, intelligent and efficient. Always look at the WHOLE CONTEXT before providing solutions or making edits and act THOROUGHLY, DEEP DIVE in order to understand the subtleties. EXPLAIN what you're doing WITHOUT HIDING ANYTHING, TELL the CHALLENGES you faced, the ERRORS you met and the SOLUTIONS YOU FOUND, and SHOW THE RESULTS.

IMPORTANT RESPONSE GUIDELINES:
- After using tools, do NOT respond with pleasantries like "Thanks for..." or "Great!"
- Only provide necessary explanations or next steps if relevant to the task
- Keep responses complete and focused on the actual work being done
- If a tool execution completes the user's request, confirm and give a complete explanation of what have been done, then summarize the findings

Current working directory: ${process.cwd()}`,
    };

    // ✅ PURGE ALL old system messages (critical when switching models)
    // Remove all existing system messages to avoid confusion
    const oldSystemCount = this.messages.filter(m => m.role === 'system').length;
    debugLog.log(`🗑️  BEFORE purge: ${oldSystemCount} system message(s), total: ${this.messages.length} messages`);
    
    this.messages = this.messages.filter(m => m.role !== 'system');
    debugLog.log(`🗑️  AFTER purge: ${this.messages.length} messages remaining (no system)`);
    
    // Add the new system message at the beginning
    this.messages.unshift(systemMessage);
    
    const newSystemCount = this.messages.filter(m => m.role === 'system').length;
    debugLog.log(`✅ System message added: model="${currentModel}", now ${newSystemCount} system message(s), total: ${this.messages.length} messages`);
  }

  private async persist(entry: ChatEntry) {
    if (!this.persistSession) return;
    try {
      await appendChatEntry(entry);
    } catch {}
  }

  /**
   * Restore message context from previously saved chat history
   */
  restoreFromHistory(entries: ChatEntry[]): void {
    if (!entries || entries.length === 0) return;
    for (const entry of entries) {
      try {
        if (entry.type === "user") {
          this.messages.push({ role: "user", content: entry.content });
        } else if (entry.type === "assistant") {
          this.messages.push({
            role: "assistant",
            content: entry.content,
            tool_calls: entry.toolCalls as any,
          } as any);
        } else if (entry.type === "tool_result" && entry.toolCall) {
          this.messages.push({
            role: "tool",
            content: entry.content,
            tool_call_id: entry.toolCall.id,
          } as any);
        }
      } catch {}
    }
  }

  private async initializeMCP(): Promise<void> {
    // Initialize MCP in the background without blocking
    Promise.resolve().then(async () => {
      try {
        const config = loadMCPConfig();
        if (config.servers.length > 0) {
          await initializeMCPServers();
        }
      } catch (error) {
        console.warn("MCP initialization failed:", error);
      } finally {
        this.mcpInitialized = true;
      }
    });
  }

  private isGrokModel(): boolean {
    const currentModel = this.grokClient.getCurrentModel();
    return currentModel.toLowerCase().includes("grok");
  }

  // Heuristic: enable web search only when likely needed
  private shouldUseSearchFor(message: string): boolean {
    const q = message.toLowerCase();
    const keywords = [
      "today",
      "latest",
      "news",
      "trending",
      "breaking",
      "current",
      "now",
      "recent",
      "x.com",
      "twitter",
      "tweet",
      "what happened",
      "as of",
      "update on",
      "release notes",
      "changelog",
      "price",
    ];
    if (keywords.some((k) => q.includes(k))) return true;
    // crude date pattern (e.g., 2024/2025) may imply recency
    if (/(20\d{2})/.test(q)) return true;
    return false;
  }

  async processUserMessage(message: string): Promise<ChatEntry[]> {
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    await this.persist(userEntry);
    this.messages.push({ role: "user", content: message });

    const newEntries: ChatEntry[] = [userEntry];
    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;

    try {
      const tools = await getAllGrokTools();
      let currentResponse = await this.grokClient.chat(
        this.messages,
        tools,
        undefined,
        this.isGrokModel() && this.shouldUseSearchFor(message)
          ? { search_parameters: { mode: "auto" } }
          : { search_parameters: { mode: "off" } }
      );

      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        const assistantMessage = currentResponse.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response from Grok");
        }

        // Handle tool calls
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          toolRounds++;

          // Add assistant message with tool calls
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "Using tools to help you...",
            timestamp: new Date(),
            toolCalls: assistantMessage.tool_calls,
          };
          this.chatHistory.push(assistantEntry);
          await this.persist(assistantEntry);
          newEntries.push(assistantEntry);

          // Add assistant message to conversation
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          } as any);

          // Create initial tool call entries to show tools are being executed
          assistantMessage.tool_calls.forEach((toolCall) => {
            const toolCallEntry: ChatEntry = {
              type: "tool_call",
              content: "Executing...",
              timestamp: new Date(),
              toolCall: toolCall,
            };
            this.chatHistory.push(toolCallEntry);
            newEntries.push(toolCallEntry);
          });

          // Execute tool calls and update the entries
          for (const toolCall of assistantMessage.tool_calls) {
            const result = await this.executeTool(toolCall);

            // Update the existing tool_call entry with the result
            const entryIndex = this.chatHistory.findIndex(
              (entry) =>
                entry.type === "tool_call" && entry.toolCall?.id === toolCall.id
            );

            if (entryIndex !== -1) {
              const updatedEntry: ChatEntry = {
                ...this.chatHistory[entryIndex],
                type: "tool_result",
                content: result.success
                  ? result.output || "Success"
                  : result.error || "Error occurred",
                toolResult: result,
              };
              this.chatHistory[entryIndex] = updatedEntry;
              await this.persist(updatedEntry);

              // Also update in newEntries for return value
              const newEntryIndex = newEntries.findIndex(
                (entry) =>
                  entry.type === "tool_call" &&
                  entry.toolCall?.id === toolCall.id
              );
              if (newEntryIndex !== -1) {
                newEntries[newEntryIndex] = updatedEntry;
              }
            }

            // Add tool result to messages with proper format (needed for AI context)
            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Get next response - this might contain more tool calls
          currentResponse = await this.grokClient.chat(
            this.messages,
            tools,
            undefined,
            this.isGrokModel() && this.shouldUseSearchFor(message)
              ? { search_parameters: { mode: "auto" } }
              : { search_parameters: { mode: "off" } }
          );
        } else {
          // No more tool calls, add final response
          const finalEntry: ChatEntry = {
            type: "assistant",
            content:
              assistantMessage.content ||
              "I understand, but I don't have a specific response.",
            timestamp: new Date(),
          };
          this.chatHistory.push(finalEntry);
          await this.persist(finalEntry);
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          newEntries.push(finalEntry);
          break; // Exit the loop
        }
      }

      if (toolRounds >= maxToolRounds) {
        const warningEntry: ChatEntry = {
          type: "assistant",
          content:
            "Maximum tool execution rounds reached. Stopping to prevent infinite loops.",
          timestamp: new Date(),
        };
        this.chatHistory.push(warningEntry);
        await this.persist(warningEntry);
        newEntries.push(warningEntry);
      }

      return newEntries;
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      await this.persist(errorEntry);
      return [userEntry, errorEntry];
    }
  }

  private messageReducer(previous: any, item: any): any {
    const reduce = (acc: any, delta: any) => {
      acc = { ...acc };
      for (const [key, value] of Object.entries(delta)) {
        if (acc[key] === undefined || acc[key] === null) {
          acc[key] = value;
          // Clean up index properties from tool calls
          if (Array.isArray(acc[key])) {
            for (const arr of acc[key]) {
              delete arr.index;
            }
          }
        } else if (typeof acc[key] === "string" && typeof value === "string") {
          (acc[key] as string) += value;
        } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
          const accArray = acc[key] as any[];
          for (let i = 0; i < value.length; i++) {
            if (!accArray[i]) accArray[i] = {};
            accArray[i] = reduce(accArray[i], value[i]);
          }
        } else if (typeof acc[key] === "object" && typeof value === "object") {
          acc[key] = reduce(acc[key], value);
        }
      }
      return acc;
    };

    return reduce(previous, item.choices[0]?.delta || {});
  }

  async *processUserMessageStream(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();

    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    await this.persist(userEntry);
    this.messages.push({ role: "user", content: message });

    // Calculate input tokens
    let inputTokens = this.tokenCounter.countMessageTokens(
      this.messages as any
    );
    yield {
      type: "token_count",
      tokenCount: inputTokens,
    };

    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;
    let totalOutputTokens = 0;
    let lastTokenUpdate = 0;

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        // Check if operation was cancelled
        if (this.abortController?.signal.aborted) {
          yield {
            type: "content",
            content: "\n\n[Operation cancelled by user]",
          };
          yield { type: "done" };
          return;
        }

        // Stream response and accumulate
        const tools = await getAllGrokTools();
        const stream = this.grokClient.chatStream(
          this.messages,
          tools,
          undefined,
          this.isGrokModel() && this.shouldUseSearchFor(message)
            ? { search_parameters: { mode: "auto" } }
            : { search_parameters: { mode: "off" } }
        );
        let accumulatedMessage: any = {};
        let accumulatedContent = "";
        let bufferedContent = "";
        let lastContentFlush = 0;
        let toolCallsYielded = false;

        for await (const chunk of stream) {
          // Check for cancellation in the streaming loop
          if (this.abortController?.signal.aborted) {
            yield {
              type: "content",
              content: "\n\n[Operation cancelled by user]",
            };
            yield { type: "done" };
            return;
          }

          if (!chunk.choices?.[0]) continue;

          // Accumulate the message using reducer
          accumulatedMessage = this.messageReducer(accumulatedMessage, chunk);

          // Check for tool calls - yield when we have complete tool calls with function names
          if (!toolCallsYielded && accumulatedMessage.tool_calls?.length > 0) {
            // Check if we have at least one complete tool call with a function name
            const hasCompleteTool = accumulatedMessage.tool_calls.some(
              (tc: any) => tc.function?.name
            );
            if (hasCompleteTool) {
              yield {
                type: "tool_calls",
                toolCalls: accumulatedMessage.tool_calls,
              };
              toolCallsYielded = true;
            }
          }

          // Stream content as it comes (buffered to reduce flicker)
          if (chunk.choices[0].delta?.content) {
                  const deltaText = chunk.choices[0].delta.content;
            bufferedContent += deltaText;

            const now = Date.now();
            if (now - lastContentFlush > 500 || bufferedContent.length > 2000) {
              // Flush buffered content in batches
              yield { type: "content", content: bufferedContent };
              accumulatedContent += bufferedContent;
              bufferedContent = "";
              lastContentFlush = now;

              // Update token count in real-time including accumulated content and any tool calls
              const currentOutputTokens =
                this.tokenCounter.estimateStreamingTokens(accumulatedContent) +
                (accumulatedMessage.tool_calls
                  ? this.tokenCounter.countTokens(
                      JSON.stringify(accumulatedMessage.tool_calls)
                    )
                  : 0);
              totalOutputTokens = currentOutputTokens;

              // Emit token count update (throttled)
              if (now - lastTokenUpdate > 2500) {
                lastTokenUpdate = now;
                yield {
                  type: "token_count",
                  tokenCount: inputTokens + totalOutputTokens,
                };
              }
            }
          }
      }

        // Final content flush after stream completes
        if (bufferedContent) {
          yield { type: "content", content: bufferedContent };
          accumulatedContent += bufferedContent;
          bufferedContent = "";
        }

        // Add assistant entry to history
        const assistantEntry: ChatEntry = {
          type: "assistant",
          content: accumulatedMessage.content || "Using tools to help you...",
          timestamp: new Date(),
          toolCalls: accumulatedMessage.tool_calls || undefined,
        };
        this.chatHistory.push(assistantEntry);
        await this.persist(assistantEntry);

        // Add accumulated message to conversation
        this.messages.push({
          role: "assistant",
          content: accumulatedMessage.content || "",
          tool_calls: accumulatedMessage.tool_calls,
        } as any);

        // Handle tool calls if present
        if (accumulatedMessage.tool_calls?.length > 0) {
          toolRounds++;

          // Only yield tool_calls if we haven't already yielded them during streaming
          if (!toolCallsYielded) {
            yield {
              type: "tool_calls",
              toolCalls: accumulatedMessage.tool_calls,
            };
          }

          // Execute tools
          for (const toolCall of accumulatedMessage.tool_calls) {
            // Check for cancellation before executing each tool
            if (this.abortController?.signal.aborted) {
              yield {
                type: "content",
                content: "\n\n[Operation cancelled by user]",
              };
              yield { type: "done" };
              return;
            }

            const result = await this.executeTool(toolCall);

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            this.chatHistory.push(toolResultEntry);
            await this.persist(toolResultEntry);

            yield {
              type: "tool_result",
              toolCall,
              toolResult: result,
            };

            // Add tool result with proper format (needed for AI context)
            // ✅ For Mistral: include "name" field (required by their API)
            const toolMessage: any = {
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            };
            
            // Add "name" field for Mistral (required by their API spec)
            const currentProvider = providerManager.detectProvider(this.grokClient.getCurrentModel());
            if (currentProvider === 'mistral') {
              toolMessage.name = toolCall.function.name;
            }
            
            this.messages.push(toolMessage);
          }

          // Update token count after processing all tool calls to include tool results
          inputTokens = this.tokenCounter.countMessageTokens(
            this.messages as any
          );
          // Final token update after tools processed
          yield {
            type: "token_count",
            tokenCount: inputTokens + totalOutputTokens,
          };

          // Continue the loop to get the next response (which might have more tool calls)
        } else {
          // No tool calls, we're done
          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        yield {
          type: "content",
          content:
            "\n\nMaximum tool execution rounds reached. Stopping to prevent infinite loops.",
        };
      }

      yield { type: "done" };
    } catch (error: any) {
      // Check if this was a cancellation
      if (this.abortController?.signal.aborted) {
        yield {
          type: "content",
          content: "\n\n[Operation cancelled by user]",
        };
        yield { type: "done" };
        return;
      }

      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      await this.persist(errorEntry);
      yield {
        type: "content",
        content: errorEntry.content,
      };
      yield { type: "done" };
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  private async executeTool(toolCall: GrokToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolCall.function.name) {
        case "view_file":
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);

        case "create_file":
          return await this.textEditor.create(args.path, args.content);

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str,
            args.replace_all
          );

        case "edit_file":
          if (!this.morphEditor) {
            return {
              success: false,
              error:
                "Morph Fast Apply not available. Please set MORPH_API_KEY environment variable to use this feature.",
            };
          }
          return await this.morphEditor.editFile(
            args.target_file,
            args.instructions,
            args.code_edit
          );

        case "bash":
          return await this.bash.execute(args.command);

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        case "search":
          return await this.search.search(args.query, {
            searchType: args.search_type,
            includePattern: args.include_pattern,
            excludePattern: args.exclude_pattern,
            caseSensitive: args.case_sensitive,
            wholeWord: args.whole_word,
            regex: args.regex,
            maxResults: args.max_results,
            fileTypes: args.file_types,
            includeHidden: args.include_hidden,
          });
        case "apply_patch":
          if (!this.applyPatch) {
            const mod = await import("../tools/apply-patch.js");
            this.applyPatch = new mod.ApplyPatchTool();
          }
          return await this.applyPatch.apply(args.patch, !!args.dry_run);

        default:
          // Check if this is an MCP tool
          if (toolCall.function.name.startsWith("mcp__")) {
            return await this.executeMCPTool(toolCall);
          }

          return {
            success: false,
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  private async executeMCPTool(toolCall: GrokToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const mcpManager = getMCPManager();

      const result = await mcpManager.callTool(toolCall.function.name, args);

      if (result.isError) {
        return {
          success: false,
          error: (result.content[0] as any)?.text || "MCP tool error",
        };
      }

      // Extract content from result
      const output = result.content
        .map((item) => {
          if (item.type === "text") {
            return item.text;
          } else if (item.type === "resource") {
            return `Resource: ${item.resource?.uri || "Unknown"}`;
          }
          return String(item);
        })
        .join("\n");

      return {
        success: true,
        output: output || "Success",
      };
    } catch (error: any) {
      return {
        success: false,
        error: `MCP tool execution error: ${error.message}`,
      };
    }
  }

  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }

  getCurrentModel(): string {
    return this.grokClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.grokClient.setModel(model);
    // Update token counter for new model
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
    // Persist state (best-effort)
    saveState({ version: 1, model, cwd: process.cwd() }).catch(() => {});
  }
  
  // ✅ NEW: Get API key
  getApiKey(): string {
    return this.grokClient.getApiKey();
  }
  
  // ✅ NEW: Switch to different model with new API key and baseURL
  // Used when changing providers (e.g., Grok → Claude)
  async switchToModel(model: string, apiKey: string, baseURL: string): Promise<string> {
    debugLog.log(`🔧 GrokAgent.switchToModel: model=${model}, baseURL=${baseURL}, apiKey=${apiKey.slice(0,10)}...`);
    
    // Recreate client with new config
    this.grokClient = new GrokClient(apiKey, model, baseURL);
    
    debugLog.log(`✅ GrokClient recreated with baseURL=${baseURL}`);
    
    // Update token counter
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
    
    // Update system message with new model name
    this.updateSystemMessage();
    debugLog.log(`✅ System message updated for model=${model}`);
    
    // Update session manager
    const provider = providerManager.detectProvider(model) || 'grok';
    sessionManager.switchProvider(provider, model, apiKey);
    
    debugLog.log(`✅ Session manager updated for provider=${provider}`);
    
    // ✅ NEW: Identity check (isolated message, no history)
    try {
      debugLog.log(`🔍 Sending identity check to model...`);
      
      const identityResponse = await this.grokClient.chat(
        [{ role: "user", content: "In one short sentence, what is your exact model name and provider?" }],
        [], // No tools
        undefined, // Use current model
        undefined  // No search
      );
      
      const aiSays = identityResponse.choices[0]?.message?.content || "No response";
      const apiReturned = identityResponse.model || model;
      
      debugLog.log(`✅ AI says: "${aiSays}"`);
      debugLog.log(`📝 API returned: ${apiReturned}`);
      
      // Return formatted identity info
      return `🤖 AI Response: "${aiSays}"\n📋 API Metadata: ${apiReturned}`;
      
    } catch (error) {
      debugLog.log(`⚠️  Identity check failed:`, error);
      return `⚠️  Identity check failed, but connection established`;
    }
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Detect provider from baseURL
   */
  private detectProvider(baseURL?: string): string {
    if (!baseURL) return 'grok';
    
    if (baseURL.includes('anthropic')) return 'claude';
    if (baseURL.includes('openai')) return 'openai';
    if (baseURL.includes('mistral')) return 'mistral';
    if (baseURL.includes('deepseek')) return 'deepseek';
    if (baseURL.includes('x.ai')) return 'grok';
    
    return 'grok'; // default
  }

  /**
   * Switch to a different provider/API key
   */
  switchProvider(provider: string, apiKey: string, model?: string) {
    // Detect baseURL from provider
    const baseUrls: Record<string, string> = {
      grok: 'https://api.x.ai/v1',
      claude: 'https://api.anthropic.com/v1',
      openai: 'https://api.openai.com/v1',
      mistral: 'https://api.mistral.ai/v1',
      deepseek: 'https://api.deepseek.com/v1',
    };

    const baseURL = baseUrls[provider] || baseUrls.grok;
    
    // ✅ CORRECTED: Use priority chain instead of hardcoded fallback
    const manager = getSettingsManager();
    const projectModel = manager.getProjectSetting("model");
    const userDefault = manager.getCurrentModel();
    const systemDefault = "grok-code-fast-1";
    
    const modelToUse = model || projectModel || userDefault || systemDefault;

    // Update client
    this.grokClient = new GrokClient(apiKey, modelToUse, baseURL);
    
    // Update session manager
    sessionManager.switchProvider(provider, modelToUse, apiKey);
    
    debugLog.log(`✅ Switched to ${provider} (${modelToUse})`);
  }
}
