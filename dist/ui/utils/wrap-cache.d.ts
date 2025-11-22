/**
 * Wrapping cache inspired by Codex's RefCell<WrapCache>
 * Prevents recalculating text wrapping on every render
 */
declare class WrapCache {
    private cache;
    private maxEntries;
    private maxAge;
    /**
     * Get wrapped lines from cache or calculate and cache
     */
    getWrappedLines(text: string, width: number): string[];
    /**
     * Invalidate cache for specific text
     */
    invalidate(text?: string): void;
    private makeKey;
    private simpleHash;
    private wrapText;
    private cleanupOldEntries;
}
export declare function useWrapCache(): WrapCache;
export default WrapCache;
