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
import { HelpFormatter } from "../utils/help-formatter.js";
import { imagePathManager } from "../utils/image-path-detector.js";
import { insertText } from "../utils/text-utils.js";
import { debugLog } from "../utils/debug-logger.js";

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
    insertAtCursor,
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

    // Debug: Log paste events
    if (inputChar && inputChar.length > 5) {
      debugLog.log('[PASTE DEBUG] inputChar.length:', inputChar.length, 'key.paste:', key.paste);
    }

    // Handle native paste event from Ink
    if (key.paste && inputChar) {
      debugLog.log('[PASTE] Ink detected paste, length:', inputChar.length);
      // Ink detected a paste operation - process as paste
      const imageResult = imagePathManager.processPaste(inputChar);
      if (imageResult.isImage) {
        insertAtCursor(imageResult.textToInsert);
      } else {
        const { textToInsert } = pasteManager.processPaste(inputChar);
        insertAtCursor(textToInsert);
      }
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
    { command: "/timeline", description: "Query timeline events (files, git, conversations)" },
    { command: "/rewind", description: "Time machine: rewind to specific timestamp" },
    { command: "/snapshots", description: "List available snapshots for rewinding" },
    { command: "/rewind-history", description: "Show history of all rewind operations" },
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

    if (trimmedInput === "/help" || trimmedInput.startsWith("/help ")) {
      const parts = trimmedInput.split(/\s+/);
      const subCommand = parts.length > 1 ? parts[1] : undefined;
      
      const helpContent = subCommand
        ? HelpFormatter.generateCommandHelp(subCommand)
        : HelpFormatter.generateHelp(agent);
      
      const helpEntry: ChatEntry = {
        type: "assistant",
        content: helpContent,
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
            
            content += `\n`;
            content += `      📱 Model: ${session.default_model} | 💬 ${session.message_count} msgs`;
            
            // Add creation date
            if (session.created_at) {
              const createdDate = new Date(session.created_at);
              const createdFormatted = createdDate.toLocaleString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });
              content += `\n      🕐 Created: ${createdFormatted}`;
              
              // Add age if available
              if (session.age_days !== undefined) {
                const ageStr = session.age_days === 0 
                  ? 'today' 
                  : session.age_days === 1 
                    ? '1 day ago' 
                    : `${session.age_days} days ago`;
                content += ` (${ageStr})`;
              }
            }
            
            // Add last activity
            if (session.last_activity_relative) {
              content += `\n      ⏰ Last active: ${session.last_activity_relative}`;
            }
            
            content += `\n`;
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
    // /timeline-check - Run Merkle DAG consistency check
    // ============================================
    if (trimmedInput === "/timeline-check") {
      try {
        const infoEntry: ChatEntry = {
          type: "assistant",
          content:
            `🔍 Timeline / Merkle DAG Check\n\n` +
            `⏳ Running: npm run timeline:check\n` +
            `Logs will be written to: logs/timeline-merkle-check.log`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, infoEntry]);

        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        await execAsync("npm run timeline:check", { cwd: process.cwd() });

        const doneEntry: ChatEntry = {
          type: "assistant",
          content:
            `✅ timeline:check completed\n\n` +
            `📄 Detailed report:\n` +
            `   logs/timeline-merkle-check.log`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, doneEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content:
            `❌ timeline:check failed: ${error?.message || "Unknown error"}\n\n` +
            `📄 Check logs/timeline-merkle-check.log for details (if created).`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }

    // ============================================
    // /timeline-rewind-test - Run rewind self-test
    // ============================================
    if (trimmedInput === "/timeline-rewind-test") {
      try {
        const infoEntry: ChatEntry = {
          type: "assistant",
          content:
            `🧪 Timeline Rewind Self-Test\n\n` +
            `⏳ Running: npm run timeline:rewind-test\n` +
            `Logs will be written to: logs/timeline-rewind-test.log`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, infoEntry]);

        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        await execAsync("npm run timeline:rewind-test", { cwd: process.cwd() });

        const doneEntry: ChatEntry = {
          type: "assistant",
          content:
            `✅ timeline:rewind-test completed\n\n` +
            `📄 Detailed report:\n` +
            `   logs/timeline-rewind-test.log`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, doneEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content:
            `❌ timeline:rewind-test failed: ${error?.message || "Unknown error"}\n\n` +
            `📄 Check logs/timeline-rewind-test.log for details (if created).`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }

    // ============================================
    // /timeline - Query timeline events
    // ============================================
    if (trimmedInput.startsWith("/timeline")) {
      try {
        const { executeTimelineQuery } = await import("../tools/timeline-query-tool.js");

        // Parse command arguments
        const args = trimmedInput.slice(9).trim(); // Remove "/timeline"
        const params: any = {};

        // Parse args: /timeline --start "2 hours ago" --category FILE --limit 50 --stats
        const matches = args.matchAll(/--([\w-]+)\s+(?:"([^"]+)"|(\S+))/g);
        for (const match of matches) {
          const key = match[1];
          const value = match[2] || match[3];

          // Time range aliases
          if (key === 'start' || key === 'startTime' || key === 'since') {
            params.startTime = value;
          } else if (key === 'end' || key === 'endTime' || key === 'before') {
            params.endTime = value;

          // Category (high-level type)
          } else if (key === 'category' || key === 'categories') {
            if (!params.categories) {
              params.categories = [];
            }
            params.categories.push(value);

          // Specific event types
          } else if (key === 'type' || key === 'eventType' || key === 'eventTypes') {
            if (!params.eventTypes) {
              params.eventTypes = [];
            }
            params.eventTypes.push(value);

          // Session filter
          } else if (key === 'session' || key === 'sessionId') {
            params.sessionId = parseInt(value);

          // Aggregate (e.g. file path)
          } else if (key === 'path' || key === 'aggregateId') {
            params.aggregateId = value;

          // Actor filter
          } else if (key === 'actor') {
            params.actor = value;

          // Limit
          } else if (key === 'limit') {
            params.limit = parseInt(value);

          // Text search in payloads
          } else if (key === 'search') {
            params.searchText = value;

          // Sort order
          } else if (key === 'order') {
            const lower = value.toLowerCase();
            if (lower === 'asc' || lower === 'desc') {
              params.order = lower;
            }
          }
        }

        // Check for --stats flag
        if (args.includes('--stats')) {
          params.statsOnly = true;
        }

        // If no args, show help
        if (!args || args === '--help') {
          const helpEntry: ChatEntry = {
            type: "assistant",
            content: `📅 Timeline Query Command\n\n` +
                     `Usage: /timeline [options]\n\n` +
                     `Options:\n` +
                     `  --start|--since <time>   Start time (ISO or relative)\n` +
                     `  --end|--before <time>    End time (ISO)\n` +
                     `  --category <cat>         Category: SESSION, LLM, TOOL, FILE, GIT, REWIND\n` +
                     `  --type <event>           Specific event type: FILE_MODIFIED, GIT_COMMIT, etc. (repeatable)\n` +
                     `  --path <path>            Filter by aggregate ID (e.g. file path)\n` +
                     `  --actor <actor>          Filter by actor (e.g. user, system, git:username)\n` +
                     `  --session <id>           Filter by session ID\n` +
                     `  --limit <n>              Max results (default: 100)\n` +
                     `  --search <text>          Search text in event payloads\n` +
                     `  --order <asc|desc>       Sort order (default: desc)\n` +
                     `  --stats                  Show statistics only\n\n` +
                     `Examples:\n` +
                     `  /timeline --category FILE --limit 20\n` +
                     `  /timeline --since "2025-11-28T10:00:00Z" --category GIT\n` +
                     `  /timeline --type FILE_MODIFIED --path src/ --since "2025-11-28" --limit 50\n` +
                     `  /timeline --session 5 --stats\n` +
                     `  /timeline --search "error" --limit 10`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, helpEntry]);
          clearInput();
          return true;
        }
        
        // Execute query
        const result = await executeTimelineQuery(params);
        
        let content = '';
        if (result.success) {
          if (result.stats) {
            content = `📊 Timeline Statistics\n\n` +
                     `Total Events: ${result.stats.totalEvents}\n\n` +
                     `By Category:\n${Object.entries(result.stats.eventsByCategory).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n\n` +
                     `By Actor:\n${Object.entries(result.stats.eventsByActor).slice(0, 10).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n\n` +
                     `Time Range:\n  Earliest: ${result.stats.timeRange.earliest}\n  Latest: ${result.stats.timeRange.latest}`;
          } else if (result.events) {
            content = `📅 Timeline Events (${result.events.length} of ${result.total})\n\n`;
            result.events.forEach((event, i) => {
              content += `${i + 1}. [${event.timestamp}] ${event.description}\n`;
              content += `   Actor: ${event.actor} | Aggregate: ${event.aggregate}\n`;
              if (Object.keys(event.payload).length > 0) {
                content += `   Payload: ${JSON.stringify(event.payload).substring(0, 100)}...\n`;
              }
              content += '\n';
            });
            if (result.hasMore) {
              content += `\n💡 More results available. Use --limit to see more.`;
            }
          }
        } else {
          content = `❌ Query failed: ${result.error}`;
        }
        
        const resultEntry: ChatEntry = {
          type: "assistant",
          content,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, resultEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Timeline query failed: ${error?.message || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }
    
    // ============================================
    // /rewind - Time machine: rewind to timestamp
    // ============================================
    if (trimmedInput.startsWith("/rewind")) {
      try {
        const { executeRewindTo } = await import("../tools/rewind-to-tool.js");
        
        // Parse command: /rewind <timestamp> [--output <dir>] [--no-files]
        const args = trimmedInput.slice(7).trim();
        
        if (!args || args === '--help') {
          const helpEntry: ChatEntry = {
            type: "assistant",
            content: `⏰ Rewind Command (Time Machine)\n\n` +
                     `Usage: /rewind <timestamp> [options]\n\n` +
                     `Options:\n` +
                     `  <timestamp>         Target time (ISO format: "2025-11-28T12:00:00Z")\n` +
                     `  --output <dir>      Custom output directory\n` +
                     `  --git-mode <mode>   Git materialization mode:\n` +
                     `      none            No git information at all\n` +
                     `      metadata        Just git_state.json (default)\n` +
                     `      full            Full .git repository + checkout\n` +
                     `  --create-session    Create a new grokinou session in rewinded directory\n` +
                     `  --auto-checkout     Automatically cd to rewinded directory after rewind\n` +
                     `  --compare-with <dir> Compare rewinded state with another directory\n` +
                     `  --no-files          Don't include file contents\n` +
                     `  --no-conversations  Don't include conversation history\n` +
                     `  --no-git            Alias for --git-mode none\n\n` +
                     `Examples:\n` +
                     `  /rewind "2025-11-28T10:00:00Z"\n` +
                     `  /rewind "2025-11-27T18:00:00Z" --output ~/recovered\n` +
                     `  /rewind "2025-11-28T12:00:00Z" --git-mode full --create-session --auto-checkout\n` +
                     `  /rewind "2025-11-28T12:00:00Z" --compare-with ~/current-project\n` +
                     `  /rewind "2025-11-28T12:00:00Z" --no-files --git-mode none\n\n` +
                     `⚠️ This creates a NEW directory with reconstructed state (non-destructive)\n\n` +
                     `Git Modes Explained:\n` +
                     `  • none     : No git data (just files + conversations)\n` +
                     `  • metadata : git_state.json with commit hash/branch (fast)\n` +
                     `  • full     : Complete .git repo you can work with (slow)\n\n` +
                     `Advanced Features:\n` +
                     `  --auto-checkout: Changes your working directory to the rewinded state\n` +
                     `  --compare-with: Shows detailed diff between rewinded and target directory\n` +
                     `  --create-session: Bridges /rewind and /new-session functionality`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, helpEntry]);
          clearInput();
          return true;
        }
        
        // Extract timestamp (first quoted string or first arg)
        const timestampMatch = args.match(/"([^"]+)"|^(\S+)/);
        if (!timestampMatch) {
          throw new Error('Missing timestamp. Usage: /rewind "2025-11-28T12:00:00Z"');
        }
        
        const targetTimestamp = timestampMatch[1] || timestampMatch[2];
        const params: any = { targetTimestamp };
        
        // Parse options
        if (args.includes('--no-files')) params.includeFiles = false;
        if (args.includes('--no-conversations')) params.includeConversations = false;
        if (args.includes('--no-git')) params.gitMode = 'none';
        if (args.includes('--create-session')) params.createSession = true;
        if (args.includes('--auto-checkout')) params.autoCheckout = true;
        
        // Parse --git-mode
        const gitModeMatch = args.match(/--git-mode\s+(?:"([^"]+)"|(\S+))/);
        if (gitModeMatch) {
          const mode = gitModeMatch[1] || gitModeMatch[2];
          if (['none', 'metadata', 'full'].includes(mode)) {
            params.gitMode = mode;
          } else {
            throw new Error(`Invalid git-mode: ${mode}. Must be: none, metadata, or full`);
          }
        }
        
        const outputMatch = args.match(/--output\s+(?:"([^"]+)"|(\S+))/);
        if (outputMatch) {
          params.outputDir = outputMatch[1] || outputMatch[2];
        }
        
        const compareMatch = args.match(/--compare-with\s+(?:"([^"]+)"|(\S+))/);
        if (compareMatch) {
          params.compareWith = compareMatch[1] || compareMatch[2];
        }
        
        // Execute rewind
        const infoEntry: ChatEntry = {
          type: "assistant",
          content: `⏳ Starting rewind to ${targetTimestamp}...\n` +
                   `This may take a few moments...`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, infoEntry]);
        
        const result = await executeRewindTo(params);
        
        let content = '';
        if (result.success) {
          content = `✅ Rewind Complete!\n\n` +
                   `${result.summary}\n\n` +
                   `📊 Stats:\n` +
                   `  Events Replayed: ${result.eventsReplayed}\n` +
                   `  Files Restored: ${result.filesRestored}\n` +
                   `  Duration: ${result.durationMs}ms\n` +
                   `  Snapshot Used: ${result.snapshotUsed || 'None (full replay)'}\n`;
          
          if (result.sessionCreated) {
            content += `  Session Created: #${result.sessionCreated.sessionId} (${result.sessionCreated.sessionName})\n`;
          }
          
          if (result.autoCheckedOut) {
            content += `  📂 Working Directory Changed:\n`;
            content += `     From: ${result.previousWorkingDir}\n`;
            content += `     To:   ${result.outputDirectory}\n`;
          }
          
          if (result.comparisonReport) {
            const report = result.comparisonReport;
            content += `\n📊 Comparison with ${report.compareDirectory}:\n`;
            content += `  Total Files: ${report.totalFiles}\n`;
            content += `  🆕 Added: ${report.added}\n`;
            content += `  ❌ Deleted: ${report.deleted}\n`;
            content += `  ✏️  Modified: ${report.modified}\n`;
            content += `  ✅ Unchanged: ${report.unchanged}\n`;
            
            if (report.modified > 0 || report.added > 0 || report.deleted > 0) {
              content += `\n  Key Changes:\n`;
              const changes = report.files.filter(f => f.status !== 'unchanged').slice(0, 5);
              changes.forEach(f => {
                const icon = f.status === 'added' ? '🆕' : f.status === 'deleted' ? '❌' : '✏️';
                content += `    ${icon} ${f.path}\n`;
              });
              if (report.files.filter(f => f.status !== 'unchanged').length > 5) {
                content += `    ... and ${report.files.filter(f => f.status !== 'unchanged').length - 5} more\n`;
              }
            }
          }
          
          content += `\n`;
          
          if (result.sessionCreated) {
            content += `💡 Use /switch-session ${result.sessionCreated.sessionId} to activate the rewinded session\n`;
          }
          
          if (result.autoCheckedOut) {
            content += `💡 You are now in the rewinded directory!\n`;
          }
          
          content += `\nNext Steps:\n${result.nextSteps?.join('\n')}`;
        } else {
          content = `❌ Rewind failed: ${result.error}`;
        }
        
        const resultEntry: ChatEntry = {
          type: "assistant",
          content,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, resultEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Rewind failed: ${error?.message || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }
    
    // ============================================
    // /snapshots - List available snapshots
    // ============================================
    if (trimmedInput === "/snapshots" || trimmedInput.startsWith("/snapshots")) {
      try {
        const { getAvailableTimePoints } = await import("../tools/rewind-to-tool.js");
        
        const timePoints = await getAvailableTimePoints();
        
        let content = `📸 Available Time Points for Rewinding\n\n`;
        
        // Show snapshots
        content += `━━━ Snapshots (Optimized Rewind Points) ━━━\n\n`;
        if (timePoints.snapshots.length === 0) {
          content += `No snapshots available yet.\n\n`;
        } else {
          timePoints.snapshots.forEach((snapshot, i) => {
            content += `${i + 1}. ${snapshot.timestamp}\n`;
            content += `   Events: ${snapshot.eventCount}`;
            if (snapshot.sessionName) {
              content += ` | Session: ${snapshot.sessionName}`;
            }
            content += '\n\n';
          });
        }
        
        // Show recent events
        content += `━━━ Recent Events (Precise Rewind) ━━━\n\n`;
        if (timePoints.recentEvents.length === 0) {
          content += `No recent events.\n\n`;
        } else {
          timePoints.recentEvents.slice(0, 10).forEach((event, i) => {
            content += `${i + 1}. [${event.timestamp}] ${event.description}\n`;
          });
          if (timePoints.recentEvents.length > 10) {
            content += `\n... and ${timePoints.recentEvents.length - 10} more\n`;
          }
        }
        
        content += `\n💡 Use /rewind "<timestamp>" to time-travel to any point above.`;
        
        const resultEntry: ChatEntry = {
          type: "assistant",
          content,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, resultEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to list snapshots: ${error?.message || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }
      
      clearInput();
      return true;
    }
    
    // ============================================
    // /rewind-history - Show history of all rewind operations
    // ============================================
    if (trimmedInput === "/rewind-history" || trimmedInput.startsWith("/rewind-history")) {
      try {
        const { executeTimelineQuery } = await import("../tools/timeline-query-tool.js");
        
        // Query all REWIND events from timeline
        const result = await executeTimelineQuery({
          categories: ['REWIND'],
          limit: 50,
          order: 'desc',
        });
        
        if (!result.success || !result.events || result.events.length === 0) {
          const noRewindsEntry: ChatEntry = {
            type: "assistant",
            content: `🕰️  Rewind History\n\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                     `No rewind operations found.\n\n` +
                     `💡 Use /rewind "<timestamp>" to perform your first time-travel!`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, noRewindsEntry]);
          clearInput();
          return true;
        }
        
        // Group rewinds by completed operations
        const rewindOps: Map<string, any[]> = new Map();
        
        result.events.forEach((event: any) => {
          const aggregateId = event.aggregate;
          if (!rewindOps.has(aggregateId)) {
            rewindOps.set(aggregateId, []);
          }
          rewindOps.get(aggregateId)!.push(event);
        });
        
        let content = `🕰️  Rewind History (${rewindOps.size} operations)\n\n`;
        content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        let opIndex = 1;
        for (const [targetTimestamp, events] of rewindOps) {
          // Find REWIND_COMPLETED or REWIND_FAILED event
          const completedEvent = events.find(e => e.description.includes('REWIND_COMPLETED'));
          const failedEvent = events.find(e => e.description.includes('REWIND_FAILED'));
          const startedEvent = events.find(e => e.description.includes('REWIND_STARTED'));
          
          const status = completedEvent ? '✅' : failedEvent ? '❌' : '⏳';
          const statusText = completedEvent ? 'Completed' : failedEvent ? 'Failed' : 'In Progress';
          
          const targetDate = new Date(parseInt(targetTimestamp));
          const rewindDate = startedEvent ? new Date(startedEvent.timestamp) : new Date();
          
          content += `${opIndex}. ${status} ${statusText}\n`;
          content += `   Target Time: ${targetDate.toLocaleString()}\n`;
          content += `   Performed: ${rewindDate.toLocaleString()}\n`;
          
          if (completedEvent && completedEvent.payload) {
            const payload = completedEvent.payload;
            if (payload.duration_ms) {
              content += `   Duration: ${payload.duration_ms}ms\n`;
            }
            if (payload.session_created) {
              content += `   Session Created: Yes\n`;
            }
            if (payload.auto_checked_out) {
              content += `   Auto Checkout: Yes\n`;
            }
          }
          
          if (failedEvent && failedEvent.payload?.error) {
            content += `   Error: ${failedEvent.payload.error}\n`;
          }
          
          content += `\n`;
          opIndex++;
          
          if (opIndex > 20) {
            content += `... and ${rewindOps.size - 20} more operations\n`;
            break;
          }
        }
        
        content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        content += `💡 Use /rewind "<timestamp>" to perform a new time-travel\n`;
        content += `💡 Use /timeline --category REWIND for detailed event log`;
        
        const resultEntry: ChatEntry = {
          type: "assistant",
          content,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, resultEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to load rewind history: ${error?.message || 'Unknown error'}`,
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
          } else if (['timeline_query', 'rewind_to', 'list_time_points'].includes(name)) {
            sessionMgmt.push(formattedTool); // Timeline tools in session management
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
        let cloneGit = false;
        let copyFiles = false;
        let fromRewind: string | undefined;
        
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
          } else if (arg === '--clone-git') {
            cloneGit = true;
          } else if (arg === '--copy-files') {
            copyFiles = true;
          } else if (arg === '--from-rewind' && args[i + 1]) {
            fromRewind = args[i + 1];
            i++; // Skip next arg
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
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Handle directory initialization options
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        // --from-rewind: Use rewind to initialize directory (highest priority)
        if (fromRewind) {
          const infoEntry: ChatEntry = {
            type: "assistant",
            content: `⏳ Initializing directory from rewind at ${fromRewind}...\n` +
                     `This may take a moment...`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, infoEntry]);
          
          const { executeRewindTo } = await import("../tools/rewind-to-tool.js");
          const rewindResult = await executeRewindTo({
            targetTimestamp: fromRewind,
            outputDir: targetWorkdir,
            includeFiles: true,
            includeConversations: importHistory,
            gitMode: 'full', // Always use full git mode for from-rewind
            createSession: false, // We'll create session ourselves
          });
          
          if (!rewindResult.success) {
            throw new Error(`Rewind failed: ${rewindResult.error}`);
          }
          
          const rewindInfoEntry: ChatEntry = {
            type: "assistant",
            content: `✅ Directory initialized from rewind\n` +
                     `   Files Restored: ${rewindResult.filesRestored}\n` +
                     `   Events Replayed: ${rewindResult.eventsReplayed}\n` +
                     `   Duration: ${rewindResult.durationMs}ms`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, rewindInfoEntry]);
        }
        // --clone-git: Clone current git repository
        else if (cloneGit) {
          const infoEntry: ChatEntry = {
            type: "assistant",
            content: `⏳ Cloning Git repository to ${targetWorkdir}...\n` +
                     `This may take a moment...`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, infoEntry]);
          
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          const currentDir = process.cwd();
          const gitDir = `${currentDir}/.git`;
          
          if (!fs.existsSync(gitDir)) {
            throw new Error('Not in a Git repository. Cannot use --clone-git');
          }
          
          try {
            // Clone the current repo to target directory
            await execAsync(`git clone "${currentDir}" "${targetWorkdir}_temp"`);
            
            // Move contents from temp to target
            await execAsync(`cp -r "${targetWorkdir}_temp/"* "${targetWorkdir}/" 2>/dev/null || true`);
            await execAsync(`cp -r "${targetWorkdir}_temp/".* "${targetWorkdir}/" 2>/dev/null || true`);
            
            // Remove temp directory
            await execAsync(`rm -rf "${targetWorkdir}_temp"`);
            
            const cloneInfoEntry: ChatEntry = {
              type: "assistant",
              content: `✅ Git repository cloned successfully`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, cloneInfoEntry]);
          } catch (error: any) {
            throw new Error(`Git clone failed: ${error.message}`);
          }
        }
        // --copy-files: Copy files from current directory (excluding .git)
        else if (copyFiles) {
          const infoEntry: ChatEntry = {
            type: "assistant",
            content: `⏳ Copying files to ${targetWorkdir}...\n` +
                     `This may take a moment...`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, infoEntry]);
          
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          const currentDir = process.cwd();
          
          try {
            // Copy all files except .git, node_modules, and hidden files
            await execAsync(
              `rsync -av --exclude='.git' --exclude='node_modules' --exclude='.*' "${currentDir}/" "${targetWorkdir}/" 2>/dev/null || ` +
              `cp -r "${currentDir}/"* "${targetWorkdir}/" 2>/dev/null || true`
            );
            
            const copyInfoEntry: ChatEntry = {
              type: "assistant",
              content: `✅ Files copied successfully (excluding .git)`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, copyInfoEntry]);
          } catch (error: any) {
            throw new Error(`File copy failed: ${error.message}`);
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
        
        const { session, history, importWarning } = await sessionManager.createNewSession(
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
        console.log('🐛 [DEBUG] Import warning:', importWarning || 'none');
        
        // Update agent with new session's model/provider
        const providerConfig = providerManager.getProviderForModel(targetModel);
        if (!providerConfig) {
          throw new Error(`Unknown provider for model: ${targetModel}`);
        }
        
        await agent.switchToModel(targetModel, apiKey, providerConfig.baseURL);
        
        // CRITICAL: Set switching flag to prevent auto-commit during state updates
        // Same behavior as /switch-session for consistency
        if (isSwitchingRef) {
          isSwitchingRef.current = true;
        }
        
        // CRITICAL: Change working directory if creating session in different directory
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
        
        // CRITICAL: Replace chat history with the new session's history
        // We update chatHistory first with just the loaded history (no confirmation yet)
        // This ensures committedHistory and chatHistory are in sync momentarily
        console.log('🐛 [DEBUG] Replacing chat history with', history.length, 'messages');
        setChatHistory(history);
        
        // Then update committedHistory to match (all loaded messages are "committed")
        if (setCommittedHistory) {
          setCommittedHistory(history);
        }
        
        // Finally add the confirmation message
        // This makes activeMessages = [confirmEntry] via the automatic useEffect calculation
        console.log('🐛 [DEBUG] Creating confirmation message');
        
        // Determine initialization mode
        let initMode = '';
        if (fromRewind) {
          initMode = `🕰️  **Directory Initialized:** From rewind at ${fromRewind}\n\n`;
        } else if (cloneGit) {
          initMode = `📦 **Directory Initialized:** Git repository cloned\n\n`;
        } else if (copyFiles) {
          initMode = `📄 **Directory Initialized:** Files copied from ${process.cwd()}\n\n`;
        } else {
          initMode = `📁 **Directory Initialized:** Empty (or existing files)\n\n`;
        }
        
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✅ **New Session Created** #${session.id}\n\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `📂 Working Directory: ${session.working_dir}\n` +
                   `🤖 Provider: ${session.default_provider}\n` +
                   `📱 Model: ${session.default_model}\n` +
                   `💬 Messages: ${history.length}${importHistory ? ' (imported)' : ''}\n` +
                   `🕐 Created: ${new Date(session.created_at).toLocaleString()}\n\n` +
                   initMode +
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
                       `   Messages: ${history.length} imported\n\n` +
                       (importWarning ? `${importWarning}\n\n` : '')
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
        
        // Allow auto-commit to resume after a small delay (let React finish batching)
        setTimeout(() => {
          if (isSwitchingRef) {
            isSwitchingRef.current = false;
          }
        }, 100);
        
        console.log('🐛 [DEBUG] /new-session COMPLETE');
        
      } catch (error: any) {
        // Reset switching flag on error
        if (isSwitchingRef) {
          isSwitchingRef.current = false;
        }
        
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
