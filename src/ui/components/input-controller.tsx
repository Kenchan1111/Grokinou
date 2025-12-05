import React from "react";
import { Box, Text } from "ink";
import { GrokAgent, ChatEntry } from "../../agent/grok-agent.js";
import { useInputHandler } from "../../hooks/use-input-handler.js";
import { ChatInput } from "./chat-input.js";
import { CommandSuggestions } from "./command-suggestions.js";
import { ModelSelection } from "./model-selection.js";
import { MCPStatus } from "./mcp-status.js";

interface InputControllerProps {
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
  isConfirmationActive: boolean;
  searchMode?: boolean;
  onSearchCommand?: (input: string) => boolean;
  inputInjectionRef?: React.MutableRefObject<((text: string) => void) | null>;
}

// This component encapsulates input state and handlers to avoid rerendering the parent on every keystroke
// Memoized to prevent unnecessary re-renders when chat history updates
const InputControllerComponent = (props: InputControllerProps) => {
  const {
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
    isConfirmationActive,
    searchMode,
    onSearchCommand,
    inputInjectionRef,
  } = props;

  const {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    showModelSelection,
    selectedModelIndex,
    commandSuggestions,
    availableModels,
    autoEditEnabled,
  } = useInputHandler({
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
    isConfirmationActive,
    searchMode,
    onSearchCommand,
    inputInjectionRef,
  });

  return (
    <>
      {!showModelSelection && (
        <ChatInput
          input={input}
          cursorPosition={cursorPosition}
          isProcessing={isProcessing}
          isStreaming={isStreaming}
        />
      )}

      <Box flexDirection="row" marginTop={1}>
        <Box marginRight={2}>
          <Text color="cyan">
            {autoEditEnabled ? "▶" : "⏸"} auto-edit:{" "}
            {autoEditEnabled ? "on" : "off"}
          </Text>
          <Text color="gray" dimColor>
            {" "}
            (shift + tab)
          </Text>
        </Box>
        <Box marginRight={2}>
          <Text color="yellow">≋ {agent.getCurrentModel()}</Text>
        </Box>
        <MCPStatus />
      </Box>

      <CommandSuggestions
        suggestions={commandSuggestions}
        input={input}
        selectedIndex={selectedCommandIndex}
        isVisible={showCommandSuggestions}
      />

      <ModelSelection
        models={availableModels}
        selectedIndex={selectedModelIndex}
        isVisible={showModelSelection}
        currentModel={agent.getCurrentModel()}
      />
    </>
  );
};

// Export memoized version that only re-renders when necessary props change
export const InputController = React.memo(InputControllerComponent, (prevProps, nextProps) => {
  // Only re-render if these critical props change
  // chatHistory changes should NOT trigger re-render (only used for input processing, not display)
  return (
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isConfirmationActive === nextProps.isConfirmationActive &&
    prevProps.agent === nextProps.agent &&
    prevProps.chatHistory.length === nextProps.chatHistory.length
  );
});

