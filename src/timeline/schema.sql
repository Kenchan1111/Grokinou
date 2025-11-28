-- ============================================================================
-- TIMELINE.DB - Event Sourcing Schema
-- ============================================================================
-- Description: Immutable append-only log for complete state reconstruction
-- Version: 1.0.0
-- Date: 2025-11-28
-- ============================================================================

-- ============================================================================
-- TABLE: events (Append-Only Event Log)
-- ============================================================================
-- Description: Main event log. NEVER UPDATE/DELETE, only INSERT.
-- Each event captures a single atomic change in the system.
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    -- Primary identifiers
    id TEXT PRIMARY KEY,                    -- UUID v4
    timestamp INTEGER NOT NULL,             -- Unix timestamp in microseconds
    sequence_number INTEGER NOT NULL UNIQUE,-- Auto-increment for strict ordering
    
    -- Event classification
    actor TEXT NOT NULL,                    -- 'user' | 'llm:<model>' | 'tool:<name>' | 'system'
    event_type TEXT NOT NULL,               -- Event type (see EventType enum)
    
    -- Event aggregation (Domain-Driven Design)
    aggregate_id TEXT,                      -- ID of the entity (session, file, etc.)
    aggregate_type TEXT,                    -- 'session' | 'file' | 'conversation' | 'git'
    
    -- Event data (JSON payload)
    payload TEXT NOT NULL,                  -- JSON-serialized event data
    
    -- Causality tracking
    correlation_id TEXT,                    -- Groups related events (transaction ID)
    causation_id TEXT,                      -- Parent event ID (forms a chain)
    
    -- Metadata
    metadata TEXT,                          -- Additional context (JSON)
    
    -- Cryptographic integrity
    checksum TEXT NOT NULL,                 -- SHA256(payload) for tamper detection
    
    -- Performance hints
    CHECK (length(checksum) = 64),          -- Enforce SHA256 length
    CHECK (timestamp > 0),                  -- Enforce positive timestamp
    CHECK (sequence_number > 0)             -- Enforce positive sequence
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_events_sequence ON events (sequence_number);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_id, aggregate_type);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events (actor);

-- ============================================================================
-- TABLE: snapshots (State Snapshots for Performance)
-- ============================================================================
-- Description: Periodic snapshots of the complete system state.
-- Used to avoid replaying millions of events for reconstruction.
-- Strategy: Snapshot every 10,000 events OR after each git commit.
-- ============================================================================
CREATE TABLE IF NOT EXISTS snapshots (
    -- Snapshot identity
    aggregate_id TEXT PRIMARY KEY,          -- Typically "global" or specific entity
    aggregate_type TEXT NOT NULL,           -- 'global' | 'session' | 'file'
    
    -- Snapshot position in event stream
    sequence_number INTEGER NOT NULL,       -- Last event included in this snapshot
    timestamp INTEGER NOT NULL,             -- When snapshot was created
    
    -- Snapshot data (compressed for storage efficiency)
    state_compressed BLOB NOT NULL,         -- zlib-compressed JSON state
    
    -- Integrity
    checksum TEXT NOT NULL,                 -- SHA256 of uncompressed state
    
    -- Performance hints
    CHECK (length(checksum) = 64),
    CHECK (timestamp > 0),
    CHECK (sequence_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_sequence ON snapshots (sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots (timestamp DESC);

-- ============================================================================
-- TABLE: file_blobs (Merkle DAG - File Content Storage)
-- ============================================================================
-- Description: Content-addressable storage for file versions.
-- Uses SHA256 hash as key for deduplication.
-- Supports delta encoding to save space (like Git pack files).
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_blobs (
    -- Content addressing
    hash TEXT PRIMARY KEY,                  -- SHA256 of content
    
    -- Storage
    content BLOB NOT NULL,                  -- File content (zlib compressed)
    is_delta INTEGER DEFAULT 0,             -- 0=full content, 1=delta patch
    base_hash TEXT,                         -- If delta, hash of base version
    
    -- Metadata
    size INTEGER NOT NULL,                  -- Original size (before compression)
    compressed_size INTEGER NOT NULL,       -- Size after compression
    created_at INTEGER NOT NULL,            -- Creation timestamp
    
    -- Constraints
    CHECK (length(hash) = 64),
    CHECK (size >= 0),
    CHECK (compressed_size >= 0),
    CHECK (is_delta IN (0, 1)),
    CHECK (is_delta = 0 OR base_hash IS NOT NULL),  -- Delta must have base
    FOREIGN KEY (base_hash) REFERENCES file_blobs(hash) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_file_blobs_created ON file_blobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_blobs_base ON file_blobs (base_hash);

-- ============================================================================
-- TABLE: file_trees (Merkle Tree - Directory Structure)
-- ============================================================================
-- Description: Represents the complete file tree at a point in time.
-- Each tree is immutable and content-addressed.
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_trees (
    -- Tree identity
    hash TEXT PRIMARY KEY,                  -- SHA256 of tree JSON
    
    -- Tree structure (JSON)
    tree_json TEXT NOT NULL,                -- { "files": { "path": "hash" }, ... }
    
    -- Chain (Git-like)
    parent_hash TEXT,                       -- Previous tree hash (forms a chain)
    
    -- Metadata
    timestamp INTEGER NOT NULL,             -- When tree was created
    total_files INTEGER DEFAULT 0,          -- Number of files in tree
    
    -- Constraints
    CHECK (length(hash) = 64),
    CHECK (timestamp > 0),
    CHECK (total_files >= 0),
    FOREIGN KEY (parent_hash) REFERENCES file_trees(hash) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_file_trees_timestamp ON file_trees (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_file_trees_parent ON file_trees (parent_hash);

-- ============================================================================
-- TABLE: rewind_cache (Optimized Rewind Results)
-- ============================================================================
-- Description: Caches the results of expensive rewind operations.
-- Invalidated when new events are added.
-- ============================================================================
CREATE TABLE IF NOT EXISTS rewind_cache (
    -- Cache key
    target_timestamp INTEGER PRIMARY KEY,   -- Timestamp requested for rewind
    
    -- Cache result
    snapshot_sequence INTEGER NOT NULL,     -- Snapshot used for reconstruction
    tree_hash TEXT NOT NULL,                -- Resulting file tree hash
    state_json TEXT NOT NULL,               -- Complete state (JSON)
    
    -- Cache metadata
    created_at INTEGER NOT NULL,            -- When cache entry was created
    hit_count INTEGER DEFAULT 0,            -- Number of cache hits
    
    -- Constraints
    CHECK (target_timestamp > 0),
    CHECK (created_at > 0),
    CHECK (hit_count >= 0),
    FOREIGN KEY (tree_hash) REFERENCES file_trees(hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rewind_cache_created ON rewind_cache (created_at DESC);

-- ============================================================================
-- TABLE: metadata (System Metadata)
-- ============================================================================
-- Description: Stores system-level configuration and state.
-- ============================================================================
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,                   -- Config key
    value TEXT NOT NULL,                    -- Config value (JSON or plain text)
    updated_at INTEGER NOT NULL             -- Last update timestamp
);

-- Initialize metadata
INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES
    ('schema_version', '1.0.0', strftime('%s', 'now') * 1000000),
    ('created_at', strftime('%s', 'now') * 1000000, strftime('%s', 'now') * 1000000),
    ('last_sequence', '0', strftime('%s', 'now') * 1000000),
    ('last_snapshot_sequence', '0', strftime('%s', 'now') * 1000000);

-- ============================================================================
-- VIEWS (Convenience Queries)
-- ============================================================================

-- View: Recent events (last 100)
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

-- View: Event statistics by type
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

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
