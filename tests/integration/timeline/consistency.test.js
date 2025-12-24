#!/usr/bin/env node
/**
 * Timeline consistency checks (non-destructive).
 *
 * Based on COMPREHENSIVE_TEST_PLAN.md section 2.7.
 *
 * When ~/.grok/timeline.db exists and has an events table, this test verifies:
 * - sequence_number values are continuous (no gaps)
 * - timestamps are monotonic with respect to sequence_number
 *
 * If the DB or table is missing, the test is skipped without failing.
 *
 * Run:
 *   node tests/integration/timeline/consistency.test.js
 */

import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

const timelineDbPath = path.join(os.homedir(), ".grok", "timeline.db");

function safeDb(file) {
  return new Database(file, { readonly: true, fileMustExist: true });
}

function fail(msg) {
  console.error("❌ TIMELINE CONSISTENCY FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

function warn(msg) {
  console.warn("⚠️", msg);
}

if (!fs.existsSync(timelineDbPath)) {
  warn(`timeline.db not found at ${timelineDbPath}, skipping timeline consistency checks.`);
  process.exit(0);
}

let db = null;

try {
  db = safeDb(timelineDbPath);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
  if (!tables.includes("events")) {
    warn("timeline.db has no 'events' table, skipping consistency checks.");
    process.exit(0);
  }

  // 1) Sequence numbers continuous
  const gaps = db
    .prepare(
      `
      WITH sequences AS (
        SELECT 
          sequence_number,
          LAG(sequence_number) OVER (ORDER BY sequence_number) AS prev
        FROM events
      )
      SELECT sequence_number, prev
      FROM sequences
      WHERE prev IS NOT NULL AND sequence_number != prev + 1
      LIMIT 5
    `
    )
    .all();

  if (gaps.length > 0) {
    fail(
      `Non-contiguous sequence_number detected in events table (examples: ` +
        gaps.map((g) => `${g.prev}→${g.sequence_number}`).join(", ") +
        ")."
    );
  } else {
    console.log("✅ timeline.db: sequence_number values are continuous.");
  }

  // 2) Timestamps monotonic with respect to sequence_number
  const tsViolations = db
    .prepare(
      `
      WITH ordered AS (
        SELECT 
          sequence_number,
          timestamp,
          LAG(timestamp) OVER (ORDER BY sequence_number) AS prev_ts
        FROM events
      )
      SELECT sequence_number, timestamp, prev_ts
      FROM ordered
      WHERE prev_ts IS NOT NULL AND timestamp < prev_ts
      LIMIT 5
    `
    )
    .all();

  if (tsViolations.length > 0) {
    fail(
      `Timestamp monotonicity violated (examples: ` +
        tsViolations
          .map((v) => `seq=${v.sequence_number} ts=${v.timestamp} prev_ts=${v.prev_ts}`)
          .join(", ") +
        ")."
    );
  } else {
    console.log("✅ timeline.db: timestamps are monotonic with respect to sequence_number.");
  }

  pass("Timeline consistency checks passed.");
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  // If better-sqlite3 binary is incompatible with the current Node.js version,
  // we skip this test instead of failing hard (environment issue, not logic bug).
  if (msg.includes("NODE_MODULE_VERSION")) {
    warn(
      "better-sqlite3 binary is incompatible with this Node.js version; " +
        "skipping timeline consistency checks."
    );
    process.exit(0);
  }
  fail(`Error while checking timeline consistency: ${msg}`);
} finally {
  if (db) {
    db.close();
  }
}
