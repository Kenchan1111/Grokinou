#!/usr/bin/env node
import fs from "fs-extra";
import os from "os";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";

function tsStamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, "-");
}

function ensureDir(p) {
  fs.mkdirpSync(p);
}

function listDbVariants(dir, base) {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  return entries
    .filter((name) => name === base || name.startsWith(base + "-"))
    .map((name) => path.join(dir, name));
}

function backupDbFiles(grokDir, backupDir, baseName) {
  const variants = listDbVariants(grokDir, baseName);
  for (const file of variants) {
    const dest = path.join(backupDir, path.basename(file));
    fs.copyFileSync(file, dest);
  }
  return variants;
}

function removeDbFiles(files) {
  for (const file of files) {
    fs.removeSync(file);
  }
}

function getColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
}

function generateSessionHash(workdir, provider, createdAt, seed) {
  const base = `${workdir || "unknown"}:${provider || "grok"}:${createdAt || Date.now()}:${seed}`;
  return crypto.createHash("sha256").update(base).digest("hex").substring(0, 16);
}

function migrateSessions(oldDbPath, newDbPath) {
  const oldDb = new Database(oldDbPath, { readonly: true });
  const newDb = new Database(newDbPath);

  const newCols = getColumns(newDb, "sessions");
  const oldCols = getColumns(oldDb, "sessions");
  const rows = oldDb.prepare(`SELECT * FROM sessions`).all();

  if (rows.length === 0) {
    oldDb.close();
    newDb.close();
    return;
  }

  const insertCols = newCols.filter((c) => c !== "id");
  const placeholders = insertCols.map(() => "?").join(",");
  const insert = newDb.prepare(
    `INSERT INTO sessions (${insertCols.join(",")}) VALUES (${placeholders})`
  );

  const txn = newDb.transaction(() => {
    for (const row of rows) {
      const createdAt = row.created_at || row.started_at || new Date().toISOString();
      const values = insertCols.map((col) => {
        if (col === "session_hash") {
          return row.session_hash || generateSessionHash(row.working_dir, row.default_provider, createdAt, row.id);
        }
        if (col === "created_at") return createdAt;
        if (col === "session_name") return row.session_name ?? row.title ?? null;
        if (col in row) return row[col];
        return null;
      });
      insert.run(values);
    }
  });

  txn();
  oldDb.close();
  newDb.close();
}

function migrateMessages(oldDbPath, newDbPath) {
  const oldDb = new Database(oldDbPath, { readonly: true });
  const newDb = new Database(newDbPath);

  const newCols = getColumns(newDb, "messages");
  const oldCols = getColumns(oldDb, "messages");
  const common = newCols.filter((c) => oldCols.includes(c));
  if (common.length === 0) {
    oldDb.close();
    newDb.close();
    return;
  }

  const escapedOld = oldDbPath.replace(/'/g, "''");
  newDb.exec(`ATTACH DATABASE '${escapedOld}' AS old;`);
  newDb.exec("PRAGMA foreign_keys = OFF;");
  newDb.exec(`INSERT INTO messages (${common.join(",")}) SELECT ${common.join(",")} FROM old.messages;`);
  newDb.exec("DETACH DATABASE old;");

  oldDb.close();
  newDb.close();
}

function migrateTimeline(oldDbPath, newDbPath) {
  const oldDb = new Database(oldDbPath, { readonly: true });
  const newDb = new Database(newDbPath);
  const tables = ["events", "snapshots", "file_blobs", "file_trees", "rewind_cache", "metadata"];

  const escapedOld = oldDbPath.replace(/'/g, "''");
  newDb.exec(`ATTACH DATABASE '${escapedOld}' AS old;`);

  for (const table of tables) {
    const oldTables = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    const newTables = newDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    if (!oldTables.includes(table) || !newTables.includes(table)) continue;

    const oldCols = getColumns(oldDb, table);
    const newCols = getColumns(newDb, table);
    const common = newCols.filter((c) => oldCols.includes(c));
    if (common.length === 0) continue;

    newDb.exec("PRAGMA foreign_keys = OFF;");
    if (table === "metadata") {
      newDb.exec(`INSERT OR REPLACE INTO ${table} (${common.join(",")}) SELECT ${common.join(",")} FROM old.${table};`);
    } else {
      newDb.exec(`INSERT INTO ${table} (${common.join(",")}) SELECT ${common.join(",")} FROM old.${table};`);
    }
  }

  newDb.exec("DETACH DATABASE old;");
  oldDb.close();
  newDb.close();
}

async function main() {
  const grokDir = path.join(os.homedir(), ".grok");
  ensureDir(grokDir);
  const backupDir = path.join(grokDir, "db-backups", tsStamp());
  ensureDir(backupDir);

  const dbs = [
    "conversations.db",
    "timeline.db",
    "conversation-fts.db",
    "search-fts.db",
    "search-cache.db",
  ];

  const backedUp = new Map();
  for (const base of dbs) {
    const variants = backupDbFiles(grokDir, backupDir, base);
    backedUp.set(base, variants);
  }

  for (const variants of backedUp.values()) {
    removeDbFiles(variants);
  }

  // Recreate conversations.db
  const { GrokDatabase } = await import(path.join(process.cwd(), "dist", "db", "database.js"));
  const dbInstance = GrokDatabase.getInstance();
  dbInstance.close();

  // Recreate timeline.db
  const { getTimelineDb } = await import(path.join(process.cwd(), "dist", "timeline", "database.js"));
  const timeline = getTimelineDb();
  timeline.close();

  // Migrate data from backups if present
  const oldConversations = path.join(backupDir, "conversations.db");
  if (fs.existsSync(oldConversations)) {
    const newConversations = path.join(grokDir, "conversations.db");
    migrateSessions(oldConversations, newConversations);
    migrateMessages(oldConversations, newConversations);
  }

  const oldTimeline = path.join(backupDir, "timeline.db");
  if (fs.existsSync(oldTimeline)) {
    const newTimeline = path.join(grokDir, "timeline.db");
    migrateTimeline(oldTimeline, newTimeline);
  }

  // Rebuild conversation-fts.db from conversations.db
  const { getConversationFTS } = await import(path.join(process.cwd(), "dist", "tools", "conversation-fts.js"));
  const fts = getConversationFTS();
  await fts.rebuildFull();
  fts.close();

  // Rebuild search-fts.db for current repo
  const { FTSSearch } = await import(path.join(process.cwd(), "dist", "tools", "fts-search.js"));
  const codeFts = new FTSSearch();
  await codeFts.indexDirectory(process.cwd());

  console.log("✅ Rebuild complete. Backups stored at:", backupDir);
}

main().catch((err) => {
  console.error("❌ DB rebuild failed:", err?.message || err);
  process.exit(1);
});
