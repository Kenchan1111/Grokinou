import crypto from 'crypto';
export class SessionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Generate hash from working directory and provider
     */
    generateSessionHash(workdir, provider) {
        return crypto
            .createHash('sha256')
            .update(`${workdir}:${provider}`)
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Find active session by workdir and provider
     */
    findActiveSession(workdir, provider) {
        const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE working_dir = ? 
      AND default_provider = ?
      AND status = 'active'
      ORDER BY last_activity DESC
      LIMIT 1
    `);
        return stmt.get(workdir, provider);
    }
    /**
     * Check if session should be reused (activity within last hour)
     */
    shouldReuseSession(session) {
        const lastActivity = new Date(session.last_activity).getTime();
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        return now - lastActivity < oneHour;
    }
    /**
     * Find or create session for current workdir and provider
     */
    findOrCreate(workdir, provider, model, apiKeyHash) {
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
    `).get(sessionHash);
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
            return this.findById(anySession.id);
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
        return this.findById(result.lastInsertRowid);
    }
    /**
     * Find session by ID
     */
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
        return stmt.get(id);
    }
    /**
     * Update last activity timestamp
     */
    updateLastActivity(sessionId) {
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
    closeSession(sessionId) {
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
    updateTitle(sessionId, title) {
        const stmt = this.db.prepare(`
      UPDATE sessions SET title = ? WHERE id = ?
    `);
        stmt.run(title, sessionId);
    }
    /**
     * Get all sessions with filters
     */
    findAll(filters) {
        let query = 'SELECT * FROM sessions WHERE 1=1';
        const params = [];
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
        return stmt.all(...params);
    }
}
//# sourceMappingURL=session-repository.js.map