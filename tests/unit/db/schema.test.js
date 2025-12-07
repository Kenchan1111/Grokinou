#!/usr/bin/env node
/**
 * DB Schema sanity checks (non-destructive).
 * - Verifies expected tables exist when DB files are present.
 * - Warns and skips if DB files are missing (no false failures).
 *
 * Run: node tests/unit/db/schema.test.js
 */

import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

const dbPaths = {
  sessions: path.join(os.homedir(), ".grok", "sessions.db"),
  conversations: path.join(os.homedir(), ".grok", "conversations.db"),
  timeline: path.join(os.homedir(), ".grok", "timeline.db"),
  grok: path.join(os.homedir(), ".grok", "grok.db"),
};

function loadTables(dbFile) {
  const db = new Database(dbFile, { readonly: true });
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
}

function expectTable(tables, name) {
  return tables.includes(name);
}

function main() {
  let failures = 0;
  for (const [label, dbFile] of Object.entries(dbPaths)) {
    if (!fs.existsSync(dbFile)) {
      console.warn(`⚠️  ${label}: DB not found at ${dbFile} (skipping)`);
      continue;
    }
    try {
      const tables = loadTables(dbFile);
      switch (label) {
        case "sessions": {
          const expected = ["sessions", "messages"];
          const missing = expected.filter(t => !expectTable(tables, t));
          if (missing.length) {
            failures++;
            console.error(`❌ ${label}: missing tables ${missing.join(", ")}`);
          } else {
            console.log(`✅ ${label}: tables ok (${expected.join(", ")})`);
          }
          break;
        }
        case "conversations": {
          const expected = ["messages"];
          const missing = expected.filter(t => !expectTable(tables, t));
          if (missing.length) {
            failures++;
            console.error(`❌ ${label}: missing tables ${missing.join(", ")}`);
          } else {
            console.log(`✅ ${label}: tables ok (${expected.join(", ")})`);
          }
          break;
        }
        case "timeline": {
          const expected = ["events", "snapshots", "file_blobs", "file_trees", "rewind_cache", "metadata"];
          const missing = expected.filter(t => !expectTable(tables, t));
          if (missing.length) {
            failures++;
            console.error(`❌ ${label}: missing tables ${missing.join(", ")}`);
          } else {
            console.log(`✅ ${label}: tables ok (${expected.join(", ")})`);
          }
          break;
        }
        case "grok": {
          // Schema unknown; just report tables
          console.log(`ℹ️  ${label}: tables detected: ${tables.join(", ") || "(none)"}`);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      failures++;
      console.error(`❌ ${label}: failed to read schema (${err.message})`);
    }
  }

  if (failures > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
