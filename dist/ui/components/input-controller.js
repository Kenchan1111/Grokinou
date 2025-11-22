import React from "react";
import { Box, Text } from "ink";
import { useInputHandler } from "../../hooks/use-input-handler.js";
import { ChatInput } from "./chat-input.js";
import { CommandSuggestions } from "./command-suggestions.js";
import { ModelSelection } from "./model-selection.js";
import { MCPStatus } from "./mcp-status.js";
// This component encapsulates input state and handlers to avoid rerendering the parent on every keystroke
// Memoized to prevent unnecessary re-renders when chat history updates
const InputControllerComponent = (props) => {
    const { agent, chatHistory, setChatHistory, setIsProcessing, setIsStreaming, setStreamingContent, setStreamingTools, setStreamingToolResults, setTokenCount, setProcessingTime, processingStartTime, isProcessing, isStreaming, isConfirmationActive, searchMode, onSearchCommand, inputInjectionRef, } = props;
    const { input, cursorPosition, showCommandSuggestions, selectedCommandIndex, showModelSelection, selectedModelIndex, commandSuggestions, availableModels, autoEditEnabled, } = useInputHandler({
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
        isConfirmationActive,
        searchMode,
        onSearchCommand,
        inputInjectionRef,
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(ChatInput, { input: input, cursorPosition: cursorPosition, isProcessing: isProcessing, isStreaming: isStreaming }),
        React.createElement(Box, { flexDirection: "row", marginTop: 1 },
            React.createElement(Box, { marginRight: 2 },
                React.createElement(Text, { color: "cyan" },
                    autoEditEnabled ? "▶" : "⏸",
                    " auto-edit:",
                    " ",
                    autoEditEnabled ? "on" : "off"),
                React.createElement(Text, { color: "gray", dimColor: true },
                    " ",
                    "(shift + tab)")),
            React.createElement(Box, { marginRight: 2 },
                React.createElement(Text, { color: "yellow" },
                    "\u224B ",
                    agent.getCurrentModel())),
            React.createElement(MCPStatus, null)),
        React.createElement(CommandSuggestions, { suggestions: commandSuggestions, input: input, selectedIndex: selectedCommandIndex, isVisible: showCommandSuggestions }),
        React.createElement(ModelSelection, { models: availableModels, selectedIndex: selectedModelIndex, isVisible: showModelSelection, currentModel: agent.getCurrentModel() })));
};
// Export memoized version that only re-renders when necessary props change
export const InputController = React.memo(InputControllerComponent, (prevProps, nextProps) => {
    // Only re-render if these critical props change
    // chatHistory changes should NOT trigger re-render (only used for input processing, not display)
    return (prevProps.isProcessing === nextProps.isProcessing &&
        prevProps.isStreaming === nextProps.isStreaming &&
        prevProps.isConfirmationActive === nextProps.isConfirmationActive &&
        prevProps.agent === nextProps.agent &&
        prevProps.chatHistory.length === nextProps.chatHistory.length);
});
//# sourceMappingURL=input-controller.js.map