#!/usr/bin/env node
/**
 * Show status of WAL shippers (archive info + last backups).
 * Note: This reads archive directories and cannot read in-memory shippers; it reports latest files and sizes.
 */
import fs from "fs-extra";
import path from "path";
import os from "os";

function human(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function latestFiles(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((f) => {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      return { name: f, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 3);
}

function dirSize(dir: string) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    total += st.size;
  }
  return total;
}

function report(label: string, baseDir: string) {
  const snapDir = path.join(baseDir, "snapshot");
  const walDir = path.join(baseDir, "wal");
  console.log(`== ${label} ==`);
  console.log(`Archive: ${baseDir}`);
  console.log(`Snapshot size: ${human(dirSize(snapDir))}`);
  console.log(`WAL size: ${human(dirSize(walDir))}`);
  console.log(`Latest snapshots:`, latestFiles(snapDir).map((f) => f.name).join(", ") || "none");
  console.log(`Latest WAL:`, latestFiles(walDir).map((f) => f.name).join(", ") || "none");
  console.log("");
}

function main() {
  const convArchive = path.join(os.homedir(), ".grok", "wal-archive");
  const timelineArchive = path.join(os.homedir(), ".grok", "wal-archive-timeline");
  report("Conversations", convArchive);
  report("Timeline", timelineArchive);
}

main();
