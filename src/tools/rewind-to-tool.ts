/**
 * Rewind To Tool - LLM Tool for time-travel reconstruction
 * 
 * Allows the LLM to rewind the system to any point in time,
 * creating a complete reconstruction in a new directory.
 * 
 * This is the core "Time Machine" feature exposed to the LLM.
 * 
 * @module tools/rewind-to-tool
 * @version 1.0.0
 */

import { getRewindEngine, type RewindOptions, type ComparisonReport } from '../timeline/index.js';

/**
 * Rewind tool parameters
 */
export interface RewindToParams {
  /**
   * Target timestamp to rewind to (ISO string or milliseconds)
   */
  targetTimestamp: string | number;

  /**
   * Custom output directory (optional)
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
  gitMode?: 'none' | 'metadata' | 'full';

  /**
   * Create a new session in the rewinded directory (default: false)
   */
  createSession?: boolean;

  /**
   * Automatically change working directory to rewinded directory (default: false)
   */
  autoCheckout?: boolean;

  /**
   * Compare rewinded state with another directory (optional)
   */
  compareWith?: string;

  /**
   * Human-readable reason for rewind (for logging)
   */
  reason?: string;
}

/**
 * Rewind result for LLM
 */
export interface RewindToResult {
  success: boolean;
  targetTimestamp: string;
  targetTimestampMs: number;
  outputDirectory: string;
  snapshotUsed: string | null;
  eventsReplayed: number;
  filesRestored: number;
  durationMs: number;
  error?: string;
  sessionCreated?: {
    sessionId: number;
    sessionName: string;
  };
  comparisonReport?: ComparisonReport;
  autoCheckedOut?: boolean;
  previousWorkingDir?: string;
  
  // Additional info for LLM
  summary?: string;
  nextSteps?: string[];
}

/**
 * Parse timestamp from string or number
 */
function parseTimestamp(input: string | number): number {
  if (typeof input === 'number') {
    return input;
  }
  
  // Try to parse ISO string
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${input}. Use ISO format (e.g., "2025-11-28T12:00:00Z") or milliseconds.`);
  }
  
  return date.getTime();
}

/**
 * Execute rewind operation
 */
export async function executeRewindTo(params: RewindToParams): Promise<RewindToResult> {
  try {
    const rewindEngine = getRewindEngine();
    
    // Parse target timestamp
    const targetTimestampMs = parseTimestamp(params.targetTimestamp);
    const targetTimestamp = new Date(targetTimestampMs).toISOString();
    
    // Validate timestamp is in the past
    if (targetTimestampMs > Date.now()) {
      throw new Error('Cannot rewind to a future timestamp');
    }

    // Build options
    const options: RewindOptions = {
      targetTimestamp: targetTimestampMs,
      outputDir: params.outputDir,
      includeFiles: params.includeFiles ?? true,
      includeConversations: params.includeConversations ?? true,
      gitMode: params.gitMode ?? (params.includeGit === false ? 'none' : 'metadata'),
      createSession: params.createSession ?? false,
      autoCheckout: params.autoCheckout ?? false,
      compareWith: params.compareWith,
      onProgress: (message, progress) => {
        // Could emit progress events here
        console.log(`[Rewind ${progress}%] ${message}`);
      },
    };

    // Execute rewind
    const result = await rewindEngine.rewindTo(options);

    if (!result.success) {
      return {
        success: false,
        targetTimestamp,
        targetTimestampMs,
        outputDirectory: result.outputDirectory,
        snapshotUsed: result.snapshotUsed,
        eventsReplayed: result.eventsReplayed,
        filesRestored: result.filesRestored,
        durationMs: result.duration,
        error: result.error || 'Unknown error during rewind',
      };
    }

    // Build success summary
    const summaryLines = [
      `Successfully rewound system to ${targetTimestamp}`,
      `Restored ${result.filesRestored} files`,
      `Replayed ${result.eventsReplayed} events`,
      result.snapshotUsed ? `Used snapshot: ${result.snapshotUsed}` : 'No snapshot used (replayed from beginning)',
      `Output directory: ${result.outputDirectory}`,
    ];
    
    if (result.sessionCreated) {
      summaryLines.push(`Created session #${result.sessionCreated.sessionId} in rewinded directory`);
    }
    
    const summary = summaryLines.join('\n');

    const nextSteps = [
      `Explore the reconstructed state in: ${result.outputDirectory}`,
      `Files are in: ${result.outputDirectory}/files/`,
      `Session state: ${result.outputDirectory}/session_state.json`,
      `Git state: ${result.outputDirectory}/git_state.json`,
      `File manifest: ${result.outputDirectory}/file_manifest.json`,
    ];
    
    if (result.sessionCreated) {
      nextSteps.unshift(`Switch to rewinded session: use session_switch tool with ID ${result.sessionCreated.sessionId}`);
    }

    return {
      success: true,
      targetTimestamp,
      targetTimestampMs,
      outputDirectory: result.outputDirectory,
      snapshotUsed: result.snapshotUsed,
      eventsReplayed: result.eventsReplayed,
      filesRestored: result.filesRestored,
      durationMs: result.duration,
      sessionCreated: result.sessionCreated,
      comparisonReport: result.comparisonReport,
      autoCheckedOut: result.autoCheckedOut,
      previousWorkingDir: result.previousWorkingDir,
      summary,
      nextSteps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      targetTimestamp: '',
      targetTimestampMs: 0,
      outputDirectory: '',
      snapshotUsed: null,
      eventsReplayed: 0,
      filesRestored: 0,
      durationMs: 0,
      error: errorMessage,
    };
  }
}

/**
 * Get available time points (snapshots + recent events)
 */
export async function getAvailableTimePoints(): Promise<{
  snapshots: Array<{
    timestamp: string;
    timestampMs: number;
    eventCount: number;
    sessionName: string | null;
  }>;
  recentEvents: Array<{
    timestamp: string;
    timestampMs: number;
    description: string;
  }>;
}> {
  const { getSnapshotManager, getQueryEngine, getEventDescription } = await import('../timeline/index.js');
  
  const snapshotManager = getSnapshotManager();
  const queryEngine = getQueryEngine();

  // Get snapshots
  const snapshotMetas = snapshotManager.listSnapshots(10);
  const snapshots = snapshotMetas.map(meta => ({
    timestamp: new Date(meta.timestamp).toISOString(),
    timestampMs: meta.timestamp,
    eventCount: meta.event_count,
    sessionName: meta.session_name,
  }));

  // Get recent events
  const recentEvents = queryEngine.getRecentEvents(20).map(event => ({
    timestamp: new Date(event.timestamp).toISOString(),
    timestampMs: event.timestamp,
    description: getEventDescription(event.event_type),
  }));

  return { snapshots, recentEvents };
}

/**
 * Rewind tool definition for LLM
 */
export const rewindToTool = {
  name: 'rewind_to',
  description: `Rewind the system to a specific point in time, creating a complete reconstruction.
  
This is a TIME MACHINE that reconstructs:
- Session state (active session, working directory, model)
- Conversation history up to that point
- File contents at that moment (restored from Merkle DAG)
- Git state (commit hash, branch)

The reconstruction is created in a NEW directory (non-destructive).

Use this tool to:
- Recover lost work
- Investigate what the system looked like at a specific time
- Debug issues by going back in time
- Create a new session from a past state

⚠️ WARNING: This can take time for distant timestamps (lots of event replay).

Examples:
- "Rewind to 2 hours ago"
- "Show me what files looked like before the last commit"
- "Restore session state from this morning"`,
  
  inputSchema: {
    type: 'object',
    properties: {
      targetTimestamp: {
        type: 'string',
        description: 'Target timestamp in ISO format (e.g., "2025-11-28T12:00:00Z") or milliseconds',
      },
      outputDir: {
        type: 'string',
        description: 'Custom output directory path (optional, auto-generated if not provided)',
      },
      includeFiles: {
        type: 'boolean',
        description: 'Include file contents in reconstruction (default: true)',
        default: true,
      },
      includeConversations: {
        type: 'boolean',
        description: 'Include conversation history (default: true)',
        default: true,
      },
      includeGit: {
        type: 'boolean',
        description: 'Include git state (default: true)',
        default: true,
      },
      reason: {
        type: 'string',
        description: 'Human-readable reason for rewind (for logging)',
      },
    },
    required: ['targetTimestamp'],
  },
  
  execute: executeRewindTo,
};

/**
 * List time points tool (helper for rewind)
 */
export const listTimePointsTool = {
  name: 'list_time_points',
  description: `List available time points (snapshots and recent events) for rewinding.
  
Use this before rewind_to to see what timestamps are available.
Shows:
- Recent snapshots (optimized rewind points)
- Recent events (for precise rewind)`,
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  execute: getAvailableTimePoints,
};
