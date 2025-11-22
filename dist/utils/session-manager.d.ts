import type { ChatEntry } from "../agent/grok-agent.js";
export interface SessionState {
    version: number;
    model?: string;
    autoEditEnabled?: boolean;
    cwd?: string;
}
export declare function appendChatEntry(entry: ChatEntry): Promise<void>;
export declare function loadChatHistory(): Promise<ChatEntry[]>;
export declare function saveState(state: SessionState): Promise<void>;
export declare function loadState(): Promise<SessionState | null>;
export declare function clearSession(): Promise<void>;
