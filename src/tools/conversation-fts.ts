import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs-extra";

/**
 * ConversationFTS: Full-text search index for conversation messages
 *
 * Architecture:
 * - Source of truth: conversations.db
 * - Index: conversation-fts.db (rebuiltable)
 * - No WAL shipping needed (ephemeral index)
 * - Incremental indexing + full rebuild support
 * - Health checks for sync verification
 *
 * Multi-redundancy cascade:
 * timeline.db (WAL shipping)
 *   ↓ replay events
 * conversations.db (WAL shipping)
 *   ↓ rebuild index
 * conversation-fts.db (rebuiltable - NO WAL shipping)
 */

export interface ConversationSearchOptions {
  sessionId?: number;
  sessionIds?: number[];
  limit?: number;
  minRank?: number;
  beforeTimestamp?: number;
  afterTimestamp?: number;
}

export interface ConversationSearchResult {
  messageId: number;
  sessionId: number;
  sessionName?: string;
  workingDir?: string;
  sessionHash?: string;
  createdAt?: Date;
  sessionKey?: string;
  content: string;
  snippet: string;
  timestamp: Date;
  role: string;
  rank: number;
}

export interface HealthStatus {
  totalMessages: number;
  indexedMessages: number;
  pendingCount: number;
  lastIndexedId: number | null;
  lastIndexedAt: Date | null;
  lastRebuildAt: Date | null;
  integrityOk: boolean;
  syncStatus: 'OK' | 'NEEDS_UPDATE' | 'MISSING_INDEX' | 'CORRUPTED';
}

/**
 * ConversationFTS singleton
 */
export class ConversationFTS {
  private static instance: ConversationFTS | null = null;
  private db: Database.Database;
  private dbPath: string;
  private lockPath: string;
  private conversationsDb: Database.Database;
  private batchQueue: Array<{ id: number; sessionId: number; content: string; timestamp: Date; role: string }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 1000;
  private readonly BATCH_TIMEOUT_MS = 100;

  private constructor(dbPath?: string, conversationsDbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), ".grok", "conversation-fts.db");
    this.lockPath = this.dbPath + ".lock";
    fs.mkdirpSync(path.dirname(this.dbPath));

    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    // Connect to conversations.db for rebuild
    const convPath = conversationsDbPath || path.join(os.homedir(), ".grok", "conversations.db");
    this.conversationsDb = new Database(convPath, { readonly: true });

    this.initSchema();
  }

  public static getInstance(dbPath?: string, conversationsDbPath?: string): ConversationFTS {
    if (!ConversationFTS.instance) {
      ConversationFTS.instance = new ConversationFTS(dbPath, conversationsDbPath);
    }
    return ConversationFTS.instance;
  }

  /**
   * Initialize FTS5 schema and metadata tables
   */
  private initSchema(): void {
    this.db.exec(`
      -- Metadata tracking
      CREATE TABLE IF NOT EXISTS conversation_fts_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- FTS5 virtual table for messages
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_messages USING fts5(
        message_id UNINDEXED,
        session_id UNINDEXED,
        content,
        timestamp UNINDEXED,
        role UNINDEXED,
        tokenize = 'porter unicode61'
      );

      -- Message ID to FTS rowid mapping
      CREATE TABLE IF NOT EXISTS fts_message_map (
        message_id INTEGER PRIMARY KEY,
        fts_rowid INTEGER UNIQUE NOT NULL
      );

      -- Initialize metadata if not exists
      INSERT OR IGNORE INTO conversation_fts_metadata (key, value, updated_at)
      VALUES
        ('last_indexed_id', '0', ${Date.now()}),
        ('last_indexed_ts', '0', ${Date.now()}),
        ('last_rebuild_at', '${new Date().toISOString()}', ${Date.now()}),
        ('schema_version', '1', ${Date.now()});
    `);
  }

  /**
   * Index a single message (queued for batch processing)
   */
  public indexMessage(id: number, sessionId: number, content: string, timestamp: Date, role: string): void {
    if (!content || content.trim().length === 0) return;

    this.batchQueue.push({ id, sessionId, content, timestamp, role });

    // Flush if batch size reached
    if (this.batchQueue.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else {
      // Schedule flush after timeout
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this.batchTimer = setTimeout(() => this.flushBatch(), this.BATCH_TIMEOUT_MS);
    }
  }

  /**
   * Flush batch queue to FTS index
   */
  private flushBatch(): void {
    if (this.batchQueue.length === 0) return;

    // Don't flush if a full rebuild is in progress (would fail with "no such table")
    if (this.isLocked()) {
      console.log('⏸️  ConversationFTS: Skipping batch flush (rebuild in progress)');
      return;
    }

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const txn = this.db.transaction((messages: typeof batch) => {
        const insertFts = this.db.prepare(`
          INSERT INTO fts_messages (message_id, session_id, content, timestamp, role)
          VALUES (?, ?, ?, ?, ?)
        `);
        const insertMap = this.db.prepare(`
          INSERT OR REPLACE INTO fts_message_map (message_id, fts_rowid)
          VALUES (?, last_insert_rowid())
        `);

        for (const msg of messages) {
          insertFts.run(msg.id, msg.sessionId, msg.content, msg.timestamp.getTime(), msg.role);
          insertMap.run(msg.id);
        }

        // Update metadata
        const maxId = Math.max(...messages.map(m => m.id));
        const maxTs = Math.max(...messages.map(m => m.timestamp.getTime()));
        this.db.prepare(`
          UPDATE conversation_fts_metadata
          SET value = ?, updated_at = ?
          WHERE key = 'last_indexed_id'
        `).run(String(maxId), Date.now());
        this.db.prepare(`
          UPDATE conversation_fts_metadata
          SET value = ?, updated_at = ?
          WHERE key = 'last_indexed_ts'
        `).run(String(maxTs), Date.now());
      });

      txn(batch);
    } catch (e) {
      console.error("⚠️  ConversationFTS batch flush failed:", e);
      // Re-queue failed batch (with limit to avoid infinite loop)
      if (batch.length < this.BATCH_SIZE * 10) {
        this.batchQueue.unshift(...batch);
      }
    }
  }

  /**
   * Search across all sessions (cross-session search)
   */
  public search(query: string, options: ConversationSearchOptions = {}): ConversationSearchResult[] {
    const limit = options.limit || 20;
    const maxRank = options.minRank;

    let sql = `
      SELECT
        message_id,
        session_id,
        content,
        timestamp,
        role,
        bm25(fts_messages) as rank,
        snippet(fts_messages, 2, '', '', ' … ', 8) as snippet
      FROM fts_messages
      WHERE fts_messages MATCH ?
        ${options.sessionId ? 'AND session_id = ?' : ''}
        ${options.sessionIds && options.sessionIds.length > 0 ? `AND session_id IN (${options.sessionIds.map(() => '?').join(',')})` : ''}
        ${options.beforeTimestamp ? 'AND timestamp < ?' : ''}
        ${options.afterTimestamp ? 'AND timestamp > ?' : ''}
        ${maxRank !== undefined ? 'AND bm25(fts_messages) <= ?' : ''}
      ORDER BY bm25(fts_messages) ASC, timestamp DESC
      LIMIT ?
    `;

    const params: any[] = [query];
    if (options.sessionId) params.push(options.sessionId);
    if (options.sessionIds && options.sessionIds.length > 0) params.push(...options.sessionIds);
    if (options.beforeTimestamp) params.push(options.beforeTimestamp);
    if (options.afterTimestamp) params.push(options.afterTimestamp);
    if (maxRank !== undefined) params.push(maxRank);
    params.push(limit);

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];

      // Enrich with session metadata from conversations.db
      return rows.map(row => {
        const sessionMeta = this.conversationsDb.prepare(`
          SELECT session_name, working_dir, session_hash, created_at, started_at
          FROM sessions
          WHERE id = ?
        `).get(row.session_id) as any;

        const createdAt =
          sessionMeta?.created_at ? new Date(sessionMeta.created_at) :
          sessionMeta?.started_at ? new Date(sessionMeta.started_at) :
          undefined;
        const sessionHash = sessionMeta?.session_hash;

        return {
          messageId: row.message_id,
          sessionId: row.session_id,
          sessionName: sessionMeta?.session_name,
          workingDir: sessionMeta?.working_dir,
          sessionHash,
          createdAt,
          sessionKey: this.formatSessionKey(row.session_id, createdAt, sessionHash),
          content: row.content,
          snippet: row.snippet || row.content.slice(0, 200),
          timestamp: new Date(row.timestamp),
          role: row.role,
          rank: row.rank
        };
      });
    } catch (e) {
      console.error("⚠️  ConversationFTS search failed:", e);
      return [];
    }
  }

  /**
   * Rebuild entire FTS index from conversations.db (full rebuild)
   */
  public async rebuildFull(): Promise<void> {
    if (this.isLocked()) {
      throw new Error("ConversationFTS rebuild already in progress (lock file exists)");
    }

    this.createLock();
    try {
      console.log("🔄 Starting full FTS rebuild from conversations.db...");

      // Shadow table swap for atomic rebuild
      const txn = this.db.transaction(() => {
        // Create shadow table
        this.db.exec(`
          DROP TABLE IF EXISTS fts_messages_new;
          CREATE VIRTUAL TABLE fts_messages_new USING fts5(
            message_id UNINDEXED,
            session_id UNINDEXED,
            content,
            timestamp UNINDEXED,
            role UNINDEXED,
            tokenize = 'porter unicode61'
          );

          DROP TABLE IF EXISTS fts_message_map_new;
          CREATE TABLE fts_message_map_new (
            message_id INTEGER PRIMARY KEY,
            fts_rowid INTEGER UNIQUE NOT NULL
          );
        `);

        // Read all messages from conversations.db
        const messages = this.conversationsDb.prepare(`
          SELECT id, session_id, content, timestamp, role
          FROM messages
          WHERE content IS NOT NULL AND content != ''
          ORDER BY id ASC
        `).all() as any[];

        console.log(`📊 Indexing ${messages.length} messages...`);

        const insertFts = this.db.prepare(`
          INSERT INTO fts_messages_new (message_id, session_id, content, timestamp, role)
          VALUES (?, ?, ?, ?, ?)
        `);
        const insertMap = this.db.prepare(`
          INSERT INTO fts_message_map_new (message_id, fts_rowid)
          VALUES (?, last_insert_rowid())
        `);

        let indexed = 0;
        for (const msg of messages) {
          insertFts.run(msg.id, msg.session_id, msg.content,
                       new Date(msg.timestamp).getTime(), msg.role);
          insertMap.run(msg.id);
          indexed++;
          if (indexed % 10000 === 0) {
            console.log(`  Indexed ${indexed}/${messages.length} messages...`);
          }
        }

        // Atomic swap
        this.db.exec(`
          DROP TABLE IF EXISTS fts_messages;
          ALTER TABLE fts_messages_new RENAME TO fts_messages;

          DROP TABLE IF EXISTS fts_message_map;
          ALTER TABLE fts_message_map_new RENAME TO fts_message_map;
        `);

        // Update metadata
        const maxId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) : 0;
        const maxTs = messages.length > 0 ? Math.max(...messages.map(m => new Date(m.timestamp).getTime())) : 0;
        this.db.prepare(`UPDATE conversation_fts_metadata SET value = ?, updated_at = ? WHERE key = 'last_indexed_id'`)
          .run(String(maxId), Date.now());
        this.db.prepare(`UPDATE conversation_fts_metadata SET value = ?, updated_at = ? WHERE key = 'last_indexed_ts'`)
          .run(String(maxTs), Date.now());
        this.db.prepare(`UPDATE conversation_fts_metadata SET value = ?, updated_at = ? WHERE key = 'last_rebuild_at'`)
          .run(new Date().toISOString(), Date.now());

        console.log(`✅ Full rebuild complete: ${indexed} messages indexed`);
      });

      txn();

      // Verify integrity
      const check = this.db.prepare(`PRAGMA integrity_check;`).get() as { integrity_check: string };
      if (check.integrity_check !== "ok") {
        throw new Error(`FTS integrity check failed: ${check.integrity_check}`);
      }
    } finally {
      this.removeLock();
    }
  }

  /**
   * Incremental rebuild: index messages not yet in FTS
   */
  public async rebuildIncremental(): Promise<number> {
    // Don't run incremental rebuild if a full rebuild is in progress
    if (this.isLocked()) {
      console.log('⏸️  ConversationFTS: Skipping incremental rebuild (full rebuild in progress)');
      return 0;
    }

    const lastIndexedId = parseInt(
      (this.db.prepare(`SELECT value FROM conversation_fts_metadata WHERE key = 'last_indexed_id'`).get() as any)?.value || '0'
    );

    const newMessages = this.conversationsDb.prepare(`
      SELECT id, session_id, content, timestamp, role
      FROM messages
      WHERE id > ?
        AND content IS NOT NULL
        AND content != ''
      ORDER BY id ASC
      LIMIT 10000
    `).all(lastIndexedId) as any[];

    if (newMessages.length === 0) {
      return 0;
    }

    console.log(`🔄 Incremental rebuild: indexing ${newMessages.length} new messages...`);

    const txn = this.db.transaction((messages: any[]) => {
      const insertFts = this.db.prepare(`
        INSERT INTO fts_messages (message_id, session_id, content, timestamp, role)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertMap = this.db.prepare(`
        INSERT OR REPLACE INTO fts_message_map (message_id, fts_rowid)
        VALUES (?, last_insert_rowid())
      `);

      for (const msg of messages) {
        insertFts.run(msg.id, msg.session_id, msg.content,
                     new Date(msg.timestamp).getTime(), msg.role);
        insertMap.run(msg.id);
      }

      const maxId = Math.max(...messages.map(m => m.id));
      const maxTs = Math.max(...messages.map(m => new Date(m.timestamp).getTime()));
      this.db.prepare(`UPDATE conversation_fts_metadata SET value = ?, updated_at = ? WHERE key = 'last_indexed_id'`)
        .run(String(maxId), Date.now());
      this.db.prepare(`UPDATE conversation_fts_metadata SET value = ?, updated_at = ? WHERE key = 'last_indexed_ts'`)
        .run(String(maxTs), Date.now());
    });

    txn(newMessages);
    console.log(`✅ Incremental rebuild complete: ${newMessages.length} messages indexed`);
    return newMessages.length;
  }

  /**
   * Health check: verify FTS sync with conversations.db
   */
  public getHealthStatus(): HealthStatus {
    try {
      const totalMessages = (this.conversationsDb.prepare(`
        SELECT COUNT(*) as count FROM messages
        WHERE content IS NOT NULL AND content != ''
      `).get() as any).count;

      const indexedMessages = (this.db.prepare(`
        SELECT COUNT(*) as count FROM fts_messages
      `).get() as any).count;

      const lastIndexedId = parseInt(
        (this.db.prepare(`SELECT value FROM conversation_fts_metadata WHERE key = 'last_indexed_id'`).get() as any)?.value || '0'
      );

      const lastIndexedTs = parseInt(
        (this.db.prepare(`SELECT value FROM conversation_fts_metadata WHERE key = 'last_indexed_ts'`).get() as any)?.value || '0'
      );

      const lastRebuildAtStr = (this.db.prepare(`SELECT value FROM conversation_fts_metadata WHERE key = 'last_rebuild_at'`).get() as any)?.value;

      const pendingCount = totalMessages - indexedMessages;
      const integrityOk = this.db.prepare(`PRAGMA integrity_check;`).get() as { integrity_check: string };

      let syncStatus: HealthStatus['syncStatus'] = 'OK';
      if (indexedMessages === 0 && totalMessages > 0) {
        syncStatus = 'MISSING_INDEX';
      } else if (integrityOk.integrity_check !== 'ok') {
        syncStatus = 'CORRUPTED';
      } else if (pendingCount > totalMessages * 0.05) { // More than 5% gap
        syncStatus = 'NEEDS_UPDATE';
      }

      return {
        totalMessages,
        indexedMessages,
        pendingCount,
        lastIndexedId: lastIndexedId || null,
        lastIndexedAt: lastIndexedTs ? new Date(lastIndexedTs) : null,
        lastRebuildAt: lastRebuildAtStr ? new Date(lastRebuildAtStr) : null,
        integrityOk: integrityOk.integrity_check === 'ok',
        syncStatus
      };
    } catch (e) {
      console.error("⚠️  ConversationFTS health check failed:", e);
      return {
        totalMessages: 0,
        indexedMessages: 0,
        pendingCount: 0,
        lastIndexedId: null,
        lastIndexedAt: null,
        lastRebuildAt: null,
        integrityOk: false,
        syncStatus: 'CORRUPTED'
      };
    }
  }

  /**
   * Auto-repair: rebuild if sync status requires it
   */
  public async autoRepair(): Promise<boolean> {
    const health = this.getHealthStatus();

    if (health.syncStatus === 'MISSING_INDEX' || health.syncStatus === 'CORRUPTED') {
      console.log(`⚠️  ConversationFTS auto-repair triggered: ${health.syncStatus}`);
      await this.rebuildFull();
      return true;
    } else if (health.syncStatus === 'NEEDS_UPDATE') {
      console.log(`🔄 ConversationFTS auto-repair: incremental update`);
      await this.rebuildIncremental();
      return true;
    }

    return false;
  }

  /**
   * Delete messages from FTS index (e.g., when deleting a session)
   */
  public deleteMessages(messageIds: number[]): void {
    if (messageIds.length === 0) return;

    try {
      const txn = this.db.transaction((ids: number[]) => {
        // Get FTS rowids from map
        const ftsRowids = this.db.prepare(`
          SELECT fts_rowid FROM fts_message_map WHERE message_id IN (${ids.map(() => '?').join(',')})
        `).all(...ids) as Array<{ fts_rowid: number }>;

        // Delete from FTS table using rowid
        if (ftsRowids.length > 0) {
          const rowidsStr = ftsRowids.map(r => r.fts_rowid).join(',');
          this.db.exec(`DELETE FROM fts_messages WHERE rowid IN (${rowidsStr})`);
        }

        // Delete from map
        this.db.prepare(`DELETE FROM fts_message_map WHERE message_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
      });

      txn(messageIds);
    } catch (e) {
      console.error('⚠️  ConversationFTS: Failed to delete messages from index:', e);
    }
  }

  /**
   * Delete all messages for a session from FTS index
   */
  public deleteSession(sessionId: number): void {
    try {
      const txn = this.db.transaction(() => {
        // Capture message_ids before deletion to clean mapping.
        const messageIds = this.db.prepare(`
          SELECT message_id FROM fts_messages WHERE session_id = ?
        `).all(sessionId) as Array<{ message_id: number }>;

        // Delete from FTS table
        this.db.prepare(`DELETE FROM fts_messages WHERE session_id = ?`).run(sessionId);

        if (messageIds.length > 0) {
          this.db.prepare(`DELETE FROM fts_message_map WHERE message_id IN (${messageIds.map(() => '?').join(',')})`).run(...messageIds.map(m => m.message_id));
        }
      });

      txn();
    } catch (e) {
      console.error('⚠️  ConversationFTS: Failed to delete session from index:', e);
    }
  }

  private isLocked(): boolean {
    return fs.existsSync(this.lockPath);
  }

  private createLock(): void {
    fs.writeFileSync(this.lockPath, String(process.pid));
  }

  private removeLock(): void {
    if (fs.existsSync(this.lockPath)) {
      fs.removeSync(this.lockPath);
    }
  }

  /**
   * Cleanup on shutdown
   */
  public close(): void {
    this.flushBatch(); // Flush any pending messages
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.removeLock();
    this.db.close();
    this.conversationsDb.close();
  }

  private formatSessionKey(sessionId: number, createdAt?: Date, sessionHash?: string): string {
    const hashPart = sessionHash ? sessionHash.slice(0, 8) : "nohash";
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      return `${sessionId}.unknown.${hashPart}`;
    }
    const y = createdAt.getUTCFullYear().toString().padStart(4, "0");
    const m = (createdAt.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = createdAt.getUTCDate().toString().padStart(2, "0");
    const hh = createdAt.getUTCHours().toString().padStart(2, "0");
    const mm = createdAt.getUTCMinutes().toString().padStart(2, "0");
    const ss = createdAt.getUTCSeconds().toString().padStart(2, "0");
    return `${sessionId}.${y}${m}${d}-${hh}${mm}${ss}.${hashPart}`;
  }
}

/**
 * Get singleton instance (convenience)
 */
export function getConversationFTS(): ConversationFTS {
  return ConversationFTS.getInstance();
}
