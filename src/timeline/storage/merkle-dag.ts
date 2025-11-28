/**
 * Merkle DAG (Directed Acyclic Graph) Storage
 * 
 * Content-addressable storage for file blobs using SHA256 hashing.
 * Inspired by Git's object storage model.
 * 
 * Features:
 * - Content deduplication via SHA256 hashing
 * - Delta compression (like Git pack files)
 * - zlib compression for storage efficiency
 * - Immutable blob storage
 * 
 * @module timeline/storage/merkle-dag
 * @version 1.0.0
 */

import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { TimelineDatabase } from '../database.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * File Blob Storage Result
 */
export interface BlobStoreResult {
  hash: string;
  size: number;
  compressedSize: number;
  isDelta: boolean;
  baseHash?: string;
}

/**
 * File Blob Retrieval Result
 */
export interface BlobRetrieveResult {
  hash: string;
  content: Buffer;
  size: number;
  isDelta: boolean;
  baseHash?: string;
}

/**
 * Merkle DAG Storage Manager
 */
export class MerkleDAG {
  private static instance: MerkleDAG;
  private db: TimelineDatabase;

  private constructor() {
    this.db = TimelineDatabase.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MerkleDAG {
    if (!MerkleDAG.instance) {
      MerkleDAG.instance = new MerkleDAG();
    }
    return MerkleDAG.instance;
  }

  /**
   * Store a file blob (full content)
   * 
   * @param content - File content
   * @returns Storage result with hash
   */
  async storeBlob(content: Buffer | string): Promise<BlobStoreResult> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    
    // Calculate hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Check if blob already exists (deduplication)
    const existing = this.getBlobInfo(hash);
    if (existing) {
      return existing;
    }
    
    // Compress content
    const compressed = await gzip(buffer);
    
    // Store in database
    const stmt = this.db.getConnection().prepare(`
      INSERT INTO file_blobs (hash, content, is_delta, base_hash, size, compressed_size, created_at)
      VALUES (?, ?, 0, NULL, ?, ?, ?)
    `);
    
    stmt.run(
      hash,
      compressed,
      buffer.length,
      compressed.length,
      Date.now() * 1000 // microseconds
    );
    
    return {
      hash,
      size: buffer.length,
      compressedSize: compressed.length,
      isDelta: false,
    };
  }

  /**
   * Store a delta blob (compressed diff)
   * 
   * @param deltaContent - Delta patch content
   * @param baseHash - Hash of the base version
   * @returns Storage result with hash
   */
  async storeDelta(deltaContent: Buffer | string, baseHash: string): Promise<BlobStoreResult> {
    const buffer = Buffer.isBuffer(deltaContent) ? deltaContent : Buffer.from(deltaContent, 'utf-8');
    
    // Calculate hash of delta
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Check if delta already exists
    const existing = this.getBlobInfo(hash);
    if (existing) {
      return existing;
    }
    
    // Compress delta
    const compressed = await gzip(buffer);
    
    // Store in database
    const stmt = this.db.getConnection().prepare(`
      INSERT INTO file_blobs (hash, content, is_delta, base_hash, size, compressed_size, created_at)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `);
    
    stmt.run(
      hash,
      compressed,
      baseHash,
      buffer.length,
      compressed.length,
      Date.now() * 1000
    );
    
    return {
      hash,
      size: buffer.length,
      compressedSize: compressed.length,
      isDelta: true,
      baseHash,
    };
  }

  /**
   * Retrieve a blob by hash
   * 
   * @param hash - SHA256 hash of the blob
   * @returns Blob content and metadata
   */
  async retrieveBlob(hash: string): Promise<BlobRetrieveResult | null> {
    const stmt = this.db.getConnection().prepare(`
      SELECT hash, content, is_delta, base_hash, size
      FROM file_blobs
      WHERE hash = ?
    `);
    
    const row = stmt.get(hash) as any;
    
    if (!row) {
      return null;
    }
    
    // Decompress content
    const decompressed = await gunzip(row.content);
    
    return {
      hash: row.hash,
      content: decompressed,
      size: row.size,
      isDelta: row.is_delta === 1,
      baseHash: row.base_hash || undefined,
    };
  }

  /**
   * Get blob info without retrieving content
   * 
   * @param hash - SHA256 hash of the blob
   * @returns Blob metadata
   */
  getBlobInfo(hash: string): BlobStoreResult | null {
    const stmt = this.db.getConnection().prepare(`
      SELECT hash, is_delta, base_hash, size, compressed_size
      FROM file_blobs
      WHERE hash = ?
    `);
    
    const row = stmt.get(hash) as any;
    
    if (!row) {
      return null;
    }
    
    return {
      hash: row.hash,
      size: row.size,
      compressedSize: row.compressed_size,
      isDelta: row.is_delta === 1,
      baseHash: row.base_hash || undefined,
    };
  }

  /**
   * Check if a blob exists
   * 
   * @param hash - SHA256 hash of the blob
   * @returns True if blob exists
   */
  hasBlob(hash: string): boolean {
    const stmt = this.db.getConnection().prepare(`
      SELECT 1 FROM file_blobs WHERE hash = ? LIMIT 1
    `);
    
    return stmt.get(hash) !== undefined;
  }

  /**
   * Get storage statistics
   * 
   * @returns Storage statistics
   */
  getStats(): {
    totalBlobs: number;
    totalSize: number;
    totalCompressedSize: number;
    compressionRatio: number;
    deltaBlobs: number;
  } {
    const stmt = this.db.getConnection().prepare(`
      SELECT
        COUNT(*) as total_blobs,
        SUM(size) as total_size,
        SUM(compressed_size) as total_compressed_size,
        SUM(CASE WHEN is_delta = 1 THEN 1 ELSE 0 END) as delta_blobs
      FROM file_blobs
    `);
    
    const row = stmt.get() as any;
    
    const totalSize = row.total_size || 0;
    const totalCompressedSize = row.total_compressed_size || 0;
    
    return {
      totalBlobs: row.total_blobs || 0,
      totalSize,
      totalCompressedSize,
      compressionRatio: totalSize > 0 ? totalCompressedSize / totalSize : 0,
      deltaBlobs: row.delta_blobs || 0,
    };
  }

  /**
   * Garbage collect unreferenced blobs
   * 
   * Removes blobs that are not referenced by any file tree.
   * 
   * @returns Number of blobs deleted
   */
  garbageCollect(): number {
    // TODO: Implement garbage collection
    // This requires scanning all file_trees and finding unreferenced blobs
    return 0;
  }
}

/**
 * Get MerkleDAG singleton instance
 */
export function getMerkleDAG(): MerkleDAG {
  return MerkleDAG.getInstance();
}
