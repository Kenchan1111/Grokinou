import React from "react";
import { GrokAgent, ChatEntry } from "../../agent/grok-agent.js";
interface InputControllerProps {
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
    isConfirmationActive: boolean;
    searchMode?: boolean;
    onSearchCommand?: (input: string) => boolean;
    inputInjectionRef?: React.MutableRefObject<((text: string) => void) | null>;
}
export declare const InputController: React.MemoExoticComponent<(props: InputControllerProps) => React.JSX.Element>;
export {};
