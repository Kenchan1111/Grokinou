import Database from 'better-sqlite3';

/**
 * Migration 003: Protect session identifiers from mutation
 *
 * Adds triggers to prevent updates to session_hash and created_at.
 */

export function up(db: Database.Database): void {
  console.log('🔄 Running migration 003: Protecting session identifiers...');

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS sessions_block_session_hash_update
    BEFORE UPDATE OF session_hash ON sessions
    WHEN OLD.session_hash IS NOT NEW.session_hash
    BEGIN
      SELECT RAISE(ABORT, 'session_hash is immutable');
    END;

    CREATE TRIGGER IF NOT EXISTS sessions_block_created_at_update
    BEFORE UPDATE OF created_at ON sessions
    WHEN OLD.created_at IS NOT NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'created_at is immutable');
    END;
  `);

  console.log('✅ Migration 003 completed successfully');
}

export function down(db: Database.Database): void {
  console.log('🔄 Rolling back migration 003...');
  db.exec(`
    DROP TRIGGER IF EXISTS sessions_block_session_hash_update;
    DROP TRIGGER IF EXISTS sessions_block_created_at_update;
  `);
  console.log('✅ Rollback 003 completed');
}
