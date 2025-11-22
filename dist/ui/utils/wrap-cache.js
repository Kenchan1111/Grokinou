/**
 * Wrapping cache inspired by Codex's RefCell<WrapCache>
 * Prevents recalculating text wrapping on every render
 */
class WrapCache {
    cache = new Map();
    maxEntries = 100;
    maxAge = 60000; // 60 seconds
    /**
     * Get wrapped lines from cache or calculate and cache
     */
    getWrappedLines(text, width) {
        const key = this.makeKey(text, width);
        // Check cache
        const cached = this.cache.get(key);
        if (cached && cached.timestamp > Date.now() - this.maxAge) {
            return cached.lines;
        }
        // Calculate and cache
        const lines = this.wrapText(text, width);
        this.cache.set(key, {
            width,
            text,
            lines,
            timestamp: Date.now(),
        });
        // Cleanup old entries
        if (this.cache.size > this.maxEntries) {
            this.cleanupOldEntries();
        }
        return lines;
    }
    /**
     * Invalidate cache for specific text
     */
    invalidate(text) {
        if (text) {
            // Remove all entries for this text
            for (const [key, entry] of this.cache.entries()) {
                if (entry.text === text) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            // Clear entire cache
            this.cache.clear();
        }
    }
    makeKey(text, width) {
        // Use hash for long texts to keep keys manageable
        if (text.length > 100) {
            const hash = this.simpleHash(text);
            return `${hash}-${width}`;
        }
        return `${text}-${width}`;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }
    wrapText(text, width) {
        if (width <= 0)
            return [text];
        const lines = [];
        const paragraphs = text.split('\n');
        for (const paragraph of paragraphs) {
            if (paragraph.length <= width) {
                lines.push(paragraph);
            }
            else {
                // Simple word wrapping
                const words = paragraph.split(' ');
                let currentLine = '';
                for (const word of words) {
                    if (currentLine.length + word.length + 1 <= width) {
                        currentLine += (currentLine ? ' ' : '') + word;
                    }
                    else {
                        if (currentLine)
                            lines.push(currentLine);
                        currentLine = word;
                    }
                }
                if (currentLine)
                    lines.push(currentLine);
            }
        }
        return lines;
    }
    cleanupOldEntries() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        // Sort by timestamp, oldest first
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        // Remove oldest 20%
        const toRemove = Math.floor(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
    }
}
// Singleton instance
const wrapCacheInstance = new WrapCache();
export function useWrapCache() {
    return wrapCacheInstance;
}
export default WrapCache;
//# sourceMappingURL=wrap-cache.js.map