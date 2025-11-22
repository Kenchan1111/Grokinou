import React from "react";
import { ChatEntry } from "../../agent/grok-agent.js";
interface ChatHistoryProps {
    entries: ChatEntry[];
    isConfirmationActive?: boolean;
}
export declare const MemoizedArchived: React.MemoExoticComponent<({ entry }: {
    entry: ChatEntry;
}) => React.JSX.Element>;
export declare const ChatHistory: React.MemoExoticComponent<({ entries, isConfirmationActive, }: ChatHistoryProps) => React.JSX.Element>;
export {};
