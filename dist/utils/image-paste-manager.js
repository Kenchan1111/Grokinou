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
import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sizeOf from 'image-size';
export class ImagePasteManager {
    attachedImages = new Map();
    imageCounter = 0;
    /**
     * Try to paste an image from clipboard
     * Returns placeholder text if successful, null if no image
     */
    async tryPasteImage() {
        try {
            // Try to read image from clipboard (Linux with xclip)
            if (process.platform === 'linux') {
                return await this.pasteImageLinux();
            }
            else if (process.platform === 'darwin') {
                return await this.pasteImageMacOS();
            }
            else if (process.platform === 'win32') {
                return await this.pasteImageWindows();
            }
            return {
                success: false,
                error: 'Unsupported platform for image paste'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Paste image on Linux using xclip
     */
    async pasteImageLinux() {
        try {
            // Check if xclip is available
            try {
                execSync('which xclip', { stdio: 'ignore' });
            }
            catch {
                return {
                    success: false,
                    error: 'xclip not installed. Install with: sudo apt-get install xclip'
                };
            }
            // Try to get image from clipboard
            const imageData = execSync('xclip -selection clipboard -t image/png -o', {
                encoding: 'buffer',
                maxBuffer: 50 * 1024 * 1024, // 50MB max
            });
            if (!imageData || imageData.length === 0) {
                return {
                    success: false,
                    error: 'No image in clipboard'
                };
            }
            // Save to temporary file
            this.imageCounter++;
            const timestamp = Date.now();
            const filename = `grok-clipboard-${timestamp}-${this.imageCounter}.png`;
            const tempPath = join(tmpdir(), filename);
            writeFileSync(tempPath, imageData);
            // Get image dimensions
            const dimensions = sizeOf(imageData);
            const width = dimensions.width || 0;
            const height = dimensions.height || 0;
            const format = dimensions.type?.toUpperCase() || 'PNG';
            // Create placeholder
            const placeholder = `[${filename} ${width}x${height}]`;
            const image = {
                placeholder,
                path: tempPath,
                width,
                height,
                format,
            };
            // Store image
            this.attachedImages.set(placeholder, image);
            return {
                success: true,
                image,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to paste image'
            };
        }
    }
    /**
     * Paste image on macOS using osascript/pngpaste
     */
    async pasteImageMacOS() {
        try {
            // Try pngpaste first (brew install pngpaste)
            try {
                execSync('which pngpaste', { stdio: 'ignore' });
                this.imageCounter++;
                const timestamp = Date.now();
                const filename = `grok-clipboard-${timestamp}-${this.imageCounter}.png`;
                const tempPath = join(tmpdir(), filename);
                execSync(`pngpaste "${tempPath}"`, { stdio: 'ignore' });
                if (!existsSync(tempPath)) {
                    return {
                        success: false,
                        error: 'No image in clipboard'
                    };
                }
                const imageBuffer = require('fs').readFileSync(tempPath);
                const dimensions = sizeOf(imageBuffer);
                const width = dimensions.width || 0;
                const height = dimensions.height || 0;
                const format = dimensions.type?.toUpperCase() || 'PNG';
                const placeholder = `[${filename} ${width}x${height}]`;
                const image = {
                    placeholder,
                    path: tempPath,
                    width,
                    height,
                    format,
                };
                this.attachedImages.set(placeholder, image);
                return {
                    success: true,
                    image,
                };
            }
            catch {
                return {
                    success: false,
                    error: 'pngpaste not installed. Install with: brew install pngpaste'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to paste image'
            };
        }
    }
    /**
     * Paste image on Windows (PowerShell)
     */
    async pasteImageWindows() {
        try {
            this.imageCounter++;
            const timestamp = Date.now();
            const filename = `grok-clipboard-${timestamp}-${this.imageCounter}.png`;
            const tempPath = join(tmpdir(), filename);
            // PowerShell script to save clipboard image
            const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $img = [Windows.Forms.Clipboard]::GetImage()
        if ($img -ne $null) {
          $img.Save('${tempPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
          exit 0
        } else {
          exit 1
        }
      `;
            execSync(`powershell -Command "${psScript}"`, { stdio: 'ignore' });
            if (!existsSync(tempPath)) {
                return {
                    success: false,
                    error: 'No image in clipboard'
                };
            }
            const imageBuffer = require('fs').readFileSync(tempPath);
            const dimensions = sizeOf(imageBuffer);
            const width = dimensions.width || 0;
            const height = dimensions.height || 0;
            const format = dimensions.type?.toUpperCase() || 'PNG';
            const placeholder = `[${filename} ${width}x${height}]`;
            const image = {
                placeholder,
                path: tempPath,
                width,
                height,
                format,
            };
            this.attachedImages.set(placeholder, image);
            return {
                success: true,
                image,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to paste image'
            };
        }
    }
    /**
     * Get all attached images
     */
    getAttachedImages() {
        return Array.from(this.attachedImages.values());
    }
    /**
     * Get image by placeholder
     */
    getImage(placeholder) {
        return this.attachedImages.get(placeholder);
    }
    /**
     * Remove image by placeholder
     */
    removeImage(placeholder) {
        return this.attachedImages.delete(placeholder);
    }
    /**
     * Clear all attached images
     */
    clearAll() {
        this.attachedImages.clear();
    }
    /**
     * Check if placeholder is an image placeholder
     */
    isImagePlaceholder(text) {
        return this.attachedImages.has(text);
    }
    /**
     * Find image placeholder at cursor position
     */
    findImagePlaceholderAtCursor(text, cursorPos) {
        for (const image of this.attachedImages.values()) {
            const { placeholder } = image;
            let index = 0;
            while ((index = text.indexOf(placeholder, index)) !== -1) {
                const start = index;
                const end = index + placeholder.length;
                if (cursorPos >= start && cursorPos <= end) {
                    return { placeholder, start, end };
                }
                index += placeholder.length;
            }
        }
        return null;
    }
    /**
     * Sync with current text (remove placeholders no longer present)
     */
    syncWithText(currentText) {
        const toRemove = [];
        for (const [placeholder] of this.attachedImages) {
            if (!currentText.includes(placeholder)) {
                toRemove.push(placeholder);
            }
        }
        for (const placeholder of toRemove) {
            this.attachedImages.delete(placeholder);
        }
    }
}
// Singleton instance
export const imagePasteManager = new ImagePasteManager();
//# sourceMappingURL=image-paste-manager.js.map