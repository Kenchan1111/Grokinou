import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

export interface CachedSearch {
  id: number;
  query: string;
  context?: string;
  createdAt: number;
  totalResults: number;
  shownResults: number;
  lastSeenId?: number;
}

export interface CachedResult {
  id: number;
  searchId: number;
  file: string;
  line?: number;
  column?: number;
  text?: string;
  score?: number;
}

/**
 * Lightweight cache for search results to avoid flooding the UI
 * and to support "show more" without rerunning rg.
 */
export class SearchCache {
  private db: Database.Database;
  // Default TTL for cached searches (48h)
  private defaultTtlMs = 48 * 60 * 60 * 1000;

  constructor(dbPath?: string) {
    const resolved = dbPath || path.join(os.homedir(), ".grok", "search-cache.db");
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.initSchema();
    this.cleanupOldSearches().catch(() => {
      // best-effort cleanup; ignore errors
    });
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        context TEXT,
        created_at INTEGER NOT NULL,
        total_results INTEGER DEFAULT 0,
        shown_results INTEGER DEFAULT 0,
        last_seen_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS search_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_id INTEGER NOT NULL,
        file TEXT NOT NULL,
        line INTEGER,
        column INTEGER,
        text TEXT,
        score REAL,
        FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_results_search ON search_results(search_id);
      CREATE INDEX IF NOT EXISTS idx_results_score ON search_results(score);
    `);
  }

  createSearch(query: string, context?: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO searches (query, context, created_at)
      VALUES (?, ?, ?)
    `);
    const res = stmt.run(query, context || null, Date.now());
    return Number(res.lastInsertRowid);
  }

  addResults(searchId: number, results: Array<{ file: string; line?: number; column?: number; text?: string; score?: number }>) {
    const insert = this.db.prepare(`
      INSERT INTO search_results (search_id, file, line, column, text, score)
      VALUES (@search_id, @file, @line, @column, @text, @score)
    `);
    const txn = this.db.transaction((rows) => {
      for (const r of rows) {
        insert.run({
          search_id: searchId,
          file: r.file,
          line: r.line ?? null,
          column: r.column ?? null,
          text: r.text ?? null,
          score: r.score ?? null,
        });
      }
    });
    txn(results);

    this.db.prepare(`UPDATE searches SET total_results = total_results + ? WHERE id = ?`).run(results.length, searchId);
  }

  /**
   * Atomically increment shown_results and update last_seen_id; returns remaining count.
   */
  markShownAndGetRemaining(searchId: number, count: number, lastSeenId?: number) {
    const txn = this.db.transaction((sid: number, cnt: number, lastId?: number) => {
      this.db
        .prepare(
          `UPDATE searches
             SET shown_results = shown_results + ?, 
                 last_seen_id = COALESCE(?, last_seen_id)
           WHERE id = ?`
        )
        .run(cnt, lastId ?? null, sid);
      const row = this.db
        .prepare(`SELECT total_results - shown_results AS remaining FROM searches WHERE id = ?`)
        .get(sid) as { remaining: number };
      return row.remaining || 0;
    });
    return txn(searchId, count, lastSeenId);
  }

  getTopResults(searchId: number, limit: number) {
    return this.db
      .prepare(
        `SELECT id, file, line, column, text, score
         FROM search_results
         WHERE search_id = ?
         ORDER BY id ASC
         LIMIT ?`
      )
      .all(searchId, limit) as CachedResult[];
  }

  /**
   * Cursor-based pagination ordered by insertion (id asc). Assumes rows were inserted in ranked order.
   */
  getNextResults(searchId: number, lastSeenId: number | null, limit: number) {
    return this.db
      .prepare(
        `SELECT id, file, line, column, text, score
         FROM search_results
         WHERE search_id = ?
            AND (? IS NULL OR id > ?)
         ORDER BY id ASC
         LIMIT ?`
      )
      .all(searchId, lastSeenId, lastSeenId, limit) as CachedResult[];
  }

  getRemainingCount(searchId: number) {
    const row = this.db
      .prepare(`SELECT total_results - shown_results AS remaining FROM searches WHERE id = ?`)
      .get(searchId) as { remaining: number } | undefined;
    return row ? row.remaining : 0;
  }

  getSearch(searchId: number): CachedSearch | undefined {
    const row = this.db
      .prepare(
        `SELECT id, query, context, created_at as createdAt, total_results as totalResults, shown_results as shownResults, last_seen_id as lastSeenId
         FROM searches WHERE id = ?`
      )
      .get(searchId) as CachedSearch | undefined;
    return row;
  }

  getFirstId(searchId: number): number | null {
    const row = this.db
      .prepare(`SELECT MIN(id) as firstId FROM search_results WHERE search_id = ?`)
      .get(searchId) as { firstId: number | null } | undefined;
    return row?.firstId ?? null;
  }

  /**
   * Delete searches older than the given TTL (ms) and vacuum the database.
   */
  async cleanupOldSearches(ttlMs: number = this.defaultTtlMs) {
    const cutoff = Date.now() - ttlMs;
    const deleted = this.db
      .prepare(`DELETE FROM searches WHERE created_at < ?`)
      .run(cutoff).changes;
    if (deleted > 0) {
      this.db.exec("VACUUM");
    }
  }
}
