import { GrokAgent, ChatEntry } from '../agent/grok-agent.js';
import { providerManager } from './provider-manager.js';
import { sessionManager } from './session-manager-sqlite.js';

/**
 * Generate session status message
 * Used by:
 * - /status command (in use-input-handler.ts)
 * - Startup message (in chat-interface.tsx)
 */
export function generateStatusMessage(agent: GrokAgent): ChatEntry {
  try {
    const currentModel = agent.getCurrentModel();
    const currentApiKey = agent.getApiKey();
    const providerConfig = providerManager.getProviderForModel(currentModel);
    
    // Get session with fallback for robustness
    // After restart, currentSession might be null until initSession() is called
    let session = sessionManager.getCurrentSession();
    if (!session) {
      // Fallback: try to find last session for current directory
      const workdir = process.cwd();
      session = sessionManager.findLastSessionByWorkdir(workdir);
    }
    
    // Format directory (shorten home path)
    const homeDir = require('os').homedir();
    const workdir = process.cwd();
    const displayDir = workdir.replace(homeDir, '~');
    
    // Format last activity
    let lastActivityStr = 'Just now';
    let messageCountStr = '0';
    let sessionNameStr = '';
    
    if (session) {
      messageCountStr = String(session.message_count || 0);
      
      if (session.session_name) {
        sessionNameStr = `\n📝 Session Name: ${session.session_name}`;
      }
      
      if (session.last_activity) {
        const lastActivity = new Date(session.last_activity);
        const now = new Date();
        const diffMs = now.getTime() - lastActivity.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffDays > 0) {
          lastActivityStr = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
          lastActivityStr = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMins > 0) {
          lastActivityStr = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        }
      }
    }
    
    const statusEntry: ChatEntry = {
      type: "assistant",
      content: `╔════════════════════════════════════════════════════════╗\n` +
               `║  📋 SESSION STATUS                                     ║\n` +
               `╠════════════════════════════════════════════════════════╣\n` +
               `║  📂 Directory: ${displayDir}\n` +
               `║  🤖 Model: ${currentModel} (${providerConfig?.name || 'unknown'})\n` +
               `║  🔗 Endpoint: ${providerConfig?.baseURL || 'unknown'}\n` +
               `║  🔑 API Key: ${currentApiKey.slice(0, 10)}...${currentApiKey.slice(-4)}\n` +
               `║  💬 Messages: ${messageCountStr}\n` +
               `║  📅 Last activity: ${lastActivityStr}${sessionNameStr}\n` +
               `╚════════════════════════════════════════════════════════╝\n\n` +
               `Available commands:\n` +
               `  /models           - List & switch models\n` +
               `  /model <name>     - Switch to specific model\n` +
               `  /apikey           - Manage API keys\n` +
               `  /list_sessions    - List all sessions\n` +
               `  /help             - Show all commands`,
      timestamp: new Date(),
    };
    
    return statusEntry;
  } catch (error: any) {
    // Fallback to basic status
    const currentModel = agent.getCurrentModel();
    const currentApiKey = agent.getApiKey();
    const providerConfig = providerManager.getProviderForModel(currentModel);
    
    const statusEntry: ChatEntry = {
      type: "assistant",
      content: `📊 Current Configuration\n` +
               `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
               `🤖 Model: ${currentModel}\n` +
               `📝 Provider: ${providerConfig?.name || 'unknown'}\n` +
               `🔗 Endpoint: ${providerConfig?.baseURL || 'unknown'}\n` +
               `🔑 API Key: ${currentApiKey.slice(0, 10)}...${currentApiKey.slice(-4)}\n` +
               `📁 Work Dir: ${process.cwd()}\n\n` +
               `Use /models to switch model\n` +
               `Use /apikey to manage API keys`,
      timestamp: new Date(),
    };
    
    return statusEntry;
  }
}
