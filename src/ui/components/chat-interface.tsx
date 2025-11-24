import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Box, Text, Static, useStdout } from "ink";
import { GrokAgent, ChatEntry } from "../../agent/grok-agent.js";
import { LoadingSpinner } from "./loading-spinner.js";
import { ChatHistory } from "./chat-history.js";
import { MemoizedArchived } from "./chat-history.js";
import { InputController } from "./input-controller.js";
import ConfirmationDialog from "./confirmation-dialog.js";
import {
  ConfirmationService,
  ConfirmationOptions,
} from "../../utils/confirmation-service.js";
import ApiKeyInput from "./api-key-input.js";
import cfonts from "cfonts";
import { loadChatHistory, loadState } from "../../utils/session-manager-sqlite.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { SplitLayout } from "./search/split-layout.js";
import { SearchResults } from "./search/search-results.js";
import { parseSearchCommand, executeSearchCommand } from "../../commands/search.js";
import { SearchResult } from "../../utils/search-manager.js";
import { sessionManager } from "../../utils/session-manager-sqlite.js";
import { generateStatusMessage } from "../../utils/status-message.js";

interface ChatInterfaceProps {
  agent?: GrokAgent;
  initialMessage?: string;
}

// Separate memoized streaming display to prevent input flickering
const StreamingDisplay = React.memo(({
  isStreaming,
  streamingContent,
  streamingTools,
  streamingToolResults,
}: {
  isStreaming: boolean;
  streamingContent: string;
  streamingTools: any[] | null;
  streamingToolResults: any[] | null;
}) => {
  if (!isStreaming || (!streamingContent && (!streamingTools || streamingTools.length === 0))) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {streamingContent && (
        <Box flexDirection="row" alignItems="flex-start">
          <Text color="white">⏺ </Text>
          <Box flexDirection="column" flexGrow={1}>
            <Text color="white">{streamingContent}</Text>
            <Text color="cyan">█</Text>
          </Box>
        </Box>
      )}
      {streamingTools && streamingTools.length > 0 && (
        <Box marginLeft={2} flexDirection="column">
          <Text color="gray">⎿ Executing tools...</Text>
          {streamingTools.map((tc, idx) => (
            <Text key={tc.id || idx} color="gray">⎿ {tc.function?.name || "tool"}</Text>
          ))}
        </Box>
      )}
      {streamingToolResults && streamingToolResults.length > 0 && (
        <Box marginLeft={2} flexDirection="column">
          <Text color="gray">⎿ Tool results:</Text>
          {streamingToolResults.map((tr: any, idx: number) => (
            <Text key={`tr_${idx}`} color="gray">
              ⎿ {typeof tr.content === 'string' ? tr.content.split("\n")[0] : 'Result'}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}, (prevProps, nextProps) => {
  // Only re-render if streaming content actually changed
  return (
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.streamingContent === nextProps.streamingContent &&
    prevProps.streamingTools?.length === nextProps.streamingTools?.length &&
    prevProps.streamingToolResults?.length === nextProps.streamingToolResults?.length
  );
});

StreamingDisplay.displayName = 'StreamingDisplay';

// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({
  agent,
  initialMessage,
}: {
  agent: GrokAgent;
  initialMessage?: string;
}) {
  const SHOW_STATUS = true; // Show spinner and token counter
  
  // Historique complet (pour l'agent)
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  
  // Historique STATIQUE : Tous les messages TERMINÉS (JSONL + messages complétés)
  const [committedHistory, setCommittedHistory] = useState<ChatEntry[]>([]);
  
  // Message actif EN COURS : soit user tape, soit Grok répond
  const [activeMessages, setActiveMessages] = useState<ChatEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingTools, setStreamingTools] = useState<any[] | null>(null);
  const [confirmationOptions, setConfirmationOptions] =
    useState<ConfirmationOptions | null>(null);
  const [streamingToolResults, setStreamingToolResults] = useState<any[] | null>(null);
  const scrollRef = useRef<any>();
  const processingStartTime = useRef<number>(0);
  
  // Debounce streaming updates to prevent input lag
  const streamingUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStreamingUpdate = useRef<{
    content?: string;
    tools?: any[] | null;
    toolResults?: any[] | null;
    tokenCount?: number;
  }>({});

  const confirmationService = ConfirmationService.getInstance();
  const VISIBLE_LIMIT = 10; // Keep only last N entries in dynamic tree (rest in Static)
  
  // Search mode states
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchFullscreen, setSearchFullscreen] = useState(false);
  const inputInjectionRef = useRef<((text: string) => void) | null>(null);

  // Stabilize setters with useCallback to prevent InputController re-renders
  const stableChatHistorySetter = useCallback((value: React.SetStateAction<ChatEntry[]>) => {
    setChatHistory(value);
  }, []);

  const stableProcessingSetter = useCallback((value: boolean) => {
    setIsProcessing(value);
  }, []);

  const stableStreamingSetter = useCallback((value: boolean) => {
    setIsStreaming(value);
  }, []);

  // Debounced setters for streaming to prevent input lag
  const stableStreamingContentSetter = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      setStreamingContent(value);
    } else {
      // Debounce rapid updates
      pendingStreamingUpdate.current.content = value;
      if (streamingUpdateRef.current) {
        clearTimeout(streamingUpdateRef.current);
      }
      streamingUpdateRef.current = setTimeout(() => {
        if (pendingStreamingUpdate.current.content !== undefined) {
          setStreamingContent(pendingStreamingUpdate.current.content);
          pendingStreamingUpdate.current.content = undefined;
        }
      }, 100); // 100ms debounce
    }
  }, []);

  const stableStreamingToolsSetter = useCallback((tools: any[] | null) => {
    pendingStreamingUpdate.current.tools = tools;
    if (streamingUpdateRef.current) {
      clearTimeout(streamingUpdateRef.current);
    }
    streamingUpdateRef.current = setTimeout(() => {
      if (pendingStreamingUpdate.current.tools !== undefined) {
        setStreamingTools(pendingStreamingUpdate.current.tools);
        pendingStreamingUpdate.current.tools = undefined;
      }
    }, 100);
  }, []);

  const stableStreamingToolResultsSetter = useCallback((results: any[] | null | ((prev: any[] | null) => any[] | null)) => {
    if (typeof results === 'function') {
      setStreamingToolResults(results);
    } else {
      pendingStreamingUpdate.current.toolResults = results;
      if (streamingUpdateRef.current) {
        clearTimeout(streamingUpdateRef.current);
      }
      streamingUpdateRef.current = setTimeout(() => {
        if (pendingStreamingUpdate.current.toolResults !== undefined) {
          setStreamingToolResults(pendingStreamingUpdate.current.toolResults);
          pendingStreamingUpdate.current.toolResults = undefined;
        }
      }, 100);
    }
  }, []);

  const stableTokenCountSetter = useCallback((count: number) => {
    pendingStreamingUpdate.current.tokenCount = count;
    if (streamingUpdateRef.current) {
      clearTimeout(streamingUpdateRef.current);
    }
    streamingUpdateRef.current = setTimeout(() => {
      if (pendingStreamingUpdate.current.tokenCount !== undefined) {
        setTokenCount(pendingStreamingUpdate.current.tokenCount);
        pendingStreamingUpdate.current.tokenCount = undefined;
      }
    }, 200); // Token count can be even slower
  }, []);

  // Handle search command
  const handleSearchCommand = useCallback((input: string): boolean => {
    const searchCmd = parseSearchCommand(input);
    
    if (searchCmd) {
      // Get current session ID
      const currentSession = sessionManager.getCurrentSession();
      const sessionId = currentSession?.id;
      
      // Execute search
      const results = executeSearchCommand(searchCmd, sessionId);
      
      // Update search state
      setSearchQuery(searchCmd.query);
      setSearchResults(results);
      setSearchMode(true);
      
      return true; // Command handled
    }
    
    return false; // Not a search command
  }, []);
  
  // Close search mode
  const handleCloseSearch = useCallback(() => {
    setSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchFullscreen(false);
  }, []);
  
  // Toggle fullscreen for search results
  const handleToggleFullscreen = useCallback(() => {
    setSearchFullscreen(prev => !prev);
  }, []);
  
  // Paste to input (from clipboard via Ctrl+P in search)
  const handlePasteToInput = useCallback((text: string) => {
    if (inputInjectionRef.current) {
      inputInjectionRef.current(text);
    }
  }, []);

  const stableProcessingTimeSetter = useCallback((time: number) => {
    setProcessingTime(time);
  }, []);

  // Cleanup streaming timers on unmount
  useEffect(() => {
    return () => {
      if (streamingUpdateRef.current) {
        clearTimeout(streamingUpdateRef.current);
      }
    };
  }, []);

  // Input is handled by InputController to avoid rerendering parent on each keystroke
  
  // Track if status was already added (to avoid duplicates in React strict mode)
  const statusAddedRef = useRef(false);

  useEffect(() => {
    // Avoid duplicate execution in React strict mode
    if (statusAddedRef.current) return;
    statusAddedRef.current = true;
    
    (async () => {
      try {
        const manager = getSettingsManager();
        const persistSession = manager.getProjectSetting("persistSession");
        const autoRestoreSession = manager.getProjectSetting("autoRestoreSession");

        if (persistSession !== false && autoRestoreSession !== false) {
          const entries = await loadChatHistory();
          
          // Generate status message using the same logic as /status command
          let statusMessage: ChatEntry | null = null;
          try {
            statusMessage = generateStatusMessage(agent);
          } catch (error) {
            console.error('Failed to generate status message:', error);
          }
          
          if (entries.length > 0) {
            // Historique JSONL → STATIQUE (messages terminés)
            const historyToSet = statusMessage ? [...entries, statusMessage] : entries;
            setCommittedHistory(historyToSet);
            setChatHistory(historyToSet);
            
            // Restore agent context
            agent.restoreFromHistory(entries);
          } else {
            // New session
            const historyToSet = statusMessage ? [statusMessage] : [];
            setCommittedHistory(historyToSet);
            setChatHistory(historyToSet);
          }
          
          // Restore model state if saved (optional)
          const state = await loadState();
          if (state?.model) {
            agent.setModel(state.model);
          }
        } else {
          setCommittedHistory([]);
          setChatHistory([]);
        }
      } catch (error) {
        console.error('Session load error:', error);
        setChatHistory([]);
      }
    })();
  }, [agent]);

  // Le logo est maintenant affiché AVANT le démarrage d'Ink dans index.ts
  // Plus besoin de le générer ici !

  // Extraire les messages EN COURS (pas encore committés dans l'historique statique)
  useEffect(() => {
    // Messages actifs = tous les messages qui ne sont PAS encore dans committedHistory
    const activeCount = chatHistory.length - committedHistory.length;
    if (activeCount > 0) {
      const active = chatHistory.slice(-activeCount);
      setActiveMessages(active);
    } else {
      setActiveMessages([]);
    }
  }, [chatHistory, committedHistory]);
  
  // Fonction pour "commit" un message dans l'historique statique
  const commitMessage = useCallback((entry: ChatEntry) => {
    setCommittedHistory(prev => [...prev, entry]);
  }, []);
  
  // Commit automatique quand un message est terminé
  useEffect(() => {
    // Si on n'est pas en train de streamer et qu'il y a des messages actifs
    if (!isStreaming && !isProcessing && activeMessages.length > 0) {
      // Commit tous les messages actifs dans l'historique statique
      setCommittedHistory(prev => [...prev, ...activeMessages]);
      setActiveMessages([]);
    }
  }, [isStreaming, isProcessing, activeMessages]);

  // Process initial message if provided (streaming for faster feedback)
  useEffect(() => {
    if (initialMessage && agent) {
      const userEntry: ChatEntry = {
        type: "user",
        content: initialMessage,
        timestamp: new Date(),
      };
      setChatHistory([userEntry]);

      const processInitialMessage = async () => {
        setIsProcessing(true);
        setIsStreaming(true);
        setStreamingContent("");
        setStreamingTools(null);
        setStreamingToolResults(null);

        try {
          let hasStarted = false;
          const pendingBufferRef = { text: "" };
          const lastFlushRef = { t: 0 };
          const pendingToolResults: ChatEntry[] = [];
          
          // Newline-gated flush (like Codex) - flush on newline OR timeout
          const flush = () => {
            if (!pendingBufferRef.text) return;
            const appendText = pendingBufferRef.text;
            pendingBufferRef.text = "";
            setStreamingContent((prev) => prev + appendText);
          };

          for await (const chunk of agent.processUserMessageStream(initialMessage)) {
            switch (chunk.type) {
              case "content":
                if (chunk.content) {
                  hasStarted = true;
                  pendingBufferRef.text += chunk.content;
                  
                  // Flush immediately if newline (like Codex!)
                  if (chunk.content.includes('\n')) {
                    flush();
                    lastFlushRef.t = Date.now();
                  } else {
                    // Fallback: flush after 800ms for content without newlines
                    const now = Date.now();
                    if (now - lastFlushRef.t > 800) {
                      flush();
                      lastFlushRef.t = now;
                    }
                  }
                }
                break;
              case "token_count":
                if (SHOW_STATUS && chunk.tokenCount !== undefined) {
                  setTokenCount(chunk.tokenCount);
                }
                break;
              case "tool_calls":
                if (chunk.toolCalls) {
                  setStreamingTools(chunk.toolCalls);
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
                  pendingToolResults.push(toolResultEntry);
                  setStreamingToolResults((prev) => (prev ? [...prev, toolResultEntry] : [toolResultEntry]));
                }
                break;
              case "done":
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

      processInitialMessage();
    }
  }, [initialMessage, agent]);

  useEffect(() => {
    const handleConfirmationRequest = (options: ConfirmationOptions) => {
      setConfirmationOptions(options);
    };

    confirmationService.on("confirmation-requested", handleConfirmationRequest);

    return () => {
      confirmationService.off(
        "confirmation-requested",
        handleConfirmationRequest
      );
    };
  }, [confirmationService]);

  useEffect(() => {
    if (!SHOW_STATUS) return; // Disable processing time updates when status is hidden
    if (!isProcessing && !isStreaming) {
      setProcessingTime(0);
      return;
    }

    if (processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
    }

    const interval = setInterval(() => {
      setProcessingTime(
        Math.floor((Date.now() - processingStartTime.current) / 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, isStreaming]);

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);

    // Reset processing states when operation is cancelled
    setIsProcessing(false);
    setIsStreaming(false);
    setTokenCount(0);
    setProcessingTime(0);
    processingStartTime.current = 0;
  };

  // Tips uniquement si pas d'historique au démarrage
  const showTips = committedHistory.length === 0 && !confirmationOptions;

  // Chat view content (reused in both normal and split modes)
  const chatViewContent = (
    <Box flexDirection="column" height={searchMode ? "100%" : undefined} overflow={searchMode ? "hidden" : undefined}>
      {/* Tips uniquement au premier démarrage sans historique */}
      {showTips && !searchMode && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Tips for getting started:
          </Text>
          <Box flexDirection="column">
            <Text color="gray">
              1. Ask questions, edit files, or run commands.
            </Text>
            <Text color="gray">2. Be specific for the best results.</Text>
            <Text color="gray">
              3. Create GROK.md files to customize your interactions with Grok.
            </Text>
            <Text color="gray">
              4. Press Shift+Tab to toggle auto-edit mode.
            </Text>
            <Text color="gray">5. /help for more information.</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" ref={searchMode ? undefined : scrollRef} flexGrow={1} overflow={searchMode ? "hidden" : undefined}>
        {/* HISTORIQUE STATIQUE : Tous les messages TERMINÉS (committed) */}
        {/* En mode recherche, limiter l'affichage pour éviter le scroll */}
        <Static items={searchMode ? committedHistory.slice(-10) : committedHistory}>
          {(entry, index) => (
            <MemoizedArchived key={`committed-${entry.timestamp.getTime()}-${index}`} entry={entry} />
          )}
        </Static>
        
        {/* MESSAGES ACTIFS : En cours de création/affichage */}
        <ChatHistory
          entries={activeMessages}
          isConfirmationActive={!!confirmationOptions}
        />
        
        {/* STREAMING EN COURS : Message de Grok en train d'être écrit */}
        <StreamingDisplay
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          streamingTools={streamingTools}
          streamingToolResults={streamingToolResults}
        />
      </Box>

      {/* Show confirmation dialog if one is pending */}
      {confirmationOptions && (
        <ConfirmationDialog
          operation={confirmationOptions.operation}
          filename={confirmationOptions.filename}
          showVSCodeOpen={confirmationOptions.showVSCodeOpen}
          content={confirmationOptions.content}
          onConfirm={handleConfirmation}
          onReject={handleRejection}
        />
      )}

      {!confirmationOptions && !searchMode && (
        <>
          {SHOW_STATUS && (
            <LoadingSpinner
              isActive={isProcessing || isStreaming}
              processingTime={processingTime}
              tokenCount={tokenCount}
            />
          )}

          <InputController
            agent={agent}
            chatHistory={chatHistory}
            setChatHistory={stableChatHistorySetter}
            setIsProcessing={stableProcessingSetter}
            setIsStreaming={stableStreamingSetter}
            setStreamingContent={stableStreamingContentSetter}
            setStreamingTools={stableStreamingToolsSetter}
            setStreamingToolResults={stableStreamingToolResultsSetter}
            setTokenCount={stableTokenCountSetter}
            setProcessingTime={stableProcessingTimeSetter}
            processingStartTime={processingStartTime}
            isProcessing={isProcessing}
            isStreaming={isStreaming}
            isConfirmationActive={!!confirmationOptions}
            searchMode={searchMode}
            onSearchCommand={handleSearchCommand}
            inputInjectionRef={inputInjectionRef}
          />
        </>
      )}
      
      {/* Search mode status indicator */}
      {!confirmationOptions && searchMode && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
          <Text color="cyan" bold>
            🔍 Search Mode Active
          </Text>
          <Text dimColor>
            {" "}• Use ↑/↓ to navigate results • Enter to expand • Ctrl+S to copy • Esc to close
          </Text>
        </Box>
      )}
    </Box>
  );
  
  // Get terminal height for fixed viewport (prevent stacking on scroll)
  const { stdout: mainStdout } = useStdout();
  const terminalHeight = mainStdout?.rows || 24;
  
  return (
    <Box flexDirection="column" paddingX={2} height={searchMode ? terminalHeight : undefined} overflow={searchMode ? "hidden" : undefined}>
      {searchMode ? (
        searchFullscreen ? (
          // Fullscreen search results (no conversation)
          <SearchResults
            query={searchQuery}
            results={searchResults}
            onClose={handleCloseSearch}
            onPasteToInput={handlePasteToInput}
            onToggleFullscreen={handleToggleFullscreen}
            fullscreen={true}
          />
        ) : (
          // Split view (conversation + search results)
          <SplitLayout
            left={chatViewContent}
            right={
              <SearchResults
                query={searchQuery}
                results={searchResults}
                onClose={handleCloseSearch}
                onPasteToInput={handlePasteToInput}
                onToggleFullscreen={handleToggleFullscreen}
                fullscreen={false}
              />
            }
            splitRatio={0.5}
          />
        )
      ) : (
        chatViewContent
      )}
    </Box>
  );
}

// Main component that handles API key input or chat interface
export default function ChatInterface({
  agent,
  initialMessage,
}: ChatInterfaceProps) {
  const [currentAgent, setCurrentAgent] = useState<GrokAgent | null>(
    agent || null
  );

  const handleApiKeySet = (newAgent: GrokAgent) => {
    setCurrentAgent(newAgent);
  };

  if (!currentAgent) {
    return <ApiKeyInput onApiKeySet={handleApiKeySet} />;
  }

  return (
    <ChatInterfaceWithAgent
      agent={currentAgent}
      initialMessage={initialMessage}
    />
  );
}
