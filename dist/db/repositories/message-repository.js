export class MessageRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Save a new message
     */
    save(input) {
        const stmt = this.db.prepare(`
      INSERT INTO messages (
        session_id, 
        type, 
        role, 
        content, 
        content_type,
        provider, 
        model, 
        api_key_hash,
        timestamp,
        token_count, 
        tool_calls, 
        tool_call_id,
        is_streaming,
        parent_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(input.session_id, input.type, input.role, input.content, input.content_type || 'text', input.provider, input.model, input.api_key_hash || null, input.timestamp || new Date().toISOString(), input.token_count || 0, input.tool_calls ? JSON.stringify(input.tool_calls) : null, input.tool_call_id || null, input.is_streaming ? 1 : 0, input.parent_message_id || null);
        return this.findById(result.lastInsertRowid);
    }
    /**
     * Find message by ID
     */
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
        return stmt.get(id);
    }
    /**
     * Get all messages for a session
     */
    getBySession(sessionId) {
        const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `);
        return stmt.all(sessionId);
    }
    /**
     * Get recent messages for a session
     */
    getRecentMessages(sessionId, limit) {
        const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
        const messages = stmt.all(sessionId, limit);
        return messages.reverse(); // Return in chronological order
    }
    /**
     * Count messages in a session
     */
    countBySession(sessionId) {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE session_id = ?
    `);
        const result = stmt.get(sessionId);
        return result.count;
    }
    /**
     * Get last message timestamp for a session
     */
    getLastTimestamp(sessionId) {
        const stmt = this.db.prepare(`
      SELECT timestamp FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
        const result = stmt.get(sessionId);
        return result ? new Date(result.timestamp).getTime() : null;
    }
    /**
     * Delete all messages in a session
     */
    deleteBySession(sessionId) {
        const stmt = this.db.prepare('DELETE FROM messages WHERE session_id = ?');
        stmt.run(sessionId);
    }
    /**
     * Get messages by provider (for analytics)
     */
    getByProvider(provider, limit) {
        let query = 'SELECT * FROM messages WHERE provider = ? ORDER BY timestamp DESC';
        if (limit) {
            query += ' LIMIT ?';
            const stmt = this.db.prepare(query);
            return stmt.all(provider, limit);
        }
        const stmt = this.db.prepare(query);
        return stmt.all(provider);
    }
}
//# sourceMappingURL=message-repository.js.map