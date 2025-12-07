#!/usr/bin/env node
/**
 * DB consistency checks (non-destructive).
 * - Orphan detection between sessions/messages.
 * - Basic timestamp sanity.
 * - JSON validity where applicable.
 * Skips silently if DBs are missing or schema mismatch.
 *
 * Run: node tests/integration/db/consistency.test.js
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

function checkSessionsVsMessages() {
  if (!fs.existsSync(sessionsDbPath)) {
    console.warn(`⚠️  sessions.db not found (${sessionsDbPath}), skipping orphan check`);
    return;
  }
  const db = safeDb(sessionsDbPath);
  if (!hasTables(db, ["sessions", "messages"])) {
    console.warn("⚠️  sessions.db missing expected tables, skipping orphan check");
    return;
  }
  const orphans = db.prepare(`
    SELECT m.id
    FROM messages m
    LEFT JOIN sessions s ON m.session_id = s.id
    WHERE s.id IS NULL
    LIMIT 5
  `).all();
  if (orphans.length) {
    failures++;
    console.error(`❌ sessions.db: found orphan messages (e.g., ids ${orphans.map(o => o.id).join(", ")})`);
  } else {
    console.log("✅ sessions.db: no orphan messages detected");
  }
}

function checkConversationsTimestamps() {
  if (!fs.existsSync(conversationsDbPath)) {
    console.warn(`⚠️  conversations.db not found (${conversationsDbPath}), skipping timestamp check`);
    return;
  }
  const db = safeDb(conversationsDbPath);
  if (!hasTables(db, ["messages"])) {
    console.warn("⚠️  conversations.db missing messages table, skipping timestamp check");
    return;
  }
  const now = Date.now();
  const future = db.prepare(
    `SELECT COUNT(*) AS count FROM messages WHERE timestamp > ?`
  ).get(new Date(now + 60_000).toISOString());
  if (future.count > 0) {
    failures++;
    console.error(`❌ conversations.db: found ${future.count} messages with future timestamps`);
  } else {
    console.log("✅ conversations.db: timestamps are not in the future");
  }
}

function checkTimelineJsonPayloads() {
  if (!fs.existsSync(timelineDbPath)) {
    console.warn(`⚠️  timeline.db not found (${timelineDbPath}), skipping JSON payload check`);
    return;
  }
  const db = safeDb(timelineDbPath);
  if (!hasTables(db, ["events"])) {
    console.warn("⚠️  timeline.db missing events table, skipping JSON payload check");
    return;
  }
  const rows = db.prepare(`SELECT id, payload FROM events LIMIT 100`).all();
  const bad = [];
  for (const row of rows) {
    try {
      JSON.parse(row.payload);
    } catch {
      bad.push(row.id);
    }
  }
  if (bad.length) {
    failures++;
    console.error(`❌ timeline.db: invalid JSON payloads for events: ${bad.join(", ")}`);
  } else {
    console.log("✅ timeline.db: sampled payloads are valid JSON");
  }
}

function main() {
  checkSessionsVsMessages();
  checkConversationsTimestamps();
  checkTimelineJsonPayloads();

  if (failures > 0) process.exit(1);
  process.exit(0);
}

main();
