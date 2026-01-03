#!/usr/bin/env node
/**
 * Simple restore helper: copies the latest snapshot and WAL/shm from archive to target DB directory.
 * Usage: node dist/utils/wal-restore.js --db conversations --archive ~/.grok/wal-archive
 */
import fs from "fs-extra";
import path from "path";
import os from "os";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: any = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--db") opts.db = args[++i];
    else if (a === "--archive") opts.archive = args[++i];
    else if (a === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

function findLatest(dir: string, base: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(base + "."));
  if (files.length === 0) return null;
  files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  return path.join(dir, files[0]);
}

async function main() {
  const opts = parseArgs();
  const dbName = opts.db || "conversations";
  const archive = opts.archive || path.join(os.homedir(), ".grok", "wal-archive");
  const baseName = dbName === "timeline" ? "timeline.db" : "conversations.db";
  const targetDir = path.join(os.homedir(), ".grok");
  const snapshotDir = path.join(archive, "snapshot");
  const walDir = path.join(archive, "wal");

  const snapshot = findLatest(snapshotDir, baseName);
  if (!snapshot) {
    console.error("❌ No snapshot found in", snapshotDir);
    process.exit(1);
  }
  const wal = findLatest(walDir, baseName + "-wal");
  const shm = findLatest(walDir, baseName + "-shm");

  console.log("Restoring", baseName, "from", snapshot);
  fs.copyFileSync(snapshot, path.join(targetDir, baseName));
  if (wal) fs.copyFileSync(wal, path.join(targetDir, `${baseName}-wal`));
  if (shm) fs.copyFileSync(shm, path.join(targetDir, `${baseName}-shm`));
  if (opts.dryRun) {
    console.log("DRY RUN: Files that would be restored:");
    console.log(`  ${snapshot}`);
    if (wal) console.log(`  ${wal}`);
    if (shm) console.log(`  ${shm}`);
    process.exit(0);
  }
  console.log("✅ Restore complete. SQLite will recover WAL on next open.");
}

main().catch((e) => {
  console.error("❌ Restore failed:", e);
  process.exit(1);
});
