/**
 * Timeline Database Manager
 * 
 * Manages the connection to timeline.db (SQLite).
 * This database is APPEND-ONLY: NO UPDATE or DELETE operations allowed.
 * 
 * Features:
 * - Auto-initialization of schema
 * - Connection pooling (via better-sqlite3)
 * - Read-only mode for queries
 * - Write-only mode for event logging
 * 
 * @module timeline/database
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { TIMELINE_SCHEMA } from './schema.js';

/**
 * Timeline Database Configuration
 */
export interface TimelineDatabaseConfig {
  dbPath?: string;              // Path to timeline.db (default: ~/.grok/timeline.db)
  readOnly?: boolean;           // Open in read-only mode
  verbose?: boolean;            // Enable SQL logging
}

/**
 * Timeline Database Manager
 * 
 * Singleton pattern: Only one instance per process.
 */
export class TimelineDatabase {
  private static instance: TimelineDatabase | null = null;
  private db: Database.Database;
  private readonly dbPath: string;
  private readonly schemaVersion = '1.0.0';
  
  /**
   * Private constructor (Singleton pattern)
   */
  private constructor(config: TimelineDatabaseConfig = {}) {
    // Determine database path
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const grokDir = path.join(homeDir, '.grok');
    
    // Ensure .grok directory exists
    if (!fs.existsSync(grokDir)) {
      fs.mkdirSync(grokDir, { recursive: true });
    }
    
    this.dbPath = config.dbPath || path.join(grokDir, 'timeline.db');
    
    // Open database connection
    this.db = new Database(this.dbPath, {
      readonly: config.readOnly || false,
      verbose: config.verbose ? console.log : undefined,
    });
    
    // Configure SQLite for performance
    this.db.pragma('journal_mode = WAL');          // Write-Ahead Logging
    this.db.pragma('synchronous = NORMAL');        // Balance safety/performance
    this.db.pragma('cache_size = -64000');         // 64MB cache
    this.db.pragma('foreign_keys = ON');           // Enforce foreign keys
    this.db.pragma('temp_store = MEMORY');         // Temp tables in RAM
    
    // Initialize schema if needed
    if (!config.readOnly) {
      this.initializeSchema();
    }
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: TimelineDatabaseConfig): TimelineDatabase {
    if (!TimelineDatabase.instance) {
      TimelineDatabase.instance = new TimelineDatabase(config);
    }
    return TimelineDatabase.instance;
  }
  
  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    try {
      // Execute embedded schema
      this.db.exec(TIMELINE_SCHEMA);
      
      // Verify schema version
      const currentVersion = this.getMetadata('schema_version');
      
      if (currentVersion !== this.schemaVersion) {
        console.warn(`⚠️  Timeline schema version mismatch: expected ${this.schemaVersion}, got ${currentVersion}`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize timeline schema:', error);
      throw error;
    }
  }
  
  /**
   * Get database connection (for raw queries)
   * 
   * ⚠️ WARNING: Use with caution. Prefer high-level methods.
   */
  public getConnection(): Database.Database {
    return this.db;
  }
  
  /**
   * Get metadata value
   */
  public getMetadata(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM metadata WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }
  
  /**
   * Set metadata value
   */
  public setMetadata(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, value, Date.now() * 1000); // Microseconds
  }
  
  /**
   * Get current sequence number
   */
  public getCurrentSequence(): number {
    const lastSeq = this.getMetadata('last_sequence');
    return parseInt(lastSeq || '0', 10);
  }
  
  /**
   * Increment and return next sequence number
   * 
   * Thread-safe via SQLite's BEGIN IMMEDIATE transaction.
   */
  public getNextSequence(): number {
    const stmt = this.db.prepare(`
      UPDATE metadata 
      SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT),
          updated_at = ?
      WHERE key = 'last_sequence'
      RETURNING CAST(value AS INTEGER) as seq
    `);
    
    const result = stmt.get(Date.now() * 1000) as { seq: number } | undefined;
    return result?.seq || 1;
  }
  
  /**
   * Get database statistics
   */
  public getStats(): {
    total_events: number;
    total_snapshots: number;
    total_blobs: number;
    db_size_mb: number;
    last_event_time: number | null;
  } {
    const countEvents = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
    const countSnapshots = this.db.prepare('SELECT COUNT(*) as count FROM snapshots').get() as { count: number };
    const countBlobs = this.db.prepare('SELECT COUNT(*) as count FROM file_blobs').get() as { count: number };
    const lastEvent = this.db.prepare('SELECT MAX(timestamp) as ts FROM events').get() as { ts: number | null };
    
    // Get database file size
    let dbSizeMb = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      dbSizeMb = stats.size / 1024 / 1024;
    } catch (error) {
      // Ignore error
    }
    
    return {
      total_events: countEvents.count,
      total_snapshots: countSnapshots.count,
      total_blobs: countBlobs.count,
      db_size_mb: Math.round(dbSizeMb * 100) / 100,
      last_event_time: lastEvent.ts,
    };
  }
  
  /**
   * Vacuum database (reclaim space)
   * 
   * ⚠️ This can be slow on large databases.
   */
  public vacuum(): void {
    console.log('🗑️  Vacuuming timeline database...');
    this.db.exec('VACUUM');
    console.log('✅ Vacuum completed');
  }
  
  /**
   * Optimize database (analyze + reindex)
   */
  public optimize(): void {
    console.log('⚡ Optimizing timeline database...');
    this.db.exec('ANALYZE');
    this.db.exec('REINDEX');
    console.log('✅ Optimization completed');
  }
  
  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      TimelineDatabase.instance = null;
    }
  }
  
  /**
   * Check if database is healthy
   */
  public healthCheck(): boolean {
    try {
      // Simple query to verify database is accessible
      this.db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      console.error('❌ Timeline database health check failed:', error);
      return false;
    }
  }
}

/**
 * Get timeline database instance (convenience function)
 */
export function getTimelineDb(config?: TimelineDatabaseConfig): TimelineDatabase {
  return TimelineDatabase.getInstance(config);
}

/**
 * Export for use in other modules
 */
export default TimelineDatabase;
