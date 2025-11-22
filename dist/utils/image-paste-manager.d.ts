/**
 * Image Paste Manager - Handle image clipboard paste
 *
 * Inspired by Codex's clipboard_paste.rs implementation.
 *
 * Features:
 * - Detect images in clipboard
 * - Save to temporary file
 * - Create visual placeholder: [image.png 1920x1080]
 * - Attach to message for Vision API
 */
export interface AttachedImage {
    placeholder: string;
    path: string;
    width: number;
    height: number;
    format: string;
}
export interface ImagePasteResult {
    success: boolean;
    image?: AttachedImage;
    error?: string;
}
export declare class ImagePasteManager {
    private attachedImages;
    private imageCounter;
    /**
     * Try to paste an image from clipboard
     * Returns placeholder text if successful, null if no image
     */
    tryPasteImage(): Promise<ImagePasteResult>;
    /**
     * Paste image on Linux using xclip
     */
    private pasteImageLinux;
    /**
     * Paste image on macOS using osascript/pngpaste
     */
    private pasteImageMacOS;
    /**
     * Paste image on Windows (PowerShell)
     */
    private pasteImageWindows;
    /**
     * Get all attached images
     */
    getAttachedImages(): AttachedImage[];
    /**
     * Get image by placeholder
     */
    getImage(placeholder: string): AttachedImage | undefined;
    /**
     * Remove image by placeholder
     */
    removeImage(placeholder: string): boolean;
    /**
     * Clear all attached images
     */
    clearAll(): void;
    /**
     * Check if placeholder is an image placeholder
     */
    isImagePlaceholder(text: string): boolean;
    /**
     * Find image placeholder at cursor position
     */
    findImagePlaceholderAtCursor(text: string, cursorPos: number): {
        placeholder: string;
        start: number;
        end: number;
    } | null;
    /**
     * Sync with current text (remove placeholders no longer present)
     */
    syncWithText(currentText: string): void;
}
export declare const imagePasteManager: ImagePasteManager;
