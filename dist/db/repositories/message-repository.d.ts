import Database from 'better-sqlite3';
import { Message, MessageInput } from '../types.js';
export declare class MessageRepository {
    private db;
    constructor(db: Database.Database);
    /**
     * Save a new message
     */
    save(input: MessageInput): Message;
    /**
     * Find message by ID
     */
    findById(id: number): Message | null;
    /**
     * Get all messages for a session
     */
    getBySession(sessionId: number): Message[];
    /**
     * Get recent messages for a session
     */
    getRecentMessages(sessionId: number, limit: number): Message[];
    /**
     * Count messages in a session
     */
    countBySession(sessionId: number): number;
    /**
     * Get last message timestamp for a session
     */
    getLastTimestamp(sessionId: number): number | null;
    /**
     * Delete all messages in a session
     */
    deleteBySession(sessionId: number): void;
    /**
     * Get messages by provider (for analytics)
     */
    getByProvider(provider: string, limit?: number): Message[];
}
