/**
 * Timeline Database Schema (Embedded)
 * 
 * @module timeline/schema
 * @version 1.0.0
 */

export const TIMELINE_SCHEMA = `
-- ============================================================================
-- TIMELINE.DB - Event Sourcing Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL UNIQUE,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_id TEXT,
    aggregate_type TEXT,
    payload TEXT NOT NULL,
    correlation_id TEXT,
    causation_id TEXT,
    metadata TEXT,
    checksum TEXT NOT NULL,
    CHECK (length(checksum) = 64),
    CHECK (timestamp > 0),
    CHECK (sequence_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_events_sequence ON events (sequence_number);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_id, aggregate_type);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events (actor);

CREATE TABLE IF NOT EXISTS snapshots (
    aggregate_id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    state_compressed BLOB NOT NULL,
    checksum TEXT NOT NULL,
    CHECK (length(checksum) = 64),
    CHECK (timestamp > 0),
    CHECK (sequence_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_sequence ON snapshots (sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots (timestamp DESC);

CREATE TABLE IF NOT EXISTS file_blobs (
    hash TEXT PRIMARY KEY,
    content BLOB NOT NULL,
    is_delta INTEGER DEFAULT 0,
    base_hash TEXT,
    size INTEGER NOT NULL,
    compressed_size INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    CHECK (length(hash) = 64),
    CHECK (size >= 0),
    CHECK (compressed_size >= 0),
    CHECK (is_delta IN (0, 1)),
    CHECK (is_delta = 0 OR base_hash IS NOT NULL),
    FOREIGN KEY (base_hash) REFERENCES file_blobs(hash) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_file_blobs_created ON file_blobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_blobs_base ON file_blobs (base_hash);

CREATE TABLE IF NOT EXISTS file_trees (
    hash TEXT PRIMARY KEY,
    tree_json TEXT NOT NULL,
    parent_hash TEXT,
    timestamp INTEGER NOT NULL,
    total_files INTEGER DEFAULT 0,
    CHECK (length(hash) = 64),
    CHECK (timestamp > 0),
    CHECK (total_files >= 0),
    FOREIGN KEY (parent_hash) REFERENCES file_trees(hash) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_file_trees_timestamp ON file_trees (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_file_trees_parent ON file_trees (parent_hash);

CREATE TABLE IF NOT EXISTS rewind_cache (
    target_timestamp INTEGER PRIMARY KEY,
    snapshot_sequence INTEGER NOT NULL,
    tree_hash TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    hit_count INTEGER DEFAULT 0,
    CHECK (target_timestamp > 0),
    CHECK (created_at > 0),
    CHECK (hit_count >= 0),
    FOREIGN KEY (tree_hash) REFERENCES file_trees(hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rewind_cache_created ON rewind_cache (created_at DESC);

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Insert metadata only if keys don't exist (idempotent)
-- Using INSERT OR IGNORE to preserve existing values (e.g., last_sequence)
INSERT OR IGNORE INTO metadata (key, value, updated_at) VALUES
    ('schema_version', '1.0.0', strftime('%s', 'now') * 1000000),
    ('created_at', strftime('%s', 'now') * 1000000, strftime('%s', 'now') * 1000000),
    ('last_sequence', '0', strftime('%s', 'now') * 1000000),
    ('last_snapshot_sequence', '0', strftime('%s', 'now') * 1000000);

-- Update schema_version separately (can be updated on schema changes)
UPDATE metadata 
SET value = '1.0.0', updated_at = strftime('%s', 'now') * 1000000
WHERE key = 'schema_version';

CREATE VIEW IF NOT EXISTS v_recent_events AS
SELECT 
    id,
    datetime(timestamp / 1000000, 'unixepoch') as timestamp_human,
    sequence_number,
    actor,
    event_type,
    aggregate_id,
    aggregate_type
FROM events
ORDER BY sequence_number DESC
LIMIT 100;

CREATE VIEW IF NOT EXISTS v_event_stats AS
SELECT 
    event_type,
    COUNT(*) as count,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_seen,
    datetime(MIN(timestamp) / 1000000, 'unixepoch') as first_seen_human,
    datetime(MAX(timestamp) / 1000000, 'unixepoch') as last_seen_human
FROM events
GROUP BY event_type
ORDER BY count DESC;
`;
