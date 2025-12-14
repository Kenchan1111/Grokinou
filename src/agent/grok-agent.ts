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
import { getLLMHook } from "../timeline/hooks/llm-hook.js";
import { getToolHook } from "../timeline/hooks/tool-hook.js";
import { executionManager, ExecutionStream } from "../execution/index.js";
import { loadSystemPrompt } from "./prompt-loader.js";

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
  private llmHook = getLLMHook();
  private toolHook = getToolHook();
  private currentExecutionStream: ExecutionStream | null = null;

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
    // Note: This is async but we don't await it in constructor
    // The promise will resolve before user sends first message
    this.updateSystemMessage().catch((error) => {
      debugLog.log(`⚠️ Failed to load system prompt: ${error}`);
    });
  }

  /**
   * Update system message with current model name
   * Called during initialization and when switching models
   */
  private async updateSystemMessage(): Promise<void> {
    const customInstructions = loadCustomInstructions();
    const currentModel = this.grokClient.getCurrentModel();

    // Load system prompt from external file
    let promptContent: string;
    try {
      promptContent = await loadSystemPrompt({
        language: 'en', // TODO: Make this configurable
        variant: 'default',
        customInstructions: customInstructions,
      });
    } catch (error) {
      debugLog.log(`⚠️ Failed to load external prompt: ${error}`);
      // Fallback handled by loadSystemPrompt
      promptContent = await loadSystemPrompt({ customInstructions });
    }

    // Add model identity and working directory
    const modelIdentity = `You are ${currentModel}.\n\n`;
    const workingDir = `\n\nCurrent working directory: ${process.cwd()}`;

    const systemMessage = {
      role: "system" as const,
      content: modelIdentity + promptContent + workingDir,
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

  /**
   * Format a concise, user-facing summary of a tool result for the conversation.
   * Avoids dumping full file contents or long outputs into the chat history.
   */
  private formatToolResultSummary(
    toolCall: GrokToolCall,
    result: ToolResult
  ): string {
    const raw =
      (result.success ? result.output || "Success" : result.error || "Error occurred") ||
      "";

    let args: any = {};
    try {
      args = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      // Ignore parse errors, fall back to raw
    }

    switch (toolCall.function.name) {
      case "view_file": {
        const path = args.path || "unknown path";
        const hasRange = args.start_line && args.end_line;
        const range =
          hasRange && typeof args.start_line === "number" && typeof args.end_line === "number"
            ? ` (lines ${args.start_line}-${args.end_line})`
            : "";

        if (result.success && result.output) {
          const lineCount = result.output.split("\n").length;
          return `view_file: ${path}${range} — ${lineCount} lines read (details in viewer/logs)`;
        }

        return `view_file: ${path}${range} — error: ${result.error || "unknown error"}`;
      }

      case "search": {
        const query = args.query || "";
        // Use only the first line of output as a compact summary
        const firstLine = raw.split("\n").find((l) => l.trim().length > 0) || raw || "No results";
        return `search("${query}") — ${firstLine}`;
      }

      default: {
        // For errors (including user rejection feedback), show the full message
        // For success, use only first non-empty line to avoid flooding the chat
        if (!result.success) {
          return `${toolCall.function.name}: ${raw}`;
        }
        const firstLine = raw.split("\n").find((l) => l.trim().length > 0) || raw || "Success";
        return `${toolCall.function.name}: ${firstLine}`;
      }
    }
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
        // ✅ FIX: Add to chatHistory for UI display
        this.chatHistory.push(entry);

        // Add to messages for API context
        if (entry.type === "user") {
          this.messages.push({ role: "user", content: entry.content });
        } else if (entry.type === "assistant") {
          // ✅ FIX: Ensure tool_calls is array or undefined (not string)
          let toolCalls = entry.toolCalls;
          if (toolCalls && typeof toolCalls === 'string') {
            try {
              toolCalls = JSON.parse(toolCalls);
            } catch {
              toolCalls = undefined;
            }
          }

          // Validate tool_calls structure (must have valid type field)
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            toolCalls = toolCalls.filter((tc: any) => {
              // Each tool call must have: id, type="function", function.name, function.arguments
              return tc &&
                     tc.id &&
                     tc.type === 'function' &&
                     tc.function &&
                     tc.function.name &&
                     typeof tc.function.arguments === 'string';
            });
            // If all tool_calls were invalid, treat as empty array
            if (toolCalls.length === 0) {
              toolCalls = [];
            }
          }

          // Include tool_calls if it's an array (even if empty)
          // Empty array has semantic meaning: "I'm done using tools"
          const message: any = {
            role: "assistant",
            content: entry.content,
          };
          if (Array.isArray(toolCalls)) {
            message.tool_calls = toolCalls;
          }
          this.messages.push(message);
        } else if (entry.type === "tool_result" && entry.toolCall) {
          // ✅ STRICT VALIDATION: Tool message MUST have assistant with tool_calls immediately before
          // This prevents loading corrupted data from database
          const lastMessage = this.messages[this.messages.length - 1];

          if (!lastMessage ||
              lastMessage.role !== 'assistant' ||
              !(lastMessage as any).tool_calls ||
              (lastMessage as any).tool_calls.length === 0) {
            // ❌ Orphaned tool message - skip it to prevent API errors
            console.warn(`⚠️  [Restore] Skipping orphaned tool message (tool_call_id: ${entry.toolCall.id})`);
            console.warn(`   Last message was: ${lastMessage ? lastMessage.role : 'none'}`);
            continue; // Skip this tool message
          }

          // ✅ Valid: previous message is assistant with tool_calls
          // For Mistral: include "name" field (required by their API)
          const toolMessage: any = {
            role: "tool",
            content: entry.content,
            tool_call_id: entry.toolCall.id,
          };

          // Add "name" field for Mistral (required by their API spec)
          const currentProvider = providerManager.detectProvider(this.grokClient.getCurrentModel());
          if (currentProvider === 'mistral') {
            toolMessage.name = entry.toolCall.function?.name || 'unknown';
          }

          this.messages.push(toolMessage);
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

  private buildSummaryPrompt(lastUserMessage: string): string {
    return [
      "Tu dois maintenant FORMULER une RÉPONSE FINALE pour l’utilisateur, en français clair et naturel.",
      "",
      `Dernière question de l’utilisateur : "${lastUserMessage}"`,
      "",
      "Rédige UNE SEULE réponse structurée qui :",
      "- Analyse le problème posé par l’utilisateur à partir du contexte dont tu disposes (code, configuration, comportement observé, etc.).",
      "- Explique ce que fait le système actuellement et pourquoi il se comporte ainsi.",
      "- Propose des pistes d’amélioration concrètes, en restant au niveau conceptuel (pas besoin de donner tout le code exact).",
      "- Termine par un court paragraphe de synthèse avec les points clés et les prochaines étapes suggérées.",
      "",
      "CONTRAINTES IMPORTANTES :",
      "- Ne parle PAS des outils que tu as utilisés (view_file, bash, search, etc.).",
      "- Ne décris PAS ton processus interne, ton raisonnement étape par étape ou ton \"plan\".",
      "- Ne dis PAS \"j’utilise les outils\" ou \"je vais\" : écris directement la réponse comme si tu expliquais le résultat final à un humain.",
      "- Ne repose PAS la question à l’utilisateur.",
      "- Ne commence PAS par \"Plan:\" et ne fournis PAS de todo list.",
      "- Contente-toi de donner ton analyse, tes explications et tes recommandations finales."
    ].join("\n");
  }

  /**
   * Build a human-readable "reasoning summary" block from raw summary content.
   * This mirrors Codex's ReasoningSummaryCell: header + attenuated body.
   */
  private buildReasoningSummaryBlock(content: string): string {
    const header = "🧠 Reasoning summary (approximate, based on visible tools/logs)\n\n";
    return header + content.trim();
  }

  /**
   * Generate a fallback summary based on tool calls in chat history
   * Used when LLM fails to generate a summary
   */
  private generateFallbackSummary(userMessage: string): string {
    // Find tool calls from history (unlimited)
    const recentToolCalls = this.chatHistory
      .filter(entry => entry.type === 'tool_call' || entry.type === 'tool_result');
      // No limit - keep full tool call history for complete traceability

    if (recentToolCalls.length === 0) {
      return `J'ai traité votre demande : "${userMessage}"\n\nMalheureusement, je n'ai pas pu générer un résumé détaillé de mes actions. Veuillez consulter l'historique des outils ci-dessus pour plus de détails.`;
    }

    // Group by tool name
    const toolUsage = new Map<string, number>();
    recentToolCalls.forEach(entry => {
      if (entry.toolCall) {
        const toolName = entry.toolCall.function.name;
        toolUsage.set(toolName, (toolUsage.get(toolName) || 0) + 1);
      }
    });

    // Build summary
    const toolsList = Array.from(toolUsage.entries())
      .map(([tool, count]) => `• ${tool} (${count}×)`)
      .join('\n');

    return `Pour répondre à votre question : "${userMessage}"\n\nJ'ai utilisé les outils suivants :\n${toolsList}\n\n⚠️ Note : Le modèle n'a pas pu générer un résumé textuel détaillé. Les résultats des outils sont visibles dans l'historique ci-dessus et dans l'Execution Viewer (Ctrl+E).`;
  }

  /**
   * Generate reasoning summary text only (no persistence, no ChatEntry).
   * Used by both streaming and non-streaming paths.
   */
  private async generateSummaryText(lastUserMessage: string): Promise<string | null> {
    try {
      const prompt = this.buildSummaryPrompt(lastUserMessage);
      const summaryMessages: GrokMessage[] = [
        { role: "user", content: prompt }
      ];

      const response = await this.grokClient.chat(
        summaryMessages,
        [],
        undefined,
        { search_parameters: { mode: "off" } }
      );

      const content = response.choices?.[0]?.message?.content?.trim();
      if (!content) {
        debugLog.log("⚠️  Primary summary returned empty content, trying simplified backup prompt");

        // Backup attempt: simpler prompt focused only on the user's question
        const backupPrompt = [
          `Voici la question de l'utilisateur :`,
          `"${lastUserMessage}"`,
          "",
          "Même si tu n'as pas accès à tous les détails internes, donne une réponse claire en français qui :",
          "- Analyse le problème posé par l'utilisateur avec les informations dont tu disposes.",
          "- Propose des pistes d'amélioration ou d'investigation.",
          "",
          "IMPORTANT :",
          "- Ne parle PAS des outils que tu utilises.",
          "- Ne décris PAS ton processus interne.",
          "- Ne repose PAS la question à l'utilisateur.",
        ].join("\n");

        const backupResponse = await this.grokClient.chat(
          [{ role: "user", content: backupPrompt }],
          [],
          undefined,
          { search_parameters: { mode: "off" } }
        );

        const backupContent = backupResponse.choices?.[0]?.message?.content?.trim();
        if (!backupContent) {
          return null;
        }

        return backupContent;
      }

      return content;
    } catch (error: any) {
      debugLog.log("⚠️  Summary phase failed:", error?.message || String(error));
      return null;
    }
  }

  /**
   * Generate and persist a reasoning summary block as a ChatEntry.
   * Non-streaming path uses this directly; streaming path uses generateSummaryText
   * and manages persistence separately when needed.
   */
  private async generateAndAppendSummary(lastUserMessage: string): Promise<ChatEntry | null> {
    try {
      let content = await this.generateSummaryText(lastUserMessage);

      // If LLM failed to generate summary, use fallback
      if (!content) {
        debugLog.log("⚠️  Summary text generation returned empty content - using fallback");
        content = this.generateFallbackSummary(lastUserMessage);
      }

      const wrapped = this.buildReasoningSummaryBlock(content);

      const entry: ChatEntry = {
        type: "assistant",
        content: wrapped,
        timestamp: new Date(),
      };

      this.chatHistory.push(entry);
      await this.persist(entry);

      return entry;
    } catch (error: any) {
      debugLog.log("⚠️  Summary phase failed:", error?.message || String(error));
      return null;
    }
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
    
    // 🕐 Timeline: Capture user message
    try {
      const session = sessionManager.getCurrentSession();
      debugLog.log(`📊 [LLM Timeline] User message capture - Session: ${session?.id ?? 'NULL'}, Message length: ${message.length}`);
      if (session) {
        await this.llmHook.captureUserMessage(
          message,
          session.id,
          this.grokClient.getCurrentModel(),
          providerManager.detectProvider(this.grokClient.getCurrentModel())
        );
        debugLog.log(`✅ [LLM Timeline] User message captured successfully - Session: ${session.id}`);
      } else {
        debugLog.log('⚠️  [LLM Timeline] SKIPPED: No current session');
      }
    } catch (error) {
      // Don't fail the request if timeline logging fails
      debugLog.log('⚠️  Timeline logging failed for user message:', error);
    }

    const newEntries: ChatEntry[] = [userEntry];
    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;
    let hadToolCalls = false;
    let finalAssistantContent = "";

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
          hadToolCalls = true;

          // Add assistant message to conversation (for API)
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          } as any);

          // ✅ FIRST: Create and add tool call entries (tools appear first in history)
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

          // ✅ THEN: Add assistant message after tools (appears after tools in history)
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "",  // ✅ Empty string instead of placeholder
            timestamp: new Date(),
            toolCalls: assistantMessage.tool_calls,
          };
          this.chatHistory.push(assistantEntry);
          await this.persist(assistantEntry);
          newEntries.push(assistantEntry);

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
                content: this.formatToolResultSummary(toolCall, result),
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
          finalAssistantContent = assistantMessage.content || "";
          this.chatHistory.push(finalEntry);
          await this.persist(finalEntry);
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          newEntries.push(finalEntry);
          
          // 🕐 Timeline: Capture assistant message
          try {
            const session = sessionManager.getCurrentSession();
            const contentLength = (assistantMessage.content || "").length;
            debugLog.log(`📊 [LLM Timeline] Assistant message capture - Session: ${session?.id ?? 'NULL'}, Content length: ${contentLength}`);
            if (session) {
              await this.llmHook.captureAssistantMessage(
                assistantMessage.content || "",
                session.id,
                this.grokClient.getCurrentModel(),
                providerManager.detectProvider(this.grokClient.getCurrentModel())
              );
              debugLog.log(`✅ [LLM Timeline] Assistant message captured successfully - Session: ${session.id}`);
            } else {
              debugLog.log('⚠️  [LLM Timeline] SKIPPED: No current session');
            }
          } catch (error) {
            debugLog.log('⚠️  Timeline logging failed for assistant message:', error);
          }
          
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

      const contentTrimmed = finalAssistantContent.trim();

      // Skip synthèse pour le placeholder par défaut (GPT-5/o1)
      if (contentTrimmed === "Using tools to help you...") {
        debugLog.log("⏭️  Skipping summary (placeholder message, waiting for streaming completion)");
        return newEntries;
      }

      // Générer synthèse si :
      // - Réponse vide
      // - Réponse trop courte (< 150 caractères)
      // - ET seulement pour les reasoning models (o1/o3), PAS GPT-5
      const needsSummary =
        (!contentTrimmed || contentTrimmed.length < 150) &&
        this.grokClient.isReasoningModel();

      if (needsSummary) {
        debugLog.log("⚠️  Generating summary (insufficient LLM response detected)");
        const summaryEntry = await this.generateAndAppendSummary(message);
        if (summaryEntry) {
          newEntries.push(summaryEntry);
        }
      } else {
        debugLog.log("✅ LLM provided sufficient response, skipping summary");
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
      newEntries.push(errorEntry);
      
      // 🕐 Timeline: Capture LLM error
      try {
        const session = sessionManager.getCurrentSession();
        if (session) {
          await this.llmHook.captureError(
            error,
            session.id,
            this.grokClient.getCurrentModel(),
            providerManager.detectProvider(this.grokClient.getCurrentModel())
          );
          }
      } catch (timelineError) {
        debugLog.log('⚠️  Timeline logging failed for LLM error:', timelineError);
      }

      return newEntries;
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

    // ✅ Removed hardcoded greeting response - LLM will respond naturally
    // Identity check is already implemented in switchToModel() with server verification

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
    let hadToolCalls = false;
    let finalAssistantContent = "";

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
            hadToolCalls = true;
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
          content: accumulatedMessage.content || "",  // ✅ Empty string instead of placeholder
          timestamp: new Date(),
          toolCalls: accumulatedMessage.tool_calls || undefined,
        };
        finalAssistantContent = accumulatedMessage.content || "";
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
              content: this.formatToolResultSummary(toolCall, result),
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

      const contentTrimmed = finalAssistantContent.trim();

      // Skip synthèse pour le placeholder par défaut (GPT-5/o1)
      if (contentTrimmed === "Using tools to help you...") {
        debugLog.log("⏭️  Skipping summary (placeholder message, waiting for streaming completion)");
        yield { type: "done" };
        return;
      }

      // Générer synthèse si :
      // - Réponse vide
      // - Réponse trop courte (< 150 caractères)
      // - ET seulement pour les reasoning models (o1/o3), PAS GPT-5
      const needsSummary =
        (!contentTrimmed || contentTrimmed.length < 150) &&
        this.grokClient.isReasoningModel();

      if (needsSummary) {
        debugLog.log("⚠️  Generating summary (insufficient LLM response detected)");
        // Inform the user that a reasoning summary is being generated
        yield {
          type: "content",
          content: "\n\n[Generating reasoning summary based on tool usage…]",
        };

        let summaryText = await this.generateSummaryText(message);

        // If LLM failed to generate summary, use fallback
        if (!summaryText) {
          debugLog.log("⚠️  Summary text generation returned empty content - using fallback");
          summaryText = this.generateFallbackSummary(message);
        }

        const wrapped = this.buildReasoningSummaryBlock(summaryText);

        // Persist reasoning summary block for session history
        const summaryEntry: ChatEntry = {
          type: "assistant",
          content: wrapped,
          timestamp: new Date(),
        };
        this.chatHistory.push(summaryEntry);
        await this.persist(summaryEntry);

        // Stream the reasoning summary block to the UI
        yield {
          type: "content",
          content: "\n\n" + wrapped,
        };
      } else {
        debugLog.log("✅ LLM provided sufficient response, skipping summary");
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
    const startTime = Date.now();
    let startEventId: string = '';

    // 🛡️ DEFENSE: Clean corrupted tool names
    // Attack patterns:
    //   1. "bashbashbashbashbashbashbashview_file" (repetition + tool)
    //   2. "bashview_file" (2 tools concatenated)
    //   3. "bashedit_file" (2 tools concatenated)
    // Valid tools from tools.ts + internal tools
    const validTools = [
      // File operations
      'view_file', 'create_file', 'str_replace_editor', 'edit_file', 'apply_patch',
      // System operations
      'bash', 'search',
      // Task management
      'create_todo_list', 'update_todo_list',
      // Session management
      'session_list', 'session_switch', 'session_new', 'session_rewind',
      // Timeline/rewind
      'timeline_query', 'rewind_to', 'list_time_points',
      // Identity
      'get_my_identity'
    ];

    let cleanToolName = toolCall.function.name;

    // First check: is it a valid tool as-is?
    // MCP tools have format: mcp__servername__toolname
    const isMCPTool = cleanToolName.startsWith('mcp__');

    if (!isMCPTool && !validTools.includes(cleanToolName)) {
      // Check if it's a concatenation of valid tools
      // Pattern: starts with any valid tool name
      const toolsPattern = validTools.join('|');

      // Try to match: (validTool1)(validTool2)...
      // We want the LAST valid tool in the chain
      const match = cleanToolName.match(new RegExp(`(${toolsPattern})$`));

      if (match) {
        const originalName = cleanToolName;
        cleanToolName = match[1];
        debugLog.log(`🛡️ [DEFENSE] Cleaned concatenated tool name: "${originalName}" → "${cleanToolName}"`);

        // Also log what was removed (for forensics)
        const removed = originalName.substring(0, originalName.length - cleanToolName.length);
        debugLog.log(`🛡️ [DEFENSE] Removed prefix: "${removed}"`);

        // Update the toolCall object
        toolCall.function.name = cleanToolName;
      } else {
        // Completely unknown tool name - log for forensics
        debugLog.log(`⚠️ [DEFENSE] Unknown tool name (no valid tool found): "${cleanToolName}"`);
      }
    }

    // 📺 ExecutionViewer: Create execution stream
    const executionStream = executionManager.createExecution(toolCall.function.name);
    this.currentExecutionStream = executionStream;

    // 📺 COT: Initial thinking
    executionStream.emitCOT('thinking', `Executing tool: ${toolCall.function.name}`);
    
    // 🕐 Timeline: Capture tool call started
    try {
      const session = sessionManager.getCurrentSession();
      if (session) {
        const args = JSON.parse(toolCall.function.arguments);
        startEventId = await this.toolHook.captureToolCallStarted(
          toolCall.function.name,
          args,
          session.id
        );
      }
    } catch (error) {
      debugLog.log('⚠️  Timeline logging failed for tool start:', error);
    }
    
    try {
      // 🐛 DEBUG: Log raw arguments BEFORE parsing to diagnose JSON errors
      let rawArgs = toolCall.function.arguments;
      debugLog.log(`🔍 [DEBUG] Tool: ${toolCall.function.name}`);
      debugLog.log(`🔍 [DEBUG] Raw arguments (length ${rawArgs.length}):`, rawArgs);
      debugLog.log(`🔍 [DEBUG] First 100 chars:`, rawArgs.substring(0, 100));
      debugLog.log(`🔍 [DEBUG] Last 100 chars:`, rawArgs.substring(Math.max(0, rawArgs.length - 100)));

      // 🛡️ DEFENSE: Clean malformed JSON before parsing
      // GPT-5 attack: Adds extra text after valid JSON (position 24+)
      // Example: {"path":"file.txt"} extra garbage text
      try {
        // Try to find the end of the first valid JSON object/array
        let cleanedArgs = rawArgs.trim();

        // Find first complete JSON structure
        let depth = 0;
        let inString = false;
        let escape = false;
        let firstChar = cleanedArgs[0];
        let closingChar = firstChar === '{' ? '}' : (firstChar === '[' ? ']' : null);

        if (closingChar) {
          for (let i = 0; i < cleanedArgs.length; i++) {
            const char = cleanedArgs[i];

            if (escape) {
              escape = false;
              continue;
            }

            if (char === '\\') {
              escape = true;
              continue;
            }

            if (char === '"' && !escape) {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === firstChar) depth++;
              if (char === closingChar) {
                depth--;
                if (depth === 0) {
                  // Found complete JSON, truncate here
                  const truncated = cleanedArgs.substring(0, i + 1);
                  if (truncated !== cleanedArgs) {
                    debugLog.log(`🛡️ [DEFENSE] Truncated malformed JSON from ${cleanedArgs.length} to ${truncated.length} chars`);
                    debugLog.log(`🛡️ [DEFENSE] Removed garbage:`, cleanedArgs.substring(i + 1));
                    rawArgs = truncated;
                  }
                  break;
                }
              }
            }
          }
        }
      } catch (cleanError) {
        // If cleaning fails, continue with original (will fail in JSON.parse)
        debugLog.log(`⚠️ [DEFENSE] JSON cleaning failed:`, cleanError);
      }

      const args = JSON.parse(rawArgs);

      // 📺 COT: Action with arguments
      const argsPreview = JSON.stringify(args, null, 2).substring(0, 200);
      executionStream.emitCOT('action', `Arguments: ${argsPreview}${argsPreview.length >= 200 ? '...' : ''}`);

      let result: ToolResult;
      
      switch (toolCall.function.name) {
        case "view_file":
          // 📺 COT: Reading file
          executionStream.emitCOT('thinking', `Reading file: ${args.path}`);
          executionStream.emitCOT('action', `Opening file for reading`);
          
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          
          if (range) {
            executionStream.emitCOT('action', `Reading lines ${range[0]}-${range[1]}`);
          }
          
          result = await this.textEditor.view(args.path, range);
          
          // 📺 COT: Observation with file stats
          if (result.success) {
            const lineCount = result.output?.split('\n').length || 0;
            const charCount = result.output?.length || 0;
            executionStream.emitCOT('observation', `Read ${lineCount} lines, ${charCount} characters`);
            executionStream.emitCOT('decision', `File content retrieved successfully`);
          } else {
            executionStream.emitCOT('observation', `Failed to read file: ${result.error}`);
            executionStream.emitCOT('decision', `File reading failed`);
          }
          break;

        case "create_file":
          // 📺 COT: Creating file
          executionStream.emitCOT('thinking', `Creating new file: ${args.path}`);
          executionStream.emitCOT('action', `Writing ${args.content?.length || 0} characters to file`);

          result = await this.textEditor.create(args.path, args.content);

          // 📺 COT: Observation with result
          if (result.success) {
            executionStream.emitCOT('observation', `File created successfully at ${args.path}`);
            executionStream.emitCOT('decision', `✅ File creation succeeded`);
          } else {
            executionStream.emitCOT('observation', `Failed to create file: ${result.error}`);
            executionStream.emitCOT('decision', `❌ File creation failed`);
          }
          break;

        case "str_replace_editor":
          // 📺 COT: Replacing string in file
          executionStream.emitCOT('thinking', `Editing file: ${args.path}`);
          const replaceMode = args.replace_all ? 'all occurrences' : 'first occurrence';
          executionStream.emitCOT('action', `Replacing ${replaceMode} of "${args.old_str.substring(0, 50)}${args.old_str.length > 50 ? '...' : ''}"`);

          result = await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str,
            args.replace_all
          );

          // 📺 COT: Observation with result
          if (result.success) {
            const changeInfo = result.output ? ` - ${result.output}` : '';
            executionStream.emitCOT('observation', `File edited successfully${changeInfo}`);
            executionStream.emitCOT('decision', `✅ String replacement succeeded`);
          } else {
            executionStream.emitCOT('observation', `Failed to edit file: ${result.error}`);
            executionStream.emitCOT('decision', `❌ String replacement failed`);
          }
          break;

        case "edit_file":
          // 📺 COT: Editing file with Morph
          executionStream.emitCOT('thinking', `Editing file with AI: ${args.target_file}`);
          executionStream.emitCOT('action', `Applying instructions: ${args.instructions.substring(0, 100)}${args.instructions.length > 100 ? '...' : ''}`);

          if (!this.morphEditor) {
            executionStream.emitCOT('observation', `Morph Fast Apply not available`);
            executionStream.emitCOT('decision', `❌ MORPH_API_KEY not set`);
            result = {
              success: false,
              error:
                "Morph Fast Apply not available. Please set MORPH_API_KEY environment variable to use this feature.",
            };
          } else {
            result = await this.morphEditor.editFile(
              args.target_file,
              args.instructions,
              args.code_edit
            );

            // 📺 COT: Observation with result
            if (result.success) {
              executionStream.emitCOT('observation', `AI edit applied successfully`);
              executionStream.emitCOT('decision', `✅ File edited with Morph`);
            } else {
              executionStream.emitCOT('observation', `AI edit failed: ${result.error}`);
              executionStream.emitCOT('decision', `❌ Morph edit failed`);
            }
          }
          break;

        case "bash":
          // 📺 ExecutionViewer: Special handling for bash to capture output streaming
          executionStream.emitCOT('action', `Running command: ${args.command}`);
          executionStream.startCommand(args.command);
          
          result = await this.bash.execute(args.command);
          
          // 📺 Capture stdout lines
          if (result.output) {
            const lines = result.output.split('\n');
            lines.forEach(line => {
              if (line.trim()) {
                executionStream.commandOutput(line);
              }
            });
          }
          
          // 📺 Capture stderr lines separately (if any)
          if (result.stderr) {
            const stderrLines = result.stderr.split('\n');
            stderrLines.forEach(line => {
              if (line.trim()) {
                executionStream.commandOutput(`[STDERR] ${line}`);
              }
            });
          }
          
          // 📺 End command with actual exit code
          executionStream.endCommand(
            result.exitCode || (result.success ? 0 : 1),
            result.error
          );
          
          // 📺 COT with detailed observation
          const hasStderr = result.stderr && result.stderr.length > 0;
          const observation = result.success 
            ? `Command succeeded (${result.output?.split('\n').length || 0} stdout lines${hasStderr ? `, ${result.stderr.split('\n').length} stderr lines` : ''})`
            : `Command failed (exit ${result.exitCode || 1}): ${result.error}`;
          
          executionStream.emitCOT('observation', observation);
          break;

        case "create_todo_list":
          // 📺 COT: Creating todo list
          executionStream.emitCOT('thinking', `Creating todo list with ${args.todos?.length || 0} items`);
          executionStream.emitCOT('action', `Writing todos to list`);

          result = await this.todoTool.createTodoList(args.todos);

          // 📺 COT: Observation with result
          if (result.success) {
            executionStream.emitCOT('observation', `Todo list created with ${args.todos?.length || 0} items`);
            executionStream.emitCOT('decision', `✅ Todo list creation succeeded`);
          } else {
            executionStream.emitCOT('observation', `Failed to create todo list: ${result.error}`);
            executionStream.emitCOT('decision', `❌ Todo list creation failed`);
          }
          break;

        case "update_todo_list":
          // 📺 COT: Updating todo list
          const updateCount = args.updates ? Object.keys(args.updates).length : 0;
          executionStream.emitCOT('thinking', `Updating ${updateCount} todo item(s)`);
          executionStream.emitCOT('action', `Applying updates to todo list`);

          result = await this.todoTool.updateTodoList(args.updates);

          // 📺 COT: Observation with result
          if (result.success) {
            executionStream.emitCOT('observation', `Todo list updated (${updateCount} changes)`);
            executionStream.emitCOT('decision', `✅ Todo list update succeeded`);
          } else {
            executionStream.emitCOT('observation', `Failed to update todo list: ${result.error}`);
            executionStream.emitCOT('decision', `❌ Todo list update failed`);
          }
          break;

        case "search":
          // 📺 COT: Searching
          executionStream.emitCOT('thinking', `Searching for: "${args.query}"`);
          const searchTypeInfo = args.search_type ? ` (${args.search_type})` : '';
          executionStream.emitCOT('action', `Starting search${searchTypeInfo}`);

          result = await this.search.search(args.query, {
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

          // 📺 COT: Observation with results
          if (result.success) {
            const resultCount = result.output?.split('\n').filter(l => l.trim()).length || 0;
            executionStream.emitCOT('observation', `Found ${resultCount} results`);
            executionStream.emitCOT('decision', `✅ Search completed successfully`);
          } else {
            executionStream.emitCOT('observation', `Search failed: ${result.error}`);
            executionStream.emitCOT('decision', `❌ Search failed`);
          }
          break;
        case "apply_patch":
          // 📺 COT: Applying patch
          const isDryRun = !!args.dry_run;
          executionStream.emitCOT('thinking', `Applying patch${isDryRun ? ' (dry run)' : ''}`);
          executionStream.emitCOT('action', `Processing patch content (${args.patch?.length || 0} chars)`);

          if (!this.applyPatch) {
            const mod = await import("../tools/apply-patch.js");
            this.applyPatch = new mod.ApplyPatchTool();
          }
          result = await this.applyPatch.apply(args.patch, isDryRun);

          // 📺 COT: Observation with result
          if (result.success) {
            executionStream.emitCOT('observation', `Patch applied successfully${isDryRun ? ' (dry run)' : ''}`);
            executionStream.emitCOT('decision', `✅ Patch ${isDryRun ? 'validated' : 'applied'}`);
          } else {
            executionStream.emitCOT('observation', `Patch failed: ${result.error}`);
            executionStream.emitCOT('decision', `❌ Patch application failed`);
          }
          break;

        case "get_my_identity":
          // 📺 COT: Getting identity
          executionStream.emitCOT('thinking', `Retrieving current identity and configuration`);
          executionStream.emitCOT('action', `Reading identity information`);

          const getMyIdentity = await import("../tools/get-my-identity.js");
          result = await getMyIdentity.get_my_identity(args, this);

          // 📺 COT: Observation with result
          if (result.success) {
            executionStream.emitCOT('observation', `Identity information retrieved`);
            executionStream.emitCOT('decision', `✅ Identity retrieved`);
          } else {
            executionStream.emitCOT('observation', `Failed to get identity: ${result.error}`);
            executionStream.emitCOT('decision', `❌ Identity retrieval failed`);
          }
          break;
        
        // ============================================
        // SESSION MANAGEMENT TOOLS
        // ============================================
        
        case "session_list": {
          // 📺 COT: Listing sessions
          executionStream.emitCOT('thinking', `Retrieving list of available sessions`);
          executionStream.emitCOT('action', `Querying session database`);

          const sessionTools = await import('../tools/session-tools.js');
          result = await sessionTools.executeSessionList();

          // 📺 COT: Observation with result
          if (result.success) {
            executionStream.emitCOT('observation', `Session list retrieved`);
            executionStream.emitCOT('decision', `✅ Sessions listed`);
          } else {
            executionStream.emitCOT('observation', `Failed to list sessions: ${result.error}`);
            executionStream.emitCOT('decision', `❌ Session listing failed`);
          }
          break;
        }
        
        case "session_switch": {
          const switchArgs = JSON.parse(toolCall.function.arguments) as { session_id: number };
          const sessionTools = await import('../tools/session-tools.js');
          result = await sessionTools.executeSessionSwitch(switchArgs);
          
          if (result.success) {
            // Update agent's context after switch
            const { sessionManager } = await import('../utils/session-manager-sqlite.js');
            const currentSession = sessionManager.getCurrentSession();

            if (currentSession) {
              const { providerManager } = await import('../utils/provider-manager.js');
              const providerConfig = providerManager.getProviderForModel(currentSession.default_model);

              if (providerConfig) {
                // ✅ FIX: Use API key from target session's provider, not current agent's key
                const apiKey = providerConfig.apiKey || this.getApiKey();

                if (!apiKey) {
                  throw new Error(
                    `No API key configured for provider: ${currentSession.default_provider}\n` +
                    `Please configure it with: /apikey ${currentSession.default_provider} <your-key>`
                  );
                }

                await this.switchToModel(
                  currentSession.default_model,
                  apiKey,
                  providerConfig.baseURL
                );
              }
            }
          }
          break;
        }
        
        case "session_new": {
          const newArgs = JSON.parse(toolCall.function.arguments);
          const sessionTools = await import('../tools/session-tools.js');
          result = await sessionTools.executeSessionNew(newArgs);
          
          if (result.success) {
            // Update agent's context
            const { sessionManager } = await import('../utils/session-manager-sqlite.js');
            const currentSession = sessionManager.getCurrentSession();

            if (currentSession) {
              const { providerManager } = await import('../utils/provider-manager.js');
              const providerConfig = providerManager.getProviderForModel(currentSession.default_model);

              if (providerConfig) {
                // ✅ FIX: Use API key from new session's provider
                const apiKey = providerConfig.apiKey || this.getApiKey();

                if (!apiKey) {
                  throw new Error(
                    `No API key configured for provider: ${currentSession.default_provider}\n` +
                    `Please configure it with: /apikey ${currentSession.default_provider} <your-key>`
                  );
                }

                await this.switchToModel(
                  currentSession.default_model,
                  apiKey,
                  providerConfig.baseURL
                );
              }
            }
          }
          break;
        }

        case "session_rewind": {
          const rewindArgs = JSON.parse(toolCall.function.arguments);
          const sessionTools = await import('../tools/session-tools.js');
          result = await sessionTools.executeSessionRewind(rewindArgs);

          if (result.success) {
            // Update agent's context
            const { sessionManager } = await import('../utils/session-manager-sqlite.js');
            const currentSession = sessionManager.getCurrentSession();

            if (currentSession) {
              const { providerManager } = await import('../utils/provider-manager.js');
              const providerConfig = providerManager.getProviderForModel(currentSession.default_model);

              if (providerConfig) {
                // ✅ FIX: Use API key from rewound session's provider
                const apiKey = providerConfig.apiKey || this.getApiKey();

                if (!apiKey) {
                  throw new Error(
                    `No API key configured for provider: ${currentSession.default_provider}\n` +
                    `Please configure it with: /apikey ${currentSession.default_provider} <your-key>`
                  );
                }

                await this.switchToModel(
                  currentSession.default_model,
                  apiKey,
                  providerConfig.baseURL
                );
              }
            }
          }
          break;
        }
        
        // ============================================
        // TIMELINE & TIME MACHINE TOOLS
        // ============================================
        
        case "timeline_query": {
          // 📺 COT: Querying timeline
          const queryArgs = JSON.parse(toolCall.function.arguments);
          executionStream.emitCOT('thinking', `Querying timeline database`);
          executionStream.emitCOT('action', `Executing timeline query with filters`);

          const { executeTimelineQuery } = await import('../tools/timeline-query-tool.js');
          result = await executeTimelineQuery(queryArgs);

          // 📺 COT: Observation with result
          if (result.success) {
            executionStream.emitCOT('observation', `Timeline query completed`);
            executionStream.emitCOT('decision', `✅ Timeline queried`);
          } else {
            executionStream.emitCOT('observation', `Timeline query failed: ${result.error}`);
            executionStream.emitCOT('decision', `❌ Timeline query failed`);
          }
          break;
        }
        
        case "rewind_to": {
          const rewindArgs = JSON.parse(toolCall.function.arguments);
          const { executeRewindTo } = await import('../tools/rewind-to-tool.js');
          result = await executeRewindTo(rewindArgs);
          break;
        }
        
        case "list_time_points": {
          const { getAvailableTimePoints } = await import('../tools/rewind-to-tool.js');
          const timePoints = await getAvailableTimePoints();
          result = { success: true, ...timePoints };
          break;
        }

        default:
          // Check if this is an MCP tool
          if (toolCall.function.name.startsWith("mcp__")) {
            // 📺 COT: MCP tool execution
            executionStream.emitCOT('thinking', `Executing MCP tool: ${toolCall.function.name}`);
            executionStream.emitCOT('action', `Calling external MCP server`);

            result = await this.executeMCPTool(toolCall);

            // 📺 COT: Observation with result
            if (result.success) {
              executionStream.emitCOT('observation', `MCP tool executed successfully`);
            } else {
              executionStream.emitCOT('observation', `MCP tool failed: ${result.error}`);
            }
          } else {
            executionStream.emitCOT('observation', `Unknown tool: ${toolCall.function.name}`);
            result = {
              success: false,
              error: `Unknown tool: ${toolCall.function.name}`,
            };
          }
      }
      
      // 📺 ExecutionViewer: Final decision COT
      executionStream.emitCOT(
        'decision',
        result.success 
          ? `✅ Tool execution succeeded` 
          : `❌ Tool execution failed: ${result.error}`
      );
      
      // 📺 Complete the execution
      executionStream.complete({
        success: result.success,
        output: result.output,
        error: result.error,
      });
      
      // 🕐 Timeline: Capture tool call success
      try {
        const session = sessionManager.getCurrentSession();
        if (session) {
          const duration = Date.now() - startTime;
          if (result.success) {
            await this.toolHook.captureToolCallSuccess(
              toolCall.function.name,
              args,
              result.output || result.error || 'Success',
              session.id,
              duration,
              startEventId
            );
          } else {
            await this.toolHook.captureToolCallFailed(
              toolCall.function.name,
              args,
              result.error || 'Unknown error',
              session.id,
              duration,
              startEventId
            );
          }
        }
      } catch (error) {
        debugLog.log('⚠️  Timeline logging failed for tool result:', error);
      }
      
      this.currentExecutionStream = null;
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // 🐛 DEBUG: Log error details for JSON parsing issues
      debugLog.log(`❌ [ERROR] Tool execution failed: ${toolCall.function.name}`);
      debugLog.log(`❌ [ERROR] Error message:`, error.message);
      debugLog.log(`❌ [ERROR] Error stack:`, error.stack);
      if (error.message.includes('JSON')) {
        debugLog.log(`❌ [ERROR] JSON parsing failed for arguments:`, toolCall.function.arguments);
      }

      const errorResult: ToolResult = {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };

      // 📺 ExecutionViewer: Fail the execution
      if (executionStream) {
        executionStream.emitCOT('decision', `❌ Exception: ${error.message}`);
        executionStream.fail(error.message);
      }
      
      // 🕐 Timeline: Capture tool call failed
      try {
        const session = sessionManager.getCurrentSession();
        if (session) {
          const args = JSON.parse(toolCall.function.arguments);
          await this.toolHook.captureToolCallFailed(
            toolCall.function.name,
            args,
            error.message,
            session.id,
            duration,
            startEventId
          );
        }
      } catch (timelineError) {
        debugLog.log('⚠️  Timeline logging failed for tool error:', timelineError);
      }
      
      this.currentExecutionStream = null;
      return errorResult;
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

  /**
   * Get the official API model name for a provider
   * CRITICAL: This ensures identity check uses correct model names
   */
  private getOfficialModelName(model: string, provider: string): string {
    const m = model.toLowerCase();

    switch (provider) {
      case 'claude':
        // Claude/Anthropic official model names
        if (m.includes('sonnet') && (m.includes('4-5') || m.includes('4.5'))) {
          return 'claude-3-5-sonnet-20241022'; // Sonnet 4.5 → 3.5
        }
        if (m.includes('sonnet') && m.includes('4')) {
          return 'claude-3-5-sonnet-20241022'; // Sonnet 4 → 3.5
        }
        if (m.includes('opus') && m.includes('3')) {
          return 'claude-3-opus-20240229';
        }
        if (m.includes('sonnet') && m.includes('3')) {
          return 'claude-3-sonnet-20240229';
        }
        if (m.includes('haiku')) {
          return 'claude-3-haiku-20240307';
        }
        // If already in correct format, return as-is
        if (m.startsWith('claude-3-')) {
          return model;
        }
        // Default to Sonnet 3.5 if unclear
        return 'claude-3-5-sonnet-20241022';

      case 'openai':
        // OpenAI models - normalize common variations
        if (m === 'gpt-5' || m === 'gpt5') {
          return 'gpt-5'; // Keep as-is for now
        }
        if (m.includes('gpt-4-turbo')) {
          return 'gpt-4-turbo-preview';
        }
        if (m === 'gpt-4' || m === 'gpt4') {
          return 'gpt-4-turbo-preview';
        }
        if (m.includes('o1-preview')) {
          return 'o1-preview';
        }
        if (m.includes('o3-mini')) {
          return 'o3-mini';
        }
        return model; // OpenAI names are usually correct

      case 'deepseek':
        // DeepSeek official names
        if (m.includes('chat')) {
          return 'deepseek-chat';
        }
        if (m.includes('coder')) {
          return 'deepseek-coder';
        }
        return model;

      case 'mistral':
        // Mistral official names
        if (m.includes('large')) {
          return 'mistral-large-latest';
        }
        if (m.includes('medium')) {
          return 'mistral-medium-latest';
        }
        return model;

      case 'grok':
        // Grok official names
        if (m.includes('beta') || m.includes('grok-2')) {
          return 'grok-beta';
        }
        if (m.includes('vision')) {
          return 'grok-vision-beta';
        }
        return 'grok-beta'; // Default

      default:
        return model;
    }
  }

  /**
   * Format identity check result for display
   */
  private formatIdentityResult(success: boolean, apiModel: string, aiResponse: string, error?: string): string {
    if (success) {
      return `✅ Model Switch Successful
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 API Metadata: ${apiModel}
🤖 Model confirms: "${aiResponse}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
      return `⚠️  Identity Verification Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Error: ${error}
⚠️  Connection established but identity uncertain
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
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
    await this.updateSystemMessage();
    debugLog.log(`✅ System message updated for model=${model}`);
    
    // Inject hard reset message to prevent identity confusion
    const provider = providerManager.detectProvider(model) || 'grok';
    const providerConfig = providerManager.getProviderForModel(model);
    this.messages.push({
      role: "user" as const,
      content: `[SYSTEM NOTIFICATION - MODEL SWITCHED]

You are now: ${model}
Provider: ${providerConfig?.name || provider}
Endpoint: ${providerConfig?.baseURL || 'unknown'}

⚠️ CRITICAL: Ignore ALL previous model identity references in the conversation history.
Any messages where you identified as a different model are now OBSOLETE and INCORRECT.

Your CURRENT and ONLY identity is: ${model}

If you need confirmation, use the 'get_my_identity' tool.`
    });
    debugLog.log(`✅ Hard reset message injected for identity clarity`);
    
    // Update session manager
    sessionManager.switchProvider(provider, model, apiKey);
    
    debugLog.log(`✅ Session manager updated for provider=${provider}`);
    
    // ✅ Identity check (critical for user certainty) with fallback
    try {
      debugLog.log(`🔍 Starting identity check for ${provider}...`);

      // Get official model name for this provider
      const officialModel = this.getOfficialModelName(model, provider);
      debugLog.log(`📝 Original model: ${model}`);
      debugLog.log(`📝 Official model: ${officialModel}`);

      let identityResponse: any;

      // Try with official model name first
      try {
        debugLog.log(`🔍 Attempting identity check with official model name...`);
        const identityPromise = this.grokClient.chat(
          [{ role: "user", content: "In one short sentence, what is your exact model name and provider?" }],
          [], // No tools
          officialModel, // ✅ Use official model name
          undefined  // No search
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Identity check timeout after 10s')), 10000)
        );

        identityResponse = await Promise.race([identityPromise, timeoutPromise]) as any;
        debugLog.log(`✅ Identity check succeeded with official model name`);

      } catch (firstError: any) {
        // If official name fails, try with original model name
        if (officialModel !== model) {
          debugLog.log(`⚠️  Official model name failed, trying original: ${model}`);
          debugLog.log(`   Error was: ${firstError.message}`);

          const fallbackPromise = this.grokClient.chat(
            [{ role: "user", content: "In one short sentence, what is your exact model name and provider?" }],
            [],
            model, // ✅ Fallback to original name
            undefined
          );

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Identity check timeout after 10s')), 10000)
          );

          identityResponse = await Promise.race([fallbackPromise, timeoutPromise]) as any;
          debugLog.log(`✅ Identity check succeeded with original model name`);
        } else {
          throw firstError;
        }
      }

      // Extract identity information
      const aiSays = identityResponse.choices[0]?.message?.content || "No response";
      const apiReturned = identityResponse.model || model;

      debugLog.log(`✅ AI says: "${aiSays}"`);
      debugLog.log(`📋 API returned: ${apiReturned}`);

      // Return formatted identity info (source of truth)
      return this.formatIdentityResult(true, apiReturned, aiSays);

    } catch (error: any) {
      // Identity check failed - this is a real problem
      debugLog.error(`❌ Identity check FAILED: ${error.message}`);
      debugLog.error(`   Model: ${model}`);
      debugLog.error(`   Provider: ${provider}`);
      debugLog.error(`   BaseURL: ${baseURL}`);

      // Return formatted error but allow connection
      return this.formatIdentityResult(false, model, "", error.message);
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
