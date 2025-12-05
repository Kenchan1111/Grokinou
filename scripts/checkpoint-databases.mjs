#!/usr/bin/env node
/**
 * Checkpoint SQLite databases to consolidate WAL files
 * Run this when WAL files become too large
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const GROK_DIR = path.join(os.homedir(), '.grok');

function checkpointDatabase(dbPath, dbName) {
  if (!fs.existsSync(dbPath)) {
    console.log(`⏭️  ${dbName}: Database doesn't exist, skipping`);
    return;
  }

  console.log(`\n🔄 Checkpointing ${dbName}...`);

  try {
    const db = new Database(dbPath);

    // Get current WAL size
    const walPath = dbPath + '-wal';
    const walSize = fs.existsSync(walPath)
      ? (fs.statSync(walPath).size / 1024 / 1024).toFixed(2) + ' MB'
      : 'N/A';

    console.log(`   Current WAL size: ${walSize}`);

    // Run checkpoint (TRUNCATE mode = consolidate and delete WAL)
    db.pragma('wal_checkpoint(TRUNCATE)');

    // Check new WAL size
    const newWalSize = fs.existsSync(walPath)
      ? (fs.statSync(walPath).size / 1024 / 1024).toFixed(2) + ' MB'
      : '0 MB (deleted)';

    console.log(`   ✅ Checkpoint complete. New WAL size: ${newWalSize}`);

    db.close();
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
}

console.log('=== SQLite Database Checkpoint ===\n');

// Checkpoint all databases
checkpointDatabase(path.join(GROK_DIR, 'conversations.db'), 'conversations.db');
checkpointDatabase(path.join(GROK_DIR, 'timeline.db'), 'timeline.db');

console.log('\n✅ All databases checkpointed\n');
