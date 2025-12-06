import { db } from '../db/database.js';
import { SessionRepository } from '../db/repositories/session-repository.js';
import { MessageRepository } from '../db/repositories/message-repository.js';
import { Session, Message, SessionListItem } from '../db/types.js';
import { ChatEntry } from '../agent/grok-agent.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSessionHook } from '../timeline/hooks/session-hook.js';

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
  private sessionHook = getSessionHook();

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
      
      // 🕐 Timeline: Capture session created
      try {
        this.sessionHook.captureSessionCreated(
          this.currentSession.id,
          this.currentSession.session_name,
          workdir,
          model,
          provider
        ).catch(err => sessionDebugLog.log('⚠️  Timeline logging failed:', err));
      } catch (error) {
        sessionDebugLog.log('⚠️  Timeline logging failed for session created:', error);
      }
    }
    
    sessionDebugLog.log(`✅ [initSession] FINAL currentSession: id=${this.currentSession.id}\n`);
    
    return this.currentSession;
  }

  /**
   * Create a new session (Git-like branching for conversations)
   * 
   * @param workdir - Working directory for the new session (can be different from current)
   * @param provider - AI provider (e.g., 'openai', 'grok')
   * @param model - Model name (e.g., 'gpt-4o')
   * @param apiKey - Optional API key (will be hashed)
   * @param options - Import options
   *   - importHistory: Copy all messages from source session
   *   - fromSessionId: Import from specific session (default: current session)
   *   - dateRange: { start: Date, end: Date } - Filter messages by date
   * @returns The newly created session and its history
   */
  async createNewSession(
    workdir: string,
    provider: string,
    model: string,
    apiKey?: string,
    options?: {
      importHistory?: boolean;
      fromSessionId?: number;
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<{ session: Session; history: ChatEntry[]; importWarning?: string }> {
    const apiKeyHash = apiKey ? this.hashApiKey(apiKey) : undefined;
    // ✅ CHANGED: Default to true (import history by default)
    // Use --no-import-history to create a fresh session without context
    const importHistory = options?.importHistory !== false;
    const fromSessionId = options?.fromSessionId;
    const dateRange = options?.dateRange;
    
    sessionDebugLog.log(`🆕 [createNewSession] CALLED with:`);
    sessionDebugLog.log(`   workdir="${workdir}"`);
    sessionDebugLog.log(`   provider="${provider}"`);
    sessionDebugLog.log(`   model="${model}"`);
    sessionDebugLog.log(`   importHistory=${importHistory}`);
    sessionDebugLog.log(`   fromSessionId=${fromSessionId}`);
    sessionDebugLog.log(`   dateRange=${dateRange ? `${dateRange.start} → ${dateRange.end}` : 'none'}`);
    
    // Determine source session for history import
    let sourceSession: Session | null = null;
    if (importHistory) {
      if (fromSessionId) {
        // Import from specific session
        sourceSession = this.sessionRepo.findById(fromSessionId);
        if (!sourceSession) {
          throw new Error(`Source session not found: ${fromSessionId}`);
        }
        sessionDebugLog.log(`📋 [createNewSession] Importing from session ${fromSessionId}`);
      } else {
        // Import from current session
        sourceSession = this.currentSession;
        if (!sourceSession) {
          throw new Error('No current session to import from. Use --from-session <id>');
        }
        sessionDebugLog.log(`📋 [createNewSession] Importing from current session ${sourceSession.id}`);
      }
    }
    
    // Force creation of a new session (don't reuse existing)
    const newSession = this.sessionRepo.create(
      workdir,
      provider,
      model,
      apiKeyHash
    );
    
    sessionDebugLog.log(`✅ [createNewSession] New session created: id=${newSession.id}`);
    
    // Update current session reference
    this.currentSession = newSession;
    this.currentProvider = provider;
    this.currentModel = model;
    
    let history: ChatEntry[] = [];
    
    // Import history from source session if requested
    let importWarning: string | undefined;
    
    if (importHistory && sourceSession) {
      sessionDebugLog.log(`📋 [createNewSession] Importing history from session ${sourceSession.id}`);
      
      let messages = this.messageRepo.getBySession(sourceSession.id);
      const originalCount = messages.length;
      
      // Calculate actual date range of messages (for warning)
      let actualMinDate: Date | null = null;
      let actualMaxDate: Date | null = null;
      
      if (messages.length > 0) {
        const timestamps = messages.map(m => new Date(m.timestamp).getTime());
        actualMinDate = new Date(Math.min(...timestamps));
        actualMaxDate = new Date(Math.max(...timestamps));
      }
      
      // Filter by date range if specified
      if (dateRange) {
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();
        
        messages = messages.filter(msg => {
          const msgTime = new Date(msg.timestamp).getTime();
          return msgTime >= startTime && msgTime <= endTime;
        });
        
        sessionDebugLog.log(`📅 [createNewSession] Date filter: ${originalCount} → ${messages.length} messages`);
        sessionDebugLog.log(`   Range: ${dateRange.start.toISOString()} → ${dateRange.end.toISOString()}`);
        
        // Warning if date range excluded all messages
        if (messages.length === 0 && originalCount > 0 && actualMinDate && actualMaxDate) {
          const formatDate = (date: Date) => {
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
          };
          
          importWarning = 
            `⚠️  Date range excluded all ${originalCount} messages!\n\n` +
            `   Requested range:\n` +
            `      ${formatDate(dateRange.start)} → ${formatDate(dateRange.end)}\n\n` +
            `   Actual message range:\n` +
            `      ${formatDate(actualMinDate)} → ${formatDate(actualMaxDate)}\n\n` +
            `   💡 To import all messages, use:\n` +
            `      /new-session --from-session ${sourceSession.id} --date-range ${formatDate(actualMinDate)} ${formatDate(actualMaxDate)}`;
          
          sessionDebugLog.log(`⚠️  [createNewSession] ${importWarning}`);
        }
      }
      
      // Copy filtered messages to new session
      for (const message of messages) {
        const newMessage = this.messageRepo.save({
          session_id: newSession.id,
          type: message.type,
          role: message.role,
          content: message.content,
          content_type: message.content_type,
          provider: message.provider,
          model: message.model,
          api_key_hash: message.api_key_hash,
          tool_calls: message.tool_calls,
          tool_call_id: message.tool_call_id,
          is_streaming: false,
          token_count: message.token_count,
          timestamp: new Date().toISOString() // Use current timestamp for imported messages
        });
        
        // Convert to ChatEntry
        history.push(this.messageToEntry(newMessage));
      }
      
      sessionDebugLog.log(`✅ [createNewSession] Imported ${messages.length} messages`);
      
      // Update stats for the new session
      this.sessionRepo.updateSessionStats(newSession.id);
    }
    
    sessionDebugLog.log(`✅ [createNewSession] COMPLETE: session=${newSession.id}, history=${history.length} messages\n`);
    
    return { session: newSession, history, importWarning };
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
   * @param workdir - Filter by working directory (defaults to current, null = all directories)
   * @param options - Additional filtering options
   * @returns Array of enriched session list items
   */
  listSessions(
    workdir?: string | null,
    options?: {
      status?: ('active' | 'completed' | 'archived')[];
      favoriteOnly?: boolean;
      minMessages?: number;
      sortBy?: 'last_activity' | 'created_at' | 'message_count' | 'session_name';
      sortOrder?: 'ASC' | 'DESC';
      limit?: number;
    }
  ): SessionListItem[] {
    // If workdir is explicitly null, don't filter by directory (list all)
    // If workdir is undefined, default to current directory
    // If workdir is a string, use that directory
    const targetWorkdir = workdir === null ? null : (workdir || process.cwd());
    return this.sessionRepo.listSessions(targetWorkdir, options);
  }

  /**
   * Rename the specified session
   * @param sessionId - Session ID to rename
   * @param newName - New name for the session
   */
  renameSession(sessionId: number, newName: string): void {
    sessionDebugLog.log(`\n📝 [renameSession] CALLED with:`);
    sessionDebugLog.log(`   sessionId=${sessionId}`);
    sessionDebugLog.log(`   newName="${newName}"`);
    
    // Get old name before update
    const session = this.sessionRepo.findById(sessionId);
    const oldName = session?.session_name || '';
    
    this.sessionRepo.updateSessionName(sessionId, newName);
    
    // Update current session cache if it's the one being renamed
    if (this.currentSession && this.currentSession.id === sessionId) {
      this.currentSession.session_name = newName;
    }
    
    // 🕐 Timeline: Capture session renamed
    try {
      this.sessionHook.captureSessionRenamed(
        sessionId,
        oldName,
        newName
      ).catch(err => sessionDebugLog.log('⚠️  Timeline logging failed:', err));
    } catch (error) {
      sessionDebugLog.log('⚠️  Timeline logging failed for session renamed:', error);
    }
    
    sessionDebugLog.log(`✅ [renameSession] Session ${sessionId} renamed to "${newName}"`);
  }

  /**
   * Switch to a different session
   * 
   * @param sessionId - ID of the session to switch to
   * @returns The new active session and its history
   * @throws Error if session not found or on failure
   */
  async switchSession(sessionId: number): Promise<{ session: Session; history: ChatEntry[] }> {
    sessionDebugLog.log(`\n🔄 [switchSession] CALLED with sessionId=${sessionId}`);
    
    const fromSessionId = this.currentSession?.id;
    
    // Find the session
    const targetSession = this.sessionRepo.findById(sessionId);
    
    if (!targetSession) {
      sessionDebugLog.log(`❌ [switchSession] Session ${sessionId} not found`);
      throw new Error(`Session ${sessionId} not found`);
    }
    
    sessionDebugLog.log(`✅ [switchSession] Target session found:`);
    sessionDebugLog.log(`   working_dir="${targetSession.working_dir}"`);
    sessionDebugLog.log(`   provider="${targetSession.default_provider}"`);
    sessionDebugLog.log(`   model="${targetSession.default_model}"`);
    sessionDebugLog.log(`   status="${targetSession.status}"`);
    
    // Close current session if exists
    if (this.currentSession) {
      sessionDebugLog.log(`📋 [switchSession] Closing previous session ${this.currentSession.id}`);
      this.sessionRepo.updateLastActivity(this.currentSession.id);
    }
    
    // Update target session to active
    if (targetSession.status !== 'active') {
      sessionDebugLog.log(`🔓 [switchSession] Reactivating session ${sessionId}`);
      this.sessionRepo.updateStatus(sessionId, 'active');
      targetSession.status = 'active';
    }
    
    // Update current session reference
    this.currentSession = targetSession;
    this.currentProvider = targetSession.default_provider;
    this.currentModel = targetSession.default_model;
    
    // Update last activity
    this.sessionRepo.updateLastActivity(sessionId);
    
    // Load history from the new session
    const messages = this.messageRepo.getBySession(sessionId);
    const history = messages.map(this.messageToEntry);
    
    sessionDebugLog.log(`✅ [switchSession] Switched successfully:`);
    sessionDebugLog.log(`   currentSession.id=${this.currentSession.id}`);
    sessionDebugLog.log(`   currentProvider="${this.currentProvider}"`);
    sessionDebugLog.log(`   currentModel="${this.currentModel}"`);
    sessionDebugLog.log(`   history.length=${history.length}`);
    
    // 🕐 Timeline: Capture session switched
    if (fromSessionId) {
      try {
        this.sessionHook.captureSessionSwitched(
          fromSessionId,
          sessionId,
          targetSession.working_dir
        ).catch(err => sessionDebugLog.log('⚠️  Timeline logging failed:', err));
      } catch (error) {
        sessionDebugLog.log('⚠️  Timeline logging failed for session switch:', error);
      }
    }
    
    return {
      session: this.currentSession,
      history
    };
  }

  /**
   * Load chat history from current session
   */
  async loadChatHistory(): Promise<ChatEntry[]> {
    if (!this.currentSession) {
      sessionDebugLog.log('⚠️  [loadChatHistory] No active session - returning empty history');
      sessionDebugLog.log('   Make sure initSession() was called in GrokAgent constructor');
      return [];
    }

    sessionDebugLog.log(`✅ [loadChatHistory] Loading history for session ${this.currentSession.id}`);
    const messages = this.messageRepo.getBySession(this.currentSession.id);
    sessionDebugLog.log(`✅ [loadChatHistory] Loaded ${messages.length} messages`);
    return messages.map(this.messageToEntry);
  }

  /**
   * Append chat entry to current session
   */
  async appendChatEntry(entry: ChatEntry): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call initSession first.');
    }

    const message = await this.saveMessage(entry);
    
    // Update session last activity
    this.sessionRepo.updateLastActivity(this.currentSession.id);
    
    // Update session stats (message_count, total_tokens, previews)
    // This is fast (~1-5ms) and keeps denormalized fields fresh
    this.sessionRepo.updateSessionStats(this.currentSession.id);
    
    // Auto-generate session name from first user message
    if (entry.type === 'user' && !this.currentSession.session_name) {
      const sessionName = this.generateSessionName(entry.content);
      this.sessionRepo.updateSessionName(this.currentSession.id, sessionName);
      // Update cached session
      this.currentSession.session_name = sessionName;
    }
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
   * Generate a session name from first user message
   * Extracts meaningful text, cleans it, and truncates to 50 chars
   * 
   * Examples:
   *   "Help me debug this React component" → "Help me debug this React component"
   *   "Create a new API endpoint\nfor user management" → "Create a new API endpoint for user manag..."
   *   "/list_sessions" → "list_sessions"
   * 
   * @param content - First user message content
   * @returns Clean, readable session name
   */
  private generateSessionName(content: string): string {
    if (!content || content.trim().length === 0) {
      return 'New Session';
    }

    // Clean the content
    let name = content
      .replace(/[\r\n]+/g, ' ')          // Replace newlines with spaces
      .replace(/\s{2,}/g, ' ')            // Collapse multiple spaces
      .replace(/[^\w\s\-_.!?]/g, '')      // Remove special chars except basic punctuation
      .trim();

    // Handle commands (starts with /)
    if (name.startsWith('/')) {
      name = name.substring(1); // Remove leading /
    }

    // Truncate to 50 characters
    if (name.length > 50) {
      name = name.substring(0, 47) + '...';
    }

    // Fallback if empty after cleaning
    if (name.length === 0) {
      return 'New Session';
    }

    return name;
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
