#!/usr/bin/env node
/**
 * Cross-DB consistency (non-destructive).
 * - Ensures sessions in sessions.db have corresponding timeline events.
 * - Ensures message counts align between conversations and timeline (sampled).
 * Skips gracefully if DBs or schemas are missing.
 *
 * Run: node tests/integration/db/multi-db-consistency.test.js
 */

import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

const sessionsDbPath = path.join(os.homedir(), ".grok", "sessions.db");
const conversationsDbPath = path.join(os.homedir(), ".grok", "conversations.db");
const timelineDbPath = path.join(os.homedir(), ".grok", "timeline.db");

function safeDb(file) {
  return new Database(file, { readonly: true, fileMustExist: true });
}

function hasTables(db, names) {
  const list = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  return names.every(n => list.includes(n));
}

let failures = 0;

function checkSessionHasTimelineEvents() {
  if (!fs.existsSync(sessionsDbPath) || !fs.existsSync(timelineDbPath)) {
    console.warn("⚠️  sessions.db or timeline.db missing, skipping session→timeline check");
    return;
  }
  const sdb = safeDb(sessionsDbPath);
  const tdb = safeDb(timelineDbPath);
  if (!hasTables(sdb, ["sessions"]) || !hasTables(tdb, ["events"])) {
    console.warn("⚠️  Required tables missing, skipping session→timeline check");
    return;
  }
  const sessionIds = sdb.prepare(`SELECT id FROM sessions LIMIT 100`).all().map(r => r.id);
  const missing = [];
  for (const id of sessionIds) {
    const count = tdb.prepare(
      `SELECT COUNT(*) AS cnt FROM events WHERE aggregate_id = ? AND aggregate_type = 'session'`
    ).get(id).cnt;
    if (count === 0) {
      missing.push(id);
    }
  }
  if (missing.length) {
    failures++;
    console.error(`❌ timeline.db: no events for session ids: ${missing.join(", ")}`);
  } else {
    console.log("✅ timeline.db: sessions have corresponding events (sampled)");
  }
}

function checkMessageCountsAlign() {
  if (!fs.existsSync(conversationsDbPath) || !fs.existsSync(timelineDbPath)) {
    console.warn("⚠️  conversations.db or timeline.db missing, skipping message count alignment");
    return;
  }
  const cdb = safeDb(conversationsDbPath);
  const tdb = safeDb(timelineDbPath);
  if (!hasTables(cdb, ["messages"]) || !hasTables(tdb, ["events"])) {
    console.warn("⚠️  Required tables missing, skipping message count alignment");
    return;
  }
  // Sample up to 20 session_ids from conversations
  const sessionIds = cdb.prepare(
    `SELECT DISTINCT session_id FROM messages WHERE session_id IS NOT NULL LIMIT 20`
  ).all().map(r => r.session_id);

  const mismatches = [];
  for (const sid of sessionIds) {
    const convoCount = cdb.prepare(
      `SELECT COUNT(*) AS cnt FROM messages WHERE session_id = ?`
    ).get(sid).cnt;
    const timelineCount = tdb.prepare(
      `SELECT COUNT(*) AS cnt
       FROM events
       WHERE event_type IN ('USER_MESSAGE','LLM_RESPONSE','TOOL_CALL_STARTED','TOOL_CALL_SUCCESS','TOOL_CALL_FAILED')
         AND aggregate_id = ?`
    ).get(sid).cnt;
    if (convoCount !== timelineCount) {
      mismatches.push({ sid, convoCount, timelineCount });
    }
  }
  if (mismatches.length) {
    failures++;
    console.error("❌ message count mismatch (sampled):", mismatches);
  } else {
    console.log("✅ message counts align between conversations and timeline (sampled)");
  }
}

function main() {
  checkSessionHasTimelineEvents();
  checkMessageCountsAlign();
  if (failures > 0) process.exit(1);
  process.exit(0);
}

main();
