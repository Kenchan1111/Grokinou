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

// Internal imports for functions
import { getLLMHook as _getLLMHook } from './hooks/llm-hook.js';
import { getToolHook as _getToolHook } from './hooks/tool-hook.js';
import { getSessionHook as _getSessionHook } from './hooks/session-hook.js';
import { getTimelineDb as _getTimelineDb } from './database.js';
import { getEventBus as _getEventBus } from './event-bus.js';

/**
 * Initialize timeline module
 * 
 * Call this once at application startup.
 * 
 * @param config - Optional configuration
 * @returns True if initialization succeeded
 */
export function initTimeline(config?: {
  dbPath?: string;
  enableLLMHook?: boolean;
  enableToolHook?: boolean;
  enableSessionHook?: boolean;
}): boolean {
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
