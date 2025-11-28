/**
 * Query Engine - Timeline Event Querying
 * 
 * Provides powerful query capabilities over the timeline event log.
 * Supports filtering by time range, event type, actor, aggregate, etc.
 * 
 * Features:
 * - Time range queries
 * - Event type filtering
 * - Actor/aggregate filtering
 * - Pagination support
 * - Aggregation queries
 * - Causation chain traversal
 * 
 * @module timeline/query-engine
 * @version 1.0.0
 */

import { TimelineDatabase } from './database.js';
import { EventType, EventCategory, isEventInCategory } from './event-types.js';
import type { TimelineEvent } from './event-types.js';

/**
 * Query filter options
 */
export interface QueryFilter {
  /**
   * Start timestamp (inclusive)
   */
  startTime?: number;

  /**
   * End timestamp (inclusive)
   */
  endTime?: number;

  /**
   * Filter by event types
   */
  eventTypes?: EventType[];

  /**
   * Filter by event categories
   */
  categories?: EventCategory[];

  /**
   * Filter by actor
   */
  actor?: string;

  /**
   * Filter by aggregate ID
   */
  aggregateId?: string;

  /**
   * Filter by aggregate type
   */
  aggregateType?: string;

  /**
   * Filter by session ID
   */
  sessionId?: number;

  /**
   * Limit number of results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Sort order (default: 'asc')
   */
  order?: 'asc' | 'desc';
}

/**
 * Query result with pagination info
 */
export interface QueryResult {
  events: TimelineEvent[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

/**
 * Event statistics
 */
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByCategory: Record<string, number>;
  eventsByActor: Record<string, number>;
  timeRange: {
    earliest: number;
    latest: number;
  };
}

/**
 * Causation chain entry
 */
export interface CausationChainEntry {
  event: TimelineEvent;
  depth: number;
  children: CausationChainEntry[];
}

/**
 * Query Engine for timeline events
 */
export class QueryEngine {
  private static instance: QueryEngine;
  private db: TimelineDatabase;

  private constructor() {
    this.db = TimelineDatabase.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): QueryEngine {
    if (!QueryEngine.instance) {
      QueryEngine.instance = new QueryEngine();
    }
    return QueryEngine.instance;
  }

  /**
   * Query events with filters
   */
  query(filter: QueryFilter = {}): QueryResult {
    const {
      startTime,
      endTime,
      eventTypes,
      categories,
      actor,
      aggregateId,
      aggregateType,
      sessionId,
      limit = 100,
      offset = 0,
      order = 'asc',
    } = filter;

    // Build WHERE clauses
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (startTime !== undefined) {
      whereClauses.push('timestamp >= ?');
      params.push(startTime);
    }

    if (endTime !== undefined) {
      whereClauses.push('timestamp <= ?');
      params.push(endTime);
    }

    if (eventTypes && eventTypes.length > 0) {
      whereClauses.push(`event_type IN (${eventTypes.map(() => '?').join(', ')})`);
      params.push(...eventTypes);
    }

    if (categories && categories.length > 0) {
      // Get all event types in these categories
      const categoryEventTypes = new Set<EventType>();
      for (const category of categories) {
        const types = this.getEventTypesInCategory(category);
        types.forEach(t => categoryEventTypes.add(t));
      }
      
      if (categoryEventTypes.size > 0) {
        const types = Array.from(categoryEventTypes);
        whereClauses.push(`event_type IN (${types.map(() => '?').join(', ')})`);
        params.push(...types);
      }
    }

    if (actor) {
      whereClauses.push('actor = ?');
      params.push(actor);
    }

    if (aggregateId) {
      whereClauses.push('aggregate_id = ?');
      params.push(aggregateId);
    }

    if (aggregateType) {
      whereClauses.push('aggregate_type = ?');
      params.push(aggregateType);
    }

    if (sessionId !== undefined) {
      whereClauses.push("json_extract(payload, '$.session_id') = ?");
      params.push(sessionId);
    }

    const whereClause = whereClauses.length > 0 
      ? `WHERE ${whereClauses.join(' AND ')}` 
      : '';

    // Count total matching events
    const countSql = `SELECT COUNT(*) as count FROM timeline_events ${whereClause}`;
    const countResult = this.db.getConnection().prepare(countSql).get(...params) as { count: number };
    const total = countResult.count;

    // Get paginated events
    const querySql = `
      SELECT * FROM timeline_events 
      ${whereClause}
      ORDER BY timestamp ${order.toUpperCase()}, sequence_number ${order.toUpperCase()}
      LIMIT ? OFFSET ?
    `;
    
    const rows = this.db.getConnection().prepare(querySql).all(...params, limit, offset);
    
    const events: TimelineEvent[] = rows.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      sequence_number: row.sequence_number,
      event_type: row.event_type as EventType,
      actor: row.actor,
      aggregate_id: row.aggregate_id,
      aggregate_type: row.aggregate_type,
      causation_id: row.causation_id,
      correlation_id: row.correlation_id,
      payload: JSON.parse(row.payload),
    }));

    return {
      events,
      total,
      hasMore: offset + events.length < total,
      offset,
      limit,
    };
  }

  /**
   * Get event types in a category
   */
  private getEventTypesInCategory(category: EventCategory): EventType[] {
    const types: EventType[] = [];
    for (const type of Object.values(EventType)) {
      if (isEventInCategory(type, category)) {
        types.push(type);
      }
    }
    return types;
  }

  /**
   * Get event by ID
   */
  getEventById(id: string): TimelineEvent | null {
    const row = this.db.getConnection()
      .prepare('SELECT * FROM timeline_events WHERE id = ?')
      .get(id);
    
    if (!row) return null;
    
    const r = row as any;
    return {
      id: r.id,
      timestamp: r.timestamp,
      sequence_number: r.sequence_number,
      event_type: r.event_type as EventType,
      actor: r.actor,
      aggregate_id: r.aggregate_id,
      aggregate_type: r.aggregate_type,
      causation_id: r.causation_id,
      correlation_id: r.correlation_id,
      payload: JSON.parse(r.payload),
    };
  }

  /**
   * Get causation chain (all events caused by a root event)
   */
  getCausationChain(rootEventId: string): CausationChainEntry | null {
    const rootEvent = this.getEventById(rootEventId);
    if (!rootEvent) return null;

    return this.buildCausationChain(rootEvent, 0);
  }

  /**
   * Build causation chain recursively
   */
  private buildCausationChain(event: TimelineEvent, depth: number): CausationChainEntry {
    // Find all events caused by this event
    const childRows = this.db.getConnection()
      .prepare('SELECT * FROM timeline_events WHERE causation_id = ? ORDER BY timestamp ASC')
      .all(event.id);
    
    const children: CausationChainEntry[] = childRows.map((row: any) => {
      const childEvent: TimelineEvent = {
        id: row.id,
        timestamp: row.timestamp,
        sequence_number: row.sequence_number,
        event_type: row.event_type as EventType,
        actor: row.actor,
        aggregate_id: row.aggregate_id,
        aggregate_type: row.aggregate_type,
        causation_id: row.causation_id,
        correlation_id: row.correlation_id,
        payload: JSON.parse(row.payload),
      };
      return this.buildCausationChain(childEvent, depth + 1);
    });

    return {
      event,
      depth,
      children,
    };
  }

  /**
   * Get correlation chain (all events with the same correlation ID)
   */
  getCorrelationChain(correlationId: string): TimelineEvent[] {
    const rows = this.db.getConnection()
      .prepare('SELECT * FROM timeline_events WHERE correlation_id = ? ORDER BY timestamp ASC')
      .all(correlationId);
    
    return rows.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      sequence_number: row.sequence_number,
      event_type: row.event_type as EventType,
      actor: row.actor,
      aggregate_id: row.aggregate_id,
      aggregate_type: row.aggregate_type,
      causation_id: row.causation_id,
      correlation_id: row.correlation_id,
      payload: JSON.parse(row.payload),
    }));
  }

  /**
   * Get events for a specific session
   */
  getSessionEvents(sessionId: number, filter?: Omit<QueryFilter, 'sessionId'>): QueryResult {
    return this.query({
      ...filter,
      sessionId,
    });
  }

  /**
   * Get events for a specific file
   */
  getFileEvents(filePath: string, filter?: Omit<QueryFilter, 'aggregateId'>): QueryResult {
    return this.query({
      ...filter,
      aggregateId: filePath,
      aggregateType: 'file',
    });
  }

  /**
   * Get statistics about events
   */
  getStats(filter?: Omit<QueryFilter, 'limit' | 'offset' | 'order'>): EventStats {
    const { events } = this.query({ ...filter, limit: 999999 });
    
    const eventsByType: Record<string, number> = {};
    const eventsByCategory: Record<string, number> = {};
    const eventsByActor: Record<string, number> = {};
    let earliest = Infinity;
    let latest = -Infinity;

    for (const event of events) {
      // Count by type
      eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;

      // Count by category
      for (const category of Object.values(EventCategory) as EventCategory[]) {
        if (isEventInCategory(event.event_type, category)) {
          const catKey = category as string;
          eventsByCategory[catKey] = (eventsByCategory[catKey] || 0) + 1;
        }
      }

      // Count by actor
      eventsByActor[event.actor] = (eventsByActor[event.actor] || 0) + 1;

      // Track time range
      earliest = Math.min(earliest, event.timestamp);
      latest = Math.max(latest, event.timestamp);
    }

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByCategory,
      eventsByActor,
      timeRange: {
        earliest: earliest === Infinity ? 0 : earliest,
        latest: latest === -Infinity ? 0 : latest,
      },
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): TimelineEvent[] {
    const { events } = this.query({ limit, order: 'desc' });
    return events;
  }

  /**
   * Search events by text in payload
   */
  searchPayload(searchTerm: string, filter?: QueryFilter): QueryResult {
    const allResults = this.query({ ...filter, limit: 999999 });
    
    const searchLower = searchTerm.toLowerCase();
    const matchingEvents = allResults.events.filter(event => {
      const payloadStr = JSON.stringify(event.payload).toLowerCase();
      return payloadStr.includes(searchLower);
    });

    const { limit = 100, offset = 0 } = filter || {};
    const paginatedEvents = matchingEvents.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total: matchingEvents.length,
      hasMore: offset + paginatedEvents.length < matchingEvents.length,
      offset,
      limit,
    };
  }

  /**
   * Get events around a specific timestamp (before + after)
   */
  getEventsAroundTime(timestamp: number, before: number = 10, after: number = 10): TimelineEvent[] {
    const beforeEvents = this.query({
      endTime: timestamp,
      limit: before,
      order: 'desc',
    }).events.reverse();

    const afterEvents = this.query({
      startTime: timestamp + 1,
      limit: after,
      order: 'asc',
    }).events;

    return [...beforeEvents, ...afterEvents];
  }
}

/**
 * Get QueryEngine singleton instance
 */
export function getQueryEngine(): QueryEngine {
  return QueryEngine.getInstance();
}
