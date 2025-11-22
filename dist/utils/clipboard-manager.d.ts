import { Message } from '../db/types.js';
export interface ClipboardOptions {
    includeMetadata?: boolean;
    format?: 'markdown' | 'plain';
}
export interface MessageContext {
    sessionDate: string;
    workdir: string;
    provider: string;
    model: string;
}
/**
 * Manages clipboard operations for search results
 */
export declare class ClipboardManager {
    /**
     * Copy single message to system clipboard (Markdown format)
     */
    copySingleMessage(message: Message, context: MessageContext, options?: ClipboardOptions): Promise<number>;
    /**
     * Copy conversation pair (user + assistant) to clipboard
     */
    copyConversationPair(userMessage: Message, assistantMessage: Message, context: MessageContext, options?: ClipboardOptions): Promise<number>;
    /**
     * Read from system clipboard
     */
    readClipboard(): Promise<string>;
    /**
     * Format message header with metadata
     */
    private formatHeader;
    /**
     * Format message footer
     */
    private formatFooter;
    /**
     * Format single message with metadata
     */
    private formatMessage;
    /**
     * Format message content based on role
     */
    private formatMessageContent;
    /**
     * Check if clipboard functionality is available
     */
    isAvailable(): Promise<boolean>;
}
export declare const clipboardManager: ClipboardManager;
