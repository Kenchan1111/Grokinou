#!/usr/bin/env node
/**
 * SMOKE TEST: Session Creation
 *
 * EXPECTED: sessions.db should contain active session(s)
 * CURRENT STATUS: FAILS (sessions.db is 0 bytes - completely empty)
 *
 * This test documents Bug #2: sessions.db empty
 *
 * Once sessions.db is fixed, this test should PASS.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, statSync } from 'fs';

const dbPath = join(homedir(), '.grok', 'sessions.db');

function fail(msg) {
  console.error('❌ SMOKE TEST FAILED:', msg);
  process.exit(1);
}

function pass(msg) {
  console.log('✅', msg);
  process.exit(0);
}

// Check 1: sessions.db file exists
if (!existsSync(dbPath)) {
  fail(`sessions.db does not exist at ${dbPath}`);
}

// Check 2: sessions.db is not empty
const stats = statSync(dbPath);
if (stats.size === 0) {
  fail(`sessions.db is 0 bytes (empty). Session management is broken.`);
}

// Check 3: sessions.db has correct schema
let db;
try {
  db = new Database(dbPath, { readonly: true });

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all();

  const tableNames = tables.map(t => t.name);

  if (!tableNames.includes('sessions')) {
    db.close();
    fail('sessions.db missing "sessions" table');
  }

  // Check 4: At least one session exists
  const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get();

  if (sessionCount.count === 0) {
    db.close();
    fail('sessions.db has schema but contains 0 sessions');
  }

  db.close();
  pass(`sessions.db contains ${sessionCount.count} session(s) ✅`);

} catch (error) {
  if (db) db.close();
  fail(`Database error: ${error.message}`);
}
