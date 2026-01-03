#!/usr/bin/env node
/**
 * Benchmark WAL snapshot + backup creation time on a tiny temp DB.
 * Usage: node scripts/performance/wal-backup-benchmark.mjs
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
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping WAL benchmark.");
    process.exit(0);
  }
  throw err;
}
import { WalShipper } from "../../dist/utils/wal-shipper.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wal-bench-"));
const dbPath = path.join(tmpDir, "bench.db");
const archiveDir = path.join(tmpDir, "archive");

const db = new Database(dbPath);
db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);");
for (let i = 0; i < 100; i += 1) {
  db.prepare("INSERT INTO t (v) VALUES (?)").run(`row-${i}`);
}
db.close();

const shipper = new WalShipper({
  dbPath,
  archiveDir,
  snapshotIntervalMs: 10,
  copyIntervalMs: 10,
  integrityCheck: true,
});

const start = process.hrtime.bigint();
await new Promise((resolve) => {
  shipper.start();
  setTimeout(() => {
    shipper.stop();
    resolve();
  }, 150);
});
const end = process.hrtime.bigint();

const ms = Number(end - start) / 1e6;
console.log(`WAL snapshot+backup duration: ${ms.toFixed(2)} ms`);
