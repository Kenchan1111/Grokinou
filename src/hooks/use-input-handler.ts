import { useState, useMemo, useEffect, useCallback } from "react";
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

interface UseInputHandlerProps {
  agent: GrokAgent;
  chatHistory: ChatEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
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

  const handleInputSubmit = async (userInput: string) => {
    if (userInput === "exit" || userInput === "quit") {
      process.exit(0);
      return;
    }

    // Expand placeholders before processing
    const expandedInput = pasteManager.expandPlaceholders(userInput);

    if (expandedInput.trim()) {
      const directCommandResult = await handleDirectCommand(expandedInput);
      if (!directCommandResult) {
        await processUserMessage(expandedInput);
      }
      // Clear pending pastes after successful submit
      pasteManager.clearAll();
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
    { command: "/switch", description: "Switch to a different session by ID" },
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
  /switch <id> - Switch to a different session by ID
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
    // /list_sessions - List all sessions in current directory
    // ============================================
    if (trimmedInput === "/list_sessions") {
      try {
        const sessions = sessionManager.listSessions(
          process.cwd(),
          {
            sortBy: 'last_activity',
            sortOrder: 'DESC',
            limit: 20
          }
        );

        if (sessions.length === 0) {
          const noSessionEntry: ChatEntry = {
            type: "assistant",
            content: `📂 No sessions found in current directory\n\n` +
                     `📁 Working Directory: ${process.cwd()}\n\n` +
                     `Start chatting to create a new session!`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, noSessionEntry]);
          clearInput();
          return true;
        }

        // Format sessions list
        let content = `📚 Sessions in Current Directory\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📁 Working Directory: ${process.cwd()}\n` +
                      `📊 Total Sessions: ${sessions.length}\n\n`;

        sessions.forEach((session, index) => {
          const status = session.status === 'active' ? '🟢' : 
                        session.status === 'completed' ? '⚪' : '📦';
          const favorite = session.is_favorite ? '⭐' : '';
          
          content += `${status} Session #${session.id}${favorite}\n`;
          
          if (session.session_name) {
            content += `   📝 Name: ${session.session_name}\n`;
          }
          
          content += `   🤖 Provider: ${session.default_provider}\n`;
          content += `   📱 Model: ${session.default_model}\n`;
          content += `   💬 Messages: ${session.message_count}\n`;
          
          if (session.total_tokens > 0) {
            const tokenDisplay = session.total_tokens.toLocaleString('en-US');
            content += `   🎯 Tokens: ${tokenDisplay}\n`;
          }
          
          content += `   🕐 Last Activity: ${session.last_activity_relative}\n`;
          
          if (session.age_days !== undefined) {
            content += `   📅 Age: ${session.age_days} days\n`;
          }
          
          if (session.first_message_preview) {
            const preview = session.first_message_preview.length > 60 
              ? session.first_message_preview.substring(0, 60) + '...'
              : session.first_message_preview;
            content += `   💭 First Message: "${preview}"\n`;
          }
          
          if (index < sessions.length - 1) {
            content += `   ─────────────────────────────────\n`;
          }
        });

        content += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        content += `\n💡 Legend:\n`;
        content += `   🟢 Active  ⚪ Completed  📦 Archived  ⭐ Favorite\n`;
        content += `\n💡 To switch to a session, use: /switch <id>`;

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
    // /switch <id> - Switch to a different session
    // ============================================
    if (trimmedInput.startsWith("/switch")) {
      const parts = trimmedInput.split(/\s+/);
      
      if (parts.length < 2 || !parts[1]) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Usage: /switch <session_id>\n\n` +
                   `Example: /switch 5\n\n` +
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
        // Switch session
        const { session, history } = await sessionManager.switchSession(sessionId);
        
        // Update agent with new session's model/provider
        const providerConfig = providerManager.getProviderForModel(session.default_model);
        if (!providerConfig) {
          throw new Error(`Unknown provider for model: ${session.default_model}`);
        }
        
        const apiKey = agent.getApiKey(); // Keep current API key
        await agent.switchToModel(session.default_model, apiKey, providerConfig.baseURL);
        
        // Replace chat history with the new session's history
        setChatHistory(history);
        
        // Add confirmation message
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
                   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `Conversation history loaded! Continue chatting...`,
          timestamp: new Date(),
        };
        
        setChatHistory((prev) => [...prev, confirmEntry]);
        
      } catch (error: any) {
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
        const result = await agent.executeBashCommand(trimmedInput);

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
