import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs-extra";
import crypto from "crypto";
import { EmbeddingClient, resolveEmbeddingConfig } from "../utils/embedding-client.js";

export interface SemanticResult {
  path: string;
  snippet: string;
  score: number;
}

interface ChunkRow {
  path: string;
  chunk_index: number;
  content: string;
  sha256: string;
  embedding: string;
}

export class SemanticSearchIndex {
  private db: Database.Database;
  private dbPath: string;
  private lockPath: string;
  private embeddingClient: EmbeddingClient | null = null;
  private includeExt = new Set([
    "ts", "tsx", "js", "jsx", "json", "md", "yaml", "yml", "toml", "ini", "sql",
    "py", "rb", "php", "go", "rs", "java", "kt", "c", "cpp", "cc", "h", "hpp",
    "cs", "sh", "bash", "zsh", "fish", "lua", "swift", "scala", "html", "css",
    "scss", "less", "vue", "svelte", "dart",
  ]);

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), ".grok", "search-embeddings.db");
    this.lockPath = this.dbPath + ".lock";
    fs.mkdirpSync(path.dirname(this.dbPath));
    this.db = new Database(this.dbPath);
    this.initSchema();
    this.reloadConfig();
  }

  reloadConfig(): { enabled: boolean; reason?: string } {
    if (process.env.GROKINOU_SEMANTIC_ENABLED !== "true") {
      this.embeddingClient = null;
      return { enabled: false, reason: "GROKINOU_SEMANTIC_ENABLED is not true" };
    }
    const cfg = resolveEmbeddingConfig();
    if (!cfg) {
      this.embeddingClient = null;
      return { enabled: false, reason: "Embedding config missing (provider/model/apiKey)" };
    }
    this.embeddingClient = new EmbeddingClient(cfg);
    return { enabled: true };
  }

  isEnabled(): boolean {
    return this.embeddingClient !== null;
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS semantic_files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        indexed_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS semantic_chunks (
        path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        embedding TEXT NOT NULL,
        indexed_at INTEGER NOT NULL,
        PRIMARY KEY (path, chunk_index)
      );
      CREATE TABLE IF NOT EXISTS embedding_cache (
        key TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        updated_at INTEGER NOT NULL
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

  private chunkContent(content: string): string[] {
    const maxLen = Number(process.env.GROKINOU_SEMANTIC_CHUNK_SIZE || 1200);
    const overlap = Number(process.env.GROKINOU_SEMANTIC_CHUNK_OVERLAP || 200);
    if (content.length <= maxLen) return [content];
    const chunks: string[] = [];
    let start = 0;
    while (start < content.length) {
      const end = Math.min(content.length, start + maxLen);
      chunks.push(content.slice(start, end));
      start = Math.max(0, end - overlap);
      if (end === content.length) break;
    }
    return chunks;
  }

  private async collectFiles(root: string): Promise<Array<{ path: string; mtime: number; size: number; sha256: string; content: string }>> {
    const rows: Array<{ path: string; mtime: number; size: number; sha256: string; content: string }> = [];
    await this.walk(root, async (fullPath, stat) => {
      const ext = path.extname(fullPath).replace(".", "").toLowerCase();
      if (!this.includeExt.has(ext)) return;
      if (stat.size > 1_000_000) return;
      const content = await fs.readFile(fullPath, "utf8").catch(() => null);
      if (content == null || content.includes("\u0000")) return;
      rows.push({
        path: fullPath,
        mtime: stat.mtimeMs,
        size: stat.size,
        sha256: this.hashContent(content),
        content,
      });
    });
    return rows;
  }

  private async walk(root: string, cb: (fullPath: string, stat: fs.Stats) => Promise<void>) {
    const entries = await fs.readdir(root).catch(() => []);
    for (const entry of entries) {
      if (entry === ".git" || entry === "node_modules") continue;
      const fullPath = path.join(root, entry);
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        await this.walk(fullPath, cb);
      } else {
        await cb(fullPath, stat);
      }
    }
  }

  private async embedWithCache(texts: string[]): Promise<number[][]> {
    if (!this.embeddingClient) {
      throw new Error("Semantic embeddings not configured");
    }
    const now = Date.now();
    const hashes = texts.map((t) => this.hashContent(t));
    const cached = new Map<string, number[]>();
    const placeholders: (number[] | null)[] = hashes.map(() => null);
    const select = this.db.prepare(`SELECT key, embedding FROM embedding_cache WHERE key = ?`);
    const update = this.db.prepare(`INSERT OR REPLACE INTO embedding_cache (key, embedding, updated_at) VALUES (?, ?, ?)`);

    hashes.forEach((h, idx) => {
      const row = select.get(h) as { key: string; embedding: string } | undefined;
      if (row) {
        cached.set(h, JSON.parse(row.embedding));
        placeholders[idx] = cached.get(h) || null;
      }
    });

    const missingTexts: string[] = [];
    const missingIdx: number[] = [];
    hashes.forEach((h, idx) => {
      if (!cached.has(h)) {
        missingTexts.push(texts[idx]);
        missingIdx.push(idx);
      }
    });

    if (missingTexts.length) {
      const embeddings = await this.embeddingClient.embed(missingTexts);
      embeddings.forEach((emb, i) => {
        const idx = missingIdx[i];
        placeholders[idx] = emb;
        const key = hashes[idx];
        update.run(key, JSON.stringify(emb), now);
      });
    }

    return placeholders.map((emb) => emb || []);
  }

  async indexDirectory(root: string) {
    if (!this.embeddingClient) return;
    const absRoot = path.resolve(root);
    if (!this.acquireLock()) return;
    try {
      const now = Date.now();
      const files = await this.collectFiles(absRoot);
      const existing = this.db
        .prepare(`SELECT path, mtime, size, sha256 FROM semantic_files WHERE path LIKE ?`)
        .all(absRoot + "/%") as Array<{ path: string; mtime: number; size: number; sha256: string }>;

      const existingMap = new Map(existing.map((f) => [f.path, f]));
      const updates = files.filter((f) => {
        const prev = existingMap.get(f.path);
        return !prev || prev.sha256 !== f.sha256 || prev.size !== f.size || prev.mtime !== f.mtime;
      });

      const delStmt = this.db.prepare(`DELETE FROM semantic_chunks WHERE path = ?`);
      const insertFile = this.db.prepare(
        `INSERT OR REPLACE INTO semantic_files (path, mtime, size, sha256, indexed_at)
         VALUES (@path, @mtime, @size, @sha256, @indexed_at)`
      );
      const insertChunk = this.db.prepare(
        `INSERT OR REPLACE INTO semantic_chunks (path, chunk_index, content, sha256, embedding, indexed_at)
         VALUES (@path, @chunk_index, @content, @sha256, @embedding, @indexed_at)`
      );

      for (const file of updates) {
        const chunks = this.chunkContent(file.content);
        const embeddings = await this.embedWithCache(chunks);
        const txn = this.db.transaction(() => {
          delStmt.run(file.path);
          insertFile.run({ ...file, indexed_at: now });
          embeddings.forEach((embedding, idx) => {
            const content = chunks[idx];
            insertChunk.run({
              path: file.path,
              chunk_index: idx,
              content,
              sha256: this.hashContent(content),
              embedding: JSON.stringify(embedding),
              indexed_at: now,
            });
          });
        });
        txn();
      }
    } finally {
      this.releaseLock();
    }
  }

  async semanticSearch(root: string, query: string, limit: number = 25): Promise<SemanticResult[]> {
    if (!this.embeddingClient) return [];
    await this.indexDirectory(root);
    const maxChunks = Number(process.env.GROKINOU_SEMANTIC_MAX_CHUNKS || 2000);
    const rows = this.db
      .prepare(`SELECT path, chunk_index, content, embedding FROM semantic_chunks LIMIT ?`)
      .all(maxChunks) as ChunkRow[];
    if (!rows.length) return [];
    const [queryEmbedding] = await this.embedWithCache([query]);
    const scored = rows.map((row) => {
      const emb = JSON.parse(row.embedding) as number[];
      const score = cosineSimilarity(queryEmbedding, emb);
      return {
        path: row.path,
        snippet: row.content.slice(0, 300),
        score,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async rerankTexts(query: string, texts: string[]): Promise<number[]> {
    if (!this.embeddingClient) return texts.map(() => 0);
    const embeddings = await this.embedWithCache([query, ...texts]);
    const queryEmbedding = embeddings[0];
    return embeddings.slice(1).map((emb) => cosineSimilarity(queryEmbedding, emb));
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}
