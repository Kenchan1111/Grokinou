import Database from 'better-sqlite3';
import crypto from 'crypto';
import { Session, SessionInput, SessionListItem } from '../types.js';

export class SessionRepository {
  constructor(private db: Database.Database) {}

  /**
   * Generate hash from working directory and provider
   */
  private generateSessionHash(workdir: string, provider: string): string {
    return crypto
      .createHash('sha256')
      .update(`${workdir}:${provider}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Find active session by workdir and provider
   */
  findActiveSession(workdir: string, provider: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE working_dir = ? 
      AND default_provider = ?
      AND status = 'active'
      ORDER BY last_activity DESC
      LIMIT 1
    `);
    
    return stmt.get(workdir, provider) as Session | null;
  }

  /**
   * Find last session by workdir (regardless of provider)
   * Used for session restoration on startup
   * Prioritizes sessions with messages (completed sessions with history)
   */
  findLastSessionByWorkdir(workdir: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count
      FROM sessions s
      WHERE s.working_dir = ? 
      ORDER BY message_count DESC, last_activity DESC
      LIMIT 1
    `);
    
    return stmt.get(workdir) as Session | null;
  }

  /**
   * Check if session should be reused (activity within last hour)
   */
  shouldReuseSession(session: Session): boolean {
    const lastActivity = new Date(session.last_activity).getTime();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    return now - lastActivity < oneHour;
  }

  /**
   * Find or create session for current workdir and provider
   */
  /**
   * Create a new session (always creates, never reuses)
   * Use this when you explicitly want a new session in the same directory
   */
  create(workdir: string, provider: string, model: string, apiKeyHash?: string): Session {
    const sessionHash = this.generateSessionHash(workdir, provider);
    
    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        working_dir, 
        default_provider, 
        default_model, 
        api_key_hash, 
        session_hash,
        status,
        created_at,
        last_activity
      )
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    const result = stmt.run(
      workdir,
      provider,
      model,
      apiKeyHash || null,
      sessionHash
    );
    
    const sessionId = result.lastInsertRowid as number;
    const newSession = this.findById(sessionId);
    
    if (!newSession) {
      throw new Error(`Failed to create session`);
    }
    
    return newSession;
  }

  findOrCreate(workdir: string, provider: string, model: string, apiKeyHash?: string): Session {
    const existingSession = this.findActiveSession(workdir, provider);
    
    // Reuse if exists and recent activity
    if (existingSession && this.shouldReuseSession(existingSession)) {
      return existingSession;
    }
    
    // Close old session if exists
    if (existingSession) {
      this.closeSession(existingSession.id);
    }
    
    // Look for ANY session with this hash (even completed ones)
    const sessionHash = this.generateSessionHash(workdir, provider);
    const anySession = this.db.prepare(`
      SELECT * FROM sessions WHERE session_hash = ?
    `).get(sessionHash) as Session | undefined;
    
    // If session exists (completed), reactivate it
    if (anySession) {
      this.db.prepare(`
        UPDATE sessions 
        SET status = 'active', 
            last_activity = CURRENT_TIMESTAMP,
            default_model = ?,
            api_key_hash = ?
        WHERE id = ?
      `).run(model, apiKeyHash || null, anySession.id);
      
      return this.findById(anySession.id)!;
    }
    
    // Create new session (only if hash doesn't exist at all)
    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        working_dir, 
        session_hash, 
        default_provider, 
        default_model,
        api_key_hash
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(workdir, sessionHash, provider, model, apiKeyHash || null);
    
    return this.findById(result.lastInsertRowid as number)!;
  }

  /**
   * Find session by ID
   */
  findById(id: number): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id) as Session | null;
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity(sessionId: number) {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(sessionId);
  }

  /**
   * Update session status
   */
  updateStatus(sessionId: number, status: 'active' | 'completed' | 'archived'): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET status = ?, last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, sessionId);
  }

  /**
   * Close session (set status to completed)
   */
  closeSession(sessionId: number) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'completed', ended_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(sessionId);
  }

  /**
   * Update session title
   */
  updateTitle(sessionId: number, title: string) {
    const stmt = this.db.prepare(`
      UPDATE sessions SET title = ? WHERE id = ?
    `);
    stmt.run(title, sessionId);
  }

  /**
   * Update session provider, model, and reactivate
   * Used when restoring session with potentially different provider/model
   */
  updateSessionProviderAndModel(
    sessionId: number, 
    provider: string, 
    model: string, 
    apiKeyHash?: string
  ) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'active',
          default_provider = ?,
          default_model = ?,
          api_key_hash = ?,
          last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(provider, model, apiKeyHash || null, sessionId);
  }

  /**
   * Update session name (auto-generated from first message)
   */
  updateSessionName(sessionId: number, sessionName: string) {
    const stmt = this.db.prepare(`
      UPDATE sessions SET session_name = ? WHERE id = ?
    `);
    stmt.run(sessionName, sessionId);
  }

  /**
   * Update session statistics in real-time (message_count, total_tokens, previews)
   * Called after each message to keep denormalized stats fresh
   * Performance: < 5ms on average, executed in a single transaction
   * 
   * @param sessionId - Session to update
   */
  updateSessionStats(sessionId: number): void {
    // Update in a single transaction for atomicity
    const transaction = this.db.transaction(() => {
      // 1. Update message_count
      this.db.prepare(`
        UPDATE sessions 
        SET message_count = (
          SELECT COUNT(*) FROM messages WHERE session_id = ?
        )
        WHERE id = ?
      `).run(sessionId, sessionId);

      // 2. Update total_tokens (sum of all token_count in messages)
      this.db.prepare(`
        UPDATE sessions 
        SET total_tokens = (
          SELECT COALESCE(SUM(token_count), 0) FROM messages WHERE session_id = ?
        )
        WHERE id = ?
      `).run(sessionId, sessionId);

      // 3. Update first_message_preview (first user message)
      const firstMessage = this.db.prepare(`
        SELECT content FROM messages 
        WHERE session_id = ? AND role = 'user' AND content != ''
        ORDER BY id ASC 
        LIMIT 1
      `).get(sessionId) as { content: string } | undefined;

      if (firstMessage) {
        const preview = firstMessage.content.substring(0, 100).replace(/[\r\n]+/g, ' ');
        this.db.prepare(`
          UPDATE sessions SET first_message_preview = ? WHERE id = ?
        `).run(preview, sessionId);
      }

      // 4. Update last_message_preview (last user or assistant message)
      const lastMessage = this.db.prepare(`
        SELECT content FROM messages 
        WHERE session_id = ? AND (role = 'user' OR role = 'assistant') AND content != ''
        ORDER BY id DESC 
        LIMIT 1
      `).get(sessionId) as { content: string } | undefined;

      if (lastMessage) {
        const preview = lastMessage.content.substring(0, 100).replace(/[\r\n]+/g, ' ');
        this.db.prepare(`
          UPDATE sessions SET last_message_preview = ? WHERE id = ?
        `).run(preview, sessionId);
      }
    });

    transaction();
  }

  /**
   * Get all sessions with filters
   */
  findAll(filters?: {
    status?: string[];
    limit?: number;
    workdir?: string;
  }): Session[] {
    let query = 'SELECT * FROM sessions WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.status && filters.status.length > 0) {
      const placeholders = filters.status.map(() => '?').join(',');
      query += ` AND status IN (${placeholders})`;
      params.push(...filters.status);
    }
    
    if (filters?.workdir) {
      query += ' AND working_dir = ?';
      params.push(filters.workdir);
    }
    
    query += ' ORDER BY last_activity DESC';
    
    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Session[];
  }

  /**
   * List sessions with enriched metadata for display/search
   * 
   * @param workdir - Filter by working directory (optional)
   * @param options - Additional filtering options
   * @returns Array of enriched session list items
   */
  listSessions(
    workdir?: string,
    options?: {
      status?: ('active' | 'completed' | 'archived')[];
      favoriteOnly?: boolean;
      minMessages?: number;
      sortBy?: 'last_activity' | 'created_at' | 'message_count' | 'session_name';
      sortOrder?: 'ASC' | 'DESC';
      limit?: number;
    }
  ): SessionListItem[] {
    let query = `
      SELECT 
        s.id,
        s.session_name,
        s.working_dir,
        s.default_provider,
        s.default_model,
        s.message_count,
        s.total_tokens,
        s.status,
        s.created_at,
        s.last_activity,
        s.first_message_preview,
        s.last_message_preview,
        s.is_favorite,
        s.project_context,
        CAST((julianday('now') - julianday(s.created_at)) AS INTEGER) as age_days
      FROM sessions s
      WHERE 1=1
    `;
    const params: any[] = [];
    
    // Filter by working directory
    if (workdir) {
      query += ' AND s.working_dir = ?';
      params.push(workdir);
    }
    
    // Filter by status
    if (options?.status && options.status.length > 0) {
      const placeholders = options.status.map(() => '?').join(',');
      query += ` AND s.status IN (${placeholders})`;
      params.push(...options.status);
    }
    
    // Filter favorites only
    if (options?.favoriteOnly) {
      query += ' AND s.is_favorite = 1';
    }
    
    // Filter by minimum message count
    if (options?.minMessages !== undefined && options.minMessages > 0) {
      query += ' AND s.message_count >= ?';
      params.push(options.minMessages);
    }
    
    // Sort by
    const sortBy = options?.sortBy || 'last_activity';
    const sortOrder = options?.sortOrder || 'DESC';
    query += ` ORDER BY s.${sortBy} ${sortOrder}`;
    
    // Limit results
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as any[];
    
    // Convert to SessionListItem with computed fields
    return results.map(row => ({
      id: row.id,
      session_name: row.session_name,
      working_dir: row.working_dir,
      default_provider: row.default_provider,
      default_model: row.default_model,
      message_count: row.message_count || 0,
      total_tokens: row.total_tokens || 0,
      status: row.status,
      created_at: row.created_at,
      last_activity: row.last_activity,
      first_message_preview: row.first_message_preview,
      last_message_preview: row.last_message_preview,
      is_favorite: Boolean(row.is_favorite),
      project_context: row.project_context,
      age_days: row.age_days || 0,
      last_activity_relative: this.formatRelativeTime(row.last_activity),
    }));
  }

  /**
   * Format timestamp as relative time (e.g., "2 hours ago")
   */
  private formatRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }
}
