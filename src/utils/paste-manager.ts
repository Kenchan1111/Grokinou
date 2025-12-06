/**
 * Paste Manager - Handles large paste content with placeholder links
 *
 * Inspired by Codex implementation:
 * - Large pastes (>100 chars) are replaced with placeholders
 * - Placeholders are styled distinctly (cyan color)
 * - On submit, placeholders are expanded to full content
 * - Multiple pastes supported
 */

import { debugLog } from './debug-logger.js';

export const LARGE_PASTE_THRESHOLD = 50; // chars (aligned with use-input-handler direct detection)

export interface PendingPaste {
  id: string;
  placeholder: string;
  content: string;
  charCount: number;
}

export class PasteManager {
  private pendingPastes: Map<string, PendingPaste> = new Map();
  private pasteCounter = 0;

  /**
   * Process pasted content and determine if it should be replaced with a placeholder
   * 
   * @param content - The pasted content
   * @returns Object with the text to insert and optional pending paste info
   */
  processPaste(content: string): {
    textToInsert: string;
    pendingPaste: PendingPaste | null;
  } {
    // Trim leading/trailing whitespace from pasted content to avoid issues with empty first lines
    const trimmedContent = content.trim();
    const charCount = trimmedContent.length;
    debugLog.log('[PasteManager] processPaste called, original length:', content.length, 'trimmed length:', charCount, 'threshold:', LARGE_PASTE_THRESHOLD);

    // If content is small enough, insert normally
    if (charCount <= LARGE_PASTE_THRESHOLD) {
      debugLog.log('[PasteManager] Small paste, inserting normally');
      // Normalize whitespace: replace newlines/tabs with single spaces
      // to avoid rendering issues in single-line input
      const normalizedContent = trimmedContent
        .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
        .replace(/\t/g, ' ')        // Replace tabs with spaces
        .replace(/\s{2,}/g, ' ');   // Collapse multiple spaces into one

      return { textToInsert: normalizedContent, pendingPaste: null };
    }

    // Create placeholder for large content
    debugLog.log('[PasteManager] Large paste detected, creating placeholder');
    this.pasteCounter++;
    const id = `paste-${this.pasteCounter}-${Date.now()}`;

    // Format character count with thousand separators for readability
    const formattedCount = charCount.toLocaleString('en-US');
    const placeholder = `[Pasted ${formattedCount} chars]`;
    debugLog.log('[PasteManager] Placeholder created:', placeholder);

    const pendingPaste: PendingPaste = {
      id,
      placeholder,
      content: trimmedContent,  // Store trimmed content
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
  expandPlaceholders(text: string): string {
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
  clearAll(): void {
    this.pendingPastes.clear();
  }

  /**
   * Remove a specific pending paste by its placeholder text
   * 
   * @param placeholder - The placeholder text to remove
   * @returns true if a paste was removed
   */
  removeByPlaceholder(placeholder: string): boolean {
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
  isPlaceholder(text: string): boolean {
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
  findPlaceholderAtCursor(text: string, cursorPos: number): {
    placeholder: string;
    start: number;
    end: number;
  } | null {
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
  syncWithText(currentText: string): void {
    const toRemove: string[] = [];
    
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
  getPendingPastes(): PendingPaste[] {
    return Array.from(this.pendingPastes.values());
  }

  /**
   * Check if there are any pending pastes
   */
  hasPendingPastes(): boolean {
    return this.pendingPastes.size > 0;
  }

  /**
   * Get the count of pending pastes
   */
  getPendingCount(): number {
    return this.pendingPastes.size;
  }
}

// Singleton instance
export const pasteManager = new PasteManager();
