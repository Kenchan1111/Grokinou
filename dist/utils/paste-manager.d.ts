/**
 * Paste Manager - Handles large paste content with placeholder links
 *
 * Inspired by Codex implementation:
 * - Large pastes (>1000 chars) are replaced with placeholders
 * - Placeholders are styled distinctly (cyan color)
 * - On submit, placeholders are expanded to full content
 * - Multiple pastes supported
 */
export declare const LARGE_PASTE_THRESHOLD = 1000;
export interface PendingPaste {
    id: string;
    placeholder: string;
    content: string;
    charCount: number;
}
export declare class PasteManager {
    private pendingPastes;
    private pasteCounter;
    /**
     * Process pasted content and determine if it should be replaced with a placeholder
     *
     * @param content - The pasted content
     * @returns Object with the text to insert and optional pending paste info
     */
    processPaste(content: string): {
        textToInsert: string;
        pendingPaste: PendingPaste | null;
    };
    /**
     * Expand all placeholders in the given text to their full content
     *
     * @param text - The text containing placeholders
     * @returns The text with all placeholders expanded
     */
    expandPlaceholders(text: string): string;
    /**
     * Clear all pending pastes (typically called after successful submission)
     */
    clearAll(): void;
    /**
     * Remove a specific pending paste by its placeholder text
     *
     * @param placeholder - The placeholder text to remove
     * @returns true if a paste was removed
     */
    removeByPlaceholder(placeholder: string): boolean;
    /**
     * Check if the given text is a paste placeholder
     *
     * @param text - The text to check
     * @returns true if the text is a placeholder
     */
    isPlaceholder(text: string): boolean;
    /**
     * Find placeholder at the given position in the text
     *
     * @param text - The full text
     * @param cursorPos - The cursor position
     * @returns Placeholder info if found, null otherwise
     */
    findPlaceholderAtCursor(text: string, cursorPos: number): {
        placeholder: string;
        start: number;
        end: number;
    } | null;
    /**
     * Sync pending pastes with current text (remove placeholders no longer present)
     *
     * @param currentText - The current input text
     */
    syncWithText(currentText: string): void;
    /**
     * Get all pending pastes
     */
    getPendingPastes(): PendingPaste[];
    /**
     * Check if there are any pending pastes
     */
    hasPendingPastes(): boolean;
    /**
     * Get the count of pending pastes
     */
    getPendingCount(): number;
}
export declare const pasteManager: PasteManager;
