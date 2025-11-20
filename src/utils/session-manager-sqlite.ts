import { db } from '../db/database.js';
import { SessionRepository } from '../db/repositories/session-repository.js';
import { MessageRepository } from '../db/repositories/message-repository.js';
import { Session, Message } from '../db/types.js';
import { ChatEntry } from '../agent/grok-agent.js';
import crypto from 'crypto';

export interface SessionState {
  version: number;
  model?: string;
  autoEditEnabled?: boolean;
  cwd?: string;
  sessionId?: number;
}

/**
 * Singleton for managing SQLite-based sessions
 */
export class SessionManagerSQLite {
  private static instance: SessionManagerSQLite;
  private sessionRepo: SessionRepository;
  private messageRepo: MessageRepository;
  private currentSession: Session | null = null;
  private currentProvider: string = 'grok';
  private currentModel: string = 'grok-code-fast-1';

  private constructor() {
    this.sessionRepo = new SessionRepository(db.getDb());
    this.messageRepo = new MessageRepository(db.getDb());
  }

  static getInstance(): SessionManagerSQLite {
    if (!SessionManagerSQLite.instance) {
      SessionManagerSQLite.instance = new SessionManagerSQLite();
    }
    return SessionManagerSQLite.instance;
  }

  /**
   * Initialize or resume session for current working directory
   */
  initSession(workdir: string, provider: string, model: string, apiKey?: string): Session {
    const apiKeyHash = apiKey ? this.hashApiKey(apiKey) : undefined;
    
    this.currentProvider = provider;
    this.currentModel = model;
    
    // Find or create session
    this.currentSession = this.sessionRepo.findOrCreate(
      workdir,
      provider,
      model,
      apiKeyHash
    );
    
    return this.currentSession;
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Load chat history from current session
   */
  async loadChatHistory(): Promise<ChatEntry[]> {
    if (!this.currentSession) {
      return [];
    }

    const messages = this.messageRepo.getBySession(this.currentSession.id);
    return messages.map(this.messageToEntry);
  }

  /**
   * Append chat entry to current session
   */
  async appendChatEntry(entry: ChatEntry): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call initSession first.');
    }

    await this.saveMessage(entry);
    
    // Update session last activity
    this.sessionRepo.updateLastActivity(this.currentSession.id);
  }

  /**
   * Save a message to the database
   */
  private async saveMessage(entry: ChatEntry): Promise<Message> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const message = this.messageRepo.save({
      session_id: this.currentSession.id,
      type: entry.type,
      role: this.getRole(entry.type),
      content: entry.content,
      provider: this.currentProvider,
      model: this.currentModel,
      timestamp: entry.timestamp.toISOString(),
      tool_calls: entry.toolCalls,
      tool_call_id: entry.toolCall?.id,
      is_streaming: entry.isStreaming || false,
    });

    return message;
  }

  /**
   * Convert message type to OpenAI role
   */
  private getRole(type: string): string {
    switch (type) {
      case 'user':
        return 'user';
      case 'assistant':
        return 'assistant';
      case 'tool_result':
        return 'tool';
      default:
        return 'user';
    }
  }

  /**
   * Convert DB Message to ChatEntry
   */
  private messageToEntry(message: Message): ChatEntry {
    return {
      type: message.type as any,
      content: message.content,
      timestamp: new Date(message.timestamp),
      toolCalls: message.tool_calls ? JSON.parse(message.tool_calls) : undefined,
      toolCall: message.tool_call_id ? { id: message.tool_call_id } as any : undefined,
      isStreaming: false,
    };
  }

  /**
   * Switch to a different provider in current session
   */
  switchProvider(provider: string, model: string, apiKey?: string) {
    this.currentProvider = provider;
    this.currentModel = model;
    
    // Note: Next messages will use the new provider
    console.log(`✅ Switched to ${provider} (${model})`);
  }

  /**
   * Close current session
   */
  closeSession() {
    if (this.currentSession) {
      this.sessionRepo.closeSession(this.currentSession.id);
      this.currentSession = null;
    }
  }

  /**
   * Save session state (for backward compatibility)
   */
  async saveState(state: SessionState): Promise<void> {
    if (this.currentSession && state.model) {
      // Update session title if it's new
      if (!this.currentSession.title) {
        this.sessionRepo.updateTitle(
          this.currentSession.id,
          `Session in ${this.currentSession.working_dir}`
        );
      }
    }
  }

  /**
   * Load session state (for backward compatibility)
   */
  async loadState(): Promise<SessionState | null> {
    if (!this.currentSession) {
      return null;
    }

    return {
      version: 1,
      model: this.currentSession.default_model,
      cwd: this.currentSession.working_dir,
      sessionId: this.currentSession.id,
    };
  }

  /**
   * Clear session (close and delete all messages)
   */
  async clearSession(): Promise<void> {
    if (this.currentSession) {
      this.messageRepo.deleteBySession(this.currentSession.id);
      this.sessionRepo.closeSession(this.currentSession.id);
      this.currentSession = null;
    }
  }

  /**
   * Hash API key for tracking (not storing the key itself!)
   */
  private hashApiKey(apiKey: string): string {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId?: number): { messageCount: number; providers: string[] } {
    const id = sessionId || this.currentSession?.id;
    if (!id) {
      return { messageCount: 0, providers: [] };
    }

    const messages = this.messageRepo.getBySession(id);
    const providers = [...new Set(messages.map(m => m.provider))];

    return {
      messageCount: messages.length,
      providers,
    };
  }
}

// Export singleton instance (for backward compatibility with old session-manager)
export const sessionManager = SessionManagerSQLite.getInstance();

// Export functions that mimic old API
export async function loadChatHistory(): Promise<ChatEntry[]> {
  return sessionManager.loadChatHistory();
}

export async function appendChatEntry(entry: ChatEntry): Promise<void> {
  return sessionManager.appendChatEntry(entry);
}

export async function saveState(state: SessionState): Promise<void> {
  return sessionManager.saveState(state);
}

export async function loadState(): Promise<SessionState | null> {
  return sessionManager.loadState();
}

export async function clearSession(): Promise<void> {
  return sessionManager.clearSession();
}
