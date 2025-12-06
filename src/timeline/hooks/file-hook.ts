/**
 * File Hook - Automatic File Change Tracking
 * 
 * Monitors file system changes (create, modify, delete) and logs them
 * to the timeline with debouncing to avoid event spam.
 * 
 * Features:
 * - Debounced event emission (configurable delay)
 * - SHA256 content hashing
 * - Automatic ignore patterns (.git, node_modules, etc.)
 * - Singleton pattern
 * 
 * @module timeline/hooks/file-hook
 * @version 1.0.0
 */

import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { EventBus } from '../event-bus.js';
import { EventType } from '../event-types.js';
import type { FileModifiedPayload } from '../event-types.js';
import { getMerkleDAG } from '../storage/merkle-dag.js';

/**
 * File Hook Configuration
 */
export interface FileHookConfig {
  /**
   * Enable file watching
   */
  enabled?: boolean;

  /**
   * Debounce delay in milliseconds (default: 500ms)
   * Events for the same file within this delay are merged
   */
  debounceMs?: number;

  /**
   * Watch specific paths (default: current working directory)
   */
  watchPaths?: string[];

  /**
   * Ignore patterns (glob patterns)
   */
  ignorePatterns?: string[];

  /**
   * Maximum file size to hash (in bytes, default: 10 MB)
   * Files larger than this won't have their content hashed
   */
  maxFileSizeForHash?: number;
}

/**
 * Debounced File Event
 */
interface DebouncedEvent {
  filePath: string;
  eventType: 'add' | 'change' | 'unlink';
  timeout: NodeJS.Timeout;
}

/**
 * File Hook for monitoring file system changes
 */
export class FileHook {
  private static instance: FileHook;
  private bus: EventBus;
  private config: Required<FileHookConfig>;
  private watcher: FSWatcher | null = null;
  private pendingEvents: Map<string, DebouncedEvent> = new Map();
  private isWatching: boolean = false;

  private constructor(config: FileHookConfig = {}) {
    this.bus = EventBus.getInstance();

    // Default watch paths: watch source files, not everything
    const defaultWatchPaths = config.watchPaths ?? [
      process.cwd() + '/src/**',
      process.cwd() + '/scripts/**',
      process.cwd() + '/*.{ts,js,json,md}',
    ];

    this.config = {
      enabled: config.enabled ?? true,
      debounceMs: config.debounceMs ?? 500,
      watchPaths: defaultWatchPaths,
      ignorePatterns: config.ignorePatterns ?? [
        '**/node_modules/**',
        '**/.git/**',
        '**/.grok/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log',
        '**/coverage/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.swp',
        '**/*.swo',
        '**/*~',
      ],
      maxFileSizeForHash: config.maxFileSizeForHash ?? 10 * 1024 * 1024, // 10 MB
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: FileHookConfig): FileHook {
    if (!FileHook.instance) {
      FileHook.instance = new FileHook(config);
    }
    return FileHook.instance;
  }

  /**
   * Start watching files
   */
  async startWatching(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.isWatching) {
      return;
    }

    try {
      this.watcher = chokidar.watch(this.config.watchPaths, {
        ignored: this.config.ignorePatterns,
        persistent: true,
        ignoreInitial: true, // Don't emit events for existing files
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      this.watcher.on('add', (filePath) => this.handleFileEvent(filePath, 'add'));
      this.watcher.on('change', (filePath) => this.handleFileEvent(filePath, 'change'));
      this.watcher.on('unlink', (filePath) => this.handleFileEvent(filePath, 'unlink'));

      this.watcher.on('error', (error) => {
        console.error('File watcher error:', error);
      });

      await new Promise<void>((resolve) => {
        this.watcher!.on('ready', () => {
          this.isWatching = true;
          resolve();
        });
      });
    } catch (error) {
      console.error('Failed to start file watcher:', error);
      throw error;
    }
  }

  /**
   * Stop watching files
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    // Clear all pending debounced events
    for (const [, event] of this.pendingEvents) {
      clearTimeout(event.timeout);
    }
    this.pendingEvents.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.isWatching = false;
  }

  /**
   * Handle file system event with debouncing
   */
  private handleFileEvent(filePath: string, eventType: 'add' | 'change' | 'unlink'): void {
    // Cancel existing timeout for this file
    const existing = this.pendingEvents.get(filePath);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    // Create new debounced event
    const timeout = setTimeout(() => {
      this.emitFileEvent(filePath, eventType);
      this.pendingEvents.delete(filePath);
    }, this.config.debounceMs);

    this.pendingEvents.set(filePath, {
      filePath,
      eventType,
      timeout,
    });
  }

  /**
   * Emit file event to timeline
   */
  private async emitFileEvent(filePath: string, eventType: 'add' | 'change' | 'unlink'): Promise<void> {
    try {
      const absolutePath = path.resolve(filePath);
      const relativePath = path.relative(process.cwd(), absolutePath);

      // Get file stats (if file exists)
      let size: number | undefined;
      let contentHash: string | undefined;

      if (eventType !== 'unlink') {
        try {
          const stats = fs.statSync(absolutePath);
          size = stats.size;

          // Hash + store content in Merkle DAG only for files within size limit
          if (size <= this.config.maxFileSizeForHash) {
            contentHash = await this.hashFileContent(absolutePath);
          }
        } catch (error) {
          // File might have been deleted between event and processing
          // Silent fail - don't pollute console with transient filesystem errors
          return;
        }
      }

      // Map event type to timeline event type
      const timelineEventType =
        eventType === 'add'
          ? EventType.FILE_CREATED
          : eventType === 'change'
          ? EventType.FILE_MODIFIED
          : EventType.FILE_DELETED;

      // Emit event
      await this.bus.emit({
        event_type: timelineEventType,
        actor: 'system',
        aggregate_id: relativePath,
        aggregate_type: 'file',
        payload: {
          path: relativePath,
          old_hash: eventType === 'change' ? 'unknown' : undefined,
          new_hash: contentHash,
          size_bytes: size,
          session_id: 0, // Will be populated by session context if available
        },
      });
    } catch (error) {
      // Silent fail - Timeline errors shouldn't pollute user console
      // Errors are already logged in timeline-logger.ts
    }
  }

  /**
   * Calculate SHA256 hash of file content
   */
  private async hashFileContent(filePath: string): Promise<string> {
    // Read full content (bounded by maxFileSizeForHash via caller)
    const content = await fs.promises.readFile(filePath);

    // Store blob in Merkle DAG (content-addressable storage)
    const merkle = getMerkleDAG();
    const result = await merkle.storeBlob(content);

    // Return the content hash used as key in Merkle DAG
    return result.hash;
  }

  /**
   * Check if watching is active
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<FileHookConfig>> {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart)
   */
  async updateConfig(config: Partial<FileHookConfig>): Promise<void> {
    const wasWatching = this.isWatching;

    if (wasWatching) {
      await this.stopWatching();
    }

    this.config = {
      ...this.config,
      ...config,
    };

    if (wasWatching && this.config.enabled) {
      await this.startWatching();
    }
  }
}

/**
 * Get FileHook singleton instance
 */
export function getFileHook(config?: FileHookConfig): FileHook {
  return FileHook.getInstance(config);
}
