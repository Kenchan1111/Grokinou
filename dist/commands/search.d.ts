import { SearchResult } from '../utils/search-manager.js';
export interface SearchCommand {
    type: 'search';
    query: string;
    scope?: 'session' | 'global';
    sessionId?: number;
}
/**
 * Parse /search command from user input
 *
 * Supported formats:
 * - /search pattern
 * - /search "exact phrase"
 * - /search pattern --global
 * - /search pattern --session
 */
export declare function parseSearchCommand(input: string): SearchCommand | null;
/**
 * Execute search command
 */
export declare function executeSearchCommand(command: SearchCommand, currentSessionId?: number): SearchResult[];
/**
 * Format search results count for display
 */
export declare function formatSearchSummary(results: SearchResult[], query: string): string;
/**
 * Check if input is a search command
 */
export declare function isSearchCommand(input: string): boolean;
