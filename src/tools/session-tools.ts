/**
 * Session Management Tools
 * Git-like conversation branching and time travel
 */

import { ToolResult } from '../types/index.js';
import { sessionManager } from '../utils/session-manager-sqlite.js';
import { providerManager } from '../utils/provider-manager.js';
import { SessionListItem } from '../db/types.js';

/**
 * Tool: session_list
 * List all conversation sessions
 */
export async function executeSessionList(): Promise<ToolResult> {
  try {
    const sessions = sessionManager.listSessions();
    
    if (sessions.length === 0) {
      return {
        success: true,
        output: `📋 **No Sessions Found**

No conversation sessions in the database yet.

💡 Create your first session by starting a conversation!`
      };
    }
    
    // Format session list
    const currentSession = sessionManager.getCurrentSession();
    
    let output = `📋 **Conversation Sessions** (${sessions.length} total)\n\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    for (const session of sessions) {
      const isCurrent = currentSession?.id === session.id;
      const statusEmoji = session.status === 'active' ? '🟢' : session.status === 'completed' ? '✅' : '📦';
      
      output += `${isCurrent ? '👉 ' : '   '}**Session #${session.id}** ${statusEmoji}\n`;
      output += `   📂 Directory: ${session.working_dir}\n`;
      output += `   🤖 Provider: ${session.default_provider} (${session.default_model})\n`;
      output += `   💬 Messages: ${session.message_count || 0}\n`;
      
      if (session.session_name) {
        output += `   📝 Name: ${session.session_name}\n`;
      }
      
      if (session.first_message_preview) {
        const preview = session.first_message_preview.substring(0, 60);
        output += `   💭 First: "${preview}${session.first_message_preview.length > 60 ? '...' : ''}"\n`;
      }
      
      output += `   📅 Created: ${new Date(session.created_at).toLocaleDateString()}\n`;
      output += `   🕐 Last Active: ${new Date(session.last_activity).toLocaleString()}\n`;
      
      if (isCurrent) {
        output += `   ✨ **CURRENT SESSION**\n`;
      }
      
      output += `\n`;
    }
    
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    output += `💡 **Actions:**\n`;
    output += `- Switch session: session_switch tool or /switch-session <id>\n`;
    output += `- Create new: session_new tool or /new-session\n`;
    output += `- Git rewind: session_rewind tool or /new-session --git-rewind\n`;
    
    return {
      success: true,
      output
    };
    
  } catch (error: any) {
    return {
      success: false,
      output: `❌ Error listing sessions: ${error.message}`
    };
  }
}

/**
 * Tool: session_switch
 * Switch to a different session
 * REQUIRES USER PERMISSION
 */
export async function executeSessionSwitch(args: { session_id: number }): Promise<ToolResult> {
  try {
    const { session_id } = args;
    
    // Validate session exists
    const sessions = sessionManager.listSessions();
    const targetSession = sessions.find(s => s.id === session_id);
    
    if (!targetSession) {
      return {
        success: false,
        output: `❌ Session #${session_id} not found.\n\n` +
                `Available sessions: ${sessions.map(s => `#${s.id}`).join(', ')}\n\n` +
                `💡 Use session_list to see all sessions`
      };
    }
    
    // Check if target directory exists
    const fs = await import('fs');
    if (!fs.existsSync(targetSession.working_dir)) {
      return {
        success: false,
        output: `❌ Target directory does not exist: ${targetSession.working_dir}\n\n` +
                `The session exists in database but its directory is missing.`
      };
    }
    
    // Perform switch
    const { session, history } = await sessionManager.switchSession(session_id);
    
    // Change Node's CWD
    process.chdir(targetSession.working_dir);
    
    // Verify CWD change
    const actualCwd = process.cwd();
    if (actualCwd !== targetSession.working_dir) {
      return {
        success: false,
        output: `❌ Failed to change directory to ${targetSession.working_dir}\n` +
                `Current directory: ${actualCwd}`
      };
    }
    
    return {
      success: true,
      output: `✅ **Session Switched** to #${session.id}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📂 **Working Directory:** ${session.working_dir}\n` +
              `   ✅ Process CWD changed successfully\n\n` +
              `🤖 **Provider:** ${session.default_provider}\n` +
              `📱 **Model:** ${session.default_model}\n` +
              `💬 **Messages:** ${history.length} loaded\n\n` +
              `📅 **Session Info:**\n` +
              `   Created: ${new Date(session.created_at).toLocaleDateString()}\n` +
              `   Last Active: ${new Date(session.last_activity).toLocaleString()}\n` +
              (session.session_name ? `   Name: ${session.session_name}\n` : '') +
              `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🎯 You can now continue working in this session context.\n` +
              `All file paths are relative to: ${session.working_dir}`
    };
    
  } catch (error: any) {
    return {
      success: false,
      output: `❌ Session switch failed: ${error.message}`
    };
  }
}

/**
 * Tool: session_new
 * Create a new conversation session
 */
export async function executeSessionNew(args: {
  directory: string;
  import_history?: boolean;
  from_session_id?: number;
  date_range_start?: string;
  date_range_end?: string;
  model?: string;
  provider?: string;
}): Promise<ToolResult> {
  try {
    const {
      directory,
      import_history = false,
      from_session_id,
      date_range_start,
      date_range_end,
      model,
      provider
    } = args;
    
    // Resolve directory path
    const path = await import('path');
    const targetWorkdir = directory.startsWith('/')
      ? directory
      : path.resolve(process.cwd(), directory);
    
    // Create directory if needed
    const fs = await import('fs');
    if (!fs.existsSync(targetWorkdir)) {
      fs.mkdirSync(targetWorkdir, { recursive: true });
    }
    
    // Parse date range if provided
    let dateRange: { start: Date; end: Date } | undefined;
    if (date_range_start || date_range_end) {
      dateRange = {
        start: date_range_start ? parseDate(date_range_start) : new Date(0),
        end: date_range_end ? parseDate(date_range_end) : new Date()
      };
    }
    
    // Determine model and provider
    const currentSession = sessionManager.getCurrentSession();
    const targetModel = model || currentSession?.default_model || 'grok-beta';
    const targetProvider = provider || 
                          (model ? providerManager.detectProvider(model) : null) ||
                          currentSession?.default_provider ||
                          'grok';
    
    // Get API key (assume agent will provide it)
    // This is a simplified version - in practice, the agent handler will provide the key
    const apiKey = undefined; // Agent will provide
    
    // Create session
    const { session, history } = await sessionManager.createNewSession(
      targetWorkdir,
      targetProvider,
      targetModel,
      apiKey,
      {
        importHistory: import_history,
        fromSessionId: from_session_id,
        dateRange
      }
    );
    
    return {
      success: true,
      output: `✅ **New Session Created** #${session.id}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📂 **Working Directory:** ${session.working_dir}\n` +
              `   ${targetWorkdir !== process.cwd() ? '(Created in new directory)\n' : ''}\n` +
              `🤖 **Provider:** ${session.default_provider}\n` +
              `📱 **Model:** ${session.default_model}\n` +
              `💬 **Messages:** ${history.length}${import_history ? ' (imported)' : ''}\n` +
              `🕐 **Created:** ${new Date(session.created_at).toLocaleString()}\n\n` +
              (import_history
                ? `📋 **History Imported**\n` +
                  (from_session_id ? `   Source: Session #${from_session_id}\n` : `   Source: Current session\n`) +
                  (dateRange ? `   Date Range: ${dateRange.start.toLocaleDateString()} → ${dateRange.end.toLocaleDateString()}\n` : '') +
                  `   Messages: ${history.length} imported\n\n`
                : `📄 **Fresh Start**\n` +
                  `   This is a brand new conversation.\n\n`
              ) +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🎯 Session ready for new conversation!\n\n` +
              `💡 **Next Steps:**\n` +
              `- Start conversation in new context\n` +
              `- Use session_list to see all sessions\n` +
              `- Use session_switch to go back to previous session`
    };
    
  } catch (error: any) {
    return {
      success: false,
      output: `❌ Session creation failed: ${error.message}`
    };
  }
}

/**
 * Tool: session_rewind
 * Perform Git rewind - synchronize conversation + code to specific date
 * REQUIRES USER PERMISSION (most critical operation)
 */
export async function executeSessionRewind(args: {
  target_directory: string;
  date_range_start: string;
  date_range_end: string;
  from_session_id?: number;
  preserve_git_history?: boolean;
}): Promise<ToolResult> {
  try {
    const {
      target_directory,
      date_range_start,
      date_range_end,
      from_session_id,
      preserve_git_history = false
    } = args;
    
    // Parse dates
    const startDate = parseDate(date_range_start);
    const endDate = parseDate(date_range_end);
    const dateRange = { start: startDate, end: endDate };
    
    // Validate date range
    if (startDate > endDate) {
      return {
        success: false,
        output: `❌ Invalid date range: start date (${startDate.toLocaleDateString()}) is after end date (${endDate.toLocaleDateString()})`
      };
    }
    
    // Resolve directory path
    const path = await import('path');
    const targetWorkdir = target_directory.startsWith('/')
      ? target_directory
      : path.resolve(process.cwd(), target_directory);
    
    // Check if target directory already exists
    const fs = await import('fs');
    if (fs.existsSync(targetWorkdir)) {
      return {
        success: false,
        output: `❌ Target directory already exists: ${targetWorkdir}\n\n` +
                `Please choose a different directory or remove the existing one.`
      };
    }
    
    // Determine source session
    const sourceSession = from_session_id
      ? sessionManager.listSessions().find(s => s.id === from_session_id)
      : sessionManager.getCurrentSession();
    
    if (!sourceSession) {
      return {
        success: false,
        output: `❌ Source session not found${from_session_id ? `: #${from_session_id}` : ''}\n\n` +
                `Use session_list to see available sessions.`
      };
    }
    
    const sourceWorkdir = sourceSession.working_dir;
    
    // Check if source is a Git repo
    const { execAsync } = await import('../utils/exec-async.js');
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: sourceWorkdir });
    } catch {
      return {
        success: false,
        output: `❌ Source directory is not a Git repository: ${sourceWorkdir}\n\n` +
                `Git rewind requires the source directory to be a Git repository.\n` +
                `Initialize Git first: cd ${sourceWorkdir} && git init`
      };
    }
    
    // Import GitRewindManager
    const { GitRewindManager } = await import('../utils/git-rewind.js');
    const gitRewindManager = new GitRewindManager();
    
    // Perform Git rewind
    const rewindInfo = await gitRewindManager.performRewind(
      sourceWorkdir,
      targetWorkdir,
      dateRange,
      sourceSession.id,
      { preserveGitHistory: preserve_git_history }
    );
    
    // Create new session with rewound state
    const currentSession = sessionManager.getCurrentSession();
    const targetModel = currentSession?.default_model || 'grok-beta';
    const targetProvider = currentSession?.default_provider || 'grok';
    
    const { session, history } = await sessionManager.createNewSession(
      targetWorkdir,
      targetProvider,
      targetModel,
      undefined, // apiKey will be provided by agent
      {
        importHistory: true,
        fromSessionId: sourceSession.id,
        dateRange
      }
    );
    
    // Update rewind info with conversation count
    rewindInfo.conversation_messages = history.length;
    await gitRewindManager.updateRewindInfo(targetWorkdir, rewindInfo);
    
    return {
      success: true,
      output: `✅ **Git Rewind Complete** #${session.id}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📂 **Working Directory:** ${session.working_dir}\n` +
              `   (Created in new directory)\n\n` +
              `🔄 **Git Rewind Applied**\n` +
              `   🎯 Target Commit: ${rewindInfo.target_commit.substring(0, 7)}\n` +
              `   📅 Commit Date: ${rewindInfo.git_commits[rewindInfo.git_commits.length - 1].date.toLocaleString()}\n` +
              `   📊 Commits in Range: ${rewindInfo.git_commits.length}\n` +
              `   📁 Files Extracted: ${rewindInfo.files_copied}\n` +
              `   🌳 Extraction Method: ${rewindInfo.extraction_method}\n` +
              `   ${preserve_git_history ? '✅ Full Git history preserved\n' : '💾 Lightweight (git archive)\n'}` +
              `\n` +
              `📋 **Conversation Synchronized**\n` +
              `   📥 Source: Session #${sourceSession.id}\n` +
              `   📅 Date Range: ${dateRange.start.toLocaleDateString()} → ${dateRange.end.toLocaleDateString()}\n` +
              `   💬 Messages: ${history.length} imported\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🎯 **Perfect Checkpoint Established**\n\n` +
              `✅ Code state: ${dateRange.end.toLocaleDateString()}\n` +
              `✅ Conversation state: ${dateRange.end.toLocaleDateString()}\n` +
              `✅ Ready for iteration from this exact point\n\n` +
              `📋 **Next Steps:**\n\n` +
              `1. **Continue Development:**\n` +
              `   - Make changes as usual\n` +
              `   - Use bash tool for git commits: git commit -m "message"\n` +
              `   - Push regularly: git push origin <branch>\n\n` +
              `2. **Create GitHub Branch (Recommended):**\n` +
              `   \`\`\`bash\n` +
              `   git checkout -b rewind-${dateRange.end.toISOString().split('T')[0]}\n` +
              `   git push -u origin rewind-${dateRange.end.toISOString().split('T')[0]}\n` +
              `   \`\`\`\n\n` +
              `3. **View Rewind Details:**\n` +
              `   cat .git-rewind-info.json\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `💡 Source session (#${sourceSession.id}) remains intact in ${sourceWorkdir}`
    };
    
  } catch (error: any) {
    return {
      success: false,
      output: `❌ Git rewind failed: ${error.message}\n\n` +
              `💡 Common issues:\n` +
              `- Source directory not a Git repository\n` +
              `- No commits in specified date range\n` +
              `- Target directory already exists\n` +
              `- Insufficient permissions`
    };
  }
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): Date {
  // Relative dates
  if (dateStr === 'today') {
    return new Date();
  }
  if (dateStr === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }
  
  // DD/MM/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // YYYY-MM-DD format or ISO 8601
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  throw new Error(`Invalid date format: ${dateStr}. Use DD/MM/YYYY, YYYY-MM-DD, or ISO 8601`);
}
