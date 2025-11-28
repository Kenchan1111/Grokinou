import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useInput } from "ink";
import { GrokAgent, ChatEntry } from "../agent/grok-agent.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import { useEnhancedInput, Key } from "./use-enhanced-input.js";

import { filterCommandSuggestions } from "../ui/components/command-suggestions.js";
import { loadModelConfig, updateCurrentModel, updateDefaultModel } from "../utils/model-config.js";
import { clearSession } from "../utils/session-manager.js";
import { pasteManager } from "../utils/paste-manager.js";
import { providerManager } from "../utils/provider-manager.js";
import { sessionManager } from "../utils/session-manager-sqlite.js";
import { generateStatusMessage } from "../utils/status-message.js";

/**
 * Parse date from various formats:
 * - DD/MM/YYYY (e.g., 01/11/2025)
 * - YYYY-MM-DD (e.g., 2025-11-01)
 * - Relative: "today", "yesterday"
 */
function parseDate(dateStr: string): Date {
  // Relative dates
  if (dateStr === 'today') {
    return new Date();
  }
  if (dateStr === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }
  
  // DD/MM/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // YYYY-MM-DD format
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  
  throw new Error(`Invalid date format: ${dateStr}. Use DD/MM/YYYY or YYYY-MM-DD`);
}

interface UseInputHandlerProps {
  agent: GrokAgent;
  chatHistory: ChatEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setCommittedHistory?: React.Dispatch<React.SetStateAction<ChatEntry[]>>;  // NEW: for switch-session sync
  setActiveMessages?: React.Dispatch<React.SetStateAction<ChatEntry[]>>;    // NEW: for atomic switch
  isSwitchingRef?: React.MutableRefObject<boolean>;                          // NEW: prevent auto-commit during switch
  setIsProcessing: (processing: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingContent: (value: string | ((prev: string) => string)) => void;
  setStreamingTools: (tools: any[] | null) => void;
  setStreamingToolResults: (results: any[] | null | ((prev: any[] | null) => any[] | null)) => void;
  setTokenCount: (count: number) => void;
  setProcessingTime: (time: number) => void;
  processingStartTime: React.MutableRefObject<number>;
  isProcessing: boolean;
  isStreaming: boolean;
  isConfirmationActive?: boolean;
  searchMode?: boolean;
  streamingBus?: import("../ui/streaming-bus.js").StreamingBus;
  onSearchCommand?: (input: string) => boolean;
  inputInjectionRef?: React.MutableRefObject<((text: string) => void) | null>;
}

interface CommandSuggestion {
  command: string;
  description: string;
}

interface ModelOption {
  model: string;
}

export function useInputHandler({
  agent,
  chatHistory,
  setChatHistory,
  setCommittedHistory,
  setActiveMessages,
  isSwitchingRef,
  setIsProcessing,
  setIsStreaming,
  setStreamingContent,
  setStreamingTools,
  setStreamingToolResults,
  setTokenCount,
  setProcessingTime,
  processingStartTime,
  isProcessing,
  isStreaming,
  isConfirmationActive = false,
  searchMode = false,
  streamingBus,
  onSearchCommand,
  inputInjectionRef,
}: UseInputHandlerProps) {
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showModelSelection, setShowModelSelection] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => {
    const confirmationService = ConfirmationService.getInstance();
    const sessionFlags = confirmationService.getSessionFlags();
    return sessionFlags.allOperations;
  });

  const handleSpecialKey = (key: Key): boolean => {
    // Don't handle input if confirmation dialog is active
    if (isConfirmationActive) {
      return true; // Prevent default handling
    }

    // Handle shift+tab to toggle auto-edit mode
    if (key.shift && key.tab) {
      const newAutoEditState = !autoEditEnabled;
      setAutoEditEnabled(newAutoEditState);

      const confirmationService = ConfirmationService.getInstance();
      if (newAutoEditState) {
        // Enable auto-edit: set all operations to be accepted
        confirmationService.setSessionFlag("allOperations", true);
      } else {
        // Disable auto-edit: reset session flags
        confirmationService.resetSession();
      }
      return true; // Handled
    }

    // Handle escape key for closing menus
    if (key.escape) {
      if (showCommandSuggestions) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return true;
      }
      if (showModelSelection) {
        setShowModelSelection(false);
        setSelectedModelIndex(0);
        return true;
      }
      if (isProcessing || isStreaming) {
        agent.abortCurrentOperation();
        setIsProcessing(false);
        setIsStreaming(false);
        setTokenCount(0);
        setProcessingTime(0);
        processingStartTime.current = 0;
        return true;
      }
      return false; // Let default escape handling work
    }

    // Handle command suggestions navigation
    if (showCommandSuggestions) {
      const filteredSuggestions = filterCommandSuggestions(
        commandSuggestions,
        input
      );

      if (filteredSuggestions.length === 0) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return false; // Continue processing
      } else {
        if (key.upArrow) {
          setSelectedCommandIndex((prev) =>
            prev === 0 ? filteredSuggestions.length - 1 : prev - 1
          );
          return true;
        }
        if (key.downArrow) {
          setSelectedCommandIndex(
            (prev) => (prev + 1) % filteredSuggestions.length
          );
          return true;
        }
        if (key.tab || key.return) {
          const safeIndex = Math.min(
            selectedCommandIndex,
            filteredSuggestions.length - 1
          );
          const selectedCommand = filteredSuggestions[safeIndex];
          const newInput = selectedCommand.command + " ";
          setInput(newInput);
          setCursorPosition(newInput.length);
          setShowCommandSuggestions(false);
          setSelectedCommandIndex(0);
          return true;
        }
      }
    }

    // Handle model selection navigation
    if (showModelSelection) {
      if (key.upArrow) {
        setSelectedModelIndex((prev) =>
          prev === 0 ? availableModels.length - 1 : prev - 1
        );
        return true;
      }
      if (key.downArrow) {
        setSelectedModelIndex((prev) => (prev + 1) % availableModels.length);
        return true;
      }
      if (key.tab || key.return) {
        const selectedModel = availableModels[selectedModelIndex];
        
        // ✅ NEW: Use multi-provider logic (same as /models <name>)
        const providerConfig = providerManager.getProviderForModel(selectedModel.model);
        
        if (!providerConfig) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ Could not detect provider for model: ${selectedModel.model}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setShowModelSelection(false);
          return true;
        }
        
        // Check API key
        if (!providerConfig.apiKey) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ API key not configured for provider: ${providerConfig.name}\n\n` +
                     `Set it now:\n` +
                     `  /apikey ${providerConfig.name} your-api-key-here`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setShowModelSelection(false);
          return true;
        }
        
        // ✅ Switch with new provider config (async)
        (async () => {
          const identityInfo = await agent.switchToModel(selectedModel.model, providerConfig.apiKey, providerConfig.baseURL);
          updateCurrentModel(selectedModel.model);
          
          const confirmEntry: ChatEntry = {
            type: "assistant",
            content: `✅ Switched to ${selectedModel.model}\n` +
                     `📝 Provider: ${providerConfig.name}\n` +
                     `🔗 Endpoint: ${providerConfig.baseURL}\n` +
                     `💾 Saved to: .grok/settings.json\n\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🔍 Identity Verification:\n${identityInfo}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, confirmEntry]);
        })();
        
        setShowModelSelection(false);
        setSelectedModelIndex(0);
        return true;
      }
    }

    return false; // Let default handling proceed
  };

  // Guard against duplicate submissions
  const isSubmittingRef = useRef(false);

  const handleInputSubmit = async (userInput: string) => {
    // Prevent duplicate submissions
    if (isSubmittingRef.current) {
      return;
    }

    if (userInput === "exit" || userInput === "quit") {
      process.exit(0);
      return;
    }

    // Expand placeholders before processing
    const expandedInput = pasteManager.expandPlaceholders(userInput);

    if (expandedInput.trim()) {
      isSubmittingRef.current = true;
      try {
        const directCommandResult = await handleDirectCommand(expandedInput);
        if (!directCommandResult) {
          await processUserMessage(expandedInput);
        }
        // Clear pending pastes after successful submit
        pasteManager.clearAll();
      } finally {
        isSubmittingRef.current = false;
      }
    }
  };

  const handleInputChange = (newInput: string) => {
    // Update command suggestions based on input
    if (newInput.startsWith("/")) {
      setShowCommandSuggestions(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setSelectedCommandIndex(0);
    }
  };

  const {
    input,
    cursorPosition,
    setInput,
    setCursorPosition,
    clearInput,
    resetHistory,
    handleInput,
  } = useEnhancedInput({
    onSubmit: handleInputSubmit,
    onSpecialKey: handleSpecialKey,
    disabled: isConfirmationActive,
  });

  // Expose input injection function for external use (e.g., paste from search)
  useEffect(() => {
    if (inputInjectionRef) {
      inputInjectionRef.current = (text: string) => {
        // Append text to current input
        const newInput = input + text;
        setInput(newInput);
        setCursorPosition(newInput.length);
      };
    }
  }, [input, setInput, setCursorPosition, inputInjectionRef]);

  // Hook up the actual input handling
  useInput((inputChar: string, key: Key) => {
    // Don't process input in search mode (SearchResults component handles it)
    if (searchMode) {
      return;
    }
    
    handleInput(inputChar, key);
  });

  // Update command suggestions when input changes
  useEffect(() => {
    handleInputChange(input);
  }, [input]);

  const commandSuggestions: CommandSuggestion[] = [
    { command: "/help", description: "Show help information" },
    { command: "/status", description: "Show current model and provider info" },
    { command: "/search", description: "Search in conversation history" },
    { command: "/list_sessions", description: "List all sessions in current directory" },
    { command: "/switch-session", description: "Switch to a different session by ID" },
    { command: "/rename_session", description: "Rename the current session" },
    { command: "/new-session", description: "Create a new session in current directory" },
    { command: "/list_tools", description: "List all tools available to LLMs" },
    { command: "/models", description: "Switch model (interactive)" },
    { command: "/model-default", description: "Set global default model" },
    { command: "/apikey", description: "Manage API keys" },
    { command: "/clear", description: "Clear chat history" },
    { command: "/clear-session", description: "Clear in-memory session only" },
    { command: "/clear-disk-session", description: "Delete persisted session and clear memory" },
    { command: "/commit-and-push", description: "AI commit & push to remote" },
    { command: "/exit", description: "Exit the application" },
  ];

  // Load models from configuration with fallback to defaults
  const availableModels: ModelOption[] = useMemo(() => {
    return loadModelConfig(); // Return directly, interface already matches
  }, []);

  const handleDirectCommand = async (input: string): Promise<boolean> => {
    const trimmedInput = input.trim();

    // Handle /search command
    if (trimmedInput.startsWith("/search")) {
      if (onSearchCommand) {
        const handled = onSearchCommand(trimmedInput);
        if (handled) {
          clearInput();
          return true;
        }
      }
      // If not handled, show error
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: "❌ Search feature is not available. Usage: /search <query>",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/clear") {
      // Reset chat history
      setChatHistory([]);

      // Reset processing states
      setIsProcessing(false);
      setIsStreaming(false);
      setTokenCount(0);
      setProcessingTime(0);
      processingStartTime.current = 0;

      // Reset confirmation service session flags
      const confirmationService = ConfirmationService.getInstance();
      confirmationService.resetSession();

      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/help") {
      const helpEntry: ChatEntry = {
        type: "assistant",
        content: `Grok CLI Help:

Built-in Commands:
  /clear      - Clear chat history
  /clear-session - Clear in-memory chat session only
  /clear-disk-session - Delete persisted session files and clear memory
  /help       - Show this help
  /status     - Show current model and provider info
  /models     - Switch between available models
  /list_sessions - List all sessions in current directory
  /switch-session <id> - Switch to a different session by ID
  /rename_session <name> - Rename the current session
  /new-session [options] - Create a new session (Git-like branching)
      --directory <path>     Create session in different directory
      --import-history       Import messages from source session
      --from-session <id>    Import from specific session (default: current)
      --from-date <date>     Import messages from this date onwards
      --to-date <date>       Import messages up to this date
      --date-range <start> <end>  Import messages between dates
      --model <name>         Start with specific model
      --provider <name>      Start with specific provider
      
      Date formats: DD/MM/YYYY, YYYY-MM-DD, "today", "yesterday"
      Example: /new-session --directory ~/rewind --from-session 5 --date-range 01/11/2025 03/11/2025
  /list_tools - List all tools available to LLMs (with descriptions)
  /search <query> - Search in conversation history
  /exit       - Exit application
  exit, quit  - Exit application

Git Commands:
  /commit-and-push - AI-generated commit + push to remote

Enhanced Input Features:
  ↑/↓ Arrow   - Navigate command history
  Ctrl+C      - Clear input (press twice to exit)
  Ctrl+←/→    - Move by word
  Ctrl+A/E    - Move to line start/end
  Ctrl+W      - Delete word before cursor
  Ctrl+K      - Delete to end of line
  Ctrl+U      - Delete to start of line
  Shift+Tab   - Toggle auto-edit mode (bypass confirmations)

Direct Commands (executed immediately):
  ls [path]   - List directory contents
  pwd         - Show current directory
  cd <path>   - Change directory
  cat <file>  - View file contents
  mkdir <dir> - Create directory
  touch <file>- Create empty file

Model Configuration:
  Edit ~/.grok/models.json to add custom models (Claude, GPT, Gemini, etc.)

For complex operations, just describe what you want in natural language.
Examples:
  "edit package.json and add a new script"
  "create a new React component called Header"
  "show me all TypeScript files in this project"`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, helpEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/clear-session") {
      // Clear in-memory session only (no disk changes)
      setChatHistory([]);
      setIsProcessing(false);
      setIsStreaming(false);
      setTokenCount(0);
      setProcessingTime(0);
      processingStartTime.current = 0;

      const confirmationService = ConfirmationService.getInstance();
      confirmationService.resetSession();

      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/clear-disk-session") {
      try {
        await clearSession();
        // Also clear in-memory session
        setChatHistory([]);
        setIsProcessing(false);
        setIsStreaming(false);
        setTokenCount(0);
        setProcessingTime(0);
        processingStartTime.current = 0;

        const confirmationService = ConfirmationService.getInstance();
        confirmationService.resetSession();

        const infoEntry: ChatEntry = {
          type: "assistant",
          content: "✓ Deleted persisted session and cleared memory",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, infoEntry]);
      } catch (e: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Failed to clear disk session: ${e?.message || "Unknown error"}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/exit") {
      process.exit(0);
      return true;
    }

    // ============================================
    // /status - Show enriched session status
    // ============================================
    if (trimmedInput === "/status") {
      const statusEntry = generateStatusMessage(agent);
      setChatHistory((prev) => [...prev, statusEntry]);
      clearInput();
      return true;
    }

    // ============================================
    // /list_sessions - List ALL sessions from ALL directories
    // ============================================
    if (trimmedInput === "/list_sessions") {
      try {
        // Pass null to get sessions from ALL directories (not just current)
        const sessions = sessionManager.listSessions(
          null,
          {
            sortBy: 'last_activity',
            sortOrder: 'DESC',
            limit: 50  // Increased limit for multi-directory view
          }
        );

        if (sessions.length === 0) {
          const noSessionEntry: ChatEntry = {
            type: "assistant",
            content: `📂 No sessions found\n\n` +
                     `Start chatting to create your first session!`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, noSessionEntry]);
          clearInput();
          return true;
        }

        // Group sessions by working directory
        const sessionsByDir: Map<string, typeof sessions> = new Map();
        sessions.forEach(session => {
          const dir = session.working_dir;
          if (!sessionsByDir.has(dir)) {
            sessionsByDir.set(dir, []);
          }
          sessionsByDir.get(dir)!.push(session);
        });

        // Format sessions list grouped by directory
        const dirCount = sessionsByDir.size;
        let content = `📚 All Sessions (${dirCount} ${dirCount === 1 ? 'directory' : 'directories'})\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Iterate through directories (sorted by most recent activity)
        const sortedDirs = Array.from(sessionsByDir.entries()).sort((a, b) => {
          const latestA = Math.max(...a[1].map(s => new Date(s.last_activity).getTime()));
          const latestB = Math.max(...b[1].map(s => new Date(s.last_activity).getTime()));
          return latestB - latestA;
        });

        sortedDirs.forEach(([dir, dirSessions], dirIndex) => {
          // Highlight current directory
          const isCurrent = dir === process.cwd();
          const dirMarker = isCurrent ? '📍' : '📁';
          const dirLabel = isCurrent ? ` (current)` : '';
          
          content += `${dirMarker} **${dir}**${dirLabel}\n`;
          content += `   ${dirSessions.length} ${dirSessions.length === 1 ? 'session' : 'sessions'}\n\n`;

          dirSessions.forEach((session, sessionIndex) => {
            const status = session.status === 'active' ? '🟢' : 
                          session.status === 'completed' ? '⚪' : '📦';
            const favorite = session.is_favorite ? '⭐' : '';
            
            content += `   ${status} #${session.id}${favorite}`;
            
            if (session.session_name) {
              content += ` - ${session.session_name}`;
            }
            
            content += ` (${session.default_model}, ${session.message_count} msgs)`;
            content += ` - ${session.last_activity_relative}\n`;
          });

          // Add spacing between directories
          if (dirIndex < sortedDirs.length - 1) {
            content += `\n`;
          }
        });

        content += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        content += `\n💡 Use \`/switch-session <id>\` to switch (changes directory automatically)\n`;
        content += `💡 Legend: 🟢 Active  ⚪ Completed  📦 Archived  ⭐ Favorite  📍 Current dir`;

        const sessionListEntry: ChatEntry = {
          type: "assistant",
          content,
          timestamp: new Date(),
        };

        setChatHistory((prev) => [...prev, sessionListEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to list sessions: ${error?.message || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }

    // ============================================
    // /switch-session <id> - Switch to a different session
    // ============================================
    if (trimmedInput.startsWith("/switch-session")) {
      const parts = trimmedInput.split(/\s+/);
      
      if (parts.length < 2 || !parts[1]) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Usage: /switch-session <session_id>\n\n` +
                   `Example: /switch-session 5\n\n` +
                   `💡 Use /list_sessions to see available session IDs`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }
      
      const sessionId = parseInt(parts[1], 10);
      
      if (isNaN(sessionId)) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Invalid session ID: "${parts[1]}"\n\n` +
                   `Session ID must be a number.\n\n` +
                   `💡 Use /list_sessions to see available session IDs`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }
      
      try {
        // CRITICAL: Set switching flag to prevent auto-commit during state updates
        if (isSwitchingRef) {
          isSwitchingRef.current = true;
        }
        
        // Switch session
        const { session, history } = await sessionManager.switchSession(sessionId);
        
        // CRITICAL: Change working directory to match the session's working_dir
        // This prevents path confusion when the LLM thinks it's in one directory
        // but the Node process is actually in another
        const targetWorkdir = session.working_dir;
        const currentWorkdir = process.cwd();
        
        if (targetWorkdir !== currentWorkdir) {
          // Verify target directory exists
          const fs = await import('fs');
          if (!fs.existsSync(targetWorkdir)) {
            throw new Error(
              `Session's working directory does not exist: ${targetWorkdir}\n` +
              `The directory may have been moved or deleted.`
            );
          }
          
          // Change the Node process's current working directory
          process.chdir(targetWorkdir);
          
          // Verify the change was successful
          const newCwd = process.cwd();
          if (newCwd !== targetWorkdir) {
            throw new Error(
              `Failed to change directory from ${currentWorkdir} to ${targetWorkdir}\n` +
              `Current directory is: ${newCwd}`
            );
          }
        }
        
        // Update agent with new session's model/provider
        const providerConfig = providerManager.getProviderForModel(session.default_model);
        if (!providerConfig) {
          throw new Error(`Unknown provider for model: ${session.default_model}`);
        }
        
        const apiKey = agent.getApiKey(); // Keep current API key
        await agent.switchToModel(session.default_model, apiKey, providerConfig.baseURL);
        
        // Add confirmation message
        const dirChanged = targetWorkdir !== currentWorkdir;
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✅ Switched to Session #${session.id}\n\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `📝 Name: ${session.session_name || 'Unnamed'}\n` +
                   `🤖 Provider: ${session.default_provider}\n` +
                   `📱 Model: ${session.default_model}\n` +
                   `💬 Messages: ${history.length}\n` +
                   `📁 Working Directory: ${session.working_dir}\n` +
                   `🕐 Last Activity: ${new Date(session.last_activity).toLocaleString()}\n\n` +
                   (dirChanged 
                     ? `📂 **Directory Changed:**\n` +
                       `   From: ${currentWorkdir}\n` +
                       `   To:   ${targetWorkdir}\n\n` +
                       `⚠️  All relative paths now resolve to the new directory.\n\n`
                     : `📂 **Directory:** Already in ${targetWorkdir}\n\n`
                   ) +
                   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `Conversation history loaded! Continue chatting...`,
          timestamp: new Date(),
        };
        
        // CRITICAL: Replace chat history with the new session's history
        // We update chatHistory first with just the loaded history (no confirmation yet)
        // This ensures committedHistory and chatHistory are in sync momentarily
        setChatHistory(history);
        
        // Then update committedHistory to match (all loaded messages are "committed")
        if (setCommittedHistory) {
          setCommittedHistory(history);
        }
        
        // Finally add the confirmation message
        // This makes activeMessages = [confirmEntry] via the automatic useEffect calculation
        setChatHistory((prev) => [...prev, confirmEntry]);
        
        // Allow auto-commit to resume after a small delay (let React finish batching)
        setTimeout(() => {
          if (isSwitchingRef) {
            isSwitchingRef.current = false;
          }
        }, 100);
        
      } catch (error: any) {
        // Reset switching flag on error
        if (isSwitchingRef) {
          isSwitchingRef.current = false;
        }
        
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to switch session: ${error?.message || 'Unknown error'}\n\n` +
                   `💡 Use /list_sessions to see available sessions`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }

    // ============================================
    // /rename_session <new_name> - Rename the current session
    // ============================================
    if (trimmedInput.startsWith("/rename_session")) {
      const parts = trimmedInput.split(/\s+/);
      const newName = parts.slice(1).join(' ').trim();
      
      if (!newName) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Usage: /rename_session <new_name>\n\n` +
                   `Example: /rename_session My Project Alpha\n\n` +
                   `💡 The new name will replace the current session name`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }
      
      try {
        const currentSession = sessionManager.getCurrentSession();
        
        if (!currentSession) {
          throw new Error('No active session found');
        }
        
        // IMPORTANT: Save old name BEFORE renaming (renameSession updates the cache immediately)
        const oldName = currentSession.session_name || 'Unnamed';
        
        // Rename the session
        sessionManager.renameSession(currentSession.id, newName);
        
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✅ Session Renamed\n\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `📝 Old Name: ${oldName}\n` +
                   `📝 New Name: ${newName}\n` +
                   `🔖 Session ID: ${currentSession.id}\n\n` +
                   `The session name has been updated successfully.`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, confirmEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to rename session: ${error?.message || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }

    // ============================================
    // /list_tools - List all tools available to LLMs
    // ============================================
    if (trimmedInput === "/list_tools") {
      try {
        // Dynamically import getAllGrokTools to get current tools
        const { getAllGrokTools } = await import("../grok/tools.js");
        const allTools = await getAllGrokTools();
        
        // Check for conditional tools
        const hasMorphKey = !!process.env.MORPH_API_KEY;
        
        // Group tools by category
        const fileOps: string[] = [];
        const execution: string[] = [];
        const search: string[] = [];
        const taskMgmt: string[] = [];
        const sessionMgmt: string[] = [];
        const system: string[] = [];
        const mcpTools: string[] = [];
        
        allTools.forEach((tool) => {
          const name = tool.function.name;
          const desc = tool.function.description;
          const firstLine = desc.split('\n')[0];
          const truncatedDesc = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
          const formattedTool = `   🔧 ${name}\n      ${truncatedDesc}`;
          
          // Categorize tools
          if (['view_file', 'create_file', 'str_replace_editor', 'edit_file', 'apply_patch'].includes(name)) {
            fileOps.push(formattedTool);
          } else if (['bash'].includes(name)) {
            execution.push(formattedTool);
          } else if (['search'].includes(name)) {
            search.push(formattedTool);
          } else if (['create_todo_list', 'update_todo_list'].includes(name)) {
            taskMgmt.push(formattedTool);
          } else if (['session_list', 'session_switch', 'session_new', 'session_rewind'].includes(name)) {
            sessionMgmt.push(formattedTool);
          } else if (['get_my_identity'].includes(name)) {
            system.push(formattedTool);
          } else {
            // MCP or other external tools
            mcpTools.push(formattedTool);
          }
        });
        
        // Add Morph edit_file tool if not present (show as unavailable)
        if (!hasMorphKey && !allTools.some(t => t.function.name === 'edit_file')) {
          const morphTool = `   🔧 edit_file (Morph Fast Apply)\n` +
                           `      ⚠️  NOT CONFIGURED - Requires MORPH_API_KEY environment variable\n` +
                           `      AI-powered fast code editing with intelligent diff application`;
          fileOps.push(morphTool);
        }
        
        let content = `🛠️  LLM Tools Available\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📊 Total Active Tools: ${allTools.length}\n`;
        
        if (!hasMorphKey) {
          content += `⚠️  1 tool requires configuration\n`;
        }
        
        content += `\n`;
        
        if (fileOps.length > 0) {
          content += `📁 File Operations (${fileOps.length}):\n${fileOps.join('\n\n')}\n\n`;
        }
        
        if (execution.length > 0) {
          content += `⚡ Execution (${execution.length}):\n${execution.join('\n\n')}\n\n`;
        }
        
        if (search.length > 0) {
          content += `🔍 Search (${search.length}):\n${search.join('\n\n')}\n\n`;
        }
        
        if (taskMgmt.length > 0) {
          content += `📋 Task Management (${taskMgmt.length}):\n${taskMgmt.join('\n\n')}\n\n`;
        }
        
        if (sessionMgmt.length > 0) {
          content += `🔀 Session Management (${sessionMgmt.length}):\n${sessionMgmt.join('\n\n')}\n\n`;
        }
        
        if (system.length > 0) {
          content += `🤖 System (${system.length}):\n${system.join('\n\n')}\n\n`;
        }
        
        if (mcpTools.length > 0) {
          content += `🔌 MCP Tools (${mcpTools.length}):\n${mcpTools.join('\n\n')}\n\n`;
        } else {
          // Show MCP section even if empty, to inform users about the feature
          content += `🔌 MCP Tools (0):\n` +
                    `   ℹ️  No MCP servers configured\n` +
                    `   📝 Configure external tools in ~/.grok/mcp-config.json\n` +
                    `   🔗 Visit: https://modelcontextprotocol.io/introduction\n\n`;
        }
        
        content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        if (!hasMorphKey) {
          content += `💡 To enable edit_file (Morph):\n` +
                    `   export MORPH_API_KEY=your-api-key\n` +
                    `   Get your key at: https://morph.so\n\n`;
        }
        
        content += `💡 Use /help to see user commands`;
        
        const toolsEntry: ChatEntry = {
          type: "assistant",
          content,
          timestamp: new Date(),
        };
        
        setChatHistory((prev) => [...prev, toolsEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to list tools: ${error?.message || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }

    // ============================================
    // /new-session [options] - Create a new session
    // ============================================
    if (trimmedInput.startsWith("/new-session")) {
      // DEBUG: Log the full command
      console.log('🐛 [DEBUG] /new-session command:', trimmedInput);
      
      try {
        const parts = trimmedInput.split(/\s+/);
        const args = parts.slice(1);
        
        console.log('🐛 [DEBUG] Parsed args:', args);
        
        // Parse options
        let importHistory = false;
        let specificModel: string | undefined;
        let specificProvider: string | undefined;
        let targetDirectory: string | undefined;
        let fromSessionId: number | undefined;
        let fromDate: Date | undefined;
        let toDate: Date | undefined;
        
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          
          if (arg === '--import-history') {
            importHistory = true;
          } else if (arg === '--model' && args[i + 1]) {
            specificModel = args[i + 1];
            i++; // Skip next arg
          } else if (arg === '--provider' && args[i + 1]) {
            specificProvider = args[i + 1];
            i++; // Skip next arg
          } else if (arg === '--directory' && args[i + 1]) {
            targetDirectory = args[i + 1];
            i++; // Skip next arg
          } else if (arg === '--from-session' && args[i + 1]) {
            fromSessionId = parseInt(args[i + 1], 10);
            if (isNaN(fromSessionId)) {
              throw new Error(`Invalid session ID: ${args[i + 1]}`);
            }
            importHistory = true; // Implicit
            i++; // Skip next arg
          } else if (arg === '--from-date' && args[i + 1]) {
            fromDate = parseDate(args[i + 1]);
            importHistory = true; // Implicit
            i++; // Skip next arg
          } else if (arg === '--to-date' && args[i + 1]) {
            toDate = parseDate(args[i + 1]);
            importHistory = true; // Implicit
            i++; // Skip next arg
          } else if (arg === '--date-range' && args[i + 1] && args[i + 2]) {
            fromDate = parseDate(args[i + 1]);
            toDate = parseDate(args[i + 2]);
            importHistory = true; // Implicit
            i += 2; // Skip next 2 args
          }
        }
        
        // Validate date range
        if (fromDate && toDate && fromDate > toDate) {
          throw new Error('--from-date must be before --to-date');
        }
        
        // Build date range for filtering
        const dateRange = (fromDate || toDate) ? {
          start: fromDate || new Date(0), // Beginning of time if not specified
          end: toDate || new Date() // Now if not specified
        } : undefined;
        
        // Determine target directory (default: current directory)
        const targetWorkdir = targetDirectory 
          ? (targetDirectory.startsWith('/') ? targetDirectory : `${process.cwd()}/${targetDirectory}`)
          : process.cwd();
        
        console.log('🐛 [DEBUG] Target directory:', targetWorkdir);
        console.log('🐛 [DEBUG] Current directory:', process.cwd());
        
        // Verify/create target directory
        const fs = await import('fs');
        if (!fs.existsSync(targetWorkdir)) {
          // Ask for confirmation to create directory
          const shouldCreate = true; // TODO: Add confirmation dialog
          if (shouldCreate) {
            fs.mkdirSync(targetWorkdir, { recursive: true });
          } else {
            throw new Error(`Directory does not exist: ${targetWorkdir}`);
          }
        }
        
        // Determine model and provider
        const currentSession = sessionManager.getCurrentSession();
        
        const targetModel = specificModel || currentSession?.default_model || agent.getCurrentModel();
        const targetProvider = specificProvider || 
                               (specificModel ? providerManager.detectProvider(specificModel) : null) ||
                               currentSession?.default_provider || 
                               providerManager.detectProvider(agent.getCurrentModel()) || 
                               'grok';
        
        if (!targetProvider) {
          throw new Error(`Cannot determine provider for model: ${targetModel}`);
        }
        
        // Get API key for the provider
        const apiKey = agent.getApiKey();
        
        if (!apiKey) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ No API key found for provider: ${targetProvider}\n\n` +
                     `Please configure it first:\n` +
                     `/apikey ${targetProvider} <your-key>`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          clearInput();
          return true;
        }
        
        // Create the new session
        console.log('🐛 [DEBUG] Calling createNewSession with:', {
          workdir: targetWorkdir,
          provider: targetProvider,
          model: targetModel,
          importHistory,
          fromSessionId
        });
        
        const { session, history } = await sessionManager.createNewSession(
          targetWorkdir,
          targetProvider,
          targetModel,
          apiKey,
          {
            importHistory,
            fromSessionId,
            dateRange
          }
        );
        
        console.log('🐛 [DEBUG] Session created:', session.id);
        console.log('🐛 [DEBUG] History length:', history.length);
        
        // Update agent with new session's model/provider
        const providerConfig = providerManager.getProviderForModel(targetModel);
        if (!providerConfig) {
          throw new Error(`Unknown provider for model: ${targetModel}`);
        }
        
        await agent.switchToModel(targetModel, apiKey, providerConfig.baseURL);
        
        // CRITICAL: Change working directory if creating session in different directory
        // Same behavior as /switch-session for consistency
        const currentWorkdir = process.cwd();
        const dirChanged = targetWorkdir !== currentWorkdir;
        
        if (dirChanged) {
          // Change the Node process's current working directory
          process.chdir(targetWorkdir);
          
          // Verify the change was successful
          const newCwd = process.cwd();
          if (newCwd !== targetWorkdir) {
            throw new Error(
              `Failed to change directory from ${currentWorkdir} to ${targetWorkdir}\n` +
              `Current directory is: ${newCwd}`
            );
          }
        }
        
        // Replace chat history
        console.log('🐛 [DEBUG] Replacing chat history with', history.length, 'messages');
        setChatHistory(history);
        
        // Add confirmation message
        console.log('🐛 [DEBUG] Creating confirmation message');
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✅ **New Session Created** #${session.id}\n\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `📂 Working Directory: ${session.working_dir}\n` +
                   `🤖 Provider: ${session.default_provider}\n` +
                   `📱 Model: ${session.default_model}\n` +
                   `💬 Messages: ${history.length}${importHistory ? ' (imported)' : ''}\n` +
                   `🕐 Created: ${new Date(session.created_at).toLocaleString()}\n\n` +
                   (dirChanged 
                     ? `📂 **Directory Changed:**\n` +
                       `   From: ${currentWorkdir}\n` +
                       `   To:   ${targetWorkdir}\n\n` +
                       `⚠️  All relative paths now resolve to the new directory.\n\n`
                     : `📂 **Directory:** Already in ${targetWorkdir}\n\n`
                   ) +
                   (importHistory 
                     ? `📋 **History Imported**\n` +
                       (fromSessionId ? `   Source: Session #${fromSessionId}\n` : `   Source: Current session\n`) +
                       (dateRange ? `   Date Range: ${dateRange.start.toLocaleDateString()} → ${dateRange.end.toLocaleDateString()}\n` : '') +
                       `   Messages: ${history.length} imported\n\n`
                     : `📄 **Fresh Start**\n` +
                       `   This is a brand new conversation.\n\n`
                   ) +
                   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `You can now start a new conversation!\n\n` +
                   `💡 Use /list_sessions to see all sessions\n` +
                   `💡 Use /switch-session <id> to switch back`,
          timestamp: new Date(),
        };
        
        console.log('🐛 [DEBUG] Adding confirmation message');
        setChatHistory((prev) => [...prev, confirmEntry]);
        
        console.log('🐛 [DEBUG] /new-session COMPLETE');
        
      } catch (error: any) {
        console.error('🔴 [ERROR] /new-session failed:', error);
        console.error('🔴 [ERROR] Stack:', error.stack);
        
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to create new session: ${error?.message || 'Unknown error'}\n\n` +
                   `Stack trace:\n${error.stack}\n\n` +
                   `Usage: /new-session [--import-history] [--model <name>] [--provider <name>]`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }

    // ============================================
    // /apikey - Display API keys
    // ============================================
    if (trimmedInput === "/apikey") {
      const currentProvider = providerManager.detectProvider(agent.getCurrentModel());
      const info = providerManager.formatProviderList(currentProvider);
      
      const infoEntry: ChatEntry = {
        type: "assistant",
        content: info,
        timestamp: new Date(),
      };
      
      setChatHistory((prev) => [...prev, infoEntry]);
      clearInput();
      return true;
    }

    // ============================================
    // /apikey <provider> <key> - Set API key
    // ============================================
    if (trimmedInput.startsWith("/apikey ") && !trimmedInput.includes(" show ")) {
      const parts = trimmedInput.split(" ");
      
      if (parts.length < 3) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Invalid syntax.\n\n` +
                   `Usage:\n` +
                   `  /apikey <provider> <key>     - Set API key\n` +
                   `  /apikey show <provider>      - Show full key\n\n` +
                   `Example:\n` +
                   `  /apikey claude sk-ant-api03-xxx`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }
      
      const providerName = parts[1];
      const apiKey = parts[2];
      
      try {
        providerManager.setApiKey(providerName, apiKey);
        
        const maskedKey = providerManager.getMaskedApiKey(providerName);
        
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✅ Set API key for ${providerName}\n` +
                   `📝 Saved to: ~/.grok/user-settings.json\n` +
                   `🔒 Key masked: ${maskedKey}`,
          timestamp: new Date(),
        };
        
        setChatHistory((prev) => [...prev, confirmEntry]);
      } catch (error) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to set API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }

    // ============================================
    // /apikey show <provider> - Show full key
    // ============================================
    if (trimmedInput.startsWith("/apikey show ")) {
      const providerName = trimmedInput.split(" ")[2];
      
      const provider = providerManager.getProvider(providerName);
      
      if (!provider || !provider.apiKey) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ No API key configured for provider: ${providerName}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }
      
      const infoEntry: ChatEntry = {
        type: "assistant",
        content: `🔐 API Key for ${providerName}:\n` +
                 `${provider.apiKey}\n\n` +
                 `⚠️  Warning: Keep this key secret!`,
        timestamp: new Date(),
      };
      
      setChatHistory((prev) => [...prev, infoEntry]);
      clearInput();
      return true;
    }

    // ============================================
    // /model-default <model> - Set global default
    // ============================================
    if (trimmedInput.startsWith("/model-default ")) {
      const modelArg = trimmedInput.slice(15).trim();
      const modelNames = availableModels.map((m) => m.model);

      if (modelNames.includes(modelArg)) {
        // Update user settings (global default)
        updateDefaultModel(modelArg);
        
        // Get current model for comparison
        const currentModel = agent.getCurrentModel();
        
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✅ Set ${modelArg} as global default model\n` +
                   `📝 Saved to: ~/.grok/user-settings.json\n\n` +
                   `ℹ️  Current session still using: ${currentModel}\n` +
                   `💡 Use /models ${modelArg} to switch this session too\n\n` +
                   `This will be used for all NEW sessions.`,
          timestamp: new Date(),
        };
        
        setChatHistory((prev) => [...prev, confirmEntry]);
      } else {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Model "${modelArg}" not found.\n\n` +
                   `Available models:\n${modelNames.map(m => `  • ${m}`).join('\n')}\n\n` +
                   `To add a new model, edit ~/.grok/user-settings.json`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }

    if (trimmedInput === "/models") {
      setShowModelSelection(true);
      setSelectedModelIndex(0);
      clearInput();
      return true;
    }

    if (trimmedInput.startsWith("/models ")) {
      const modelArg = trimmedInput.split(" ")[1];
      const modelNames = availableModels.map((m) => m.model);

      if (modelNames.includes(modelArg)) {
        // ✅ NEW: Detect provider and get config
        const providerConfig = providerManager.getProviderForModel(modelArg);
        
        // DEBUG: Log provider config
        console.log(`🔍 DEBUG: Model=${modelArg}, Provider=${providerConfig?.name}, BaseURL=${providerConfig?.baseURL}, HasKey=${!!providerConfig?.apiKey}`);
        
        if (!providerConfig) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ Could not detect provider for model: ${modelArg}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          clearInput();
          return true;
        }
        
        // Check API key
        if (!providerConfig.apiKey) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ API key not configured for provider: ${providerConfig.name}\n\n` +
                     `Set it now:\n` +
                     `  /apikey ${providerConfig.name} your-api-key-here\n\n` +
                     `Or configure in ~/.grok/user-settings.json`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          clearInput();
          return true;
        }
        
        // ✅ Switch with new provider config (async)
        (async () => {
          const identityInfo = await agent.switchToModel(modelArg, providerConfig.apiKey, providerConfig.baseURL);
          updateCurrentModel(modelArg); // Update project current model
          
          const confirmEntry: ChatEntry = {
            type: "assistant",
            content: `✅ Switched to ${modelArg}\n` +
                     `📝 Provider: ${providerConfig.name}\n` +
                     `🔗 Endpoint: ${providerConfig.baseURL}\n` +
                     `💾 Saved to: .grok/settings.json\n\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🔍 Identity Verification:\n${identityInfo}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, confirmEntry]);
        })();
        
        clearInput();
        return true;
      } else {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Model "${modelArg}" not found.\n\nAvailable models:\n${modelNames.join("\n")}

Available models: ${modelNames.join(", ")}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }


    if (trimmedInput === "/commit-and-push") {
      const userEntry: ChatEntry = {
        type: "user",
        content: "/commit-and-push",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      setIsProcessing(true);
      setIsStreaming(true);

      try {
        // First check if there are any changes at all
        const initialStatusResult = await agent.executeBashCommand(
          "git status --porcelain"
        );

        if (
          !initialStatusResult.success ||
          !initialStatusResult.output?.trim()
        ) {
          const noChangesEntry: ChatEntry = {
            type: "assistant",
            content: "No changes to commit. Working directory is clean.",
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, noChangesEntry]);
          setIsProcessing(false);
          setIsStreaming(false);
          setInput("");
          return true;
        }

        // Add all changes
        const addResult = await agent.executeBashCommand("git add .");

        if (!addResult.success) {
          const addErrorEntry: ChatEntry = {
            type: "assistant",
            content: `Failed to stage changes: ${
              addResult.error || "Unknown error"
            }`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, addErrorEntry]);
          setIsProcessing(false);
          setIsStreaming(false);
          setInput("");
          return true;
        }

        // Show that changes were staged
        const addEntry: ChatEntry = {
          type: "tool_result",
          content: "Changes staged successfully",
          timestamp: new Date(),
          toolCall: {
            id: `git_add_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: "git add ." }),
            },
          },
          toolResult: addResult,
        };
        setChatHistory((prev) => [...prev, addEntry]);

        // Get staged changes for commit message generation
        const diffResult = await agent.executeBashCommand("git diff --cached");

        // Generate commit message using AI
        const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`;

        let commitMessage = "";
        let streamingEntry: ChatEntry | null = null;

        for await (const chunk of agent.processUserMessageStream(
          commitPrompt
        )) {
          if (chunk.type === "content" && chunk.content) {
            if (!streamingEntry) {
              const newEntry = {
                type: "assistant" as const,
                content: `Generating commit message...\n\n${chunk.content}`,
                timestamp: new Date(),
                isStreaming: true,
              };
              setChatHistory((prev) => [...prev, newEntry]);
              streamingEntry = newEntry;
              commitMessage = chunk.content;
            } else {
              commitMessage += chunk.content;
              setChatHistory((prev) =>
                prev.map((entry, idx) =>
                  idx === prev.length - 1 && entry.isStreaming
                    ? {
                        ...entry,
                        content: `Generating commit message...\n\n${commitMessage}`,
                      }
                    : entry
                )
              );
            }
          } else if (chunk.type === "done") {
            if (streamingEntry) {
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming
                    ? {
                        ...entry,
                        content: `Generated commit message: "${commitMessage.trim()}"`,
                        isStreaming: false,
                      }
                    : entry
                )
              );
            }
            break;
          }
        }

        // Execute the commit
        const cleanCommitMessage = commitMessage
          .trim()
          .replace(/^["']|["']$/g, "");
        const commitCommand = `git commit -m "${cleanCommitMessage}"`;
        const commitResult = await agent.executeBashCommand(commitCommand);

        const commitEntry: ChatEntry = {
          type: "tool_result",
          content: commitResult.success
            ? commitResult.output || "Commit successful"
            : commitResult.error || "Commit failed",
          timestamp: new Date(),
          toolCall: {
            id: `git_commit_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: commitCommand }),
            },
          },
          toolResult: commitResult,
        };
        setChatHistory((prev) => [...prev, commitEntry]);

        // If commit was successful, push to remote
        if (commitResult.success) {
          // First try regular push, if it fails try with upstream setup
          let pushResult = await agent.executeBashCommand("git push");
          let pushCommand = "git push";

          if (
            !pushResult.success &&
            pushResult.error?.includes("no upstream branch")
          ) {
            pushCommand = "git push -u origin HEAD";
            pushResult = await agent.executeBashCommand(pushCommand);
          }

          const pushEntry: ChatEntry = {
            type: "tool_result",
            content: pushResult.success
              ? pushResult.output || "Push successful"
              : pushResult.error || "Push failed",
            timestamp: new Date(),
            toolCall: {
              id: `git_push_${Date.now()}`,
              type: "function",
              function: {
                name: "bash",
                arguments: JSON.stringify({ command: pushCommand }),
              },
            },
            toolResult: pushResult,
          };
          setChatHistory((prev) => [...prev, pushEntry]);
        }
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error during commit and push: ${error.message}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      setIsProcessing(false);
      setIsStreaming(false);
      clearInput();
      return true;
    }

    const directBashCommands = [
      "ls",
      "pwd",
      "cd",
      "cat",
      "mkdir",
      "touch",
      "echo",
      "grep",
      "find",
      "cp",
      "mv",
      "rm",
    ];
    const firstWord = trimmedInput.split(" ")[0];

    if (directBashCommands.includes(firstWord)) {
      const userEntry: ChatEntry = {
        type: "user",
        content: trimmedInput,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      try {
        // Temporarily enable auto-mode for direct bash commands
        // These commands should execute immediately without confirmation
        const confirmationService = ConfirmationService.getInstance();
        const previousFlags = confirmationService.getSessionFlags();
        const wasAutoEnabled = previousFlags.bashCommands;
        
        // Enable bashCommands flag for direct execution
        confirmationService.setSessionFlag('bashCommands', true);
        
        const result = await agent.executeBashCommand(trimmedInput);
        
        // Restore previous flag state
        confirmationService.setSessionFlag('bashCommands', wasAutoEnabled);

        const commandEntry: ChatEntry = {
          type: "tool_result",
          content: result.success
            ? result.output || "Command completed"
            : result.error || "Command failed",
          timestamp: new Date(),
          toolCall: {
            id: `bash_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: trimmedInput }),
            },
          },
          toolResult: result,
        };
        setChatHistory((prev) => [...prev, commandEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error executing command: ${error.message}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }

    return false;
  };

  const processUserMessage = async (userInput: string) => {
    const userEntry: ChatEntry = {
      type: "user",
      content: userInput,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, userEntry]);

    setIsProcessing(true);
    clearInput();

    try {
      setIsStreaming(true);
      if (!streamingBus) {
        setStreamingContent("");
        setStreamingTools(null);
        setStreamingToolResults(null);
      }
      const pendingToolResults: ChatEntry[] = [];
      let hasStarted = false;
      const pendingBufferRef = { text: "" };
      const lastFlushRef = { t: 0 };
      const flush = () => {
        if (!pendingBufferRef.text) return;
        const appendText = pendingBufferRef.text;
        pendingBufferRef.text = "";
        setStreamingContent((prev) => prev + appendText);
      };

      for await (const chunk of agent.processUserMessageStream(userInput)) {
        switch (chunk.type) {
          case "content":
            if (chunk.content) {
              hasStarted = true;
              if (streamingBus) {
                streamingBus.emitContent(chunk.content);
              } else {
                pendingBufferRef.text += chunk.content;
                const now = Date.now();
                if (now - lastFlushRef.t > 300) {
                  flush();
                  lastFlushRef.t = now;
                }
              }
            }
            break;

          case "token_count":
            if (chunk.tokenCount !== undefined) {
              setTokenCount(chunk.tokenCount);
            }
            break;

          case "tool_calls":
            if (chunk.toolCalls) {
              if (streamingBus) streamingBus.emitTools(chunk.toolCalls as any);
              else setStreamingTools(chunk.toolCalls as any);
            }
            break;

          case "tool_result":
            if (chunk.toolCall && chunk.toolResult) {
              const toolResultEntry: ChatEntry = {
                type: "tool_result",
                content: chunk.toolResult.success
                  ? chunk.toolResult.output || "Success"
                  : chunk.toolResult.error || "Error occurred",
                timestamp: new Date(),
                toolCall: chunk.toolCall,
                toolResult: chunk.toolResult,
              };
              // buffer result (do not update history during streaming)
              pendingToolResults.push(toolResultEntry);
              if (streamingBus) streamingBus.emitToolResult({ content: toolResultEntry.content });
              else setStreamingToolResults((prev) => (prev ? [...prev, toolResultEntry] : [toolResultEntry]));
            }
            break;

          case "done":
            if (streamingBus) streamingBus.emitDone();
            else {
              flush();
              if (hasStarted) {
                setStreamingContent((current) => {
                  if (current) {
                    const finalEntry: ChatEntry = {
                      type: "assistant",
                      content: current,
                      timestamp: new Date(),
                    };
                    setChatHistory((prev) => [...prev, finalEntry, ...pendingToolResults]);
                  }
                  return "";
                });
              }
              setStreamingTools(null);
              setStreamingToolResults(null);
            }
            setIsStreaming(false);
            break;
        }
      }
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      setIsStreaming(false);
    }

    setIsProcessing(false);
    processingStartTime.current = 0;
  };


  return {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    showModelSelection,
    selectedModelIndex,
    commandSuggestions,
    availableModels,
    agent,
    autoEditEnabled,
  };
}
