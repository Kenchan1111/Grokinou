/**
 * Image Path Detector - Simple approach like Codex
 *
 * Detects if pasted text is a path to an image file.
 * Much simpler than clipboard pixel capture!
 *
 * How it works:
 * 1. User copies image file in file manager
 * 2. Clipboard contains: /home/user/screenshot.png
 * 3. User pastes (Ctrl+V) - terminal handles natively
 * 4. We detect it's an image path
 * 5. Create placeholder: [screenshot.png 1920x1080]
 * 6. Attach for Vision API
 */
export interface DetectedImage {
    path: string;
    filename: string;
    width: number;
    height: number;
    format: string;
    placeholder: string;
}
/**
 * Try to detect if pasted text is an image path
 * Returns DetectedImage if valid, null otherwise
 */
export declare function detectImagePath(pasted: string): DetectedImage | null;
/**
 * Image Path Manager - Manages attached images
 */
export declare class ImagePathManager {
    private attachedImages;
    /**
     * Process pasted content, detect if it's an image path
     * Returns placeholder if image detected, original text otherwise
     */
    processPaste(pasted: string): {
        isImage: boolean;
        textToInsert: string;
        image?: DetectedImage;
    };
    /**
     * Get all attached images
     */
    getAttachedImages(): DetectedImage[];
    /**
     * Get image by placeholder
     */
    getImage(placeholder: string): DetectedImage | undefined;
    /**
     * Check if text contains image placeholder
     */
    isImagePlaceholder(text: string): boolean;
    /**
     * Remove image by placeholder
     */
    removeImage(placeholder: string): boolean;
    /**
     * Find image placeholder at cursor position
     */
    findImagePlaceholderAtCursor(text: string, cursorPos: number): {
        placeholder: string;
        start: number;
        end: number;
    } | null;
    /**
     * Sync with text (remove images no longer present)
     */
    syncWithText(currentText: string): void;
    /**
     * Clear all images
     */
    clearAll(): void;
}
export declare const imagePathManager: ImagePathManager;
