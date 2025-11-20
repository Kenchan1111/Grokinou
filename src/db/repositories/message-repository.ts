import Database from 'better-sqlite3';
import { Message, MessageInput } from '../types.js';

export class MessageRepository {
  constructor(private db: Database.Database) {}

  /**
   * Save a new message
   */
  save(input: MessageInput): Message {
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
    
    const result = stmt.run(
      input.session_id,
      input.type,
      input.role,
      input.content,
      input.content_type || 'text',
      input.provider,
      input.model,
      input.api_key_hash || null,
      input.timestamp || new Date().toISOString(),
      input.token_count || 0,
      input.tool_calls ? JSON.stringify(input.tool_calls) : null,
      input.tool_call_id || null,
      input.is_streaming ? 1 : 0,
      input.parent_message_id || null
    );
    
    return this.findById(result.lastInsertRowid as number)!;
  }

  /**
   * Find message by ID
   */
  findById(id: number): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(id) as Message | null;
  }

  /**
   * Get all messages for a session
   */
  getBySession(sessionId: number): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `);
    return stmt.all(sessionId) as Message[];
  }

  /**
   * Get recent messages for a session
   */
  getRecentMessages(sessionId: number, limit: number): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    const messages = stmt.all(sessionId, limit) as Message[];
    return messages.reverse(); // Return in chronological order
  }

  /**
   * Count messages in a session
   */
  countBySession(sessionId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE session_id = ?
    `);
    const result = stmt.get(sessionId) as { count: number };
    return result.count;
  }

  /**
   * Get last message timestamp for a session
   */
  getLastTimestamp(sessionId: number): number | null {
    const stmt = this.db.prepare(`
      SELECT timestamp FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    const result = stmt.get(sessionId) as { timestamp: string } | undefined;
    return result ? new Date(result.timestamp).getTime() : null;
  }

  /**
   * Delete all messages in a session
   */
  deleteBySession(sessionId: number) {
    const stmt = this.db.prepare('DELETE FROM messages WHERE session_id = ?');
    stmt.run(sessionId);
  }

  /**
   * Get messages by provider (for analytics)
   */
  getByProvider(provider: string, limit?: number): Message[] {
    let query = 'SELECT * FROM messages WHERE provider = ? ORDER BY timestamp DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      const stmt = this.db.prepare(query);
      return stmt.all(provider, limit) as Message[];
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(provider) as Message[];
  }
}
