#!/usr/bin/env node
/**
 * Run integrity_check on conversations.db and timeline.db (or custom path).
 * Usage: node dist/utils/wal-verify.js [--db conversations|timeline|custom_path]
 */
import Database from "better-sqlite3";
import path from "path";
import os from "os";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: any = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--db") opts.db = args[++i];
  }
  return opts;
}

function resolveDb(db?: string) {
  if (!db || db === "conversations") {
    return path.join(os.homedir(), ".grok", "conversations.db");
  }
  if (db === "timeline") {
    return path.join(os.homedir(), ".grok", "timeline.db");
  }
  return db;
}

function check(dbPath: string) {
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare("PRAGMA integrity_check;").get() as any;
  db.close();
  return row?.integrity_check || "unknown";
}

function main() {
  const opts = parseArgs();
  const dbPath = resolveDb(opts.db);
  const res = check(dbPath);
  if (res !== "ok") {
    console.error(`❌ integrity_check failed for ${dbPath}: ${res}`);
    process.exit(1);
  }
  console.log(`✅ integrity_check ok for ${dbPath}`);
}

main();
