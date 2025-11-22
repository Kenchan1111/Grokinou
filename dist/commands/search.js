import { searchManager } from '../utils/search-manager.js';
/**
 * Parse /search command from user input
 *
 * Supported formats:
 * - /search pattern
 * - /search "exact phrase"
 * - /search pattern --global
 * - /search pattern --session
 */
export function parseSearchCommand(input) {
    // Basic format: /search <query>
    const basicMatch = input.match(/^\/search\s+(.+)$/);
    if (!basicMatch)
        return null;
    let query = basicMatch[1].trim();
    let scope = 'global'; // Default to global search
    // Check for flags
    if (query.includes('--session')) {
        scope = 'session';
        query = query.replace(/--session/g, '').trim();
    }
    else if (query.includes('--global')) {
        scope = 'global';
        query = query.replace(/--global/g, '').trim();
    }
    // Remove quotes if present (for exact phrase)
    query = query.replace(/^["']|["']$/g, '');
    if (!query)
        return null;
    return {
        type: 'search',
        query,
        scope,
    };
}
/**
 * Execute search command
 */
export function executeSearchCommand(command, currentSessionId) {
    if (command.scope === 'session' && currentSessionId) {
        // Search in current session only
        return searchManager.searchCurrentSession(command.query, currentSessionId, 20);
    }
    // Global search across all sessions
    return searchManager.searchGlobal(command.query, 50);
}
/**
 * Format search results count for display
 */
export function formatSearchSummary(results, query) {
    const count = results.length;
    const totalMatches = results.reduce((sum, r) => sum + r.matchCount, 0);
    if (count === 0) {
        return `No results found for "${query}"`;
    }
    if (count === 1) {
        return `1 result found for "${query}" (${totalMatches} matches)`;
    }
    return `${count} results found for "${query}" (${totalMatches} total matches)`;
}
/**
 * Check if input is a search command
 */
export function isSearchCommand(input) {
    return input.trim().startsWith('/search');
}
//# sourceMappingURL=search.js.map