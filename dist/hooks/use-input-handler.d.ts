import { GrokAgent, ChatEntry } from "../agent/grok-agent.js";
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
export declare function useInputHandler({ agent, chatHistory, setChatHistory, setIsProcessing, setIsStreaming, setStreamingContent, setStreamingTools, setStreamingToolResults, setTokenCount, setProcessingTime, processingStartTime, isProcessing, isStreaming, isConfirmationActive, searchMode, streamingBus, onSearchCommand, inputInjectionRef, }: UseInputHandlerProps): {
    input: string;
    cursorPosition: number;
    showCommandSuggestions: boolean;
    selectedCommandIndex: number;
    showModelSelection: boolean;
    selectedModelIndex: number;
    commandSuggestions: CommandSuggestion[];
    availableModels: ModelOption[];
    agent: GrokAgent;
    autoEditEnabled: boolean;
};
export {};
