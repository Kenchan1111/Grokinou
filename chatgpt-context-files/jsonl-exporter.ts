import fs from "fs-extra";
import path from "path";
import os from "os";
import Database from "better-sqlite3";

interface JsonlExporterConfig {
  db: "conversations" | "timeline";
  intervalMs?: number;
  sessionId?: number;
}

/**
 * Periodic JSONL exporter for conversations.db or timeline.db.
 * Default interval: 6h. Writes to ~/.grok/exports.
 */
export class JsonlExporter {
  private db: "conversations" | "timeline";
  private intervalMs: number;
  private sessionId?: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: JsonlExporterConfig) {
    this.db = config.db;
    this.sessionId = config.sessionId;
    this.intervalMs =
      config.intervalMs ??
      Number(process.env.GROKINOU_JSONL_EXPORT_INTERVAL_MS || 6 * 60 * 60 * 1000);
  }

  start() {
    if (this.timer || this.intervalMs <= 0) return;
    this.timer = setInterval(() => {
      try {
        this.export();
      } catch (e) {
        console.error(`⚠️ JSONL export failed for ${this.db}:`, e);
      }
    }, this.intervalMs);
    try {
      this.export();
    } catch (e) {
      console.error(`⚠️ JSONL export failed for ${this.db}:`, e);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private resolveDbPath() {
    const base = path.join(os.homedir(), ".grok");
    return path.join(base, this.db === "timeline" ? "timeline.db" : "conversations.db");
  }

  private defaultOut() {
    const dir = path.join(os.homedir(), ".grok", "exports");
    fs.mkdirpSync(dir);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = this.db === "timeline" ? "timeline" : "conversations";
    const suffix = this.sessionId ? `-session-${this.sessionId}` : "";
    return path.join(dir, `${name}${suffix}-${stamp}.jsonl`);
  }

  public export(outPath?: string) {
    const dbPath = this.resolveDbPath();
    const out = outPath || this.defaultOut();
    if (this.db === "conversations") {
      this.exportConversations(dbPath, out, this.sessionId);
    } else {
      this.exportTimeline(dbPath, out);
    }
  }

  private exportConversations(dbPath: string, outPath: string, session?: number) {
    const db = new Database(dbPath, { readonly: true });
    const stmt = db.prepare(
      `SELECT id, session_id, type, role, content, content_type, provider, model, timestamp, tool_calls, tool_call_id
       FROM messages
       ${session ? "WHERE session_id = ? " : ""}
       ORDER BY session_id, timestamp`
    );
    const rows = session ? stmt.iterate(session) : stmt.iterate();
    const stream = fs.createWriteStream(outPath, { flags: "w" });
    for (const row of rows as any) {
      stream.write(JSON.stringify(row) + "\n");
    }
    stream.end();
    db.close();
  }

  private exportTimeline(dbPath: string, outPath: string) {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare(`SELECT * FROM events ORDER BY sequence_number`).iterate();
    const stream = fs.createWriteStream(outPath, { flags: "w" });
    for (const row of rows as any) {
      stream.write(JSON.stringify(row) + "\n");
    }
    stream.end();
    db.close();
  }
}
