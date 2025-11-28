/**
 * Snapshot Manager - Automatic System State Snapshots
 * 
 * Creates periodic snapshots of the system state for efficient rewind operations.
 * Snapshots include:
 * - Session state (active session, working directory, model)
 * - Conversation history (compressed)
 * - File checksums (SHA256 hashes)
 * - Git state (commit hash, branch, status)
 * 
 * Strategy:
 * - Auto-snapshot every N events
 * - Auto-snapshot every N minutes
 * - Manual snapshot on demand
 * - Keep last K snapshots
 * 
 * @module timeline/snapshot-manager
 * @version 1.0.0
 */

import { TimelineDatabase } from './database.js';
import { EventBus } from './event-bus.js';
import { EventType } from './event-types.js';
import { QueryEngine } from './query-engine.js';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Snapshot configuration
 */
export interface SnapshotConfig {
  /**
   * Auto-snapshot every N events (0 = disabled)
   */
  eventsInterval?: number;

  /**
   * Auto-snapshot every N milliseconds (0 = disabled)
   */
  timeInterval?: number;

  /**
   * Maximum number of snapshots to keep (0 = unlimited)
   */
  maxSnapshots?: number;

  /**
   * Enable automatic snapshots
   */
  autoEnabled?: boolean;
}

/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
  snapshot_id: string;
  timestamp: number;
  sequence_number: number;
  event_count: number;
  session_id: number | null;
  session_name: string | null;
  working_dir: string;
  git_commit_hash: string | null;
  git_branch: string | null;
  file_count: number;
  compressed_size_bytes: number;
  uncompressed_size_bytes: number;
  created_at: number;
}

/**
 * Snapshot data (uncompressed)
 */
export interface SnapshotData {
  metadata: SnapshotMetadata;
  session_state: {
    active_session_id: number | null;
    working_directory: string;
    model?: string;
    provider?: string;
  };
  conversations: Array<{
    session_id: number;
    messages: any[];
  }>;
  file_checksums: Record<string, string>; // path -> SHA256
  git_state: {
    commit_hash: string | null;
    branch: string | null;
    is_clean: boolean;
    ahead: number;
    behind: number;
  };
}

/**
 * Snapshot Manager
 */
export class SnapshotManager {
  private static instance: SnapshotManager;
  private db: TimelineDatabase;
  private bus: EventBus;
  private queryEngine: QueryEngine;
  private config: Required<SnapshotConfig>;
  private lastSnapshotTime: number = 0;
  private lastSnapshotSequence: number = 0;
  private autoSnapshotTimer: NodeJS.Timeout | null = null;

  private constructor(config: SnapshotConfig = {}) {
    this.db = TimelineDatabase.getInstance();
    this.bus = EventBus.getInstance();
    this.queryEngine = QueryEngine.getInstance();
    
    this.config = {
      eventsInterval: config.eventsInterval ?? 100,
      timeInterval: config.timeInterval ?? 5 * 60 * 1000, // 5 minutes
      maxSnapshots: config.maxSnapshots ?? 50,
      autoEnabled: config.autoEnabled ?? true,
    };

    // Listen for events to trigger auto-snapshots
    if (this.config.autoEnabled) {
      this.startAutoSnapshots();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: SnapshotConfig): SnapshotManager {
    if (!SnapshotManager.instance) {
      SnapshotManager.instance = new SnapshotManager(config);
    }
    return SnapshotManager.instance;
  }

  /**
   * Start automatic snapshot timers
   */
  private startAutoSnapshots(): void {
    // Time-based snapshots
    if (this.config.timeInterval > 0) {
      this.autoSnapshotTimer = setInterval(() => {
        this.checkAndCreateTimeSnapshot();
      }, this.config.timeInterval);
    }

    // Event-based snapshots would require a more complex event listener
    // For now, we rely on time-based snapshots only
    // TODO: Implement event counting mechanism
  }

  /**
   * Stop automatic snapshots
   */
  stopAutoSnapshots(): void {
    if (this.autoSnapshotTimer) {
      clearInterval(this.autoSnapshotTimer);
      this.autoSnapshotTimer = null;
    }
  }

  /**
   * Check and create time-based snapshot
   */
  private async checkAndCreateTimeSnapshot(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSnapshotTime >= this.config.timeInterval) {
      try {
        await this.createSnapshot('auto_time');
      } catch (error) {
        console.error('Failed to create time-based snapshot:', error);
      }
    }
  }

  /**
   * Check and create event-based snapshot
   */
  private async checkAndCreateEventSnapshot(): Promise<void> {
    const currentSequence = this.db.getCurrentSequence();
    if (currentSequence - this.lastSnapshotSequence >= this.config.eventsInterval) {
      try {
        await this.createSnapshot('auto_event');
      } catch (error) {
        console.error('Failed to create event-based snapshot:', error);
      }
    }
  }

  /**
   * Create a snapshot of current system state
   */
  async createSnapshot(reason: string = 'manual'): Promise<string> {
    const timestamp = Date.now();
    const snapshotId = `snapshot_${timestamp}_${Math.random().toString(36).substring(7)}`;

    // Collect system state
    const data: SnapshotData = {
      metadata: {
        snapshot_id: snapshotId,
        timestamp,
        sequence_number: this.db.getCurrentSequence(),
        event_count: this.queryEngine.query({ limit: 1 }).total,
        session_id: null, // TODO: Get from session manager
        session_name: null,
        working_dir: process.cwd(),
        git_commit_hash: null, // TODO: Get from git hook
        git_branch: null,
        file_count: 0,
        compressed_size_bytes: 0,
        uncompressed_size_bytes: 0,
        created_at: timestamp,
      },
      session_state: {
        active_session_id: null,
        working_directory: process.cwd(),
      },
      conversations: [],
      file_checksums: {},
      git_state: {
        commit_hash: null,
        branch: null,
        is_clean: true,
        ahead: 0,
        behind: 0,
      },
    };

    // Compress snapshot data
    const jsonData = JSON.stringify(data);
    const uncompressedSize = Buffer.from(jsonData).length;
    const compressed = await gzip(jsonData);
    const compressedSize = compressed.length;

    // Update metadata with sizes
    data.metadata.compressed_size_bytes = compressedSize;
    data.metadata.uncompressed_size_bytes = uncompressedSize;

    // Store in database
    const stmt = this.db.getConnection().prepare(`
      INSERT INTO snapshots (
        id, timestamp, sequence_number, event_count,
        session_id, session_name, working_dir,
        git_commit_hash, git_branch,
        file_count, compressed_size_bytes, uncompressed_size_bytes,
        snapshot_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshotId,
      timestamp,
      data.metadata.sequence_number,
      data.metadata.event_count,
      data.metadata.session_id,
      data.metadata.session_name,
      data.metadata.working_dir,
      data.metadata.git_commit_hash,
      data.metadata.git_branch,
      data.metadata.file_count,
      compressedSize,
      uncompressedSize,
      compressed,
      timestamp
    );

    // Update tracking
    this.lastSnapshotTime = timestamp;
    this.lastSnapshotSequence = data.metadata.sequence_number;

    // Log snapshot creation event
    await this.bus.emit({
      event_type: EventType.SNAPSHOT_CREATED,
      actor: 'system',
      aggregate_id: snapshotId,
      aggregate_type: 'snapshot',
      payload: {
        reason,
        compressed_size_bytes: compressedSize,
        uncompressed_size_bytes: uncompressedSize,
        event_count: data.metadata.event_count,
      },
    });

    // Cleanup old snapshots if needed
    if (this.config.maxSnapshots > 0) {
      await this.cleanupOldSnapshots();
    }

    return snapshotId;
  }

  /**
   * Load snapshot by ID
   */
  async loadSnapshot(snapshotId: string): Promise<SnapshotData | null> {
    const stmt = this.db.getConnection().prepare(`
      SELECT * FROM snapshots WHERE id = ?
    `);
    const row = stmt.get(snapshotId) as any;

    if (!row) return null;

    // Decompress data
    const compressed = row.snapshot_data as Buffer;
    const uncompressed = await gunzip(compressed);
    const data = JSON.parse(uncompressed.toString()) as SnapshotData;

    // Log snapshot load event
    await this.bus.emit({
      event_type: EventType.SNAPSHOT_LOADED,
      actor: 'system',
      aggregate_id: snapshotId,
      aggregate_type: 'snapshot',
      payload: {
        timestamp: row.timestamp,
        event_count: row.event_count,
      },
    });

    return data;
  }

  /**
   * Get snapshot closest to a timestamp
   */
  async getSnapshotBeforeTimestamp(timestamp: number): Promise<SnapshotMetadata | null> {
    const stmt = this.db.getConnection().prepare(`
      SELECT 
        id as snapshot_id,
        timestamp,
        sequence_number,
        event_count,
        session_id,
        session_name,
        working_dir,
        git_commit_hash,
        git_branch,
        file_count,
        compressed_size_bytes,
        uncompressed_size_bytes,
        created_at
      FROM snapshots 
      WHERE timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    
    const row = stmt.get(timestamp) as any;
    return row || null;
  }

  /**
   * List all snapshots
   */
  listSnapshots(limit: number = 100): SnapshotMetadata[] {
    const stmt = this.db.getConnection().prepare(`
      SELECT 
        id as snapshot_id,
        timestamp,
        sequence_number,
        event_count,
        session_id,
        session_name,
        working_dir,
        git_commit_hash,
        git_branch,
        file_count,
        compressed_size_bytes,
        uncompressed_size_bytes,
        created_at
      FROM snapshots 
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    return stmt.all(limit) as SnapshotMetadata[];
  }

  /**
   * Delete snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const stmt = this.db.getConnection().prepare(`
      DELETE FROM snapshots WHERE id = ?
    `);
    const result = stmt.run(snapshotId);

    if (result.changes > 0) {
      await this.bus.emit({
        event_type: EventType.SNAPSHOT_DELETED,
        actor: 'system',
        aggregate_id: snapshotId,
        aggregate_type: 'snapshot',
        payload: {
          deleted_at: Date.now(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Cleanup old snapshots (keep only maxSnapshots)
   */
  private async cleanupOldSnapshots(): Promise<number> {
    const snapshots = this.listSnapshots(999999);
    
    if (snapshots.length <= this.config.maxSnapshots) {
      return 0;
    }

    const toDelete = snapshots.slice(this.config.maxSnapshots);
    let deleted = 0;

    for (const snapshot of toDelete) {
      const success = await this.deleteSnapshot(snapshot.snapshot_id);
      if (success) deleted++;
    }

    return deleted;
  }

  /**
   * Get snapshot statistics
   */
  getStats(): {
    total_snapshots: number;
    total_size_mb: number;
    oldest_timestamp: number | null;
    newest_timestamp: number | null;
    avg_compressed_size_kb: number;
  } {
    const stmt = this.db.getConnection().prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(compressed_size_bytes) as total_size,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest,
        AVG(compressed_size_bytes) as avg_size
      FROM snapshots
    `);
    
    const row = stmt.get() as any;
    
    return {
      total_snapshots: row.total || 0,
      total_size_mb: (row.total_size || 0) / (1024 * 1024),
      oldest_timestamp: row.oldest || null,
      newest_timestamp: row.newest || null,
      avg_compressed_size_kb: (row.avg_size || 0) / 1024,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SnapshotConfig>): void {
    Object.assign(this.config, config);
    
    // Restart auto-snapshots if config changed
    if (config.autoEnabled !== undefined) {
      this.stopAutoSnapshots();
      if (config.autoEnabled) {
        this.startAutoSnapshots();
      }
    }
  }
}

/**
 * Get SnapshotManager singleton instance
 */
export function getSnapshotManager(config?: SnapshotConfig): SnapshotManager {
  return SnapshotManager.getInstance(config);
}
