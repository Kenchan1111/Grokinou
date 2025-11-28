/**
 * Event Types - Complete Taxonomy for Timeline Event Sourcing
 * 
 * This file defines ALL possible event types that can occur in the system.
 * Each event type represents an atomic, immutable fact about what happened.
 * 
 * Design principles:
 * - Past tense (FILE_CREATED, not CREATE_FILE)
 * - Granular (separate STARTED/SUCCESS/FAILED for operations)
 * - Explicit (no ambiguous types)
 * 
 * @module timeline/event-types
 * @version 1.0.0
 */

/**
 * Event Type Enumeration
 * 
 * Categories:
 * - SESSION_*: Session lifecycle
 * - LLM_*: LLM interactions
 * - TOOL_*: Tool executions
 * - FILE_*: File operations
 * - GIT_*: Git operations
 * - CLI_*: CLI system events
 * - REWIND_*: Rewind operations
 */
export enum EventType {
  // ========================================
  // SESSION EVENTS
  // ========================================
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_SWITCHED = 'SESSION_SWITCHED',
  SESSION_RENAMED = 'SESSION_RENAMED',
  SESSION_CLOSED = 'SESSION_CLOSED',
  SESSION_RESTORED = 'SESSION_RESTORED',              // From rewind
  
  // ========================================
  // LLM INTERACTION EVENTS
  // ========================================
  LLM_MESSAGE_USER = 'LLM_MESSAGE_USER',
  LLM_MESSAGE_ASSISTANT = 'LLM_MESSAGE_ASSISTANT',
  LLM_MESSAGE_SYSTEM = 'LLM_MESSAGE_SYSTEM',
  LLM_STREAMING_START = 'LLM_STREAMING_START',
  LLM_STREAMING_CHUNK = 'LLM_STREAMING_CHUNK',
  LLM_STREAMING_END = 'LLM_STREAMING_END',
  LLM_ERROR = 'LLM_ERROR',
  
  // ========================================
  // TOOL EXECUTION EVENTS
  // ========================================
  TOOL_CALL_STARTED = 'TOOL_CALL_STARTED',
  TOOL_CALL_SUCCESS = 'TOOL_CALL_SUCCESS',
  TOOL_CALL_FAILED = 'TOOL_CALL_FAILED',
  TOOL_PERMISSION_REQUESTED = 'TOOL_PERMISSION_REQUESTED',
  TOOL_PERMISSION_GRANTED = 'TOOL_PERMISSION_GRANTED',
  TOOL_PERMISSION_DENIED = 'TOOL_PERMISSION_DENIED',
  
  // ========================================
  // FILE OPERATION EVENTS
  // ========================================
  FILE_READ = 'FILE_READ',
  FILE_CREATED = 'FILE_CREATED',
  FILE_MODIFIED = 'FILE_MODIFIED',
  FILE_DELETED = 'FILE_DELETED',
  FILE_RENAMED = 'FILE_RENAMED',
  FILE_PERMISSION_CHANGED = 'FILE_PERMISSION_CHANGED',
  FILE_MOVED = 'FILE_MOVED',
  
  // ========================================
  // DIRECTORY OPERATION EVENTS
  // ========================================
  DIRECTORY_CREATED = 'DIRECTORY_CREATED',
  DIRECTORY_DELETED = 'DIRECTORY_DELETED',
  DIRECTORY_RENAMED = 'DIRECTORY_RENAMED',
  DIRECTORY_MOVED = 'DIRECTORY_MOVED',
  
  // ========================================
  // GIT OPERATION EVENTS
  // ========================================
  GIT_INIT = 'GIT_INIT',
  GIT_ADD = 'GIT_ADD',
  GIT_COMMIT = 'GIT_COMMIT',
  GIT_PUSH = 'GIT_PUSH',
  GIT_PULL = 'GIT_PULL',
  GIT_FETCH = 'GIT_FETCH',
  GIT_MERGE = 'GIT_MERGE',
  GIT_REBASE = 'GIT_REBASE',
  GIT_BRANCH_CREATED = 'GIT_BRANCH_CREATED',
  GIT_BRANCH_SWITCHED = 'GIT_BRANCH_SWITCHED',
  GIT_BRANCH_DELETED = 'GIT_BRANCH_DELETED',
  GIT_TAG_CREATED = 'GIT_TAG_CREATED',
  GIT_TAG_DELETED = 'GIT_TAG_DELETED',
  GIT_STASH_PUSH = 'GIT_STASH_PUSH',
  GIT_STASH_POP = 'GIT_STASH_POP',
  GIT_CONFLICT = 'GIT_CONFLICT',
  
  // ========================================
  // CLI SYSTEM EVENTS
  // ========================================
  CLI_STARTED = 'CLI_STARTED',
  CLI_STOPPED = 'CLI_STOPPED',
  CLI_COMMAND_EXECUTED = 'CLI_COMMAND_EXECUTED',
  MODEL_CHANGED = 'MODEL_CHANGED',
  PROVIDER_CHANGED = 'PROVIDER_CHANGED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  API_KEY_ADDED = 'API_KEY_ADDED',
  API_KEY_REMOVED = 'API_KEY_REMOVED',
  
  // ========================================
  // REWIND OPERATION EVENTS
  // ========================================
  REWIND_STARTED = 'REWIND_STARTED',
  REWIND_SNAPSHOT_LOADED = 'REWIND_SNAPSHOT_LOADED',
  REWIND_EVENTS_REPLAYED = 'REWIND_EVENTS_REPLAYED',
  REWIND_STATE_MATERIALIZED = 'REWIND_STATE_MATERIALIZED',
  REWIND_COMPLETED = 'REWIND_COMPLETED',
  REWIND_FAILED = 'REWIND_FAILED',
  
  // ========================================
  // SNAPSHOT EVENTS
  // ========================================
  SNAPSHOT_CREATED = 'SNAPSHOT_CREATED',
  SNAPSHOT_LOADED = 'SNAPSHOT_LOADED',
  SNAPSHOT_DELETED = 'SNAPSHOT_DELETED',
  
  // ========================================
  // ERROR EVENTS
  // ========================================
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  EXCEPTION_THROWN = 'EXCEPTION_THROWN',
}

/**
 * Event Interface
 * 
 * Base structure for all events in the timeline.
 */
export interface Event {
  id: string;                    // UUID v4
  timestamp: number;             // Unix microseconds
  sequence_number: number;       // Strict ordering
  actor: string;                 // 'user' | 'llm:<model>' | 'tool:<name>' | 'system'
  event_type: EventType;
  aggregate_id?: string;         // Entity ID
  aggregate_type?: string;       // 'session' | 'file' | 'conversation' | 'git'
  payload: any;                  // Event-specific data
  correlation_id?: string;       // Transaction ID
  causation_id?: string;         // Parent event ID
  metadata?: any;                // Additional context
  checksum: string;              // SHA256(payload)
}

/**
 * Event Payload Types
 * 
 * Specific payload structures for each event type.
 */

export interface LLMMessagePayload {
  role: 'user' | 'assistant' | 'system';
  content: string;
  session_id: number;
  model: string;
  provider: string;
  token_count?: number;
}

export interface ToolCallPayload {
  tool_name: string;
  arguments: any;
  result?: any;
  error?: string;
  duration_ms?: number;
  session_id: number;
}

export interface FileModifiedPayload {
  path: string;
  old_hash?: string;
  new_hash: string;
  diff?: string;              // Unified diff format
  size_delta?: number;
  reason?: string;            // Why was it modified
  session_id: number;
}

export interface GitCommitPayload {
  hash: string;
  message: string;
  author: string;
  email: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  session_id: number;
}

export interface SessionCreatedPayload {
  session_id: number;
  session_name: string;
  working_dir: string;
  model?: string;
  provider?: string;
}

export interface RewindStartedPayload {
  target_timestamp: number;
  target_timestamp_human: string;
  output_dir: string;
  requested_by: string;       // 'user' | 'llm:<model>'
}

/**
 * Timeline Event Structure
 * 
 * Represents a single event in the timeline.
 */
export interface TimelineEvent {
  id: string;
  timestamp: number;
  sequence_number: number;
  event_type: EventType;
  actor: string;
  aggregate_id: string;
  aggregate_type: string;
  causation_id: string | null;
  correlation_id: string | null;
  payload: Record<string, any>;
}

/**
 * Event Category Enum
 */
export enum EventCategory {
  SESSION = 'SESSION',
  LLM = 'LLM',
  TOOL = 'TOOL',
  FILE = 'FILE',
  GIT = 'GIT',
  REWIND = 'REWIND',
}

/**
 * Event Category Groupings
 * 
 * For filtering and querying events by category.
 */
export const EVENT_CATEGORIES = {
  SESSION: [
    EventType.SESSION_CREATED,
    EventType.SESSION_SWITCHED,
    EventType.SESSION_RENAMED,
    EventType.SESSION_CLOSED,
    EventType.SESSION_RESTORED,
  ],
  LLM: [
    EventType.LLM_MESSAGE_USER,
    EventType.LLM_MESSAGE_ASSISTANT,
    EventType.LLM_MESSAGE_SYSTEM,
    EventType.LLM_STREAMING_START,
    EventType.LLM_STREAMING_CHUNK,
    EventType.LLM_STREAMING_END,
    EventType.LLM_ERROR,
  ],
  TOOL: [
    EventType.TOOL_CALL_STARTED,
    EventType.TOOL_CALL_SUCCESS,
    EventType.TOOL_CALL_FAILED,
    EventType.TOOL_PERMISSION_REQUESTED,
    EventType.TOOL_PERMISSION_GRANTED,
    EventType.TOOL_PERMISSION_DENIED,
  ],
  FILE: [
    EventType.FILE_READ,
    EventType.FILE_CREATED,
    EventType.FILE_MODIFIED,
    EventType.FILE_DELETED,
    EventType.FILE_RENAMED,
    EventType.FILE_PERMISSION_CHANGED,
    EventType.FILE_MOVED,
    EventType.DIRECTORY_CREATED,
    EventType.DIRECTORY_DELETED,
    EventType.DIRECTORY_RENAMED,
    EventType.DIRECTORY_MOVED,
  ],
  GIT: [
    EventType.GIT_INIT,
    EventType.GIT_ADD,
    EventType.GIT_COMMIT,
    EventType.GIT_PUSH,
    EventType.GIT_PULL,
    EventType.GIT_FETCH,
    EventType.GIT_MERGE,
    EventType.GIT_REBASE,
    EventType.GIT_BRANCH_CREATED,
    EventType.GIT_BRANCH_SWITCHED,
    EventType.GIT_BRANCH_DELETED,
    EventType.GIT_TAG_CREATED,
    EventType.GIT_TAG_DELETED,
    EventType.GIT_STASH_PUSH,
    EventType.GIT_STASH_POP,
    EventType.GIT_CONFLICT,
  ],
  REWIND: [
    EventType.REWIND_STARTED,
    EventType.REWIND_SNAPSHOT_LOADED,
    EventType.REWIND_EVENTS_REPLAYED,
    EventType.REWIND_STATE_MATERIALIZED,
    EventType.REWIND_COMPLETED,
    EventType.REWIND_FAILED,
  ],
} as const;

/**
 * Helper: Check if event type belongs to a category
 */
export function isEventInCategory(eventType: EventType, category: EventCategory | keyof typeof EVENT_CATEGORIES): boolean {
  const categoryKey = typeof category === 'string' && category in EVENT_CATEGORIES 
    ? category as keyof typeof EVENT_CATEGORIES
    : category as keyof typeof EVENT_CATEGORIES;
  return (EVENT_CATEGORIES[categoryKey] as readonly EventType[]).includes(eventType);
}

/**
 * Helper: Get human-readable event description
 */
export function getEventDescription(eventType: EventType): string {
  const descriptions: Partial<Record<EventType, string>> = {
    [EventType.SESSION_CREATED]: 'Session created',
    [EventType.SESSION_SWITCHED]: 'Switched to different session',
    [EventType.SESSION_RENAMED]: 'Session renamed',
    [EventType.SESSION_CLOSED]: 'Session closed',
    [EventType.SESSION_RESTORED]: 'Session restored from rewind',
    
    [EventType.LLM_MESSAGE_USER]: 'User message sent to LLM',
    [EventType.LLM_MESSAGE_ASSISTANT]: 'LLM response received',
    [EventType.LLM_MESSAGE_SYSTEM]: 'System message added',
    [EventType.LLM_STREAMING_START]: 'LLM streaming started',
    [EventType.LLM_STREAMING_CHUNK]: 'LLM streaming chunk received',
    [EventType.LLM_STREAMING_END]: 'LLM streaming completed',
    [EventType.LLM_ERROR]: 'LLM error occurred',
    
    [EventType.TOOL_CALL_STARTED]: 'Tool execution started',
    [EventType.TOOL_CALL_SUCCESS]: 'Tool executed successfully',
    [EventType.TOOL_CALL_FAILED]: 'Tool execution failed',
    [EventType.TOOL_PERMISSION_REQUESTED]: 'Tool permission requested',
    [EventType.TOOL_PERMISSION_GRANTED]: 'Tool permission granted',
    [EventType.TOOL_PERMISSION_DENIED]: 'Tool permission denied',
    
    [EventType.FILE_READ]: 'File read',
    [EventType.FILE_CREATED]: 'File created',
    [EventType.FILE_MODIFIED]: 'File modified',
    [EventType.FILE_DELETED]: 'File deleted',
    [EventType.FILE_RENAMED]: 'File renamed',
    [EventType.FILE_PERMISSION_CHANGED]: 'File permissions changed',
    [EventType.FILE_MOVED]: 'File moved',
    
    [EventType.DIRECTORY_CREATED]: 'Directory created',
    [EventType.DIRECTORY_DELETED]: 'Directory deleted',
    [EventType.DIRECTORY_RENAMED]: 'Directory renamed',
    [EventType.DIRECTORY_MOVED]: 'Directory moved',
    
    [EventType.GIT_INIT]: 'Git repository initialized',
    [EventType.GIT_ADD]: 'Files staged for commit',
    [EventType.GIT_COMMIT]: 'Git commit created',
    [EventType.GIT_PUSH]: 'Changes pushed to remote',
    [EventType.GIT_PULL]: 'Changes pulled from remote',
    [EventType.GIT_FETCH]: 'Remote changes fetched',
    [EventType.GIT_MERGE]: 'Branches merged',
    [EventType.GIT_REBASE]: 'Branch rebased',
    [EventType.GIT_BRANCH_CREATED]: 'Git branch created',
    [EventType.GIT_BRANCH_SWITCHED]: 'Switched to different branch',
    [EventType.GIT_BRANCH_DELETED]: 'Git branch deleted',
    [EventType.GIT_TAG_CREATED]: 'Git tag created',
    [EventType.GIT_TAG_DELETED]: 'Git tag deleted',
    [EventType.GIT_STASH_PUSH]: 'Changes stashed',
    [EventType.GIT_STASH_POP]: 'Stashed changes applied',
    [EventType.GIT_CONFLICT]: 'Git conflict occurred',
    
    [EventType.CLI_STARTED]: 'CLI started',
    [EventType.CLI_STOPPED]: 'CLI stopped',
    [EventType.CLI_COMMAND_EXECUTED]: 'Command executed',
    [EventType.MODEL_CHANGED]: 'AI model changed',
    [EventType.PROVIDER_CHANGED]: 'AI provider changed',
    [EventType.SETTINGS_UPDATED]: 'Settings updated',
    [EventType.API_KEY_ADDED]: 'API key added',
    [EventType.API_KEY_REMOVED]: 'API key removed',
    
    [EventType.REWIND_STARTED]: 'Rewind operation started',
    [EventType.REWIND_SNAPSHOT_LOADED]: 'Snapshot loaded for rewind',
    [EventType.REWIND_EVENTS_REPLAYED]: 'Events replayed',
    [EventType.REWIND_STATE_MATERIALIZED]: 'State materialized to filesystem',
    [EventType.REWIND_COMPLETED]: 'Rewind completed successfully',
    [EventType.REWIND_FAILED]: 'Rewind failed',
    
    [EventType.SNAPSHOT_CREATED]: 'Snapshot created',
    [EventType.SNAPSHOT_LOADED]: 'Snapshot loaded',
    [EventType.SNAPSHOT_DELETED]: 'Snapshot deleted',
    
    [EventType.ERROR_OCCURRED]: 'Error occurred',
    [EventType.EXCEPTION_THROWN]: 'Exception thrown',
  };
  
  return descriptions[eventType] || 'Unknown event';
}
