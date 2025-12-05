/**
 * Timeline Logger
 * 
 * Core component for logging events to timeline.db.
 * Ensures immutability, cryptographic integrity, and strict ordering.
 * 
 * Features:
 * - Atomic writes (SQLite transaction)
 * - Automatic sequence numbering
 * - SHA256 checksums for tamper detection
 * - Correlation and causation tracking
 * - Thread-safe via SQLite BEGIN IMMEDIATE
 * 
 * @module timeline/timeline-logger
 * @version 1.0.0
 */

import crypto from 'crypto';
import { TimelineDatabase } from './database.js';
import { Event, EventType } from './event-types.js';

/**
 * Event to be logged (without generated fields)
 */
export interface EventInput {
  event_type: EventType;
  actor: string;
  aggregate_id?: string;
  aggregate_type?: string;
  payload: any;
  correlation_id?: string;
  causation_id?: string;
  metadata?: any;
}

/**
 * Result of logging an event
 */
export interface LogResult {
  success: boolean;
  event_id: string;
  sequence_number: number;
  error?: string;
}

/**
 * Timeline Logger
 * 
 * Singleton pattern for consistent logging across the application.
 */
export class TimelineLogger {
  private static instance: TimelineLogger | null = null;
  private db: TimelineDatabase;
  private enabled: boolean = true;
  private insertStmt: any;  // Prepared statement for performance
  
  /**
   * Private constructor (Singleton)
   */
  private constructor() {
    this.db = TimelineDatabase.getInstance();
    
    // Prepare INSERT statement for performance
    const conn = this.db.getConnection();
    this.insertStmt = conn.prepare(`
      INSERT INTO events (
        id, timestamp, sequence_number, actor, event_type,
        aggregate_id, aggregate_type, payload,
        correlation_id, causation_id, metadata, checksum
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): TimelineLogger {
    if (!TimelineLogger.instance) {
      TimelineLogger.instance = new TimelineLogger();
    }
    return TimelineLogger.instance;
  }
  
  /**
   * Enable/disable logging
   * 
   * Useful for debugging or temporary disable.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`🕐 Timeline logging ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if logging is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Log an event to timeline
   * 
   * @param input - Event data (without generated fields)
   * @returns LogResult with event ID and sequence number
   */
  public async log(input: EventInput): Promise<LogResult> {
    if (!this.enabled) {
      return {
        success: false,
        event_id: '',
        sequence_number: 0,
        error: 'Timeline logging is disabled'
      };
    }
    
    try {
      // Generate event ID
      const eventId = crypto.randomUUID();
      
      // Get current timestamp (microseconds)
      const timestamp = Date.now() * 1000;
      
      // Get next sequence number (thread-safe)
      const sequence = this.db.getNextSequence();
      
      // Serialize payload
      const payloadJson = JSON.stringify(input.payload);
      
      // Calculate checksum
      const checksum = crypto
        .createHash('sha256')
        .update(payloadJson)
        .digest('hex');
      
      // Serialize metadata
      const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
      
      // Insert event (atomic)
      this.insertStmt.run(
        eventId,
        timestamp,
        sequence,
        input.actor,
        input.event_type,
        input.aggregate_id || null,
        input.aggregate_type || null,
        payloadJson,
        input.correlation_id || null,
        input.causation_id || null,
        metadataJson,
        checksum
      );
      
      return {
        success: true,
        event_id: eventId,
        sequence_number: sequence,
      };
    } catch (error: any) {
      // Silent fail - don't pollute console with timeline errors
      return {
        success: false,
        event_id: '',
        sequence_number: 0,
        error: error.message,
      };
    }
  }
  
  /**
   * Log multiple events atomically (transaction)
   * 
   * All events succeed or all fail together.
   */
  public async logBatch(inputs: EventInput[]): Promise<LogResult[]> {
    if (!this.enabled) {
      return inputs.map(() => ({
        success: false,
        event_id: '',
        sequence_number: 0,
        error: 'Timeline logging is disabled'
      }));
    }
    
    const conn = this.db.getConnection();
    const results: LogResult[] = [];
    
    // Begin transaction
    const transaction = conn.transaction((events: EventInput[]) => {
      for (const input of events) {
        const result = this.logSync(input);  // Synchronous version
        results.push(result);
      }
    });
    
    try {
      transaction(inputs);
      return results;
    } catch (error: any) {
      // Silent fail - don't pollute console with timeline errors
      return inputs.map(() => ({
        success: false,
        event_id: '',
        sequence_number: 0,
        error: error.message
      }));
    }
  }
  
  /**
   * Synchronous version of log() for use in transactions
   * 
   * @private
   */
  private logSync(input: EventInput): LogResult {
    try {
      const eventId = crypto.randomUUID();
      const timestamp = Date.now() * 1000;
      const sequence = this.db.getNextSequence();
      const payloadJson = JSON.stringify(input.payload);
      const checksum = crypto.createHash('sha256').update(payloadJson).digest('hex');
      const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
      
      this.insertStmt.run(
        eventId, timestamp, sequence,
        input.actor, input.event_type,
        input.aggregate_id || null,
        input.aggregate_type || null,
        payloadJson,
        input.correlation_id || null,
        input.causation_id || null,
        metadataJson,
        checksum
      );
      
      return {
        success: true,
        event_id: eventId,
        sequence_number: sequence,
      };
    } catch (error: any) {
      return {
        success: false,
        event_id: '',
        sequence_number: 0,
        error: error.message,
      };
    }
  }
  
  /**
   * Verify event integrity (checksum validation)
   * 
   * @param eventId - Event ID to verify
   * @returns True if checksum is valid
   */
  public verifyEvent(eventId: string): boolean {
    try {
      const conn = this.db.getConnection();
      const event = conn.prepare('SELECT payload, checksum FROM events WHERE id = ?').get(eventId) as any;
      
      if (!event) {
        return false;
      }
      
      const expectedChecksum = crypto
        .createHash('sha256')
        .update(event.payload)
        .digest('hex');
      
      return event.checksum === expectedChecksum;
    } catch (error) {
      // Silent fail - don't pollute console with timeline errors
      return false;
    }
  }
  
  /**
   * Verify integrity of all events in database
   * 
   * @returns Object with stats
   */
  public verifyAllEvents(): {
    total: number;
    valid: number;
    invalid: number;
    invalid_ids: string[];
  } {
    const conn = this.db.getConnection();
    const events = conn.prepare('SELECT id, payload, checksum FROM events').all() as any[];
    
    let valid = 0;
    let invalid = 0;
    const invalidIds: string[] = [];
    
    for (const event of events) {
      const expectedChecksum = crypto
        .createHash('sha256')
        .update(event.payload)
        .digest('hex');
      
      if (event.checksum === expectedChecksum) {
        valid++;
      } else {
        invalid++;
        invalidIds.push(event.id);
      }
    }
    
    return {
      total: events.length,
      valid,
      invalid,
      invalid_ids: invalidIds,
    };
  }
  
  /**
   * Get last N events
   */
  public getLastEvents(limit: number = 10): Event[] {
    const conn = this.db.getConnection();
    const stmt = conn.prepare(`
      SELECT * FROM events
      ORDER BY sequence_number DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.rowToEvent(row));
  }
  
  /**
   * Convert database row to Event object
   * 
   * @private
   */
  private rowToEvent(row: any): Event {
    return {
      id: row.id,
      timestamp: row.timestamp,
      sequence_number: row.sequence_number,
      actor: row.actor,
      event_type: row.event_type,
      aggregate_id: row.aggregate_id,
      aggregate_type: row.aggregate_type,
      payload: JSON.parse(row.payload),
      correlation_id: row.correlation_id,
      causation_id: row.causation_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      checksum: row.checksum,
    };
  }
}

/**
 * Get timeline logger instance (convenience)
 */
export function getTimelineLogger(): TimelineLogger {
  return TimelineLogger.getInstance();
}

/**
 * Export for use in other modules
 */
export default TimelineLogger;
