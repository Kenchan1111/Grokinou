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

import { existsSync, statSync, readFileSync } from 'fs';
import { extname, basename, resolve } from 'path';
import sizeOf from 'image-size';

export interface DetectedImage {
  path: string;
  filename: string;
  width: number;
  height: number;
  format: string;
  placeholder: string;
}

/**
 * Normalize pasted path (handle quotes, tildes, etc.)
 */
function normalizePath(pasted: string): string | null {
  let path = pasted.trim();
  
  // Remove quotes
  if ((path.startsWith('"') && path.endsWith('"')) ||
      (path.startsWith("'") && path.endsWith("'"))) {
    path = path.slice(1, -1);
  }
  
  // Expand tilde
  if (path.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) {
      path = path.replace(/^~/, home);
    }
  }
  
  // Make absolute
  if (!path.startsWith('/')) {
    path = resolve(process.cwd(), path);
  }
  
  return path;
}

/**
 * Check if file extension is an image
 */
function isImageExtension(filepath: string): boolean {
  const ext = extname(filepath).toLowerCase();
  const imageExts = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp',
    '.tiff', '.tif', '.svg', '.ico', '.heic', '.heif'
  ];
  return imageExts.includes(ext);
}

/**
 * Try to detect if pasted text is an image path
 * Returns DetectedImage if valid, null otherwise
 */
export function detectImagePath(pasted: string): DetectedImage | null {
  // Quick filter: must look like a path
  if (!pasted.includes('/') && !pasted.includes('\\')) {
    return null;
  }
  
  const path = normalizePath(pasted);
  if (!path) {
    return null;
  }
  
  // Check if file exists
  if (!existsSync(path)) {
    return null;
  }
  
  // Check if it's a file (not directory)
  const stats = statSync(path);
  if (!stats.isFile()) {
    return null;
  }
  
  // Check extension
  if (!isImageExtension(path)) {
    return null;
  }
  
  // Try to get dimensions
  try {
    const buffer = readFileSync(path);
    const dimensions = sizeOf(buffer);
    
    const width = dimensions.width || 0;
    const height = dimensions.height || 0;
    const format = dimensions.type?.toUpperCase() || 'IMG';
    const filename = basename(path);
    
    // Create placeholder like Codex
    const placeholder = `[${filename} ${width}x${height}]`;
    
    return {
      path,
      filename,
      width,
      height,
      format,
      placeholder,
    };
  } catch (error) {
    // Not a valid image file
    return null;
  }
}

/**
 * Image Path Manager - Manages attached images
 */
export class ImagePathManager {
  private attachedImages: Map<string, DetectedImage> = new Map();
  
  /**
   * Process pasted content, detect if it's an image path
   * Returns placeholder if image detected, original text otherwise
   */
  processPaste(pasted: string): { isImage: boolean; textToInsert: string; image?: DetectedImage } {
    const detected = detectImagePath(pasted);
    
    if (detected) {
      // Store the image
      this.attachedImages.set(detected.placeholder, detected);
      
      return {
        isImage: true,
        textToInsert: detected.placeholder,
        image: detected,
      };
    }
    
    // Not an image, return as-is
    return {
      isImage: false,
      textToInsert: pasted,
    };
  }
  
  /**
   * Get all attached images
   */
  getAttachedImages(): DetectedImage[] {
    return Array.from(this.attachedImages.values());
  }
  
  /**
   * Get image by placeholder
   */
  getImage(placeholder: string): DetectedImage | undefined {
    return this.attachedImages.get(placeholder);
  }
  
  /**
   * Check if text contains image placeholder
   */
  isImagePlaceholder(text: string): boolean {
    return this.attachedImages.has(text);
  }
  
  /**
   * Remove image by placeholder
   */
  removeImage(placeholder: string): boolean {
    return this.attachedImages.delete(placeholder);
  }
  
  /**
   * Find image placeholder at cursor position
   */
  findImagePlaceholderAtCursor(text: string, cursorPos: number): {
    placeholder: string;
    start: number;
    end: number;
  } | null {
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
   * Sync with text (remove images no longer present)
   */
  syncWithText(currentText: string): void {
    const toRemove: string[] = [];
    
    for (const [placeholder] of this.attachedImages) {
      if (!currentText.includes(placeholder)) {
        toRemove.push(placeholder);
      }
    }
    
    for (const placeholder of toRemove) {
      this.attachedImages.delete(placeholder);
    }
  }
  
  /**
   * Clear all images
   */
  clearAll(): void {
    this.attachedImages.clear();
  }
}

// Singleton
export const imagePathManager = new ImagePathManager();
