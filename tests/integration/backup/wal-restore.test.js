#!/usr/bin/env node
/**
 * Integration test for WAL restore (dry-run + restore into temp HOME).
 */
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

const distPath = path.join(process.cwd(), "dist", "utils", "wal-restore.js");
if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/wal-restore.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "wal-restore-"));
const archiveDir = path.join(tmpHome, ".grok", "wal-archive");
const snapshotDir = path.join(archiveDir, "snapshot");
const walDir = path.join(archiveDir, "wal");
fs.mkdirSync(snapshotDir, { recursive: true });
fs.mkdirSync(walDir, { recursive: true });

const baseName = "conversations.db";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const snapshotFile = path.join(snapshotDir, `${baseName}.${stamp}`);
fs.writeFileSync(snapshotFile, "dummy");

const dryRes = spawnSync("node", [distPath, "--db", "conversations", "--archive", archiveDir, "--dry-run"], {
  encoding: "utf8",
  env: { ...process.env, HOME: tmpHome },
});
if (dryRes.status !== 0) {
  console.error("❌ wal-restore dry-run failed", dryRes.stderr);
  process.exit(1);
}

const res = spawnSync("node", [distPath, "--db", "conversations", "--archive", archiveDir], {
  encoding: "utf8",
  env: { ...process.env, HOME: tmpHome },
});
if (res.status !== 0) {
  console.error("❌ wal-restore failed", res.stderr);
  process.exit(1);
}

const restored = path.join(tmpHome, ".grok", baseName);
if (!fs.existsSync(restored)) {
  console.error("❌ Restore did not create target DB file");
  process.exit(1);
}

console.log("✅ WAL restore test passed.");
