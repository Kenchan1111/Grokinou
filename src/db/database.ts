import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { MigrationManager } from './migrations/index.js';

const GROK_DIR = path.join(os.homedir(), '.grok');
const DB_PATH = path.join(GROK_DIR, 'conversations.db');

export class GrokDatabase {
  private db: Database.Database;
  private static instance: GrokDatabase;

  private constructor() {
    // Ensure .grok directory exists
    if (!fs.existsSync(GROK_DIR)) {
      fs.mkdirSync(GROK_DIR, { recursive: true });
    }

    this.db = new Database(DB_PATH);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');  // Wait up to 5s for locks
    this.db.pragma('synchronous = NORMAL'); // Balance safety/performance
    
    this.initialize();
    this.runMigrations();
  }

  static getInstance(): GrokDatabase {
    if (!GrokDatabase.instance) {
      GrokDatabase.instance = new GrokDatabase();
    }
    return GrokDatabase.instance;
  }
  
  /**
   * Run pending database migrations
   */
  private runMigrations(): void {
    const migrationManager = new MigrationManager(this.db);
    migrationManager.runPendingMigrations();
  }

  private initialize() {
    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Identification
        working_dir TEXT NOT NULL,
        session_hash TEXT UNIQUE NOT NULL,
        
        -- Provider/Model (default for session)
        default_provider TEXT NOT NULL DEFAULT 'grok',
        default_model TEXT NOT NULL,
        api_key_hash TEXT,
        
        -- Timestamps
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- Status
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
        
        -- Metadata
        title TEXT,
        tags TEXT,
        metadata TEXT,
        user_id TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_working_dir ON sessions(working_dir);
      CREATE INDEX IF NOT EXISTS idx_session_hash ON sessions(session_hash);
      CREATE INDEX IF NOT EXISTS idx_last_activity ON sessions(last_activity);
      CREATE INDEX IF NOT EXISTS idx_status ON sessions(status);
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        
        -- Type and Role
        type TEXT NOT NULL,
        role TEXT NOT NULL,
        
        -- Content
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        
        -- Provider info (per message for API switching)
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        api_key_hash TEXT,
        
        -- Timestamps
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- Metrics
        token_count INTEGER DEFAULT 0,
        
        -- Tool calls (JSON stringified)
        tool_calls TEXT,
        tool_call_id TEXT,
        
        -- Streaming
        is_streaming BOOLEAN DEFAULT 0,
        
        -- Relations
        parent_message_id INTEGER,
        
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_timestamp ON messages(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_provider ON messages(provider);
      CREATE INDEX IF NOT EXISTS idx_type ON messages(type);
    `);

    console.log('✅ SQLite database initialized:', DB_PATH);
  }

  getDb(): Database.Database {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

// Export singleton instance
export const db = GrokDatabase.getInstance();
