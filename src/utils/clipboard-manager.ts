import clipboard from 'clipboardy';
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
export class ClipboardManager {
  /**
   * Copy single message to system clipboard (Markdown format)
   */
  async copySingleMessage(
    message: Message,
    context: MessageContext,
    options: ClipboardOptions = {}
  ): Promise<number> {
    const { includeMetadata = true, format = 'markdown' } = options;
    
    const formatted = this.formatMessage(message, context, { includeMetadata, format });
    await clipboard.write(formatted);
    
    return formatted.length;
  }

  /**
   * Copy conversation pair (user + assistant) to clipboard
   */
  async copyConversationPair(
    userMessage: Message,
    assistantMessage: Message,
    context: MessageContext,
    options: ClipboardOptions = {}
  ): Promise<number> {
    const { includeMetadata = true, format = 'markdown' } = options;
    
    let output = '';
    
    // Header
    if (includeMetadata) {
      output += this.formatHeader(context);
      output += '\n\n';
    }
    
    // User message
    output += this.formatMessageContent(userMessage, format);
    output += '\n\n';
    
    // Assistant message
    output += this.formatMessageContent(assistantMessage, format);
    
    // Footer
    if (includeMetadata) {
      output += '\n\n';
      output += this.formatFooter();
    }
    
    await clipboard.write(output);
    return output.length;
  }

  /**
   * Read from system clipboard
   */
  async readClipboard(): Promise<string> {
    try {
      return await clipboard.read();
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      return '';
    }
  }

  /**
   * Format message header with metadata
   */
  private formatHeader(context: MessageContext): string {
    return [
      `---`,
      `**Session**: ${context.sessionDate}`,
      `**Working Directory**: \`${context.workdir}\``,
      `**Provider**: ${context.provider} (${context.model})`,
      `---`,
    ].join('\n');
  }

  /**
   * Format message footer
   */
  private formatFooter(): string {
    return `*Copied from Grok CLI*`;
  }

  /**
   * Format single message with metadata
   */
  private formatMessage(
    message: Message,
    context: MessageContext,
    options: { includeMetadata: boolean; format: string }
  ): string {
    let output = '';
    
    // Header
    if (options.includeMetadata) {
      output += this.formatHeader(context);
      output += '\n\n';
    }
    
    // Content
    output += this.formatMessageContent(message, options.format);
    
    // Footer
    if (options.includeMetadata) {
      output += '\n\n';
      output += this.formatFooter();
    }
    
    return output;
  }

  /**
   * Format message content based on role
   */
  private formatMessageContent(message: Message, format: string): string {
    const roleIcon = message.role === 'user' ? '👤' : '🤖';
    const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
    
    if (format === 'markdown') {
      return [
        `### ${roleIcon} ${roleLabel}`,
        '',
        message.content,
      ].join('\n');
    }
    
    // Plain format
    return [
      `${roleIcon} ${roleLabel}:`,
      message.content,
    ].join('\n');
  }

  /**
   * Check if clipboard functionality is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await clipboard.read();
      return true;
    } catch {
      return false;
    }
  }
}

export const clipboardManager = new ClipboardManager();
