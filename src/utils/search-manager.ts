import { db } from '../db/database.js';
import { Message, Session } from '../db/types.js';
import Database from 'better-sqlite3';

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
export class SearchManager {
  private db: Database.Database;

  constructor() {
    this.db = db.getDb();
  }

  /**
   * Search messages using LIKE (simple but functional)
   */
  search(options: SearchOptions): SearchResult[] {
    const { 
      query, 
      sessionId, 
      messageType, 
      limit = 50, 
      caseSensitive = false 
    } = options;
    
    // Build query
    let sql = `
      SELECT 
        m.*,
        s.id as session_id,
        s.working_dir,
        s.default_provider,
        s.default_model,
        s.started_at
      FROM messages m
      JOIN sessions s ON m.session_id = s.id
      WHERE m.content LIKE ?
    `;
    
    const params: any[] = [
      caseSensitive ? `%${query}%` : `%${query}%`
    ];
    
    if (!caseSensitive) {
      sql = sql.replace('m.content LIKE ?', 'LOWER(m.content) LIKE LOWER(?)');
    }
    
    if (sessionId) {
      sql += ' AND m.session_id = ?';
      params.push(sessionId);
    }
    
    if (messageType) {
      sql += ' AND m.role = ?';
      params.push(messageType);
    }
    
    sql += ' ORDER BY m.timestamp DESC LIMIT ?';
    params.push(limit);
    
    // Execute query
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    
    // Enrich results
    return rows.map(row => this.enrichResult(row, query));
  }

  /**
   * Search in current session only
   */
  searchCurrentSession(query: string, sessionId: number, limit = 20): SearchResult[] {
    return this.search({
      query,
      sessionId,
      limit,
      caseSensitive: false,
    });
  }

  /**
   * Search globally across all sessions
   */
  searchGlobal(query: string, limit = 50): SearchResult[] {
    return this.search({
      query,
      limit,
      caseSensitive: false,
    });
  }

  /**
   * Get total match count for a query
   */
  getMatchCount(query: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE LOWER(content) LIKE LOWER(?)
    `);
    
    const result = stmt.get(`%${query}%`) as { count: number };
    return result.count;
  }

  /**
   * Enrich search result with context and match positions
   */
  private enrichResult(row: any, query: string): SearchResult {
    const message: Message = {
      id: row.id,
      session_id: row.session_id,
      type: row.type,
      role: row.role,
      content: row.content,
      content_type: row.content_type,
      provider: row.provider,
      model: row.model,
      api_key_hash: row.api_key_hash,
      timestamp: row.timestamp,
      token_count: row.token_count,
      tool_calls: row.tool_calls,
      tool_call_id: row.tool_call_id,
      is_streaming: row.is_streaming,
      parent_message_id: row.parent_message_id,
    };

    // Session info
    const session = {
      id: row.session_id,
      workdir: row.working_dir,
      provider: row.default_provider,
      model: row.default_model,
      sessionDate: this.formatDate(row.started_at),
    };

    // Find match positions
    const matchPositions = this.findMatchPositions(row.content, query);
    
    // Get context messages
    const contextBefore = this.getContextMessage(row.id, row.session_id, 'before');
    const contextAfter = this.getContextMessage(row.id, row.session_id, 'after');

    return {
      message,
      session,
      matchCount: matchPositions.length,
      matchPositions,
      contextBefore,
      contextAfter,
    };
  }

  /**
   * Find all positions where query matches in text
   */
  private findMatchPositions(text: string, query: string): number[] {
    const positions: number[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let pos = lowerText.indexOf(lowerQuery);
    while (pos !== -1) {
      positions.push(pos);
      pos = lowerText.indexOf(lowerQuery, pos + 1);
    }
    
    return positions;
  }

  /**
   * Get message before or after for context
   */
  private getContextMessage(
    messageId: number,
    sessionId: number,
    direction: 'before' | 'after'
  ): Message | undefined {
    const operator = direction === 'before' ? '<' : '>';
    const order = direction === 'before' ? 'DESC' : 'ASC';
    
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ? AND id ${operator} ?
      ORDER BY id ${order}
      LIMIT 1
    `);
    
    const result = stmt.get(sessionId, messageId) as Message | undefined;
    return result;
  }

  /**
   * Format date for display
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  /**
   * Get search suggestions based on recent queries (future feature)
   */
  getSuggestions(prefix: string, limit = 5): string[] {
    // TODO: Implement search history
    return [];
  }
}

export const searchManager = new SearchManager();
