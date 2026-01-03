import Database from 'better-sqlite3';
import * as migration002 from './002-add-session-search-fields.js';
import * as migration003 from './003-protect-session-identifiers.js';

/**
 * Migration Manager
 * 
 * Handles database schema migrations in a safe, incremental way.
 */

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    version: 2,
    name: 'add-session-search-fields',
    up: migration002.up,
    down: migration002.down,
  },
  {
    version: 3,
    name: 'protect-session-identifiers',
    up: migration003.up,
    down: migration003.down,
  },
  // Future migrations go here
];

export class MigrationManager {
  private db: Database.Database;
  
  constructor(db: Database.Database) {
    this.db = db;
    this.ensureMigrationsTable();
  }
  
  /**
   * Create migrations tracking table
   */
  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  
  /**
   * Get current schema version
   */
  private getCurrentVersion(): number {
    const result = this.db.prepare(`
      SELECT MAX(version) as version FROM schema_migrations
    `).get() as { version: number | null };
    
    return result.version || 0;
  }
  
  /**
   * Run pending migrations
   */
  runPendingMigrations(): void {
    const currentVersion = this.getCurrentVersion();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      console.log('✅ Database schema is up to date (version ' + currentVersion + ')');
      return;
    }
    
    console.log(`🔄 Running ${pendingMigrations.length} pending migration(s)...`);
    
    for (const migration of pendingMigrations) {
      try {
        console.log(`\n📦 Migration ${migration.version}: ${migration.name}`);
        
        // Run migration in transaction
        this.db.transaction(() => {
          migration.up(this.db);
          
          // Record migration
          this.db.prepare(`
            INSERT INTO schema_migrations (version, name) VALUES (?, ?)
          `).run(migration.version, migration.name);
        })();
        
        console.log(`✅ Migration ${migration.version} completed`);
      } catch (error) {
        console.error(`❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }
    
    console.log(`\n✅ All migrations completed. Schema version: ${this.getCurrentVersion()}\n`);
  }
  
  /**
   * Rollback last migration (use with caution)
   */
  rollbackLastMigration(): void {
    const currentVersion = this.getCurrentVersion();
    
    if (currentVersion === 0) {
      console.log('ℹ️  No migrations to rollback');
      return;
    }
    
    const migration = migrations.find(m => m.version === currentVersion);
    
    if (!migration) {
      console.error(`❌ Migration ${currentVersion} not found in code`);
      return;
    }
    
    console.log(`🔄 Rolling back migration ${migration.version}: ${migration.name}`);
    
    try {
      this.db.transaction(() => {
        migration.down(this.db);
        
        // Remove migration record
        this.db.prepare(`
          DELETE FROM schema_migrations WHERE version = ?
        `).run(currentVersion);
      })();
      
      console.log(`✅ Rollback completed. Schema version: ${this.getCurrentVersion()}`);
    } catch (error) {
      console.error(`❌ Rollback failed:`, error);
      throw error;
    }
  }
}
