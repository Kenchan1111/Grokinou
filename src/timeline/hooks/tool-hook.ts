/**
 * Tool Hook - Automatic Event Capture for Tool Calls
 * 
 * Captures all tool executions (calls, results, errors, permissions)
 * and logs them to timeline.db.
 * 
 * Integration point:
 * - ConfirmationService.executeWithConfirmation()
 * - Tool execution logic
 * 
 * @module timeline/hooks/tool-hook
 * @version 1.0.0
 */

import { EventBus } from '../event-bus';
import { EventType } from '../event-types';
import type { ToolCallPayload } from '../event-types';

/**
 * Tool Hook Configuration
 */
export interface ToolHookConfig {
  enabled?: boolean;              // Enable/disable hook
  capturePermissions?: boolean;   // Capture permission requests (default: true)
  maxResultLength?: number;       // Max result length to log (default: 10000)
}

/**
 * Tool Hook - Captures tool executions
 */
export class ToolHook {
  private static instance: ToolHook | null = null;
  private eventBus: EventBus;
  private config: ToolHookConfig;
  
  /**
   * Private constructor (Singleton)
   */
  private constructor(config: ToolHookConfig = {}) {
    this.eventBus = EventBus.getInstance();
    this.config = {
      enabled: config.enabled !== false,
      capturePermissions: config.capturePermissions !== false,
      maxResultLength: config.maxResultLength || 10000,
    };
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: ToolHookConfig): ToolHook {
    if (!ToolHook.instance) {
      ToolHook.instance = new ToolHook(config);
    }
    return ToolHook.instance;
  }
  
  /**
   * Enable/disable hook
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
  
  /**
   * Check if hook is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Capture tool call started
   * 
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @param sessionId - Current session ID
   * @returns Event ID for causation tracking
   */
  public async captureToolCallStarted(
    toolName: string,
    args: any,
    sessionId: number
  ): Promise<string> {
    if (!this.config.enabled) return '';
    
    const payload: ToolCallPayload = {
      tool_name: toolName,
      arguments: args,
      session_id: sessionId,
    };
    
    const result = await this.eventBus.emit({
      event_type: EventType.TOOL_CALL_STARTED,
      actor: `tool:${toolName}`,
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
    });
    
    return result.event_id;
  }
  
  /**
   * Capture tool call success
   * 
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @param result - Tool result
   * @param sessionId - Current session ID
   * @param durationMs - Execution duration
   * @param causationId - Parent event ID (from captureToolCallStarted)
   */
  public async captureToolCallSuccess(
    toolName: string,
    args: any,
    result: any,
    sessionId: number,
    durationMs?: number,
    causationId?: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    // Truncate result if too long
    let resultToLog = result;
    if (typeof result === 'string' && result.length > this.config.maxResultLength!) {
      resultToLog = result.substring(0, this.config.maxResultLength!) + '... (truncated)';
    }
    
    const payload: ToolCallPayload = {
      tool_name: toolName,
      arguments: args,
      result: resultToLog,
      duration_ms: durationMs,
      session_id: sessionId,
    };
    
    await this.eventBus.emit({
      event_type: EventType.TOOL_CALL_SUCCESS,
      actor: `tool:${toolName}`,
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
      causation_id: causationId,
    });
  }
  
  /**
   * Capture tool call failed
   * 
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @param error - Error message
   * @param sessionId - Current session ID
   * @param durationMs - Execution duration
   * @param causationId - Parent event ID
   */
  public async captureToolCallFailed(
    toolName: string,
    args: any,
    error: string,
    sessionId: number,
    durationMs?: number,
    causationId?: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    const payload: ToolCallPayload = {
      tool_name: toolName,
      arguments: args,
      error,
      duration_ms: durationMs,
      session_id: sessionId,
    };
    
    await this.eventBus.emit({
      event_type: EventType.TOOL_CALL_FAILED,
      actor: `tool:${toolName}`,
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
      causation_id: causationId,
    });
  }
  
  /**
   * Capture permission requested
   * 
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @param sessionId - Current session ID
   */
  public async capturePermissionRequested(
    toolName: string,
    args: any,
    sessionId: number
  ): Promise<void> {
    if (!this.config.enabled || !this.config.capturePermissions) return;
    
    const payload: ToolCallPayload = {
      tool_name: toolName,
      arguments: args,
      session_id: sessionId,
    };
    
    await this.eventBus.emit({
      event_type: EventType.TOOL_PERMISSION_REQUESTED,
      actor: 'user',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
    });
  }
  
  /**
   * Capture permission granted
   * 
   * @param toolName - Tool name
   * @param sessionId - Current session ID
   */
  public async capturePermissionGranted(
    toolName: string,
    sessionId: number
  ): Promise<void> {
    if (!this.config.enabled || !this.config.capturePermissions) return;
    
    await this.eventBus.emit({
      event_type: EventType.TOOL_PERMISSION_GRANTED,
      actor: 'user',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        tool_name: toolName,
        session_id: sessionId,
      },
    });
  }
  
  /**
   * Capture permission denied
   * 
   * @param toolName - Tool name
   * @param sessionId - Current session ID
   */
  public async capturePermissionDenied(
    toolName: string,
    sessionId: number
  ): Promise<void> {
    if (!this.config.enabled || !this.config.capturePermissions) return;
    
    await this.eventBus.emit({
      event_type: EventType.TOOL_PERMISSION_DENIED,
      actor: 'user',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        tool_name: toolName,
        session_id: sessionId,
      },
    });
  }
}

/**
 * Get tool hook instance (convenience)
 */
export function getToolHook(config?: ToolHookConfig): ToolHook {
  return ToolHook.getInstance(config);
}

/**
 * Export for use in other modules
 */
export default ToolHook;
