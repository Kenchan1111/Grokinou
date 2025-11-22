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
    buffer = '';
    lastInputTime = null;
    flushTimer = null;
    isActive = false;
    onFlush = null;
    /**
     * Process input character/string
     * Returns true if buffering (don't insert yet), false if should insert normally
     */
    handleInput(inputChar, onFlushCallback) {
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
    flush() {
        if (this.buffer && this.onFlush) {
            const content = this.buffer;
            this.clear();
            this.onFlush(content);
        }
    }
    /**
     * Clear buffer and state
     */
    clear() {
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
    getBuffer() {
        return this.buffer;
    }
    /**
     * Check if currently buffering
     */
    isBuffering() {
        return this.isActive;
    }
}
// Singleton instance
export const pasteBurstDetector = new PasteBurstDetector();
//# sourceMappingURL=paste-burst-detector.js.map