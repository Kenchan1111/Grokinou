#!/usr/bin/env node
/**
 * Unit tests for ConversationFTS:
 * - Full rebuild indexes messages
 * - minRank (bm25 upper bound) filters results
 * - deleteSession removes FTS entries and mapping
 */
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import assert from "assert";
import Database from "better-sqlite3";

const distPath = path.join(process.cwd(), "dist", "tools", "conversation-fts.js");

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/conversation-fts.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let ConversationFTS;
try {
  ({ ConversationFTS } = await import(pathToFileUrl(distPath).href));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary incompatible with this Node.js runtime; " +
        "skipping ConversationFTS unit tests. Try `npm rebuild` or reinstall."
    );
    process.exit(0);
  }
  console.error("❌ Failed to import ConversationFTS:", err);
  process.exit(1);
}

function setupConversationsDb(baseDir) {
  const convPath = path.join(baseDir, "conversations.db");
  const db = new Database(convPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      session_name TEXT,
      working_dir TEXT,
      session_hash TEXT,
      created_at TEXT,
      started_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      session_id INTEGER,
      content TEXT,
      timestamp TEXT,
      role TEXT
    );
  `);
  db.prepare(`INSERT INTO sessions (id, session_name, working_dir, session_hash, created_at, started_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(1, "Session One", "/tmp/one", "hashsessionone", "2025-01-01T09:00:00.000Z", "2025-01-01T08:59:00.000Z");
  db.prepare(`INSERT INTO sessions (id, session_name, working_dir, session_hash, created_at, started_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(2, "Session Two", "/tmp/two", "hashsessiontwo", "2025-01-02T09:00:00.000Z", "2025-01-02T08:59:00.000Z");

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, session_id, content, timestamp, role)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertMsg.run(1, 1, "hello world from session one", "2025-01-01T10:00:00.000Z", "user");
  insertMsg.run(2, 1, "another message in session one", "2025-01-01T10:01:00.000Z", "assistant");
  insertMsg.run(3, 2, "hello from session two", "2025-01-02T12:00:00.000Z", "user");

  db.close();
  return convPath;
}

async function main() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "conv-fts-test-"));
  const convDbPath = setupConversationsDb(baseDir);
  const ftsDbPath = path.join(baseDir, "conversation-fts.db");

  const fts = ConversationFTS.getInstance(ftsDbPath, convDbPath);
  await fts.rebuildFull();

  const results = fts.search("hello", { limit: 10 });
  assert.ok(results.length >= 1, "FTS search should return results");
  const first = results[0];
  assert.ok(Number.isFinite(first.rank), "FTS rank should be finite");
  assert.ok(first.sessionKey, "FTS result should include sessionKey");
  assert.ok(
    first.sessionKey.startsWith(`${first.sessionId}.`),
    "sessionKey should start with sessionId"
  );

  const health = fts.getHealthStatus();
  assert.strictEqual(health.totalMessages, 3, "health totalMessages should match");
  assert.strictEqual(health.indexedMessages, 3, "health indexedMessages should match");
  assert.strictEqual(health.syncStatus, "OK", "health syncStatus should be OK");

  const sessionFiltered = fts.search("hello", { sessionId: 1, limit: 10 });
  assert.ok(sessionFiltered.length > 0, "sessionId filter should return results");
  assert.ok(sessionFiltered.every((r) => r.sessionId === 1), "sessionId filter should constrain results");

  const before = Date.parse("2025-01-02T00:00:00.000Z");
  const beforeResults = fts.search("hello", { beforeTimestamp: before, limit: 10 });
  assert.ok(beforeResults.length > 0, "beforeTimestamp should return results");
  assert.ok(beforeResults.every((r) => r.timestamp.getTime() < before), "beforeTimestamp filter should be respected");

  const after = Date.parse("2025-01-02T00:00:00.000Z");
  const afterResults = fts.search("hello", { afterTimestamp: after, limit: 10 });
  assert.ok(afterResults.length > 0, "afterTimestamp should return results");
  assert.ok(afterResults.every((r) => r.timestamp.getTime() > after), "afterTimestamp filter should be respected");

  const stricter = first.rank - 0.000001;
  const filtered = fts.search("hello", { limit: 10, minRank: stricter });
  assert.strictEqual(filtered.length, 0, "minRank should filter out results with higher bm25");

  fts.deleteSession(1);

  const ftsDb = new Database(ftsDbPath, { readonly: true });
  const countSession1 = ftsDb
    .prepare(`SELECT COUNT(*) as count FROM fts_messages WHERE session_id = ?`)
    .get(1).count;
  assert.strictEqual(countSession1, 0, "deleteSession should remove FTS rows for the session");

  const mapCount = ftsDb
    .prepare(`SELECT COUNT(*) as count FROM fts_message_map WHERE message_id IN (?, ?)`)
    .get(1, 2).count;
  assert.strictEqual(mapCount, 0, "deleteSession should remove mapping rows for the session");

  const countSession2 = ftsDb
    .prepare(`SELECT COUNT(*) as count FROM fts_messages WHERE session_id = ?`)
    .get(2).count;
  assert.ok(countSession2 > 0, "deleteSession should not remove other sessions");

  fts.deleteMessages([3]);
  const countMessage3 = ftsDb
    .prepare(`SELECT COUNT(*) as count FROM fts_messages WHERE message_id = ?`)
    .get(3).count;
  assert.strictEqual(countMessage3, 0, "deleteMessages should remove specific messages");
  const mapCount3 = ftsDb
    .prepare(`SELECT COUNT(*) as count FROM fts_message_map WHERE message_id = ?`)
    .get(3).count;
  assert.strictEqual(mapCount3, 0, "deleteMessages should remove mapping rows");

  ftsDb.close();
  fts.close();
  fs.rmSync(baseDir, { recursive: true, force: true });

  console.log("✅ ConversationFTS unit tests passed.");
}

main().catch((err) => {
  console.error("❌ ConversationFTS unit tests failed:", err?.message || err);
  process.exit(1);
});
