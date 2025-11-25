import type { ToolResult } from "../types/index.js";
import type { GrokAgent } from "../agent/grok-agent.js";
import { providerManager } from "../utils/provider-manager.js";
import { sessionManager } from "../utils/session-manager-sqlite.js";

/**
 * Get factual information about the current model's identity
 * 
 * This tool provides authoritative information about:
 * - Model name
 * - Provider
 * - API endpoint
 * - Session context
 * 
 * Use this when you need to verify your own identity, especially after model switches.
 */
export async function get_my_identity(
  _args: Record<string, never>,
  agent: GrokAgent
): Promise<ToolResult> {
  try {
    const currentModel = agent.getCurrentModel();
    const currentApiKey = agent.getApiKey();
    const providerConfig = providerManager.getProviderForModel(currentModel);
    
    // Get current session info
    let session = sessionManager.getCurrentSession();
    if (!session) {
      // Fallback: try to find last session for current directory
      const workdir = process.cwd();
      session = sessionManager.findLastSessionByWorkdir(workdir);
    }

    const identityInfo = {
      model: currentModel,
      provider: providerConfig?.name || 'unknown',
      endpoint: providerConfig?.baseURL || 'unknown',
      api_key_prefix: currentApiKey ? `${currentApiKey.slice(0, 10)}...${currentApiKey.slice(-4)}` : 'not set',
      session_id: session?.id || null,
      working_directory: process.cwd(),
      timestamp: new Date().toISOString()
    };

    const output = `╔═══════════════════════════════════════════════════════════════╗
║                    MY IDENTITY                                ║
╚═══════════════════════════════════════════════════════════════╝

🤖 Model:        ${identityInfo.model}
🏢 Provider:     ${identityInfo.provider}
🔗 Endpoint:     ${identityInfo.endpoint}
🔑 API Key:      ${identityInfo.api_key_prefix}
📂 Working Dir:  ${identityInfo.working_directory}
💾 Session ID:   ${identityInfo.session_id || 'N/A'}
⏰ Timestamp:    ${identityInfo.timestamp}

This is FACTUAL information about your current runtime configuration.
Use this to verify your identity, not conversation history.`;

    return {
      success: true,
      output: output,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get identity: ${error.message}`,
    };
  }
}
