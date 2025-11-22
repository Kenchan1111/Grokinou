import Database from 'better-sqlite3';
import { Session } from '../types.js';
export declare class SessionRepository {
    private db;
    constructor(db: Database.Database);
    /**
     * Generate hash from working directory and provider
     */
    private generateSessionHash;
    /**
     * Find active session by workdir and provider
     */
    findActiveSession(workdir: string, provider: string): Session | null;
    /**
     * Check if session should be reused (activity within last hour)
     */
    shouldReuseSession(session: Session): boolean;
    /**
     * Find or create session for current workdir and provider
     */
    findOrCreate(workdir: string, provider: string, model: string, apiKeyHash?: string): Session;
    /**
     * Find session by ID
     */
    findById(id: number): Session | null;
    /**
     * Update last activity timestamp
     */
    updateLastActivity(sessionId: number): void;
    /**
     * Close session (set status to completed)
     */
    closeSession(sessionId: number): void;
    /**
     * Update session title
     */
    updateTitle(sessionId: number, title: string): void;
    /**
     * Get all sessions with filters
     */
    findAll(filters?: {
        status?: string[];
        limit?: number;
        workdir?: string;
    }): Session[];
}
