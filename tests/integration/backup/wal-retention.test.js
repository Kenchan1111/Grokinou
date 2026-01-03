#!/usr/bin/env node
/**
 * Integration test for WAL retention policy.
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
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping WAL retention test.");
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wal-retention-"));
const dbPath = path.join(tmpDir, "test.db");
const archiveDir = path.join(tmpDir, "archive");

let db;
try {
  db = new Database(dbPath);
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);");
  db.prepare("INSERT INTO t (v) VALUES (?)").run("hello");
  db.close();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping WAL retention test.");
    process.exit(0);
  }
  throw err;
}

const shipper = new WalShipper({
  dbPath,
  archiveDir,
  snapshotIntervalMs: 20,
  copyIntervalMs: 20,
  retentionCount: 2,
  retentionBytes: 1024 * 1024,
  integrityCheck: true,
});

await new Promise((resolve) => {
  shipper.start();
  setTimeout(() => {
    shipper.stop();
    resolve();
  }, 300);
});

const walDir = path.join(archiveDir, "wal");
const files = fs.existsSync(walDir) ? fs.readdirSync(walDir) : [];
if (files.length > 2) {
  console.error(`❌ Retention failed: expected <=2 files, found ${files.length}`);
  process.exit(1);
}

console.log("✅ WAL retention test passed.");
