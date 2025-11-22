import { Session } from '../db/types.js';
import { ChatEntry } from '../agent/grok-agent.js';
export interface SessionState {
    version: number;
    model?: string;
    autoEditEnabled?: boolean;
    cwd?: string;
    sessionId?: number;
}
/**
 * Singleton for managing SQLite-based sessions
 */
export declare class SessionManagerSQLite {
    private static instance;
    private sessionRepo;
    private messageRepo;
    private currentSession;
    private currentProvider;
    private currentModel;
    private constructor();
    static getInstance(): SessionManagerSQLite;
    /**
     * Initialize or resume session for current working directory
     */
    initSession(workdir: string, provider: string, model: string, apiKey?: string): Session;
    /**
     * Get current session
     */
    getCurrentSession(): Session | null;
    /**
     * Load chat history from current session
     */
    loadChatHistory(): Promise<ChatEntry[]>;
    /**
     * Append chat entry to current session
     */
    appendChatEntry(entry: ChatEntry): Promise<void>;
    /**
     * Save a message to the database
     */
    private saveMessage;
    /**
     * Convert message type to OpenAI role
     */
    private getRole;
    /**
     * Convert DB Message to ChatEntry
     */
    private messageToEntry;
    /**
     * Switch to a different provider in current session
     */
    switchProvider(provider: string, model: string, apiKey?: string): void;
    /**
     * Close current session
     */
    closeSession(): void;
    /**
     * Save session state (for backward compatibility)
     */
    saveState(state: SessionState): Promise<void>;
    /**
     * Load session state (for backward compatibility)
     */
    loadState(): Promise<SessionState | null>;
    /**
     * Clear session (close and delete all messages)
     */
    clearSession(): Promise<void>;
    /**
     * Hash API key for tracking (not storing the key itself!)
     */
    private hashApiKey;
    /**
     * Get session statistics
     */
    getSessionStats(sessionId?: number): {
        messageCount: number;
        providers: string[];
    };
}
export declare const sessionManager: SessionManagerSQLite;
export declare function loadChatHistory(): Promise<ChatEntry[]>;
export declare function appendChatEntry(entry: ChatEntry): Promise<void>;
export declare function saveState(state: SessionState): Promise<void>;
export declare function loadState(): Promise<SessionState | null>;
export declare function clearSession(): Promise<void>;
