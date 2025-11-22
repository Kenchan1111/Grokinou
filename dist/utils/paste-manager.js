/**
 * Paste Manager - Handles large paste content with placeholder links
 *
 * Inspired by Codex implementation:
 * - Large pastes (>1000 chars) are replaced with placeholders
 * - Placeholders are styled distinctly (cyan color)
 * - On submit, placeholders are expanded to full content
 * - Multiple pastes supported
 */
export const LARGE_PASTE_THRESHOLD = 1000; // chars
export class PasteManager {
    pendingPastes = new Map();
    pasteCounter = 0;
    /**
     * Process pasted content and determine if it should be replaced with a placeholder
     *
     * @param content - The pasted content
     * @returns Object with the text to insert and optional pending paste info
     */
    processPaste(content) {
        const charCount = content.length;
        // If content is small enough, insert normally
        if (charCount <= LARGE_PASTE_THRESHOLD) {
            return { textToInsert: content, pendingPaste: null };
        }
        // Create placeholder for large content
        this.pasteCounter++;
        const id = `paste-${this.pasteCounter}-${Date.now()}`;
        const placeholder = `[Pasted Content ${charCount} chars]`;
        const pendingPaste = {
            id,
            placeholder,
            content,
            charCount,
        };
        this.pendingPastes.set(id, pendingPaste);
        return { textToInsert: placeholder, pendingPaste };
    }
    /**
     * Expand all placeholders in the given text to their full content
     *
     * @param text - The text containing placeholders
     * @returns The text with all placeholders expanded
     */
    expandPlaceholders(text) {
        let expandedText = text;
        for (const [id, paste] of this.pendingPastes.entries()) {
            if (expandedText.includes(paste.placeholder)) {
                expandedText = expandedText.replace(paste.placeholder, paste.content);
            }
        }
        return expandedText;
    }
    /**
     * Clear all pending pastes (typically called after successful submission)
     */
    clearAll() {
        this.pendingPastes.clear();
    }
    /**
     * Remove a specific pending paste by its placeholder text
     *
     * @param placeholder - The placeholder text to remove
     * @returns true if a paste was removed
     */
    removeByPlaceholder(placeholder) {
        for (const [id, paste] of this.pendingPastes.entries()) {
            if (paste.placeholder === placeholder) {
                this.pendingPastes.delete(id);
                return true;
            }
        }
        return false;
    }
    /**
     * Check if the given text is a paste placeholder
     *
     * @param text - The text to check
     * @returns true if the text is a placeholder
     */
    isPlaceholder(text) {
        for (const paste of this.pendingPastes.values()) {
            if (paste.placeholder === text) {
                return true;
            }
        }
        return false;
    }
    /**
     * Find placeholder at the given position in the text
     *
     * @param text - The full text
     * @param cursorPos - The cursor position
     * @returns Placeholder info if found, null otherwise
     */
    findPlaceholderAtCursor(text, cursorPos) {
        for (const paste of this.pendingPastes.values()) {
            const { placeholder } = paste;
            // Check if cursor is within a placeholder (cursor at end or inside)
            let index = 0;
            while ((index = text.indexOf(placeholder, index)) !== -1) {
                const start = index;
                const end = index + placeholder.length;
                // Cursor is at the end of placeholder or inside it
                if (cursorPos >= start && cursorPos <= end) {
                    return { placeholder, start, end };
                }
                index += placeholder.length;
            }
        }
        return null;
    }
    /**
     * Sync pending pastes with current text (remove placeholders no longer present)
     *
     * @param currentText - The current input text
     */
    syncWithText(currentText) {
        const toRemove = [];
        for (const [id, paste] of this.pendingPastes.entries()) {
            if (!currentText.includes(paste.placeholder)) {
                toRemove.push(id);
            }
        }
        for (const id of toRemove) {
            this.pendingPastes.delete(id);
        }
    }
    /**
     * Get all pending pastes
     */
    getPendingPastes() {
        return Array.from(this.pendingPastes.values());
    }
    /**
     * Check if there are any pending pastes
     */
    hasPendingPastes() {
        return this.pendingPastes.size > 0;
    }
    /**
     * Get the count of pending pastes
     */
    getPendingCount() {
        return this.pendingPastes.size;
    }
}
// Singleton instance
export const pasteManager = new PasteManager();
//# sourceMappingURL=paste-manager.js.map