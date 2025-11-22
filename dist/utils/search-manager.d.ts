import { Message } from '../db/types.js';
export interface SearchOptions {
    query: string;
    sessionId?: number;
    messageType?: 'user' | 'assistant';
    limit?: number;
    caseSensitive?: boolean;
}
export interface SearchResult {
    message: Message;
    session: {
        id: number;
        workdir: string;
        provider: string;
        model: string;
        sessionDate: string;
    };
    matchCount: number;
    matchPositions: number[];
    contextBefore?: Message;
    contextAfter?: Message;
}
/**
 * Manages search operations across conversation history
 */
export declare class SearchManager {
    private db;
    constructor();
    /**
     * Search messages using LIKE (simple but functional)
     */
    search(options: SearchOptions): SearchResult[];
    /**
     * Search in current session only
     */
    searchCurrentSession(query: string, sessionId: number, limit?: number): SearchResult[];
    /**
     * Search globally across all sessions
     */
    searchGlobal(query: string, limit?: number): SearchResult[];
    /**
     * Get total match count for a query
     */
    getMatchCount(query: string): number;
    /**
     * Enrich search result with context and match positions
     */
    private enrichResult;
    /**
     * Find all positions where query matches in text
     */
    private findMatchPositions;
    /**
     * Get message before or after for context
     */
    private getContextMessage;
    /**
     * Format date for display
     */
    private formatDate;
    /**
     * Get search suggestions based on recent queries (future feature)
     */
    getSuggestions(prefix: string, limit?: number): string[];
}
export declare const searchManager: SearchManager;
