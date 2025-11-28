/**
 * Timeline Module - Event Sourcing & Time Machine
 * 
 * Main entry point for timeline functionality.
 * 
 * Usage:
 * ```typescript
 * import { getTimelineDb, getLLMHook, getEventBus } from './timeline';
 * 
 * // Initialize timeline
 * const timeline = getTimelineDb();
 * 
 * // Get hooks
 * const llmHook = getLLMHook();
 * const toolHook = getToolHook();
 * 
 * // Capture events
 * await llmHook.captureUserMessage('Hello', 1, 'gpt-4', 'openai');
 * ```
 * 
 * @module timeline
 * @version 1.0.0
 */

// Core
export { TimelineDatabase, getTimelineDb, type TimelineDatabaseConfig } from './database.js';
export { EventBus, getEventBus, type EventBusOptions, type EventListener } from './event-bus.js';
export { TimelineLogger, getTimelineLogger, type EventInput, type LogResult } from './timeline-logger.js';

// Event Types
export { EventType, Event, isEventInCategory, getEventDescription, EVENT_CATEGORIES } from './event-types.js';
export type {
  LLMMessagePayload,
  ToolCallPayload,
  FileModifiedPayload,
  GitCommitPayload,
  SessionCreatedPayload,
  RewindStartedPayload,
} from './event-types.js';

// Hooks
export { LLMHook, getLLMHook, type LLMHookConfig } from './hooks/llm-hook.js';
export { ToolHook, getToolHook, type ToolHookConfig } from './hooks/tool-hook.js';
export { SessionHook, getSessionHook, type SessionHookConfig } from './hooks/session-hook.js';
export { FileHook, getFileHook, type FileHookConfig } from './hooks/file-hook.js';
export { GitHook, getGitHook, type GitHookConfig } from './hooks/git-hook.js';

// Storage
export { MerkleDAG, getMerkleDAG, type BlobStoreResult, type BlobRetrieveResult } from './storage/merkle-dag.js';

// Internal imports for functions
import { getLLMHook as _getLLMHook } from './hooks/llm-hook.js';
import { getToolHook as _getToolHook } from './hooks/tool-hook.js';
import { getSessionHook as _getSessionHook } from './hooks/session-hook.js';
import { getFileHook as _getFileHook } from './hooks/file-hook.js';
import { getGitHook as _getGitHook } from './hooks/git-hook.js';
import { getTimelineDb as _getTimelineDb } from './database.js';
import { getEventBus as _getEventBus } from './event-bus.js';

/**
 * Initialize timeline module
 * 
 * Call this once at application startup.
 * 
 * @param config - Optional configuration
 * @returns Promise that resolves to true if initialization succeeded
 */
export async function initTimeline(config?: {
  dbPath?: string;
  enableLLMHook?: boolean;
  enableToolHook?: boolean;
  enableSessionHook?: boolean;
  enableFileHook?: boolean;
  enableGitHook?: boolean;
}): Promise<boolean> {
  try {
    // Initialize database
    const db = _getTimelineDb({ dbPath: config?.dbPath });
    
    if (!db.healthCheck()) {
      console.error('❌ Timeline database health check failed');
      return false;
    }
    
    // Initialize hooks
    if (config?.enableLLMHook !== false) {
      _getLLMHook({ enabled: true });
    }
    
    if (config?.enableToolHook !== false) {
      _getToolHook({ enabled: true });
    }
    
    if (config?.enableSessionHook !== false) {
      _getSessionHook({ enabled: true });
    }
    
    // Initialize and start file hook (if enabled)
    if (config?.enableFileHook !== false) {
      const fileHook = _getFileHook({ enabled: true });
      await fileHook.startWatching();
    }
    
    // Initialize git hook (if enabled)
    if (config?.enableGitHook !== false) {
      _getGitHook({ enabled: true });
    }
    
    console.log('✅ Timeline module initialized');
    return true;
  } catch (error) {
    console.error('❌ Timeline initialization failed:', error);
    return false;
  }
}

/**
 * Get timeline statistics
 */
export function getTimelineStats() {
  const db = _getTimelineDb();
  const bus = _getEventBus();
  
  return {
    database: db.getStats(),
    eventBus: bus.getStats(),
  };
}
