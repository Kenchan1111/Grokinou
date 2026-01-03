#!/usr/bin/env node
/**
 * Integration smoke test for WalShipper.
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
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping WalShipper smoke test.");
    process.exit(0);
  }
  throw err;
}

const distPath = path.join(process.cwd(), "dist", "utils", "wal-shipper.js");
if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/wal-shipper.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const mod = await import(new URL(`file://${path.resolve(distPath)}`).href);
const { WalShipper } = mod;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wal-shipper-smoke-"));
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
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping WalShipper smoke test.");
    process.exit(0);
  }
  throw err;
}

const shipper = new WalShipper({
  dbPath,
  archiveDir,
  snapshotIntervalMs: 10,
  copyIntervalMs: 10,
  integrityCheck: true,
});

await new Promise((resolve) => {
  shipper.start();
  setTimeout(() => {
    shipper.stop();
    resolve();
  }, 150);
});

const snapshotDir = path.join(archiveDir, "snapshot");
const walDir = path.join(archiveDir, "wal");
const snapshotFiles = fs.existsSync(snapshotDir) ? fs.readdirSync(snapshotDir) : [];
const walFiles = fs.existsSync(walDir) ? fs.readdirSync(walDir) : [];

if (snapshotFiles.length === 0 || walFiles.length === 0) {
  console.error("❌ WalShipper did not create expected backups");
  process.exit(1);
}

console.log("✅ WalShipper smoke test passed.");
