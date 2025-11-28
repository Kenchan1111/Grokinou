/**
 * Timeline Query Tool - LLM Tool for querying timeline events
 * 
 * Allows the LLM to query the timeline database to understand:
 * - What happened in a session
 * - What files were modified
 * - What git operations occurred
 * - Conversation history
 * - Tool executions
 * 
 * @module tools/timeline-query-tool
 * @version 1.0.0
 */

import { 
  getQueryEngine, 
  EventType,
  EventCategory,
  type QueryFilter,
  getEventDescription,
} from '../timeline/index.js';

/**
 * Timeline query tool parameters
 */
export interface TimelineQueryParams {
  /**
   * Start timestamp (ISO string or milliseconds)
   */
  startTime?: string | number;

  /**
   * End timestamp (ISO string or milliseconds)
   */
  endTime?: string | number;

  /**
   * Event categories to filter (SESSION, LLM, TOOL, FILE, GIT, REWIND)
   */
  categories?: string[];

  /**
   * Specific event types to filter
   */
  eventTypes?: string[];

  /**
   * Filter by actor (e.g., 'user', 'system', 'git:user')
   */
  actor?: string;

  /**
   * Filter by session ID
   */
  sessionId?: number;

  /**
   * Filter by aggregate (e.g., file path)
   */
  aggregateId?: string;

  /**
   * Maximum number of results (default: 100, max: 1000)
   */
  limit?: number;

  /**
   * Search text in event payloads
   */
  searchText?: string;

  /**
   * Sort order: 'asc' or 'desc' (default: 'desc' - newest first)
   */
  order?: 'asc' | 'desc';

  /**
   * Get statistics instead of events
   */
  statsOnly?: boolean;
}

/**
 * Timeline query result
 */
export interface TimelineQueryResult {
  success: boolean;
  query: TimelineQueryParams;
  
  // Event results
  events?: Array<{
    id: string;
    timestamp: string;
    timestampMs: number;
    eventType: string;
    description: string;
    actor: string;
    aggregate: string;
    payload: any;
  }>;
  
  // Statistics
  stats?: {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByCategory: Record<string, number>;
    eventsByActor: Record<string, number>;
    timeRange: {
      earliest: string;
      earliestMs: number;
      latest: string;
      latestMs: number;
    };
  };

  // Pagination
  hasMore?: boolean;
  total?: number;

  error?: string;
}

/**
 * Parse timestamp from string or number
 */
function parseTimestamp(input: string | number | undefined): number | undefined {
  if (input === undefined) return undefined;
  
  if (typeof input === 'number') {
    return input;
  }
  
  // Try to parse ISO string
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${input}`);
  }
  
  return date.getTime();
}

/**
 * Parse event categories
 */
function parseCategories(categories: string[] | undefined): EventCategory[] | undefined {
  if (!categories || categories.length === 0) return undefined;
  
  const validCategories: EventCategory[] = [];
  for (const cat of categories) {
    const upper = cat.toUpperCase();
    if (upper in EventCategory) {
      validCategories.push(EventCategory[upper as keyof typeof EventCategory]);
    }
  }
  
  return validCategories.length > 0 ? validCategories : undefined;
}

/**
 * Parse event types
 */
function parseEventTypes(types: string[] | undefined): EventType[] | undefined {
  if (!types || types.length === 0) return undefined;
  
  const validTypes: EventType[] = [];
  for (const type of types) {
    const upper = type.toUpperCase();
    if (upper in EventType) {
      validTypes.push(EventType[upper as keyof typeof EventType]);
    }
  }
  
  return validTypes.length > 0 ? validTypes : undefined;
}

/**
 * Execute timeline query
 */
export async function executeTimelineQuery(params: TimelineQueryParams): Promise<TimelineQueryResult> {
  try {
    const queryEngine = getQueryEngine();
    
    // Parse timestamps
    const startTime = parseTimestamp(params.startTime);
    const endTime = parseTimestamp(params.endTime);
    
    // Parse categories and event types
    const categories = parseCategories(params.categories);
    const eventTypes = parseEventTypes(params.eventTypes);
    
    // Build filter
    const filter: QueryFilter = {
      startTime,
      endTime,
      categories,
      eventTypes,
      actor: params.actor,
      sessionId: params.sessionId,
      aggregateId: params.aggregateId,
      limit: Math.min(params.limit || 100, 1000), // Cap at 1000
      order: params.order || 'desc',
    };

    // Get statistics only
    if (params.statsOnly) {
      const stats = queryEngine.getStats(filter);
      
      return {
        success: true,
        query: params,
        stats: {
          totalEvents: stats.totalEvents,
          eventsByType: stats.eventsByType,
          eventsByCategory: stats.eventsByCategory,
          eventsByActor: stats.eventsByActor,
          timeRange: {
            earliest: new Date(stats.timeRange.earliest).toISOString(),
            earliestMs: stats.timeRange.earliest,
            latest: new Date(stats.timeRange.latest).toISOString(),
            latestMs: stats.timeRange.latest,
          },
        },
      };
    }

    // Search by text
    if (params.searchText) {
      const result = queryEngine.searchPayload(params.searchText, filter);
      
      return {
        success: true,
        query: params,
        events: result.events.map(event => ({
          id: event.id,
          timestamp: new Date(event.timestamp).toISOString(),
          timestampMs: event.timestamp,
          eventType: event.event_type,
          description: getEventDescription(event.event_type),
          actor: event.actor,
          aggregate: `${event.aggregate_type}:${event.aggregate_id}`,
          payload: event.payload,
        })),
        total: result.total,
        hasMore: result.hasMore,
      };
    }

    // Regular query
    const result = queryEngine.query(filter);
    
    return {
      success: true,
      query: params,
      events: result.events.map(event => ({
        id: event.id,
        timestamp: new Date(event.timestamp).toISOString(),
        timestampMs: event.timestamp,
        eventType: event.event_type,
        description: getEventDescription(event.event_type),
        actor: event.actor,
        aggregate: `${event.aggregate_type}:${event.aggregate_id}`,
        payload: event.payload,
      })),
      total: result.total,
      hasMore: result.hasMore,
    };
  } catch (error) {
    return {
      success: false,
      query: params,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Timeline query tool definition for LLM
 */
export const timelineQueryTool = {
  name: 'timeline_query',
  description: `Query the timeline event log to understand what happened in the system.
  
Use this tool to:
- See what happened in a session
- Find file modifications
- Track git operations
- Review conversation history
- Analyze tool executions
- Get statistics about events

Examples:
- "What files were modified in the last hour?"
- "Show me all git commits in session 5"
- "What tools were executed today?"
- "Get statistics about all events"`,
  
  inputSchema: {
    type: 'object',
    properties: {
      startTime: {
        type: 'string',
        description: 'Start timestamp (ISO string like "2025-11-28T00:00:00Z" or relative like "1 hour ago")',
      },
      endTime: {
        type: 'string',
        description: 'End timestamp (ISO string)',
      },
      categories: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['SESSION', 'LLM', 'TOOL', 'FILE', 'GIT', 'REWIND'],
        },
        description: 'Filter by event categories',
      },
      eventTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific event types (e.g., FILE_MODIFIED, GIT_COMMIT)',
      },
      actor: {
        type: 'string',
        description: 'Filter by actor (e.g., "user", "system", "git:username")',
      },
      sessionId: {
        type: 'number',
        description: 'Filter by session ID',
      },
      aggregateId: {
        type: 'string',
        description: 'Filter by aggregate ID (e.g., file path)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 100, max: 1000)',
        default: 100,
      },
      searchText: {
        type: 'string',
        description: 'Search for text in event payloads',
      },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order: asc (oldest first) or desc (newest first)',
        default: 'desc',
      },
      statsOnly: {
        type: 'boolean',
        description: 'Return only statistics instead of events',
        default: false,
      },
    },
  },
  
  execute: executeTimelineQuery,
};
