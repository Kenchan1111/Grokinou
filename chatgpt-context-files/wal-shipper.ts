import fs from "fs-extra";
import path from "path";
import os from "os";
import Database from "better-sqlite3";
import { spawnSync } from "child_process";
import zlib from "zlib";

interface WalShipperConfig {
  dbPath: string;
  archiveDir?: string;
  snapshotIntervalMs?: number;
  copyIntervalMs?: number;
  retentionBytes?: number;
  retentionCount?: number;
  integrityCheck?: boolean;
  compress?: boolean; // not implemented, reserved
  externalCommandTemplate?: string; // e.g., "ipfs add {file}" or "sh ./upload.sh {file}"
  alertCallback?: (msg: string) => void;
}

/**
 * Minimal WAL shipper: periodically copies {db, -wal, -shm} to an archive directory,
 * creates hourly snapshots, and purges by retention.
 *
 * NOTE: This is a best-effort shippper intended for local redundancy, not a full backup system.
 */
export class WalShipper {
  private dbPath: string;
  private archiveDir: string;
  private snapshotIntervalMs: number;
  private copyIntervalMs: number;
  private retentionBytes: number;
  private retentionCount: number;
  private lastSnapshotHour: number = -1;
  private timer: NodeJS.Timeout | null = null;
  private integrityCheck: boolean;
  private externalCommandTemplate?: string;
  private lastBackupSuccess?: Date;
  private lastBackupError?: string;
  private backupCount: number = 0;
  private alertCb?: (msg: string) => void;
  private compressEnabled: boolean;

  constructor(config: WalShipperConfig) {
    this.dbPath = config.dbPath;
    const base = path.join(os.homedir(), ".grok", "wal-archive");
    this.archiveDir = config.archiveDir || base;
    this.snapshotIntervalMs =
      config.snapshotIntervalMs ??
      Number(process.env.GROKINOU_WAL_SNAPSHOT_INTERVAL_MS || 60 * 60 * 1000);
    this.copyIntervalMs =
      config.copyIntervalMs ??
      Number(process.env.GROKINOU_WAL_COPY_INTERVAL_MS || 30 * 1000);
    this.retentionBytes =
      config.retentionBytes ??
      Number(process.env.GROKINOU_WAL_RETENTION_BYTES || 2 * 1024 * 1024 * 1024);
    this.retentionCount =
      config.retentionCount ??
      Number(process.env.GROKINOU_WAL_RETENTION_COUNT || 200);
    this.integrityCheck = config.integrityCheck ?? true;
    this.externalCommandTemplate =
      config.externalCommandTemplate ||
      process.env.GROKINOU_WAL_SHIP_CMD ||
      undefined;
    this.alertCb = config.alertCallback;
    this.compressEnabled = config.compress ?? false;
    fs.mkdirpSync(this.archiveDir);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(() => {}), this.copyIntervalMs);
    // fire immediately
    this.tick().catch(() => {});
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    const now = Date.now();
    const date = new Date(now);
    const hour = date.getUTCHours();
    const stamp = date.toISOString().replace(/[:.]/g, "-");

    // periodic snapshot (hourly)
    if (this.lastSnapshotHour !== hour) {
      this.lastSnapshotHour = hour;
      const snapFiles = await this.createSnapshot(stamp);
      this.runExternalShip(snapFiles);
    }

    // create a backup in wal dir (acts as incremental backup)
    const walBackupFiles = await this.createWalBackup(stamp);
    this.runExternalShip(walBackupFiles);
    this.purgeByRetention();
  }

  private purgeByRetention() {
    const walDir = path.join(this.archiveDir, "wal");
    const files = fs.existsSync(walDir) ? fs.readdirSync(walDir) : [];
    const fullPaths = files.map((f) => path.join(walDir, f));
    const stats = fullPaths
      .map((p) => {
        const st = fs.statSync(p);
        return { p, s: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => a.mtime - b.mtime); // oldest first

    let total = stats.reduce((acc, cur) => acc + cur.s, 0);
    while (stats.length > this.retentionCount || total > this.retentionBytes) {
      const victim = stats.shift();
      if (!victim) break;
      fs.removeSync(victim.p);
      total -= victim.s;
    }
  }

  /**
   * Create a consistent snapshot using SQLite backup API, then integrity_check.
   */
  private async createSnapshot(stamp: string) {
    const snapDir = path.join(this.archiveDir, "snapshot");
    fs.mkdirpSync(snapDir);
    const dest = path.join(snapDir, `${path.basename(this.dbPath)}.${stamp}`);
    try {
      const db = new Database(this.dbPath, { readonly: false });
      await db.backup(dest);
      if (this.integrityCheck) {
        const checkDb = new Database(dest, { readonly: true });
        const row = checkDb.prepare("PRAGMA integrity_check;").get() as any;
        if (row && row.integrity_check && row.integrity_check !== "ok") {
          console.error(`⚠️ Snapshot integrity_check failed for ${dest}: ${row.integrity_check}`);
          checkDb.close();
          fs.removeSync(dest);
          throw new Error(`Snapshot integrity_check failed: ${row.integrity_check}`);
        }
        checkDb.close();
      }
      db.close();
      const finalFile = this.compressEnabled ? this.compressFile(dest) : dest;
      this.backupCount++;
      this.lastBackupSuccess = new Date();
      if (this.compressEnabled && finalFile !== dest) {
        fs.removeSync(dest);
      }
      return [finalFile];
    } catch (e) {
      console.error("⚠️ Snapshot backup failed:", e);
      this.lastBackupError = (e as any)?.message || String(e);
      this.alert(`Snapshot backup failed for ${this.dbPath}: ${this.lastBackupError}`);
    }
    return [];
  }

  /**
   * Create a backup in the WAL directory (acts as incremental/rolling backup).
   */
  private async createWalBackup(stamp: string) {
    const walDir = path.join(this.archiveDir, "wal");
    fs.mkdirpSync(walDir);
    const dest = path.join(walDir, `${path.basename(this.dbPath)}.${stamp}`);
    try {
      const db = new Database(this.dbPath, { readonly: false });
      await db.backup(dest);
      if (this.integrityCheck) {
        const checkDb = new Database(dest, { readonly: true });
        const row = checkDb.prepare("PRAGMA integrity_check;").get() as any;
        if (row && row.integrity_check && row.integrity_check !== "ok") {
          console.error(`⚠️ WAL backup integrity_check failed for ${dest}: ${row.integrity_check}`);
          checkDb.close();
          fs.removeSync(dest);
          throw new Error(`WAL backup integrity_check failed: ${row.integrity_check}`);
        }
        checkDb.close();
      }
      db.close();
      const finalFile = this.compressEnabled ? this.compressFile(dest) : dest;
      this.backupCount++;
      this.lastBackupSuccess = new Date();
      if (this.compressEnabled && finalFile !== dest) {
        fs.removeSync(dest);
      }
      return [finalFile];
    } catch (e) {
      console.error("⚠️ WAL backup failed:", e);
      this.lastBackupError = (e as any)?.message || String(e);
      this.alert(`WAL backup failed for ${this.dbPath}: ${this.lastBackupError}`);
    }
    return [];
  }

  /**
   * Optional external shipping (e.g., IPFS/WORM/custom) via a command template with {file} placeholder.
   */
  private runExternalShip(files: string[]) {
    if (!this.externalCommandTemplate) return;
    for (const file of files) {
      const template = this.externalCommandTemplate;
      const parts = template.split(/\s+/).filter(Boolean);
      if (!parts.length) continue;
      const cmd = parts[0];
      const args = parts.slice(1).map((arg) => arg.replace(/\{file\}/g, file));
      try {
        const res = spawnSync(cmd, args, { stdio: "inherit" });
        if (res.status !== 0) {
          console.error(`⚠️ External ship command failed for ${file}: ${cmd} ${args.join(" ")}`);
          this.alert(`External ship failed for ${file}: ${cmd} ${args.join(" ")}`);
        }
      } catch (e) {
        console.error(`⚠️ External ship command error for ${file}:`, e);
        this.alert(`External ship error for ${file}: ${(e as any)?.message || e}`);
      }
    }
  }

  private compressFile(file: string): string {
    try {
      const gz = file + ".gz";
      const data = fs.readFileSync(file);
      const compressed = zlib.gzipSync(data);
      fs.writeFileSync(gz, compressed);
      return gz;
    } catch (e) {
      console.error("⚠️ Compression failed:", e);
      this.alert(`Compression failed for ${file}: ${(e as any)?.message || e}`);
      return file;
    }
  }

  getStatus() {
    return {
      lastBackupSuccess: this.lastBackupSuccess,
      lastBackupError: this.lastBackupError,
      backupCount: this.backupCount,
      archiveDir: this.archiveDir,
    };
  }

  private alert(msg: string) {
    if (this.alertCb) {
      try {
        this.alertCb(msg);
      } catch {
        // ignore alert errors
      }
    }
  }
}
