import { searchManager, SearchResult } from '../utils/search-manager.js';

export interface SearchInConversationsCommand {
  type: 'search_in_conversations';
  query: string;
  scope?: 'session' | 'global';
  sessionId?: number;
}

/**
 * Parse /search_in_conversations command from user input
 *
 * Supported formats:
 * - /search_in_conversations pattern
 * - /search_in_conversations "exact phrase"
 * - /search_in_conversations pattern --global
 * - /search_in_conversations pattern --session
 */
export function parseSearchInConversationsCommand(input: string): SearchInConversationsCommand | null {
  // Basic format: /search_in_conversations <query>
  const basicMatch = input.match(/^\/search_in_conversations\s+(.+)$/);
  if (!basicMatch) return null;

  let query = basicMatch[1].trim();
  let scope: 'session' | 'global' = 'global'; // Default to global search

  // Check for flags
  if (query.includes('--session')) {
    scope = 'session';
    query = query.replace(/--session/g, '').trim();
  } else if (query.includes('--global')) {
    scope = 'global';
    query = query.replace(/--global/g, '').trim();
  }

  // Remove quotes if present (for exact phrase)
  query = query.replace(/^["']|["']$/g, '');

  if (!query) return null;

  return {
    type: 'search_in_conversations',
    query,
    scope,
  };
}

/**
 * Execute search in conversations command
 */
export function executeSearchInConversationsCommand(
  command: SearchInConversationsCommand,
  currentSessionId?: number
): SearchResult[] {
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
export function formatSearchInConversationsSummary(results: SearchResult[], query: string): string {
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
 * Check if input is a search in conversations command
 */
export function isSearchInConversationsCommand(input: string): boolean {
  return input.trim().startsWith('/search_in_conversations');
}
