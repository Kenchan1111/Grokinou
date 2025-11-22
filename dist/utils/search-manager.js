import { db } from '../db/database.js';
/**
 * Manages search operations across conversation history
 */
export class SearchManager {
    db;
    constructor() {
        this.db = db.getDb();
    }
    /**
     * Search messages using LIKE (simple but functional)
     */
    search(options) {
        const { query, sessionId, messageType, limit = 50, caseSensitive = false } = options;
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
        const params = [
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
        const rows = stmt.all(...params);
        // Enrich results
        return rows.map(row => this.enrichResult(row, query));
    }
    /**
     * Search in current session only
     */
    searchCurrentSession(query, sessionId, limit = 20) {
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
    searchGlobal(query, limit = 50) {
        return this.search({
            query,
            limit,
            caseSensitive: false,
        });
    }
    /**
     * Get total match count for a query
     */
    getMatchCount(query) {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE LOWER(content) LIKE LOWER(?)
    `);
        const result = stmt.get(`%${query}%`);
        return result.count;
    }
    /**
     * Enrich search result with context and match positions
     */
    enrichResult(row, query) {
        const message = {
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
    findMatchPositions(text, query) {
        const positions = [];
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
    getContextMessage(messageId, sessionId, direction) {
        const operator = direction === 'before' ? '<' : '>';
        const order = direction === 'before' ? 'DESC' : 'ASC';
        const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ? AND id ${operator} ?
      ORDER BY id ${order}
      LIMIT 1
    `);
        const result = stmt.get(sessionId, messageId);
        return result;
    }
    /**
     * Format date for display
     */
    formatDate(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return 'Today ' + date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        else if (diffDays === 1) {
            return 'Yesterday ' + date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        else {
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
    getSuggestions(prefix, limit = 5) {
        // TODO: Implement search history
        return [];
    }
}
export const searchManager = new SearchManager();
//# sourceMappingURL=search-manager.js.map