import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs-extra";
import crypto from "crypto";

export interface FTSResult {
  path: string;
  snippet: string;
  rank: number;
}

interface FileRow {
  path: string;
  mtime: number;
  size: number;
  sha256: string;
}

/**
 * FTS5-backed search with incremental, integrity-aware indexing.
 * - Tracks mtime/size/sha256 to detect changes
 * - Uses a shadow table swap to avoid corruption
 * - Lockfile to prevent concurrent index builds
 * - Integrity check fallback to full rebuild on failure
 */
export class FTSSearch {
  private db: Database.Database;
  private dbPath: string;
  private lockPath: string;
  private includeExt = new Set([
    "ts", "tsx", "js", "jsx", "json", "md", "yaml", "yml", "toml", "ini", "sql",
    "py", "rb", "php", "go", "rs", "java", "kt", "c", "cpp", "cc", "h", "hpp",
    "cs", "sh", "bash", "zsh", "fish", "lua", "swift", "scala", "html", "css",
    "scss", "less", "vue", "svelte", "dart",
  ]);

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), ".grok", "search-fts.db");
    this.lockPath = this.dbPath + ".lock";
    fs.mkdirpSync(path.dirname(this.dbPath));
    this.db = new Database(this.dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        indexed_at INTEGER NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_content USING fts5(
        content,
        path UNINDEXED
      );
    `);
  }

  private acquireLock(): boolean {
    try {
      const fd = fs.openSync(this.lockPath, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return true;
    } catch {
      return false;
    }
  }

  private releaseLock() {
    fs.removeSync(this.lockPath);
  }

  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }

  private async collectFiles(root: string): Promise<FileRow[]> {
    const rows: FileRow[] = [];
    await this.walk(root, async (fullPath, stat) => {
      const ext = path.extname(fullPath).replace(".", "").toLowerCase();
      if (!this.includeExt.has(ext)) return;
      if (stat.size > 1_000_000) return; // skip >1MB

      const content = await fs.readFile(fullPath, "utf8").catch(() => null);
      if (content == null || content.includes("\u0000")) return; // skip binary

      rows.push({
        path: fullPath,
        mtime: stat.mtimeMs,
        size: stat.size,
        sha256: this.hashContent(content),
      });
    });
    return rows;
  }

  /**
   * Incremental index: compute diff by sha256/mtime/size and swap shadow table atomically.
   * Falls back to full rebuild if integrity check fails.
   */
  async indexDirectory(root: string) {
    const absRoot = path.resolve(root);
    if (!this.acquireLock()) {
      // Another indexer is running; skip
      return;
    }
    try {
      const now = Date.now();
      const files = await this.collectFiles(absRoot);
      const existing = this.db
        .prepare(`SELECT path, mtime, size, sha256 FROM files WHERE path LIKE ?`)
        .all(absRoot + "/%") as FileRow[];

      const existingMap = new Map(existing.map((f) => [f.path, f]));
      const addsOrUpdates: FileRow[] = [];
      const seen = new Set<string>();

      for (const f of files) {
        const prev = existingMap.get(f.path);
        seen.add(f.path);
        if (!prev || prev.sha256 !== f.sha256 || prev.size !== f.size || prev.mtime !== f.mtime) {
          addsOrUpdates.push(f);
        }
      }

      const deletes = existing.filter((f) => !seen.has(f.path));

      // Use shadow table to swap atomically
      const txn = this.db.transaction(() => {
        this.db.exec(`
          DROP TABLE IF EXISTS fts_content_new;
          CREATE VIRTUAL TABLE fts_content_new USING fts5(content, path UNINDEXED);
        `);

        // Seed shadow with existing entries minus deletes, plus updates
        // Reload from disk for updates to avoid stale content
        const insertFts = this.db.prepare(
          `INSERT INTO fts_content_new (rowid, content, path) VALUES (NULL, @content, @path)`
        );
        const insertFile = this.db.prepare(
          `INSERT OR REPLACE INTO files (path, mtime, size, sha256, indexed_at)
           VALUES (@path, @mtime, @size, @sha256, @indexed_at)`
        );

        // Reinsert all existing that are not deleted or updated
        for (const f of existing) {
          if (deletes.some((d) => d.path === f.path)) continue;
          if (addsOrUpdates.some((u) => u.path === f.path)) continue;
          const content = fs.readFileSync(f.path, "utf8");
          insertFts.run({ content, path: f.path });
          insertFile.run({ ...f, indexed_at: now });
        }

        // Insert adds/updates with fresh content
        for (const f of addsOrUpdates) {
          const content = fs.readFileSync(f.path, "utf8");
          insertFts.run({ content, path: f.path });
          insertFile.run({ ...f, indexed_at: now });
        }

        // Remove deleted from files table
        const delStmt = this.db.prepare(`DELETE FROM files WHERE path = ?`);
        for (const d of deletes) {
          delStmt.run(d.path);
        }

        // Swap shadow into place
        this.db.exec(`
          DROP TABLE fts_content;
          ALTER TABLE fts_content_new RENAME TO fts_content;
        `);
      });

      txn();

      // Integrity check
      const check = this.db.prepare(`PRAGMA integrity_check;`).get() as { integrity_check: string };
      if (check.integrity_check !== "ok") {
        // fallback: rebuild full
        await this.fullRebuild(absRoot);
      }
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Full rebuild if needed.
   */
  private async fullRebuild(root: string) {
    const absRoot = path.resolve(root);
    const now = Date.now();
    const files = await this.collectFiles(absRoot);

    const txn = this.db.transaction(() => {
      this.db.exec(`
        DROP TABLE IF EXISTS fts_content;
        CREATE VIRTUAL TABLE fts_content USING fts5(content, path UNINDEXED);
        DELETE FROM files WHERE path LIKE '${absRoot.replace(/'/g, "''")}/%';
      `);

      const insertFts = this.db.prepare(
        `INSERT INTO fts_content (rowid, content, path) VALUES (NULL, @content, @path)`
      );
      const insertFile = this.db.prepare(
        `INSERT OR REPLACE INTO files (path, mtime, size, sha256, indexed_at)
         VALUES (@path, @mtime, @size, @sha256, @indexed_at)`
      );

      for (const f of files) {
        const content = fs.readFileSync(f.path, "utf8");
        insertFts.run({ content, path: f.path });
        insertFile.run({ ...f, indexed_at: now });
      }
    });

    txn();
  }

  /**
   * Run an FTS query and return ranked results with snippets.
   */
  search(query: string, limit: number = 50): FTSResult[] {
    const stmt = this.db.prepare(`
      SELECT path,
             snippet(fts_content, 0, '', '', ' … ', 8) AS snippet,
             rank
      FROM fts_content
      WHERE fts_content MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return stmt.all(query, limit) as FTSResult[];
  }

  /**
   * Basic recursive walk with ignore rules.
   */
  private async walk(dir: string, onFile: (fullPath: string, stat: fs.Stats) => Promise<void>, depth: number = 0) {
    if (depth > 100) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith(".git") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build" || entry.name === ".cache") {
        continue;
      }
      if (entry.isDirectory()) {
        await this.walk(full, onFile, depth + 1);
      } else if (entry.isFile()) {
        const stat = await fs.stat(full).catch(() => null);
        if (!stat) continue;
        await onFile(full, stat);
      }
    }
  }
}
