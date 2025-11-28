/**
 * Session Hook - Automatic Event Capture for Session Lifecycle
 * 
 * Captures all session lifecycle events (create, switch, rename, close)
 * and logs them to timeline.db.
 * 
 * Integration points:
 * - SessionManager.initSession()
 * - SessionManager.switchSession()
 * - SessionManager.renameSession()
 * - Application shutdown
 * 
 * @module timeline/hooks/session-hook
 * @version 1.0.0
 */

import { EventBus } from '../event-bus';
import { EventType } from '../event-types';
import type { SessionCreatedPayload } from '../event-types';

/**
 * Session Hook Configuration
 */
export interface SessionHookConfig {
  enabled?: boolean;  // Enable/disable hook
}

/**
 * Session Hook - Captures session lifecycle
 */
export class SessionHook {
  private static instance: SessionHook | null = null;
  private eventBus: EventBus;
  private config: SessionHookConfig;
  
  /**
   * Private constructor (Singleton)
   */
  private constructor(config: SessionHookConfig = {}) {
    this.eventBus = EventBus.getInstance();
    this.config = {
      enabled: config.enabled !== false,
    };
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: SessionHookConfig): SessionHook {
    if (!SessionHook.instance) {
      SessionHook.instance = new SessionHook(config);
    }
    return SessionHook.instance;
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
   * Capture session created
   * 
   * @param sessionId - New session ID
   * @param sessionName - Session name
   * @param workingDir - Working directory
   * @param model - Initial model
   * @param provider - Initial provider
   */
  public async captureSessionCreated(
    sessionId: number,
    sessionName: string,
    workingDir: string,
    model?: string,
    provider?: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    const payload: SessionCreatedPayload = {
      session_id: sessionId,
      session_name: sessionName,
      working_dir: workingDir,
      model,
      provider,
    };
    
    await this.eventBus.emit({
      event_type: EventType.SESSION_CREATED,
      actor: 'system',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
    });
  }
  
  /**
   * Capture session switched
   * 
   * @param fromSessionId - Previous session ID
   * @param toSessionId - New session ID
   * @param toWorkingDir - New working directory
   */
  public async captureSessionSwitched(
    fromSessionId: number,
    toSessionId: number,
    toWorkingDir: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.eventBus.emit({
      event_type: EventType.SESSION_SWITCHED,
      actor: 'user',
      aggregate_id: toSessionId.toString(),
      aggregate_type: 'session',
      payload: {
        from_session_id: fromSessionId,
        to_session_id: toSessionId,
        to_working_dir: toWorkingDir,
      },
    });
  }
  
  /**
   * Capture session renamed
   * 
   * @param sessionId - Session ID
   * @param oldName - Old session name
   * @param newName - New session name
   */
  public async captureSessionRenamed(
    sessionId: number,
    oldName: string,
    newName: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.eventBus.emit({
      event_type: EventType.SESSION_RENAMED,
      actor: 'user',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        session_id: sessionId,
        old_name: oldName,
        new_name: newName,
      },
    });
  }
  
  /**
   * Capture session closed
   * 
   * @param sessionId - Session ID
   * @param reason - Close reason (optional)
   */
  public async captureSessionClosed(
    sessionId: number,
    reason?: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.eventBus.emit({
      event_type: EventType.SESSION_CLOSED,
      actor: 'user',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        session_id: sessionId,
        reason,
      },
    });
  }
  
  /**
   * Capture session restored (from rewind)
   * 
   * @param sessionId - Session ID
   * @param fromTimestamp - Rewind target timestamp
   * @param outputDir - Restored output directory
   */
  public async captureSessionRestored(
    sessionId: number,
    fromTimestamp: number,
    outputDir: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.eventBus.emit({
      event_type: EventType.SESSION_RESTORED,
      actor: 'system',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        session_id: sessionId,
        from_timestamp: fromTimestamp,
        output_dir: outputDir,
        timestamp_human: new Date(fromTimestamp / 1000).toISOString(),
      },
    });
  }
}

/**
 * Get session hook instance (convenience)
 */
export function getSessionHook(config?: SessionHookConfig): SessionHook {
  return SessionHook.getInstance(config);
}

/**
 * Export for use in other modules
 */
export default SessionHook;
