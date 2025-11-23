import { db } from '../db/database.js';
import { SessionRepository } from '../db/repositories/session-repository.js';
import { MessageRepository } from '../db/repositories/message-repository.js';
import { Session, Message, SessionListItem } from '../db/types.js';
import { ChatEntry } from '../agent/grok-agent.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SessionState {
  version: number;
  model?: string;
  autoEditEnabled?: boolean;
  cwd?: string;
  sessionId?: number;
}

/**
 * Session-specific debug logger
 */
class SessionDebugLogger {
  private logPath: string;
  
  constructor() {
    const logDir = path.join(os.homedir(), '.grok');
    this.logPath = path.join(logDir, 'debug_session.log');
    
    // Clear log on startup
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(this.logPath, `=== Session Debug Log - ${new Date().toISOString()} ===\n`);
    } catch (error) {
      // Ignore errors
    }
  }
  
  log(...args: any[]) {
    try {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      fs.appendFileSync(this.logPath, `[${timestamp}] ${message}\n`);
    } catch (error) {
      // Ignore errors
    }
  }
}

const sessionDebugLog = new SessionDebugLogger();

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
    
    sessionDebugLog.log(`🔍 [initSession] CALLED with:`);
    sessionDebugLog.log(`   workdir="${workdir}"`);
    sessionDebugLog.log(`   provider="${provider}"`);
    sessionDebugLog.log(`   model="${model}"`);
    sessionDebugLog.log(`   apiKeyHash="${apiKeyHash?.substring(0, 8)}..."`);
    
    // Try to find existing session by workdir first (for continuity)
    const existingSession = this.sessionRepo.findLastSessionByWorkdir(workdir);
    
    if (existingSession) {
      sessionDebugLog.log(`🔍 [initSession] existingSession FOUND:`);
      sessionDebugLog.log(`   id=${existingSession.id}`);
      sessionDebugLog.log(`   status="${existingSession.status}"`);
      sessionDebugLog.log(`   default_provider="${existingSession.default_provider}"`);
      sessionDebugLog.log(`   default_model="${existingSession.default_model}"`);
      sessionDebugLog.log(`   working_dir="${existingSession.working_dir}"`);
    } else {
      sessionDebugLog.log(`🔍 [initSession] existingSession: NULL`);
    }
    
    if (existingSession) {
      // Reuse existing session, update provider/model if changed
      sessionDebugLog.log(`✅ [initSession] Reusing existing session ${existingSession.id}`);
      this.sessionRepo.updateSessionProviderAndModel(
        existingSession.id,
        provider,
        model,
        apiKeyHash
      );
      this.currentSession = this.sessionRepo.findById(existingSession.id)!;
      sessionDebugLog.log(`✅ [initSession] Session updated successfully:`);
      sessionDebugLog.log(`   id=${this.currentSession.id}`);
      sessionDebugLog.log(`   status="${this.currentSession.status}"`);
      sessionDebugLog.log(`   default_provider="${this.currentSession.default_provider}"`);
      sessionDebugLog.log(`   default_model="${this.currentSession.default_model}"`);
    } else {
      // No existing session, create new one
      sessionDebugLog.log(`🆕 [initSession] No existing session, calling findOrCreate()`);
      this.currentSession = this.sessionRepo.findOrCreate(
        workdir,
        provider,
        model,
        apiKeyHash
      );
      sessionDebugLog.log(`🆕 [initSession] New session created: id=${this.currentSession.id}`);
    }
    
    sessionDebugLog.log(`✅ [initSession] FINAL currentSession: id=${this.currentSession.id}\n`);
    
    return this.currentSession;
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Find last session by working directory (for session restoration)
   */
  findLastSessionByWorkdir(workdir: string): Session | null {
    return this.sessionRepo.findLastSessionByWorkdir(workdir);
  }

  /**
   * List sessions with enriched metadata
   * 
   * @param workdir - Filter by working directory (defaults to current)
   * @param options - Additional filtering options
   * @returns Array of enriched session list items
   */
  listSessions(
    workdir?: string,
    options?: {
      status?: ('active' | 'completed' | 'archived')[];
      favoriteOnly?: boolean;
      minMessages?: number;
      sortBy?: 'last_activity' | 'created_at' | 'message_count' | 'session_name';
      sortOrder?: 'ASC' | 'DESC';
      limit?: number;
    }
  ): SessionListItem[] {
    const targetWorkdir = workdir || process.cwd();
    return this.sessionRepo.listSessions(targetWorkdir, options);
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
    
    // ✅ Update session in database
    if (this.currentSession) {
      try {
        const database = db.getDb();
        database.prepare(`
          UPDATE sessions 
          SET default_provider = ?, 
              default_model = ?,
              last_activity = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(provider, model, this.currentSession.id);
        
        // Update currentSession object
        this.currentSession.default_provider = provider;
        this.currentSession.default_model = model;
        
        console.log(`✅ Switched to ${provider} (${model}) - DB updated`);
      } catch (error) {
        console.error(`⚠️  Failed to update session in DB:`, error);
        console.log(`✅ Switched to ${provider} (${model}) - Memory only`);
      }
    } else {
      console.log(`✅ Switched to ${provider} (${model}) - No active session`);
    }
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
