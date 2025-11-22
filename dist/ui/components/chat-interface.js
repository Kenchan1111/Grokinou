import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, Static, useStdout } from "ink";
import { LoadingSpinner } from "./loading-spinner.js";
import { ChatHistory } from "./chat-history.js";
import { MemoizedArchived } from "./chat-history.js";
import { InputController } from "./input-controller.js";
import ConfirmationDialog from "./confirmation-dialog.js";
import { ConfirmationService, } from "../../utils/confirmation-service.js";
import ApiKeyInput from "./api-key-input.js";
import { loadChatHistory, loadState } from "../../utils/session-manager-sqlite.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { SplitLayout } from "./search/split-layout.js";
import { SearchResults } from "./search/search-results.js";
import { parseSearchCommand, executeSearchCommand } from "../../commands/search.js";
import { sessionManager } from "../../utils/session-manager-sqlite.js";
// Separate memoized streaming display to prevent input flickering
const StreamingDisplay = React.memo(({ isStreaming, streamingContent, streamingTools, streamingToolResults, }) => {
    if (!isStreaming || (!streamingContent && (!streamingTools || streamingTools.length === 0))) {
        return null;
    }
    return (React.createElement(Box, { flexDirection: "column", marginTop: 1 },
        streamingContent && (React.createElement(Box, { flexDirection: "row", alignItems: "flex-start" },
            React.createElement(Text, { color: "white" }, "\u23FA "),
            React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
                React.createElement(Text, { color: "white" }, streamingContent),
                React.createElement(Text, { color: "cyan" }, "\u2588")))),
        streamingTools && streamingTools.length > 0 && (React.createElement(Box, { marginLeft: 2, flexDirection: "column" },
            React.createElement(Text, { color: "gray" }, "\u23BF Executing tools..."),
            streamingTools.map((tc, idx) => (React.createElement(Text, { key: tc.id || idx, color: "gray" },
                "\u23BF ",
                tc.function?.name || "tool"))))),
        streamingToolResults && streamingToolResults.length > 0 && (React.createElement(Box, { marginLeft: 2, flexDirection: "column" },
            React.createElement(Text, { color: "gray" }, "\u23BF Tool results:"),
            streamingToolResults.map((tr, idx) => (React.createElement(Text, { key: `tr_${idx}`, color: "gray" },
                "\u23BF ",
                typeof tr.content === 'string' ? tr.content.split("\n")[0] : 'Result')))))));
}, (prevProps, nextProps) => {
    // Only re-render if streaming content actually changed
    return (prevProps.isStreaming === nextProps.isStreaming &&
        prevProps.streamingContent === nextProps.streamingContent &&
        prevProps.streamingTools?.length === nextProps.streamingTools?.length &&
        prevProps.streamingToolResults?.length === nextProps.streamingToolResults?.length);
});
StreamingDisplay.displayName = 'StreamingDisplay';
// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({ agent, initialMessage, }) {
    const SHOW_STATUS = true; // Show spinner and token counter
    // Historique complet (pour l'agent)
    const [chatHistory, setChatHistory] = useState([]);
    // Historique STATIQUE : Tous les messages TERMINÉS (JSONL + messages complétés)
    const [committedHistory, setCommittedHistory] = useState([]);
    // Message actif EN COURS : soit user tape, soit Grok répond
    const [activeMessages, setActiveMessages] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingTime, setProcessingTime] = useState(0);
    const [tokenCount, setTokenCount] = useState(0);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const [streamingTools, setStreamingTools] = useState(null);
    const [confirmationOptions, setConfirmationOptions] = useState(null);
    const [streamingToolResults, setStreamingToolResults] = useState(null);
    const scrollRef = useRef();
    const processingStartTime = useRef(0);
    // Debounce streaming updates to prevent input lag
    const streamingUpdateRef = useRef(null);
    const pendingStreamingUpdate = useRef({});
    const confirmationService = ConfirmationService.getInstance();
    const VISIBLE_LIMIT = 10; // Keep only last N entries in dynamic tree (rest in Static)
    // Search mode states
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchFullscreen, setSearchFullscreen] = useState(false);
    const inputInjectionRef = useRef(null);
    // Stabilize setters with useCallback to prevent InputController re-renders
    const stableChatHistorySetter = useCallback((value) => {
        setChatHistory(value);
    }, []);
    const stableProcessingSetter = useCallback((value) => {
        setIsProcessing(value);
    }, []);
    const stableStreamingSetter = useCallback((value) => {
        setIsStreaming(value);
    }, []);
    // Debounced setters for streaming to prevent input lag
    const stableStreamingContentSetter = useCallback((value) => {
        if (typeof value === 'function') {
            setStreamingContent(value);
        }
        else {
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
    const stableStreamingToolsSetter = useCallback((tools) => {
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
    const stableStreamingToolResultsSetter = useCallback((results) => {
        if (typeof results === 'function') {
            setStreamingToolResults(results);
        }
        else {
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
    const stableTokenCountSetter = useCallback((count) => {
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
    const handleSearchCommand = useCallback((input) => {
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
    const handlePasteToInput = useCallback((text) => {
        if (inputInjectionRef.current) {
            inputInjectionRef.current(text);
        }
    }, []);
    const stableProcessingTimeSetter = useCallback((time) => {
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
    useEffect(() => {
        (async () => {
            try {
                const manager = getSettingsManager();
                const persistSession = manager.getProjectSetting("persistSession");
                const autoRestoreSession = manager.getProjectSetting("autoRestoreSession");
                if (persistSession !== false && autoRestoreSession !== false) {
                    const entries = await loadChatHistory();
                    if (entries.length > 0) {
                        // Historique JSONL → STATIQUE (messages terminés)
                        setCommittedHistory(entries);
                        setChatHistory(entries);
                        // Restore agent context
                        agent.restoreFromHistory(entries);
                    }
                    else {
                        setCommittedHistory([]);
                        setChatHistory([]);
                    }
                    // Restore model state if saved (optional)
                    const state = await loadState();
                    if (state?.model) {
                        agent.setModel(state.model);
                    }
                }
                else {
                    setCommittedHistory([]);
                    setChatHistory([]);
                }
            }
            catch {
                setChatHistory([]);
            }
        })();
    }, []);
    // Le logo est maintenant affiché AVANT le démarrage d'Ink dans index.ts
    // Plus besoin de le générer ici !
    // Extraire les messages EN COURS (pas encore committés dans l'historique statique)
    useEffect(() => {
        // Messages actifs = tous les messages qui ne sont PAS encore dans committedHistory
        const activeCount = chatHistory.length - committedHistory.length;
        if (activeCount > 0) {
            const active = chatHistory.slice(-activeCount);
            setActiveMessages(active);
        }
        else {
            setActiveMessages([]);
        }
    }, [chatHistory, committedHistory]);
    // Fonction pour "commit" un message dans l'historique statique
    const commitMessage = useCallback((entry) => {
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
            const userEntry = {
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
                    const pendingToolResults = [];
                    // Newline-gated flush (like Codex) - flush on newline OR timeout
                    const flush = () => {
                        if (!pendingBufferRef.text)
                            return;
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
                                    }
                                    else {
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
                                    const toolResultEntry = {
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
                                            const finalEntry = {
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
                }
                catch (error) {
                    const errorEntry = {
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
        const handleConfirmationRequest = (options) => {
            setConfirmationOptions(options);
        };
        confirmationService.on("confirmation-requested", handleConfirmationRequest);
        return () => {
            confirmationService.off("confirmation-requested", handleConfirmationRequest);
        };
    }, [confirmationService]);
    useEffect(() => {
        if (!SHOW_STATUS)
            return; // Disable processing time updates when status is hidden
        if (!isProcessing && !isStreaming) {
            setProcessingTime(0);
            return;
        }
        if (processingStartTime.current === 0) {
            processingStartTime.current = Date.now();
        }
        const interval = setInterval(() => {
            setProcessingTime(Math.floor((Date.now() - processingStartTime.current) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isProcessing, isStreaming]);
    const handleConfirmation = (dontAskAgain) => {
        confirmationService.confirmOperation(true, dontAskAgain);
        setConfirmationOptions(null);
    };
    const handleRejection = (feedback) => {
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
    const chatViewContent = (React.createElement(Box, { flexDirection: "column", height: searchMode ? "100%" : undefined, overflow: searchMode ? "hidden" : undefined },
        showTips && !searchMode && (React.createElement(Box, { flexDirection: "column" },
            React.createElement(Text, { color: "cyan", bold: true }, "Tips for getting started:"),
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { color: "gray" }, "1. Ask questions, edit files, or run commands."),
                React.createElement(Text, { color: "gray" }, "2. Be specific for the best results."),
                React.createElement(Text, { color: "gray" }, "3. Create GROK.md files to customize your interactions with Grok."),
                React.createElement(Text, { color: "gray" }, "4. Press Shift+Tab to toggle auto-edit mode."),
                React.createElement(Text, { color: "gray" }, "5. /help for more information.")))),
        React.createElement(Box, { flexDirection: "column", ref: searchMode ? undefined : scrollRef, flexGrow: 1, overflow: searchMode ? "hidden" : undefined },
            React.createElement(Static, { items: searchMode ? committedHistory.slice(-10) : committedHistory }, (entry, index) => (React.createElement(MemoizedArchived, { key: `committed-${entry.timestamp.getTime()}-${index}`, entry: entry }))),
            React.createElement(ChatHistory, { entries: activeMessages, isConfirmationActive: !!confirmationOptions }),
            React.createElement(StreamingDisplay, { isStreaming: isStreaming, streamingContent: streamingContent, streamingTools: streamingTools, streamingToolResults: streamingToolResults })),
        confirmationOptions && (React.createElement(ConfirmationDialog, { operation: confirmationOptions.operation, filename: confirmationOptions.filename, showVSCodeOpen: confirmationOptions.showVSCodeOpen, content: confirmationOptions.content, onConfirm: handleConfirmation, onReject: handleRejection })),
        !confirmationOptions && !searchMode && (React.createElement(React.Fragment, null,
            SHOW_STATUS && (React.createElement(LoadingSpinner, { isActive: isProcessing || isStreaming, processingTime: processingTime, tokenCount: tokenCount })),
            React.createElement(InputController, { agent: agent, chatHistory: chatHistory, setChatHistory: stableChatHistorySetter, setIsProcessing: stableProcessingSetter, setIsStreaming: stableStreamingSetter, setStreamingContent: stableStreamingContentSetter, setStreamingTools: stableStreamingToolsSetter, setStreamingToolResults: stableStreamingToolResultsSetter, setTokenCount: stableTokenCountSetter, setProcessingTime: stableProcessingTimeSetter, processingStartTime: processingStartTime, isProcessing: isProcessing, isStreaming: isStreaming, isConfirmationActive: !!confirmationOptions, searchMode: searchMode, onSearchCommand: handleSearchCommand, inputInjectionRef: inputInjectionRef }))),
        !confirmationOptions && searchMode && (React.createElement(Box, { borderStyle: "single", borderColor: "cyan", paddingX: 1, marginTop: 1 },
            React.createElement(Text, { color: "cyan", bold: true }, "\uD83D\uDD0D Search Mode Active"),
            React.createElement(Text, { dimColor: true },
                " ",
                "\u2022 Use \u2191/\u2193 to navigate results \u2022 Enter to expand \u2022 Ctrl+S to copy \u2022 Esc to close")))));
    // Get terminal height for fixed viewport (prevent stacking on scroll)
    const { stdout: mainStdout } = useStdout();
    const terminalHeight = mainStdout?.rows || 24;
    return (React.createElement(Box, { flexDirection: "column", paddingX: 2, height: searchMode ? terminalHeight : undefined, overflow: searchMode ? "hidden" : undefined }, searchMode ? (searchFullscreen ? (
    // Fullscreen search results (no conversation)
    React.createElement(SearchResults, { query: searchQuery, results: searchResults, onClose: handleCloseSearch, onPasteToInput: handlePasteToInput, onToggleFullscreen: handleToggleFullscreen, fullscreen: true })) : (
    // Split view (conversation + search results)
    React.createElement(SplitLayout, { left: chatViewContent, right: React.createElement(SearchResults, { query: searchQuery, results: searchResults, onClose: handleCloseSearch, onPasteToInput: handlePasteToInput, onToggleFullscreen: handleToggleFullscreen, fullscreen: false }), splitRatio: 0.5 }))) : (chatViewContent)));
}
// Main component that handles API key input or chat interface
export default function ChatInterface({ agent, initialMessage, }) {
    const [currentAgent, setCurrentAgent] = useState(agent || null);
    const handleApiKeySet = (newAgent) => {
        setCurrentAgent(newAgent);
    };
    if (!currentAgent) {
        return React.createElement(ApiKeyInput, { onApiKeySet: handleApiKeySet });
    }
    return (React.createElement(ChatInterfaceWithAgent, { agent: currentAgent, initialMessage: initialMessage }));
}
//# sourceMappingURL=chat-interface.js.map