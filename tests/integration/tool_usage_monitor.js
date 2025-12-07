#!/usr/bin/env node
/**
 * Integration monitor: flags abnormal drop in tool usage in timeline.db.
 *
 * Heuristic:
 * - Compare TOOL_CALL_STARTED counts for today vs yesterday.
 * - Fail if today < RATIO_MIN * yesterday (default 0.5).
 *
 * Usage:
 *   node tests/integration/tool_usage_monitor.js
 *
 * Requirements:
 *   - ~/.grok/timeline.db exists (created by the app).
 *   - better-sqlite3 (already in dependencies).
 */

import os from "os";
import path from "path";
import Database from "better-sqlite3";

const dbPath = path.join(os.homedir(), ".grok", "timeline.db");
const RATIO_MIN = Number(process.env.TOOL_USAGE_RATIO_MIN || "0.5");

function fail(msg) {
  console.error("❌", msg);
  process.exit(1);
}

function warn(msg) {
  console.warn("⚠️", msg);
}

function main() {
  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (err) {
    fail(`Cannot open timeline db at ${dbPath}: ${err.message}`);
  }

  // timestamp is stored in microseconds; divide by 1_000_000 to reach seconds in SQLite date()
  const sql = `
    SELECT date(timestamp/1000000,'unixepoch') as day, count(*) as cnt
    FROM events
    WHERE event_type='TOOL_CALL_STARTED'
      AND timestamp/1000000 >= strftime('%s','now','-2 day')
    GROUP BY day
    ORDER BY day DESC;
  `;

  const rows = db.prepare(sql).all();

  if (!rows || rows.length < 2) {
    warn("Not enough data to compare tool usage (need today and yesterday).");
    process.exit(0);
  }

  const [today, yesterday] = rows;

  if (!today?.cnt || !yesterday?.cnt) {
    warn("Missing counts for today or yesterday; skipping strict check.");
    process.exit(0);
  }

  const ratio = today.cnt / yesterday.cnt;
  console.log(
    `Tool usage: today=${today.cnt} (${today.day}), yesterday=${yesterday.cnt} (${yesterday.day}), ratio=${ratio.toFixed(
      2
    )}, threshold=${RATIO_MIN}`
  );

  if (ratio < RATIO_MIN) {
    fail(
      `Regression detected: tool usage dropped below threshold (${ratio.toFixed(
        2
      )} < ${RATIO_MIN}). Investigate tool execution.`
    );
  }

  console.log("✅ Tool usage is within expected range.");
  process.exit(0);
}

try {
  main();
} catch (err) {
  fail(`Failed to run integration monitor: ${err.message}`);
}
