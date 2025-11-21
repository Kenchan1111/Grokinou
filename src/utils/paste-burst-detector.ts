/**
 * Paste Burst Detector - Buffers rapid input chunks into complete pastes
 * 
 * Inspired by Codex's paste_burst.rs implementation.
 * 
 * Problem: Terminals split long pastes into multiple chunks.
 * Solution: Detect rapid inputs (< 8ms apart) and buffer them together.
 */

const PASTE_BURST_CHAR_INTERVAL_MS = 8; // Chars arriving within 8ms = paste burst
const PASTE_BURST_FLUSH_TIMEOUT_MS = 20; // Wait 20ms for more chunks before flushing

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

    // If we're in an active burst or this looks like a new burst
    if (this.isActive || isPasteBurst || inputChar.length > 10) {
      // Activate burst mode
      if (!this.isActive) {
        this.isActive = true;
      }

      // Append to buffer
      this.buffer += inputChar;
      this.lastInputTime = now;

      // Clear existing timer
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
      }

      // Set new timer to flush after timeout
      this.flushTimer = setTimeout(() => {
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
