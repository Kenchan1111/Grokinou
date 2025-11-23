import Database from 'better-sqlite3';

/**
 * Migration 002: Add Native Search Fields to Sessions
 * 
 * Adds fields that are automatically populated by the application
 * for enhanced search and filtering capabilities.
 * 
 * NO USER-DEFINED FIELDS - Only native, application-managed fields.
 */

export function up(db: Database.Database): void {
  console.log('🔄 Running migration 002: Adding native search fields...');
  
  // Add session_name (replaces/supplements title)
  db.exec(`
    ALTER TABLE sessions ADD COLUMN session_name TEXT;
  `);
  
  // Add created_at if not exists (some versions might not have it)
  // Check if column already exists
  const columns = db.prepare(`PRAGMA table_info(sessions)`).all() as Array<{name: string}>;
  const hasCreatedAt = columns.some(col => col.name === 'created_at');
  
  if (!hasCreatedAt) {
    db.exec(`
      ALTER TABLE sessions ADD COLUMN created_at DATETIME;
    `);
    
    // Backfill created_at from started_at
    db.exec(`
      UPDATE sessions SET created_at = started_at WHERE created_at IS NULL;
    `);
  }
  
  // Add message_count (denormalized for performance)
  db.exec(`
    ALTER TABLE sessions ADD COLUMN message_count INTEGER DEFAULT 0;
  `);
  
  // Add total_tokens (usage tracking)
  db.exec(`
    ALTER TABLE sessions ADD COLUMN total_tokens INTEGER DEFAULT 0;
  `);
  
  // Add first_message_preview (for quick display)
  db.exec(`
    ALTER TABLE sessions ADD COLUMN first_message_preview TEXT;
  `);
  
  // Add last_message_preview (for quick display)
  db.exec(`
    ALTER TABLE sessions ADD COLUMN last_message_preview TEXT;
  `);
  
  // Add project_context (auto-detected: git branch, package.json, etc.)
  db.exec(`
    ALTER TABLE sessions ADD COLUMN project_context TEXT;
  `);
  
  // Add is_favorite (user can star important sessions)
  db.exec(`
    ALTER TABLE sessions ADD COLUMN is_favorite INTEGER DEFAULT 0;
  `);
  
  // Create indexes for search performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(session_name);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_favorite ON sessions(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_sessions_message_count ON sessions(message_count);
  `);
  
  // Backfill message_count for existing sessions
  db.exec(`
    UPDATE sessions 
    SET message_count = (
      SELECT COUNT(*) FROM messages WHERE session_id = sessions.id
    )
    WHERE message_count = 0;
  `);
  
  // Backfill first/last message previews for existing sessions
  db.exec(`
    UPDATE sessions 
    SET first_message_preview = (
      SELECT substr(content, 1, 100) 
      FROM messages 
      WHERE session_id = sessions.id AND role = 'user'
      ORDER BY id ASC
      LIMIT 1
    ),
    last_message_preview = (
      SELECT substr(content, 1, 100) 
      FROM messages 
      WHERE session_id = sessions.id
      ORDER BY id DESC
      LIMIT 1
    )
    WHERE first_message_preview IS NULL;
  `);
  
  console.log('✅ Migration 002 completed successfully');
  console.log('   Added 8 native search fields');
  console.log('   Created 4 performance indexes');
  console.log('   Backfilled data for existing sessions');
}

export function down(db: Database.Database): void {
  console.log('🔄 Rolling back migration 002...');
  
  // Note: SQLite doesn't support DROP COLUMN easily
  // We'd need to recreate the table, which is risky
  // For now, just drop the indexes
  db.exec(`
    DROP INDEX IF EXISTS idx_sessions_name;
    DROP INDEX IF EXISTS idx_sessions_created_at;
    DROP INDEX IF EXISTS idx_sessions_favorite;
    DROP INDEX IF EXISTS idx_sessions_message_count;
  `);
  
  console.log('⚠️  Note: Columns not removed (SQLite limitation)');
  console.log('   They will remain but be unused');
}
