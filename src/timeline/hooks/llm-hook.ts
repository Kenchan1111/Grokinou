/**
 * LLM Hook - Automatic Event Capture for LLM Messages
 * 
 * Captures all LLM interactions (user messages, assistant responses, system messages)
 * and logs them to timeline.db.
 * 
 * Integration points:
 * - GrokAgent.sendMessage() - User messages
 * - GrokAgent streaming - Assistant responses
 * - System message updates
 * 
 * @module timeline/hooks/llm-hook
 * @version 1.0.0
 */

import { EventBus } from '../event-bus.js';
import { EventType } from '../event-types.js';
import type { LLMMessagePayload } from '../event-types.js';

/**
 * LLM Hook Configuration
 */
export interface LLMHookConfig {
  enabled?: boolean;           // Enable/disable hook (default: true)
  captureStreaming?: boolean;  // Capture streaming chunks (default: false, too verbose)
  minContentLength?: number;   // Min content length to log (default: 0)
}

/**
 * LLM Hook - Captures LLM messages
 */
export class LLMHook {
  private static instance: LLMHook | null = null;
  private eventBus: EventBus;
  private config: LLMHookConfig;
  
  /**
   * Private constructor (Singleton)
   */
  private constructor(config: LLMHookConfig = {}) {
    this.eventBus = EventBus.getInstance();
    this.config = {
      enabled: config.enabled !== false,
      captureStreaming: config.captureStreaming || false,
      minContentLength: config.minContentLength || 0,
    };
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: LLMHookConfig): LLMHook {
    if (!LLMHook.instance) {
      LLMHook.instance = new LLMHook(config);
    }
    return LLMHook.instance;
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
   * Capture user message
   * 
   * Call this when user sends a message to LLM.
   * 
   * @param content - User message content
   * @param sessionId - Current session ID
   * @param model - Model name
   * @param provider - Provider name
   * @param tokenCount - Optional token count
   */
  public async captureUserMessage(
    content: string,
    sessionId: number,
    model: string,
    provider: string,
    tokenCount?: number
  ): Promise<void> {
    if (!this.config.enabled) return;
    if (content.length < this.config.minContentLength) return;
    
    const payload: LLMMessagePayload = {
      role: 'user',
      content,
      session_id: sessionId,
      model,
      provider,
      token_count: tokenCount,
    };
    
    await this.eventBus.emit({
      event_type: EventType.LLM_MESSAGE_USER,
      actor: 'user',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
    });
  }
  
  /**
   * Capture assistant message
   * 
   * Call this when LLM sends a response (after streaming completes).
   * 
   * @param content - Assistant response content
   * @param sessionId - Current session ID
   * @param model - Model name
   * @param provider - Provider name
   * @param tokenCount - Optional token count
   */
  public async captureAssistantMessage(
    content: string,
    sessionId: number,
    model: string,
    provider: string,
    tokenCount?: number
  ): Promise<void> {
    if (!this.config.enabled) return;
    if (content.length < this.config.minContentLength) return;
    
    const payload: LLMMessagePayload = {
      role: 'assistant',
      content,
      session_id: sessionId,
      model,
      provider,
      token_count: tokenCount,
    };
    
    await this.eventBus.emit({
      event_type: EventType.LLM_MESSAGE_ASSISTANT,
      actor: `llm:${model}`,
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
    });
  }
  
  /**
   * Capture system message
   * 
   * Call this when system message is set/updated.
   * 
   * @param content - System message content
   * @param sessionId - Current session ID
   * @param model - Model name
   * @param provider - Provider name
   */
  public async captureSystemMessage(
    content: string,
    sessionId: number,
    model: string,
    provider: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    const payload: LLMMessagePayload = {
      role: 'system',
      content,
      session_id: sessionId,
      model,
      provider,
    };
    
    await this.eventBus.emit({
      event_type: EventType.LLM_MESSAGE_SYSTEM,
      actor: 'system',
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload,
    });
  }
  
  /**
   * Capture streaming start
   * 
   * Optional: Call when streaming starts (if captureStreaming enabled).
   */
  public async captureStreamingStart(
    sessionId: number,
    model: string,
    provider: string
  ): Promise<void> {
    if (!this.config.enabled || !this.config.captureStreaming) return;
    
    await this.eventBus.emit({
      event_type: EventType.LLM_STREAMING_START,
      actor: `llm:${model}`,
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        session_id: sessionId,
        model,
        provider,
      },
    });
  }
  
  /**
   * Capture streaming end
   * 
   * Optional: Call when streaming completes (if captureStreaming enabled).
   */
  public async captureStreamingEnd(
    sessionId: number,
    model: string,
    provider: string,
    totalTokens?: number
  ): Promise<void> {
    if (!this.config.enabled || !this.config.captureStreaming) return;
    
    await this.eventBus.emit({
      event_type: EventType.LLM_STREAMING_END,
      actor: `llm:${model}`,
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        session_id: sessionId,
        model,
        provider,
        token_count: totalTokens,
      },
    });
  }
  
  /**
   * Capture LLM error
   * 
   * Call this when LLM request fails.
   */
  public async captureError(
    error: Error,
    sessionId: number,
    model: string,
    provider: string
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.eventBus.emit({
      event_type: EventType.LLM_ERROR,
      actor: `llm:${model}`,
      aggregate_id: sessionId.toString(),
      aggregate_type: 'session',
      payload: {
        session_id: sessionId,
        model,
        provider,
        error: error.message,
        stack: error.stack,
      },
    });
  }
}

/**
 * Get LLM hook instance (convenience)
 */
export function getLLMHook(config?: LLMHookConfig): LLMHook {
  return LLMHook.getInstance(config);
}

/**
 * Export for use in other modules
 */
export default LLMHook;
