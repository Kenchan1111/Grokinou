/**
 * Event Bus
 * 
 * Central event dispatcher for the entire application.
 * ALL state mutations MUST go through this bus.
 * 
 * Architecture:
 * - Event-First: Events are logged BEFORE state changes
 * - CQRS: Separates writes (timeline) from reads (conversations.db)
 * - Causality: Tracks event chains via correlation_id and causation_id
 * 
 * Benefits:
 * - Single source of truth (timeline.db)
 * - Complete audit trail
 * - Time travel capability
 * - No synchronization issues
 * 
 * @module timeline/event-bus
 * @version 1.0.0
 */

import crypto from 'crypto';
import { TimelineLogger, EventInput, LogResult } from './timeline-logger.js';
import { EventType, Event } from './event-types.js';

/**
 * Event Listener Function
 */
export type EventListener = (event: Event) => void | Promise<void>;

/**
 * Event Bus Options
 */
export interface EventBusOptions {
  enableLogging?: boolean;        // Enable timeline logging (default: true)
  enableProjections?: boolean;    // Enable projections to conversations.db (default: true)
}

/**
 * Event Bus
 * 
 * Singleton pattern for consistent event dispatching.
 */
export class EventBus {
  private static instance: EventBus | null = null;
  private logger: TimelineLogger;
  private listeners: Map<EventType, EventListener[]> = new Map();
  private globalListeners: EventListener[] = [];
  private options: EventBusOptions;
  
  /**
   * Private constructor (Singleton)
   */
  private constructor(options: EventBusOptions = {}) {
    this.logger = TimelineLogger.getInstance();
    this.options = {
      enableLogging: options.enableLogging !== false,
      enableProjections: options.enableProjections !== false,
    };
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(options?: EventBusOptions): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus(options);
    }
    return EventBus.instance;
  }
  
  /**
   * Emit an event
   * 
   * This is the MAIN entry point for all state changes.
   * 
   * Flow:
   * 1. Log to timeline.db (immutable)
   * 2. Notify listeners (projections, UI updates, etc.)
   * 3. Return event ID for causality tracking
   * 
   * @param input - Event data
   * @returns LogResult with event ID
   */
  public async emit(input: EventInput): Promise<LogResult> {
    try {
      // 1. Log to timeline (immutable source of truth)
      let logResult: LogResult = {
        success: false,
        event_id: '',
        sequence_number: 0,
      };
      
      if (this.options.enableLogging) {
        logResult = await this.logger.log(input);

        if (!logResult.success) {
          // Log timeline errors for debugging
          console.error('[EventBus] Timeline logging FAILED:', input.event_type, logResult.error);
          return logResult;
        }
      }
      
      // 2. Construct full event object
      const fullEvent: Event = {
        id: logResult.event_id,
        timestamp: Date.now() * 1000,
        sequence_number: logResult.sequence_number,
        actor: input.actor,
        event_type: input.event_type,
        aggregate_id: input.aggregate_id,
        aggregate_type: input.aggregate_type,
        payload: input.payload,
        correlation_id: input.correlation_id,
        causation_id: input.causation_id,
        metadata: input.metadata,
        checksum: crypto.createHash('sha256').update(JSON.stringify(input.payload)).digest('hex'),
      };
      
      // 3. Notify listeners (async, non-blocking)
      this.notifyListeners(fullEvent);
      
      return logResult;
    } catch (error: any) {
      console.error('❌ EventBus.emit failed:', error);
      return {
        success: false,
        event_id: '',
        sequence_number: 0,
        error: error.message,
      };
    }
  }
  
  /**
   * Emit multiple events atomically (transaction)
   * 
   * All events succeed or all fail together.
   */
  public async emitBatch(inputs: EventInput[]): Promise<LogResult[]> {
    if (this.options.enableLogging) {
      const results = await this.logger.logBatch(inputs);
      
      // Notify listeners for each successful event
      for (let i = 0; i < results.length; i++) {
        if (results[i].success) {
          const fullEvent: Event = {
            id: results[i].event_id,
            timestamp: Date.now() * 1000,
            sequence_number: results[i].sequence_number,
            actor: inputs[i].actor,
            event_type: inputs[i].event_type,
            aggregate_id: inputs[i].aggregate_id,
            aggregate_type: inputs[i].aggregate_type,
            payload: inputs[i].payload,
            correlation_id: inputs[i].correlation_id,
            causation_id: inputs[i].causation_id,
            metadata: inputs[i].metadata,
            checksum: crypto.createHash('sha256').update(JSON.stringify(inputs[i].payload)).digest('hex'),
          };
          
          this.notifyListeners(fullEvent);
        }
      }
      
      return results;
    }
    
    return inputs.map(() => ({
      success: false,
      event_id: '',
      sequence_number: 0,
      error: 'Timeline logging is disabled'
    }));
  }
  
  /**
   * Subscribe to specific event type
   * 
   * @param eventType - Event type to listen for
   * @param listener - Callback function
   */
  public on(eventType: EventType, listener: EventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }
  
  /**
   * Subscribe to all events
   * 
   * @param listener - Callback function
   */
  public onAny(listener: EventListener): void {
    this.globalListeners.push(listener);
  }
  
  /**
   * Unsubscribe from event type
   * 
   * @param eventType - Event type
   * @param listener - Callback to remove
   */
  public off(eventType: EventType, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  /**
   * Unsubscribe from all events
   * 
   * @param listener - Callback to remove
   */
  public offAny(listener: EventListener): void {
    const index = this.globalListeners.indexOf(listener);
    if (index !== -1) {
      this.globalListeners.splice(index, 1);
    }
  }
  
  /**
   * Notify all listeners (async, non-blocking)
   * 
   * @private
   */
  private notifyListeners(event: Event): void {
    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.event_type) || [];
    for (const listener of typeListeners) {
      setImmediate(() => {
        try {
          listener(event);
        } catch (error) {
          console.error(`❌ Event listener error (${event.event_type}):`, error);
        }
      });
    }
    
    // Notify global listeners
    for (const listener of this.globalListeners) {
      setImmediate(() => {
        try {
          listener(event);
        } catch (error) {
          console.error('❌ Global event listener error:', error);
        }
      });
    }
  }
  
  /**
   * Generate correlation ID for transaction tracking
   * 
   * Use this when multiple related events form a logical transaction.
   * Example: Tool call → File modifications → Git commit
   */
  public generateCorrelationId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * Get event bus statistics
   */
  public getStats(): {
    listeners_count: number;
    global_listeners_count: number;
    event_types_subscribed: number;
  } {
    let totalListeners = 0;
    for (const listeners of this.listeners.values()) {
      totalListeners += listeners.length;
    }
    
    return {
      listeners_count: totalListeners,
      global_listeners_count: this.globalListeners.length,
      event_types_subscribed: this.listeners.size,
    };
  }
}

/**
 * Get event bus instance (convenience)
 */
export function getEventBus(options?: EventBusOptions): EventBus {
  return EventBus.getInstance(options);
}

/**
 * Export for use in other modules
 */
export default EventBus;
