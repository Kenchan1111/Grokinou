#!/usr/bin/env node
/**
 * Unit tests for session identifier immutability triggers.
 */
import fs from "fs";
import os from "os";
import path from "path";
import assert from "assert";
import Database from "better-sqlite3";

const distPath = path.join(process.cwd(), "dist", "db", "migrations", "003-protect-session-identifiers.js");

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/db/migrations/003-protect-session-identifiers.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let migration003;
try {
  migration003 = await import(pathToFileUrl(distPath).href);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary incompatible with this Node.js runtime; " +
        "skipping session identifier tests. Try `npm rebuild` or reinstall."
    );
    process.exit(0);
  }
  console.error("❌ Failed to import migration 003:", err);
  process.exit(1);
}

function setupDb(baseDir) {
  const dbPath = path.join(baseDir, "conversations.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      session_hash TEXT UNIQUE NOT NULL,
      created_at DATETIME NOT NULL
    );
  `);
  db.prepare(`INSERT INTO sessions (id, session_hash, created_at) VALUES (?, ?, ?)`)
    .run(1, "hash1234567890abcd", "2025-01-01T00:00:00.000Z");
  return { db, dbPath };
}

function expectAbort(fn, label) {
  try {
    fn();
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes("immutable")) return;
    throw new Error(`${label}: unexpected error ${msg}`);
  }
  throw new Error(`${label}: expected immutability trigger to abort`);
}

async function main() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-identifiers-"));
  const { db, dbPath } = setupDb(baseDir);

  migration003.up(db);

  expectAbort(
    () => db.prepare(`UPDATE sessions SET session_hash = ? WHERE id = ?`).run("mutated", 1),
    "session_hash update"
  );

  expectAbort(
    () => db.prepare(`UPDATE sessions SET created_at = ? WHERE id = ?`).run("2025-01-02T00:00:00.000Z", 1),
    "created_at update"
  );

  db.close();
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(baseDir, { recursive: true, force: true });

  console.log("✅ Session identifier immutability tests passed.");
}

main().catch((err) => {
  console.error("❌ Session identifier immutability tests failed:", err?.message || err);
  process.exit(1);
});
