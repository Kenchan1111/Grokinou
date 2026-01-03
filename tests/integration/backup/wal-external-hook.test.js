#!/usr/bin/env node
/**
 * Integration test for WAL external shipping hook.
 */
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";

let Database;
try {
  const mod = await import("better-sqlite3");
  Database = mod.default || mod;
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping WAL hook test.");
    process.exit(0);
  }
  throw err;
}

const distPath = path.join(process.cwd(), "dist", "utils", "wal-shipper.js");
if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/wal-shipper.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const { WalShipper } = await import(new URL(`file://${path.resolve(distPath)}`).href);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wal-hook-"));
const dbPath = path.join(tmpDir, "test.db");
const archiveDir = path.join(tmpDir, "archive");
const hookLog = path.join(tmpDir, "hook.log");
const hookScript = path.join(tmpDir, "hook.js");

fs.writeFileSync(
  hookScript,
  [
    "const fs = require('fs');",
    "const log = process.argv[2];",
    "const file = process.argv[3];",
    "fs.appendFileSync(log, file + '\\n');",
  ].join("\n"),
  "utf8"
);

let db;
try {
  db = new Database(dbPath);
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);");
  db.prepare("INSERT INTO t (v) VALUES (?)").run("hello");
  db.close();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping WAL hook test.");
    process.exit(0);
  }
  throw err;
}

const shipper = new WalShipper({
  dbPath,
  archiveDir,
  snapshotIntervalMs: 20,
  copyIntervalMs: 20,
  integrityCheck: true,
  externalCommandTemplate: `node ${hookScript} ${hookLog} {file}`,
});

await new Promise((resolve) => {
  shipper.start();
  setTimeout(() => {
    shipper.stop();
    resolve();
  }, 300);
});

if (!fs.existsSync(hookLog)) {
  console.error("❌ External hook did not run");
  process.exit(1);
}
const lines = fs.readFileSync(hookLog, "utf8").trim().split(/\r?\n/).filter(Boolean);
if (lines.length === 0) {
  console.error("❌ External hook log is empty");
  process.exit(1);
}

console.log("✅ WAL external hook test passed.");
