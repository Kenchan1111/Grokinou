/**
 * Paste Burst Detector - Buffers rapid input chunks into complete pastes
 *
 * Inspired by Codex's paste_burst.rs implementation.
 *
 * Problem: Terminals split long pastes into multiple chunks.
 * Solution: Detect rapid inputs (< 8ms apart) and buffer them together.
 */

import { debugLog } from './debug-logger.js';

const PASTE_BURST_CHAR_INTERVAL_MS = 8; // Chars arriving within 8ms = paste burst
const PASTE_BURST_FLUSH_TIMEOUT_MS = 100; // Wait 100ms for more chunks before flushing (handles large pastes)

export class PasteBurstDetector {
  private buffer: string = '';
  private lastInputTime: number | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private onFlush: ((content: string) => void) | null = null;

  /**
   * Process input character/string
   * Returns true if buffering (don't insert yet), false if should insert normally
   */
  handleInput(inputChar: string, onFlushCallback: (content: string) => void): boolean {
    const now = Date.now();
    this.onFlush = onFlushCallback;

    // Check if this input arrives quickly after the last one (paste burst)
    const isPasteBurst = this.lastInputTime !== null &&
                         (now - this.lastInputTime) <= PASTE_BURST_CHAR_INTERVAL_MS;

    // Debug large inputs
    if (inputChar.length > 10) {
      debugLog.log('[PasteBurstDetector] Large input detected:', inputChar.length, 'chars');
    }

    // If we're in an active burst or this looks like a new burst
    if (this.isActive || isPasteBurst || inputChar.length > 10) {
      // Activate burst mode
      if (!this.isActive) {
        debugLog.log('[PasteBurstDetector] Activating burst mode, input length:', inputChar.length);
        this.isActive = true;
      }

      // Append to buffer
      this.buffer += inputChar;
      this.lastInputTime = now;

      debugLog.log('[PasteBurstDetector] Buffering... total buffer size:', this.buffer.length);

      // Clear existing timer
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
      }

      // Set new timer to flush after timeout
      this.flushTimer = setTimeout(() => {
        debugLog.log('[PasteBurstDetector] Flush timeout triggered, flushing', this.buffer.length, 'chars');
        this.flush();
      }, PASTE_BURST_FLUSH_TIMEOUT_MS);

      return true; // Buffering, don't insert yet
    }

    // Normal single character input
    this.lastInputTime = now;
    return false; // Insert normally
  }

  /**
   * Flush buffered content
   */
  private flush(): void {
    if (this.buffer && this.onFlush) {
      const content = this.buffer;
      this.clear();
      this.onFlush(content);
    }
  }

  /**
   * Clear buffer and state
   */
  clear(): void {
    this.buffer = '';
    this.lastInputTime = null;
    this.isActive = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Get current buffer (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Check if currently buffering
   */
  isBuffering(): boolean {
    return this.isActive;
  }
}

// Singleton instance
export const pasteBurstDetector = new PasteBurstDetector();
