/**
 * Rewind Engine - Time Travel for System State
 * 
 * Reconstructs the complete system state at any point in time by:
 * 1. Loading nearest snapshot before target timestamp
 * 2. Replaying events from snapshot to target timestamp
 * 3. Materializing state (files, conversations, git) to output directory
 * 
 * This is the core "Time Machine" feature.
 * 
 * Features:
 * - Full state reconstruction
 * - Incremental replay from snapshots
 * - File system materialization
 * - Git state restoration
 * - Conversation history rebuild
 * - Non-destructive (creates new directory)
 * 
 * @module timeline/rewind-engine
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { TimelineDatabase } from './database.js';
import { EventBus } from './event-bus.js';
import { QueryEngine } from './query-engine.js';
import { SnapshotManager, type SnapshotData } from './snapshot-manager.js';
import { MerkleDAG } from './storage/merkle-dag.js';
import { EventType, EventCategory, type TimelineEvent } from './event-types.js';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);

/**
 * File comparison result
 */
export interface FileComparison {
  path: string;
  status: 'added' | 'deleted' | 'modified' | 'unchanged';
  rewindHash?: string;
  compareHash?: string;
  sizeDiff?: number;
}

/**
 * Comparison report
 */
export interface ComparisonReport {
  compareDirectory: string;
  totalFiles: number;
  added: number;
  deleted: number;
  modified: number;
  unchanged: number;
  files: FileComparison[];
}

/**
 * Rewind result
 */
export interface RewindResult {
  success: boolean;
  targetTimestamp: number;
  snapshotUsed: string | null;
  eventsReplayed: number;
  filesRestored: number;
  outputDirectory: string;
  duration: number;
  error?: string;
  sessionCreated?: {
    sessionId: number;
    sessionName: string;
  };
  comparisonReport?: ComparisonReport;
  autoCheckedOut?: boolean;
  previousWorkingDir?: string;
}

/**
 * Git materialization mode
 */
export type GitMode = 'none' | 'metadata' | 'full';

/**
 * Rewind options
 */
export interface RewindOptions {
  /**
   * Target timestamp to rewind to
   */
  targetTimestamp: number;

  /**
   * Output directory (default: auto-generated)
   */
  outputDir?: string;

  /**
   * Include file contents (default: true)
   */
  includeFiles?: boolean;

  /**
   * Include conversation history (default: true)
   */
  includeConversations?: boolean;

  /**
   * Include git state (default: true)
   * @deprecated Use gitMode instead
   */
  includeGit?: boolean;

  /**
   * Git materialization mode (default: 'metadata')
   * - 'none': No git information
   * - 'metadata': Just git_state.json with commit/branch info
   * - 'full': Full .git repository with checkout at target commit
   */
  gitMode?: GitMode;

  /**
   * Create a new session in the rewinded directory (default: false)
   * This automatically creates a grokinou session in the output directory,
   * bridging /rewind and /new-session functionality
   */
  createSession?: boolean;

  /**
   * Automatically change working directory to rewinded directory (default: false)
   * This makes the rewinded state the active working directory
   */
  autoCheckout?: boolean;

  /**
   * Compare rewinded state with another directory (optional)
   * Generates a comparison report between rewinded state and target directory
   */
  compareWith?: string;

  /**
   * Progress callback
   */
  onProgress?: (message: string, progress: number) => void;
}

/**
 * Reconstructed session state
 */
interface SessionState {
  sessionId: number | null;
  sessionName: string | null;
  workingDir: string;
  model?: string;
  provider?: string;
  conversations: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
}

/**
 * Reconstructed file state
 */
interface FileState {
  path: string;
  contentHash: string | null;
  exists: boolean;
  lastModified: number;
}

/**
 * Reconstructed git state
 */
interface GitState {
  commitHash: string | null;
  branch: string | null;
  isClean: boolean;
}

/**
 * Rewind Engine
 */
export class RewindEngine {
  private static instance: RewindEngine;
  private db: TimelineDatabase;
  private bus: EventBus;
  private queryEngine: QueryEngine;
  private snapshotManager: SnapshotManager;
  private merkleDAG: MerkleDAG;

  private constructor() {
    this.db = TimelineDatabase.getInstance();
    this.bus = EventBus.getInstance();
    this.queryEngine = QueryEngine.getInstance();
    this.snapshotManager = SnapshotManager.getInstance();
    this.merkleDAG = MerkleDAG.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RewindEngine {
    if (!RewindEngine.instance) {
      RewindEngine.instance = new RewindEngine();
    }
    return RewindEngine.instance;
  }

  /**
   * Rewind to a specific timestamp
   */
  async rewindTo(options: RewindOptions): Promise<RewindResult> {
    const startTime = Date.now();
    const {
      targetTimestamp,
      outputDir,
      includeFiles = true,
      includeConversations = true,
      includeGit = true, // Deprecated, for backward compatibility
      gitMode = includeGit ? 'metadata' : 'none', // Default to metadata if includeGit=true
      createSession = false,
      autoCheckout = false,
      compareWith,
      onProgress,
    } = options;

    const reportProgress = (message: string, progress: number) => {
      if (onProgress) onProgress(message, progress);
    };

    try {
      reportProgress('Starting rewind operation', 0);

      // Emit rewind started event
      await this.bus.emit({
        event_type: EventType.REWIND_STARTED,
        actor: 'system',
        aggregate_id: targetTimestamp.toString(),
        aggregate_type: 'rewind',
        payload: {
          target_timestamp: targetTimestamp,
          target_timestamp_human: new Date(targetTimestamp).toISOString(),
          output_dir: outputDir || 'auto',
          requested_by: 'user',
        },
      });

      // 1. Find nearest snapshot before target timestamp
      reportProgress('Finding nearest snapshot', 10);
      const snapshotMeta = await this.snapshotManager.getSnapshotBeforeTimestamp(targetTimestamp);
      
      let baseState: SessionState;
      let baseFiles: Map<string, FileState>;
      let baseGit: GitState;
      let startSequence = 0;

      if (snapshotMeta) {
        reportProgress(`Loading snapshot: ${snapshotMeta.snapshot_id}`, 20);
        const snapshot = await this.snapshotManager.loadSnapshot(snapshotMeta.snapshot_id);
        
        if (snapshot) {
          baseState = this.extractSessionState(snapshot);
          baseFiles = this.extractFileState(snapshot);
          baseGit = this.extractGitState(snapshot);
          startSequence = snapshotMeta.sequence_number;

          await this.bus.emit({
            event_type: EventType.REWIND_SNAPSHOT_LOADED,
            actor: 'system',
            aggregate_id: snapshotMeta.snapshot_id,
            aggregate_type: 'snapshot',
            payload: {
              snapshot_id: snapshotMeta.snapshot_id,
              snapshot_timestamp: snapshotMeta.timestamp,
            },
          });
        } else {
          // No snapshot, start from empty state
          baseState = this.createEmptySessionState();
          baseFiles = new Map();
          baseGit = this.createEmptyGitState();
        }
      } else {
        // No snapshot found, replay from beginning
        reportProgress('No snapshot found, replaying from beginning', 20);
        baseState = this.createEmptySessionState();
        baseFiles = new Map();
        baseGit = this.createEmptyGitState();
      }

      // 2. Query events from snapshot to target timestamp
      reportProgress('Querying events to replay', 30);
      const { events } = this.queryEngine.query({
        startTime: snapshotMeta?.timestamp || 0,
        endTime: targetTimestamp,
        limit: 999999,
        order: 'asc',
      });

      reportProgress(`Replaying ${events.length} events`, 40);

      // 3. Replay events to reconstruct state
      let currentState = baseState;
      let currentFiles = baseFiles;
      let currentGit = baseGit;

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const progress = 40 + Math.floor((i / events.length) * 40);
        
        if (i % 100 === 0) {
          reportProgress(`Replaying event ${i}/${events.length}`, progress);
        }

        // Apply event to state
        currentState = this.applyEventToSessionState(currentState, event);
        currentFiles = this.applyEventToFileState(currentFiles, event);
        currentGit = this.applyEventToGitState(currentGit, event);
      }

      await this.bus.emit({
        event_type: EventType.REWIND_EVENTS_REPLAYED,
        actor: 'system',
        aggregate_id: targetTimestamp.toString(),
        aggregate_type: 'rewind',
        payload: {
          events_replayed: events.length,
        },
      });

      // 4. Materialize state to output directory
      reportProgress('Materializing state to filesystem', 80);
      const finalOutputDir = outputDir || this.generateOutputDir(targetTimestamp);
      await mkdir(finalOutputDir, { recursive: true });

      let filesRestored = 0;

      // Write session state
      if (includeConversations) {
        const sessionFile = path.join(finalOutputDir, 'session_state.json');
        await writeFile(sessionFile, JSON.stringify(currentState, null, 2));
      }

      // Write file states
      if (includeFiles) {
        const filesDir = path.join(finalOutputDir, 'files');
        await mkdir(filesDir, { recursive: true });

        for (const [filePath, fileState] of currentFiles.entries()) {
          if (fileState.exists) {
            try {
              // Only attempt restore if we have a content hash
              if (!fileState.contentHash) {
                continue;
              }

              // Try to restore from Merkle DAG
              const blob = await this.merkleDAG.retrieveBlob(fileState.contentHash);
              if (blob) {
                const targetPath = path.join(filesDir, filePath);
                await mkdir(path.dirname(targetPath), { recursive: true });
                await writeFile(targetPath, blob.content);
                filesRestored++;
              }
            } catch (error) {
              console.error(`Failed to restore file ${filePath}:`, error);
            }
          }
        }
      }

      // Write git state based on gitMode
      if (gitMode !== 'none') {
        if (gitMode === 'metadata') {
          // Just write git_state.json with metadata
          const gitFile = path.join(finalOutputDir, 'git_state.json');
          await writeFile(gitFile, JSON.stringify(currentGit, null, 2));
        } else if (gitMode === 'full') {
          // Materialize full git repository
          reportProgress('Materializing Git repository', 85);
          await this.materializeGitRepository(
            finalOutputDir,
            currentGit,
            onProgress
          );
          
          // Also write metadata for reference
          const gitFile = path.join(finalOutputDir, 'git_state.json');
          await writeFile(gitFile, JSON.stringify(currentGit, null, 2));
        }
      }

      // Write file manifest
      const manifestFile = path.join(finalOutputDir, 'file_manifest.json');
      await writeFile(
        manifestFile,
        JSON.stringify(Array.from(currentFiles.entries()), null, 2)
      );

      await this.bus.emit({
        event_type: EventType.REWIND_STATE_MATERIALIZED,
        actor: 'system',
        aggregate_id: targetTimestamp.toString(),
        aggregate_type: 'rewind',
        payload: {
          output_directory: finalOutputDir,
          files_restored: filesRestored,
        },
      });

      reportProgress('Rewind completed successfully', 90);

      // Compare with another directory if requested
      let comparisonReport: ComparisonReport | undefined;
      
      if (compareWith) {
        reportProgress('Comparing with target directory', 92);
        
        try {
          comparisonReport = await this.compareDirectories(
            finalOutputDir,
            compareWith,
            currentFiles
          );
          
          console.log(`📊 Comparison: ${comparisonReport.added} added, ${comparisonReport.modified} modified, ${comparisonReport.deleted} deleted`);
        } catch (error) {
          console.error('Failed to compare directories:', error);
          // Don't fail the whole rewind
        }
      }

      // Create session in rewinded directory if requested
      let sessionCreated: { sessionId: number; sessionName: string } | undefined;
      
      if (createSession) {
        reportProgress('Creating session in rewinded directory', 95);
        
        try {
          const { sessionManager } = await import('../utils/session-manager-sqlite.js');
          const { providerManager } = await import('../utils/provider-manager.js');
          
          // Determine model/provider from reconstructed state
          const model = currentState.model || 'grok-beta';
          const provider = currentState.provider || providerManager.detectProvider(model) || 'grok';
          
          // Get API key (from current environment)
          const providerConfig = providerManager.getProviderForModel(model);
          const apiKey = providerConfig?.apiKey;
          
          if (!apiKey) {
            console.warn(`No API key found for ${provider}, session created without API key`);
          }
          
          // Create new session in rewinded directory
          const { session } = await sessionManager.createNewSession(
            finalOutputDir,
            provider,
            model,
            apiKey,
            {
              importHistory: includeConversations,
              // If we have conversations, they're already in session_state.json
            }
          );
          
          sessionCreated = {
            sessionId: session.id,
            sessionName: session.session_name || `Rewind-${new Date(targetTimestamp).toISOString()}`,
          };
          
          console.log(`✅ Created session #${session.id} in ${finalOutputDir}`);
        } catch (error) {
          console.error('Failed to create session:', error);
          // Don't fail the whole rewind, just log the error
        }
      }

      // Auto-checkout to rewinded directory if requested
      let autoCheckedOut = false;
      let previousWorkingDir: string | undefined;
      
      if (autoCheckout) {
        reportProgress('Checking out to rewinded directory', 98);
        
        try {
          previousWorkingDir = process.cwd();
          process.chdir(finalOutputDir);
          autoCheckedOut = true;
          
          console.log(`📂 Changed working directory from ${previousWorkingDir} to ${finalOutputDir}`);
        } catch (error) {
          console.error('Failed to change directory:', error);
          // Don't fail the whole rewind
        }
      }

      await this.bus.emit({
        event_type: EventType.REWIND_COMPLETED,
        actor: 'system',
        aggregate_id: targetTimestamp.toString(),
        aggregate_type: 'rewind',
        payload: {
          duration_ms: Date.now() - startTime,
          success: true,
          session_created: sessionCreated !== undefined,
          auto_checked_out: autoCheckedOut,
          comparison_performed: comparisonReport !== undefined,
        },
      });

      reportProgress('All operations completed', 100);

      return {
        success: true,
        targetTimestamp,
        snapshotUsed: snapshotMeta?.snapshot_id || null,
        eventsReplayed: events.length,
        filesRestored,
        outputDirectory: finalOutputDir,
        duration: Date.now() - startTime,
        sessionCreated,
        comparisonReport,
        autoCheckedOut,
        previousWorkingDir,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.bus.emit({
        event_type: EventType.REWIND_FAILED,
        actor: 'system',
        aggregate_id: targetTimestamp.toString(),
        aggregate_type: 'rewind',
        payload: {
          error: errorMessage,
          duration_ms: Date.now() - startTime,
        },
      });

      return {
        success: false,
        targetTimestamp,
        snapshotUsed: null,
        eventsReplayed: 0,
        filesRestored: 0,
        outputDirectory: outputDir || '',
        duration: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Extract session state from snapshot
   */
  private extractSessionState(snapshot: SnapshotData): SessionState {
    return {
      sessionId: snapshot.session_state.active_session_id,
      sessionName: null,
      workingDir: snapshot.session_state.working_directory,
      model: snapshot.session_state.model,
      provider: snapshot.session_state.provider,
      conversations: [],
    };
  }

  /**
   * Extract file state from snapshot
   */
  private extractFileState(snapshot: SnapshotData): Map<string, FileState> {
    const files = new Map<string, FileState>();
    
    for (const [filePath, contentHash] of Object.entries(snapshot.file_checksums)) {
      files.set(filePath, {
        path: filePath,
        contentHash,
        exists: true,
        lastModified: snapshot.metadata.timestamp,
      });
    }
    
    return files;
  }

  /**
   * Extract git state from snapshot
   */
  private extractGitState(snapshot: SnapshotData): GitState {
    return {
      commitHash: snapshot.git_state.commit_hash,
      branch: snapshot.git_state.branch,
      isClean: snapshot.git_state.is_clean,
    };
  }

  /**
   * Create empty session state
   */
  private createEmptySessionState(): SessionState {
    return {
      sessionId: null,
      sessionName: null,
      workingDir: process.cwd(),
      conversations: [],
    };
  }

  /**
   * Create empty git state
   */
  private createEmptyGitState(): GitState {
    return {
      commitHash: null,
      branch: null,
      isClean: true,
    };
  }

  /**
   * Apply event to session state
   */
  private applyEventToSessionState(state: SessionState, event: TimelineEvent): SessionState {
    const newState = { ...state };

    switch (event.event_type) {
      case EventType.SESSION_CREATED:
        newState.sessionId = (event.payload as any).session_id;
        newState.sessionName = (event.payload as any).session_name;
        newState.workingDir = (event.payload as any).working_dir;
        break;

      case EventType.SESSION_SWITCHED:
        newState.sessionId = (event.payload as any).session_id;
        newState.workingDir = (event.payload as any).working_dir;
        break;

      case EventType.LLM_MESSAGE_USER:
      case EventType.LLM_MESSAGE_ASSISTANT:
      case EventType.LLM_MESSAGE_SYSTEM:
        newState.conversations.push({
          role: event.event_type === EventType.LLM_MESSAGE_USER ? 'user' :
                event.event_type === EventType.LLM_MESSAGE_ASSISTANT ? 'assistant' : 'system',
          content: (event.payload as any).content || '',
          timestamp: event.timestamp,
        });
        break;

      case EventType.MODEL_CHANGED:
        newState.model = (event.payload as any).new_model;
        break;

      case EventType.PROVIDER_CHANGED:
        newState.provider = (event.payload as any).new_provider;
        break;
    }

    return newState;
  }

  /**
   * Apply event to file state
   */
  private applyEventToFileState(files: Map<string, FileState>, event: TimelineEvent): Map<string, FileState> {
    const newFiles = new Map(files);
    const payload = event.payload as any;

    switch (event.event_type) {
      case EventType.FILE_CREATED:
      case EventType.FILE_MODIFIED:
        newFiles.set(payload.path, {
          path: payload.path,
          contentHash: payload.new_hash || payload.content_hash || null,
          exists: true,
          lastModified: event.timestamp,
        });
        break;

      case EventType.FILE_DELETED:
        newFiles.set(payload.path, {
          path: payload.path,
          contentHash: '',
          exists: false,
          lastModified: event.timestamp,
        });
        break;

      case EventType.FILE_RENAMED:
      case EventType.FILE_MOVED:
        const oldFile = newFiles.get(payload.old_path);
        if (oldFile) {
          newFiles.delete(payload.old_path);
          newFiles.set(payload.new_path, {
            ...oldFile,
            path: payload.new_path,
            lastModified: event.timestamp,
          });
        }
        break;
    }

    return newFiles;
  }

  /**
   * Apply event to git state
   */
  private applyEventToGitState(state: GitState, event: TimelineEvent): GitState {
    const newState = { ...state };
    const payload = event.payload as any;

    switch (event.event_type) {
      case EventType.GIT_COMMIT:
        newState.commitHash = payload.hash;
        break;

      case EventType.GIT_BRANCH_SWITCHED:
        newState.branch = payload.branch;
        break;
    }

    return newState;
  }

  /**
   * Generate output directory name
   */
  private generateOutputDir(timestamp: number): string {
    const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
    return path.join(process.cwd(), `.rewind_${dateStr}`);
  }

  /**
   * Compare rewinded directory with another directory
   */
  private async compareDirectories(
    rewindDir: string,
    compareDir: string,
    rewindFiles: Map<string, FileState>
  ): Promise<ComparisonReport> {
    const crypto = await import('crypto');
    const fsModule = await import('fs');
    const { readdir, readFile, stat } = await import('fs/promises');

    // Helper to calculate file hash
    const calculateHash = async (filePath: string): Promise<string> => {
      try {
        const content = await readFile(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
      } catch {
        return '';
      }
    };

    // Helper to recursively get all files in a directory
    const getAllFiles = async (dir: string, baseDir: string = dir): Promise<Set<string>> => {
      const files = new Set<string>();
      
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);
          
          // Skip .git and other hidden directories
          if (entry.name.startsWith('.')) {
            continue;
          }
          
          if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath, baseDir);
            subFiles.forEach(f => files.add(f));
          } else if (entry.isFile()) {
            files.add(relativePath);
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
      
      return files;
    };

    const report: ComparisonReport = {
      compareDirectory: compareDir,
      totalFiles: 0,
      added: 0,
      deleted: 0,
      modified: 0,
      unchanged: 0,
      files: [],
    };

    try {
      // Get all files from both directories
      const rewindFilesDir = path.join(rewindDir, 'files');
      const rewindFilePaths = await getAllFiles(rewindFilesDir);
      const compareFilePaths = fsModule.existsSync(compareDir) 
        ? await getAllFiles(compareDir)
        : new Set<string>();

      // Combine all file paths
      const allPaths = new Set([...rewindFilePaths, ...compareFilePaths]);
      report.totalFiles = allPaths.size;

      // Compare each file
      for (const relativePath of allPaths) {
        const rewindPath = path.join(rewindFilesDir, relativePath);
        const comparePath = path.join(compareDir, relativePath);
        
        const rewindExists = fsModule.existsSync(rewindPath);
        const compareExists = fsModule.existsSync(comparePath);

        let comparison: FileComparison;

        if (rewindExists && !compareExists) {
          // File added in rewind (was deleted in compare)
          comparison = {
            path: relativePath,
            status: 'deleted',
            rewindHash: await calculateHash(rewindPath),
          };
          report.deleted++;
        } else if (!rewindExists && compareExists) {
          // File deleted in rewind (was added in compare)
          comparison = {
            path: relativePath,
            status: 'added',
            compareHash: await calculateHash(comparePath),
          };
          report.added++;
        } else if (rewindExists && compareExists) {
          // File exists in both, check if modified
          const rewindHash = await calculateHash(rewindPath);
          const compareHash = await calculateHash(comparePath);
          
          if (rewindHash === compareHash) {
            comparison = {
              path: relativePath,
              status: 'unchanged',
              rewindHash,
              compareHash,
            };
            report.unchanged++;
          } else {
            const rewindStat = await stat(rewindPath);
            const compareStat = await stat(comparePath);
            
            comparison = {
              path: relativePath,
              status: 'modified',
              rewindHash,
              compareHash,
              sizeDiff: rewindStat.size - compareStat.size,
            };
            report.modified++;
          }
        } else {
          // Should not happen
          continue;
        }

        report.files.push(comparison);
      }

      // Sort files by status for better readability
      report.files.sort((a, b) => {
        const statusOrder = { added: 1, deleted: 2, modified: 3, unchanged: 4 };
        return statusOrder[a.status] - statusOrder[b.status];
      });

    } catch (error) {
      console.error('Error during directory comparison:', error);
      throw error;
    }

    return report;
  }

  /**
   * Materialize full Git repository at target commit
   */
  private async materializeGitRepository(
    outputDir: string,
    gitState: GitState,
    onProgress?: (message: string, progress: number) => void
  ): Promise<void> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const reportProgress = (msg: string) => {
        if (onProgress) onProgress(msg, 85);
      };

      // Find the source git repository
      const currentDir = process.cwd();
      const gitDir = path.join(currentDir, '.git');

      // Check if we're in a git repository
      const fsModule = await import('fs');
      if (!fsModule.existsSync(gitDir)) {
        console.warn('Not in a git repository, skipping git materialization');
        return;
      }

      reportProgress('Copying .git directory');

      // Method 1: Clone the current repo to the output directory
      // This is safer and cleaner than copying .git manually
      try {
        // Clone current repo to output dir
        await execAsync(`git clone "${currentDir}" "${outputDir}_temp"`);
        
        // Move the cloned content to the actual output dir
        const tempGitDir = path.join(`${outputDir}_temp`, '.git');
        const targetGitDir = path.join(outputDir, '.git');
        
        // Copy .git directory
        await execAsync(`cp -r "${tempGitDir}" "${targetGitDir}"`);
        
        // Remove temp directory
        await execAsync(`rm -rf "${outputDir}_temp"`);

        reportProgress('Checking out target commit');

        // Checkout the specific commit
        if (gitState.commitHash) {
          await execAsync(`git -C "${outputDir}" checkout ${gitState.commitHash}`, {
            cwd: outputDir
          });
        }

        // If branch is specified and different from current, try to checkout branch
        if (gitState.branch) {
          try {
            await execAsync(`git -C "${outputDir}" checkout ${gitState.branch}`, {
              cwd: outputDir
            });
          } catch (error) {
            // Branch might not exist or commit might be detached, that's ok
            console.warn(`Could not checkout branch ${gitState.branch}, staying on commit ${gitState.commitHash}`);
          }
        }

        reportProgress('Git repository materialized successfully');

      } catch (error) {
        console.error('Failed to materialize git repository:', error);
        throw new Error(`Git materialization failed: ${error instanceof Error ? error.message : String(error)}`);
      }

    } catch (error) {
      console.error('Error in materializeGitRepository:', error);
      throw error;
    }
  }
}

/**
 * Get RewindEngine singleton instance
 */
export function getRewindEngine(): RewindEngine {
  return RewindEngine.getInstance();
}
