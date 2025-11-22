/**
 * Paste Burst Detector - Buffers rapid input chunks into complete pastes
 *
 * Inspired by Codex's paste_burst.rs implementation.
 *
 * Problem: Terminals split long pastes into multiple chunks.
 * Solution: Detect rapid inputs (< 8ms apart) and buffer them together.
 */
export declare class PasteBurstDetector {
    private buffer;
    private lastInputTime;
    private flushTimer;
    private isActive;
    private onFlush;
    /**
     * Process input character/string
     * Returns true if buffering (don't insert yet), false if should insert normally
     */
    handleInput(inputChar: string, onFlushCallback: (content: string) => void): boolean;
    /**
     * Flush buffered content
     */
    private flush;
    /**
     * Clear buffer and state
     */
    clear(): void;
    /**
     * Get current buffer (for debugging)
     */
    getBuffer(): string;
    /**
     * Check if currently buffering
     */
    isBuffering(): boolean;
}
export declare const pasteBurstDetector: PasteBurstDetector;
