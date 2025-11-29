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
 * 
 * This is a DUPLICATE of /list_sessions user command for intentional evolution.
 * The code starts identical but can diverge based on LLM feedback.
 */
export async function executeSessionList(): Promise<ToolResult> {
  try {
    // Pass null to get sessions from ALL directories (not just current)
    // Same behavior as /list_sessions user command
    const sessions = sessionManager.listSessions(
      null,
      {
        sortBy: 'last_activity',
        sortOrder: 'DESC',
        limit: 50  // Increased limit for multi-directory view
      }
    );

    if (sessions.length === 0) {
      return {
        success: true,
        output: `📂 No sessions found\n\nStart chatting to create your first session!`
      };
    }

    // Group sessions by working directory (same as user command)
    const sessionsByDir: Map<string, typeof sessions> = new Map();
    sessions.forEach(session => {
      const dir = session.working_dir;
      if (!sessionsByDir.has(dir)) {
        sessionsByDir.set(dir, []);
      }
      sessionsByDir.get(dir)!.push(session);
    });

    // Format sessions list grouped by directory
    const dirCount = sessionsByDir.size;
    let output = `📚 All Sessions (${dirCount} ${dirCount === 1 ? 'directory' : 'directories'})\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Iterate through directories (sorted by most recent activity)
    const sortedDirs = Array.from(sessionsByDir.entries()).sort((a, b) => {
      const latestA = Math.max(...a[1].map(s => new Date(s.last_activity).getTime()));
      const latestB = Math.max(...b[1].map(s => new Date(s.last_activity).getTime()));
      return latestB - latestA;
    });

    sortedDirs.forEach(([dir, dirSessions], dirIndex) => {
      // Highlight current directory
      const isCurrent = dir === process.cwd();
      const dirMarker = isCurrent ? '📍' : '📁';
      const dirLabel = isCurrent ? ` (current)` : '';
      
      output += `${dirMarker} **${dir}**${dirLabel}\n`;
      output += `   ${dirSessions.length} ${dirSessions.length === 1 ? 'session' : 'sessions'}\n\n`;

      dirSessions.forEach((session) => {
        const status = session.status === 'active' ? '🟢' : 
                      session.status === 'completed' ? '⚪' : '📦';
        const favorite = session.is_favorite ? '⭐' : '';
        
        output += `   ${status} #${session.id}${favorite}`;
        
        if (session.session_name) {
          output += ` - ${session.session_name}`;
        }
        
        output += `\n`;
        output += `      📱 Model: ${session.default_model} | 💬 ${session.message_count} msgs`;
        
        // Add creation date
        if (session.created_at) {
          const createdDate = new Date(session.created_at);
          const createdFormatted = createdDate.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          output += `\n      🕐 Created: ${createdFormatted}`;
          
          // Add age if available
          if (session.age_days !== undefined) {
            const ageStr = session.age_days === 0 
              ? 'today' 
              : session.age_days === 1 
                ? '1 day ago' 
                : `${session.age_days} days ago`;
            output += ` (${ageStr})`;
          }
        }
        
        // Add last activity
        if (session.last_activity_relative) {
          output += `\n      ⏰ Last active: ${session.last_activity_relative}`;
        }
        
        output += `\n`;
      });

      // Add spacing between directories
      if (dirIndex < sortedDirs.length - 1) {
        output += `\n`;
      }
    });

    output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `\n💡 Use session_switch tool to switch (changes directory automatically)\n`;
    output += `💡 Legend: 🟢 Active  ⚪ Completed  📦 Archived  ⭐ Favorite  📍 Current dir`;
    
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
 * 
 * This is a DUPLICATE of /switch-session user command for intentional evolution.
 * The code starts identical but can diverge based on LLM feedback.
 * Key features tested in user command:
 * - Multi-directory switching
 * - Automatic process.chdir() synchronization
 * - Chat history loading
 * - Model/provider context update
 */
export async function executeSessionSwitch(args: { session_id: number }): Promise<ToolResult> {
  try {
    const { session_id } = args;
    
    // Validate session ID
    if (isNaN(session_id)) {
      return {
        success: false,
        output: `❌ Invalid session ID\n\n` +
                `Session ID must be a number.\n\n` +
                `💡 Use session_list to see available session IDs`
      };
    }
    
    // Switch session (core logic from user command)
    const { session, history } = await sessionManager.switchSession(session_id);
    
    // CRITICAL: Change working directory to match the session's working_dir
    // This prevents path confusion when the LLM thinks it's in one directory
    // but the Node process is actually in another
    const targetWorkdir = session.working_dir;
    const currentWorkdir = process.cwd();
    
    if (targetWorkdir !== currentWorkdir) {
      // Verify target directory exists
      const fs = await import('fs');
      if (!fs.existsSync(targetWorkdir)) {
        return {
          success: false,
          output: `❌ Session's working directory does not exist: ${targetWorkdir}\n\n` +
                  `The directory may have been moved or deleted.`
        };
      }
      
      // Change the Node process's current working directory
      process.chdir(targetWorkdir);
      
      // Verify the change was successful
      const newCwd = process.cwd();
      if (newCwd !== targetWorkdir) {
        return {
          success: false,
          output: `❌ Failed to change directory from ${currentWorkdir} to ${targetWorkdir}\n` +
                  `Current directory is: ${newCwd}`
        };
      }
    }
    
    // Format confirmation message (adapted from user command)
    const dirChanged = targetWorkdir !== currentWorkdir;
    let output = `✅ Switched to Session #${session.id}\n\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    output += `📝 Name: ${session.session_name || 'Unnamed'}\n`;
    output += `🤖 Provider: ${session.default_provider}\n`;
    output += `📱 Model: ${session.default_model}\n`;
    output += `💬 Messages: ${history.length}\n`;
    output += `📁 Working Directory: ${session.working_dir}\n`;
    output += `🕐 Last Activity: ${new Date(session.last_activity).toLocaleString()}\n\n`;
    
    if (dirChanged) {
      output += `📂 **Directory Changed:**\n`;
      output += `   From: ${currentWorkdir}\n`;
      output += `   To:   ${targetWorkdir}\n\n`;
      output += `⚠️  All relative paths now resolve to the new directory.\n\n`;
    } else {
      output += `📂 **Directory:** Already in ${targetWorkdir}\n\n`;
    }
    
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    output += `Conversation history loaded! Continue chatting...`;
    
    return {
      success: true,
      output
    };
    
  } catch (error: any) {
    return {
      success: false,
      output: `❌ Failed to switch session: ${error.message}\n\n` +
              `💡 Use session_list to see available sessions`
    };
  }
}

/**
 * Tool: session_new
 * Create a new conversation session
 * 
 * This is a DUPLICATE of /new-session user command for intentional evolution.
 * The code starts identical but can diverge based on LLM feedback.
 * Key features tested in user command:
 * - Directory creation and validation
 * - History import with date filtering
 * - Model/provider resolution
 * - API key handling
 * 
 * NOTE: The agent must provide API key via context
 */
export async function executeSessionNew(args: {
  directory: string;
  init_mode?: 'empty' | 'clone-git' | 'copy-files' | 'from-rewind';
  rewind_timestamp?: string;
  rewind_git_mode?: 'none' | 'metadata' | 'full';
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
      init_mode = 'empty',
      rewind_timestamp,
      rewind_git_mode = 'full',
      import_history = false,
      from_session_id,
      date_range_start,
      date_range_end,
      model,
      provider
    } = args;
    
    // Parse date range if provided (same as user command)
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    
    if (date_range_start) {
      fromDate = parseDate(date_range_start);
    }
    if (date_range_end) {
      toDate = parseDate(date_range_end);
    }
    
    // Validate date range
    if (fromDate && toDate && fromDate > toDate) {
      return {
        success: false,
        output: `❌ Invalid date range: start date must be before end date\n\n` +
                `Start: ${fromDate.toLocaleDateString()}\n` +
                `End: ${toDate.toLocaleDateString()}`
      };
    }
    
    // Build date range for filtering
    const dateRange = (fromDate || toDate) ? {
      start: fromDate || new Date(0), // Beginning of time if not specified
      end: toDate || new Date() // Now if not specified
    } : undefined;
    
    // Determine target directory (default: current directory)
    // Same resolution logic as user command
    const targetWorkdir = directory.startsWith('/') 
      ? directory 
      : `${process.cwd()}/${directory}`;
    
    // Verify/create target directory (same as user command)
    const fs = await import('fs');
    if (!fs.existsSync(targetWorkdir)) {
      // Create directory recursively
      fs.mkdirSync(targetWorkdir, { recursive: true });
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DIRECTORY INITIALIZATION (init_mode)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let initModeDescription = 'Empty directory';
    
    switch (init_mode) {
      case 'clone-git': {
        // Validate we're in a Git repository
        const { execAsync } = await import('../utils/exec-async.js');
        try {
          await execAsync('git rev-parse --is-inside-work-tree', { cwd: process.cwd() });
        } catch {
          return {
            success: false,
            output: `❌ Cannot clone Git repository: Current directory is not a Git repository\n\n` +
                    `To use init_mode='clone-git', you must be inside a Git repository.`
          };
        }
        
        // Clone the current Git repository to target directory
        const currentDir = process.cwd();
        
        // Use git clone to copy the repository
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(exec);
        
        try {
          // Clone to temp directory first
          const tempDir = `${targetWorkdir}_temp_clone`;
          await execPromise(`git clone "${currentDir}" "${tempDir}"`);
          
          // Move contents from temp to target
          await execPromise(`mv "${tempDir}"/.git "${targetWorkdir}/" && mv "${tempDir}"/* "${targetWorkdir}/" 2>/dev/null || true && rm -rf "${tempDir}"`);
          
          initModeDescription = 'Git repository cloned from current directory';
        } catch (error: any) {
          return {
            success: false,
            output: `❌ Failed to clone Git repository: ${error.message}\n\n` +
                    `Make sure you have Git installed and the current directory is a valid Git repository.`
          };
        }
        break;
      }
      
      case 'copy-files': {
        // Copy files from current directory (excluding .git, node_modules, hidden files)
        const currentDir = process.cwd();
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(exec);
        
        try {
          // Use rsync if available, otherwise use cp
          try {
            await execPromise(`rsync -av --exclude='.git' --exclude='node_modules' --exclude='.*' "${currentDir}/" "${targetWorkdir}/"`);
            initModeDescription = 'Files copied from current directory (via rsync)';
          } catch {
            // Fallback to cp
            await execPromise(`cp -r "${currentDir}"/* "${targetWorkdir}/" 2>/dev/null || true`);
            initModeDescription = 'Files copied from current directory (via cp)';
          }
        } catch (error: any) {
          return {
            success: false,
            output: `❌ Failed to copy files: ${error.message}\n\n` +
                    `Make sure you have the necessary permissions.`
          };
        }
        break;
      }
      
      case 'from-rewind': {
        // Validate rewind_timestamp is provided
        if (!rewind_timestamp) {
          return {
            success: false,
            output: `❌ init_mode='from-rewind' requires rewind_timestamp parameter\n\n` +
                    `Please provide a timestamp (ISO 8601: 2025-11-28T15:00:00Z)\n\n` +
                    `💡 Use timeline_query to find available timestamps`
          };
        }
        
        // Import rewind tool
        const { executeRewindTo } = await import('./rewind-to-tool.js');
        
        // Perform rewind to reconstruct directory
        const rewindResult = await executeRewindTo({
          targetTimestamp: rewind_timestamp,
          outputDir: targetWorkdir,
          includeFiles: true,
          includeConversations: import_history, // Link to import_history option
          gitMode: rewind_git_mode,
          createSession: false, // We'll create session ourselves
        });
        
        if (!rewindResult.success) {
          return {
            success: false,
            output: `❌ Failed to initialize from rewind: ${rewindResult.error}\n\n` +
                    `Rewind timestamp: ${rewind_timestamp}\n` +
                    `Git mode: ${rewind_git_mode}`
          };
        }
        
        initModeDescription = `Initialized from rewind at ${rewind_timestamp} (gitMode=${rewind_git_mode})`;
        break;
      }
      
      case 'empty':
      default:
        // Directory already created above, nothing more to do
        initModeDescription = 'Empty directory';
        break;
    }
    
    // Determine model and provider (same logic as user command)
    const currentSession = sessionManager.getCurrentSession();
    
    // Note: Agent will need to inject API key via context
    // This is handled by the agent calling this tool
    const apiKey = undefined; // Agent provides via context
    
    const targetModel = model || currentSession?.default_model || 'grok-beta';
    const targetProvider = provider || 
                           (model ? providerManager.detectProvider(model) : null) ||
                           currentSession?.default_provider || 
                           (targetModel ? providerManager.detectProvider(targetModel) : null) ||
                           'grok';
    
    if (!targetProvider) {
      return {
        success: false,
        output: `❌ Cannot determine provider for model: ${targetModel}\n\n` +
                `Please specify provider explicitly.`
      };
    }
    
    // Check API key requirement
    if (!apiKey) {
      return {
        success: false,
        output: `❌ No API key found for provider: ${targetProvider}\n\n` +
                `The agent must provide API key via context.\n` +
                `Please ensure API key is configured for ${targetProvider}.`
      };
    }
    
    // Create the new session (core logic from user command)
    const { session, history, importWarning } = await sessionManager.createNewSession(
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
    
    // CRITICAL: Change working directory if creating session in different directory
    // Same behavior as user command and /switch-session for consistency
    const currentWorkdir = process.cwd();
    const dirChanged = targetWorkdir !== currentWorkdir;
    
    if (dirChanged) {
      // Change the Node process's current working directory
      process.chdir(targetWorkdir);
      
      // Verify the change was successful
      const newCwd = process.cwd();
      if (newCwd !== targetWorkdir) {
        return {
          success: false,
          output: `❌ Failed to change directory from ${currentWorkdir} to ${targetWorkdir}\n` +
                  `Current directory is: ${newCwd}`
        };
      }
    }
    
    // Format confirmation message (adapted from user command)
    let output = `✅ **New Session Created** #${session.id}\n\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    output += `📂 Working Directory: ${session.working_dir}\n`;
    output += `🎯 Initialization: ${initModeDescription}\n`;
    output += `🤖 Provider: ${session.default_provider}\n`;
    output += `📱 Model: ${session.default_model}\n`;
    output += `💬 Messages: ${history.length}${import_history ? ' (imported)' : ''}\n`;
    output += `🕐 Created: ${new Date(session.created_at).toLocaleString()}\n\n`;
    
    if (dirChanged) {
      output += `📂 **Directory Changed:**\n`;
      output += `   From: ${currentWorkdir}\n`;
      output += `   To:   ${targetWorkdir}\n\n`;
      output += `⚠️  All relative paths now resolve to the new directory.\n\n`;
    } else {
      output += `📂 **Directory:** Already in ${targetWorkdir}\n\n`;
    }
    
    if (import_history) {
      output += `📋 **History Imported**\n`;
      output += from_session_id ? `   Source: Session #${from_session_id}\n` : `   Source: Current session\n`;
      if (dateRange) {
        output += `   Date Range: ${dateRange.start.toLocaleDateString()} → ${dateRange.end.toLocaleDateString()}\n`;
      }
      output += `   Messages: ${history.length} imported\n\n`;
      
      // Add warning if date range excluded all messages
      if (importWarning) {
        output += `${importWarning}\n\n`;
      }
    } else {
      output += `📄 **Fresh Start**\n`;
      output += `   This is a brand new conversation.\n\n`;
    }
    
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    output += `You can now start a new conversation!\n\n`;
    output += `💡 Use session_list to see all sessions\n`;
    output += `💡 Use session_switch to go back to previous session`;
    
    return {
      success: true,
      output
    };
    
  } catch (error: any) {
    return {
      success: false,
      output: `❌ Failed to create new session: ${error.message}\n\n` +
              `Usage: session_new tool with required arguments`
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
