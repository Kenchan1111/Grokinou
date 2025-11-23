import Database from 'better-sqlite3';
import crypto from 'crypto';
import { Session, SessionInput } from '../types.js';

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
   */
  findLastSessionByWorkdir(workdir: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE working_dir = ? 
      ORDER BY last_activity DESC 
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
}
