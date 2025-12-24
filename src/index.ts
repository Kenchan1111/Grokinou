#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { program } from "commander";
import * as dotenv from "dotenv";
import cfonts from "cfonts";
import { GrokAgent } from "./agent/grok-agent.js";
import ChatInterface from "./ui/components/chat-interface.js";
import { getSettingsManager } from "./utils/settings-manager.js";
import { ConfirmationService } from "./utils/confirmation-service.js";
import { createMCPCommand } from "./commands/mcp.js";
import path from "path";
import os from "os";
import type { ChatCompletionMessageParam } from "openai/resources/chat";
import { loadTomlConfig, applyKeyValue, resolveEffectiveConfig } from "./utils/config.js";
import { initTimeline } from "./timeline/index.js";
import { autoStartWatcher } from "./security/watcher-daemon.js";
import { WalShipper } from "./utils/wal-shipper.js";
import { JsonlExporter } from "./utils/jsonl-exporter.js";

// Load environment variables
dotenv.config();

// Disable default SIGINT handling to let Ink handle Ctrl+C
// We'll handle exit through the input system instead

process.on("SIGTERM", () => {
  // Restore terminal to normal mode before exit
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    try {
      process.stdin.setRawMode(false);
    } catch (e) {
      // Ignore errors when setting raw mode
    }
  }
  console.log("\nGracefully shutting down...");
  process.exit(0);
});

// Handle uncaught exceptions to prevent hanging
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Ensure user settings are initialized
function ensureUserSettingsDirectory(): void {
  try {
    const manager = getSettingsManager();
    // This will create default settings if they don't exist
    manager.loadUserSettings();
  } catch (error) {
    // Silently ignore errors during setup
  }
}

// Initialize timeline module (silent, non-blocking)
async function initializeTimeline(): Promise<void> {
  try {
    await initTimeline({
      enableLLMHook: true,
      enableToolHook: true,
      enableSessionHook: true,
      enableFileHook: true, // Watch for file changes
      enableGitHook: true, // Track git operations
    });
    startWalShippers();
    startJsonlExporters();
  } catch (error) {
    // Timeline is optional - don't fail app startup if it fails
    console.error('⚠️  Timeline initialization failed (non-critical):', error);
  }
}

// Load API key from user settings if not in environment
function loadApiKey(): string | undefined {
  const manager = getSettingsManager();
  return manager.getApiKey();
}

// Load base URL from user settings if not in environment
function loadBaseURL(): string {
  const manager = getSettingsManager();
  return manager.getBaseURL();
}

// Start WAL shippers (best effort, non-blocking)
function startWalShippers(): void {
  try {
    const convDbPath = path.join(os.homedir(), ".grok", "conversations.db");
    const timelineDbPath = path.join(os.homedir(), ".grok", "timeline.db");
    const convShipper = new WalShipper({
      dbPath: convDbPath,
      externalCommandTemplate:
        process.env.GROKINOU_WAL_SHIP_CMD_CONV ||
        process.env.GROKINOU_WAL_SHIP_CMD ||
        undefined,
    });
    const timelineShipper = new WalShipper({
      dbPath: timelineDbPath,
      archiveDir: path.join(os.homedir(), ".grok", "wal-archive-timeline"),
      externalCommandTemplate:
        process.env.GROKINOU_WAL_SHIP_CMD_TIMELINE ||
        process.env.GROKINOU_WAL_SHIP_CMD ||
        undefined,
    });
    convShipper.start();
    timelineShipper.start();
  } catch (e) {
    console.error("⚠️ Failed to start WAL shippers:", e);
  }
}

// Start JSONL exporters (best effort)
function startJsonlExporters(): void {
  try {
    const convExporter = new JsonlExporter({ db: "conversations" });
    const timelineExporter = new JsonlExporter({ db: "timeline" });
    convExporter.start();
    timelineExporter.start();
  } catch (e) {
    console.error("⚠️ Failed to start JSONL exporters:", e);
  }
}

// Save command line settings to user settings file
async function saveCommandLineSettings(
  apiKey?: string,
  baseURL?: string
): Promise<void> {
  try {
    const manager = getSettingsManager();

    // Update with command line values
    if (apiKey) {
      manager.updateUserSetting("apiKey", apiKey);
      console.log("✅ API key saved to ~/.grok/user-settings.json");
    }
    if (baseURL) {
      manager.updateUserSetting("baseURL", baseURL);
      console.log("✅ Base URL saved to ~/.grok/user-settings.json");
    }
  } catch (error) {
    console.warn(
      "⚠️ Could not save settings to file:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Load model from user settings if not in environment
function loadModel(): string | undefined {
  // First check environment variables
  let model = process.env.GROK_MODEL;

  if (!model) {
    // Use the unified model loading from settings manager
    try {
      const manager = getSettingsManager();
      model = manager.getCurrentModel();
    } catch (error) {
      // Ignore errors, model will remain undefined
    }
  }

  return model;
}

/**
 * Resolve startup configuration with proper priority:
 * 1. CLI args (--model, --api-key)
 * 2. ENV vars (GROK_MODEL, GROK_API_KEY)
 * 3. Last session from SQLite (for conversation continuity)
 * 4. Project settings (.grok/settings.json)
 * 5. User settings (~/.grok/user-settings.json defaultModel)
 * 6. System default
 */
export interface StartupConfig {
  status: 'restored' | 'new' | 'needs_api_key';
  model: string;
  provider: string;
  apiKey?: string;
  baseURL?: string;
  message?: string;
  needsInput?: boolean;
}

async function resolveStartupConfiguration(
  cliModel?: string,
  cliApiKey?: string,
  cliBaseURL?: string,
  cliSessionId?: number
): Promise<StartupConfig> {
  const cwd = process.cwd();
  const settingsManager = getSettingsManager();

  // Import dynamically to avoid circular deps
  const { SessionManagerSQLite } = await import('./utils/session-manager-sqlite.js');
  const { providerManager } = await import('./utils/provider-manager.js');
  const sessionManager = SessionManagerSQLite.getInstance();

  // PRIORITY 0: CLI --session <id> (highest priority)
  if (cliSessionId !== undefined) {
    const { SessionRepository } = await import('./db/repositories/session-repository.js');
    const { db } = await import('./db/database.js');
    const repo = new SessionRepository(db.getDb());
    const targetSession = repo.findById(cliSessionId);

    if (!targetSession) {
      throw new Error(
        `❌ Session #${cliSessionId} not found\n\n` +
        `Use /list_sessions to see available sessions`
      );
    }

    const model = targetSession.default_model;
    const provider = targetSession.default_provider || providerManager.detectProvider(model) || 'grok';

    // Try to find API key for this provider
    const apiKey = settingsManager.getApiKeyForProvider(provider);

    if (!apiKey) {
      throw new Error(
        `❌ No API key found for provider: ${provider}\n\n` +
        `Session #${cliSessionId} uses ${model} (${provider})\n` +
        `Please configure API key: /apikey ${provider} <your-key>\n` +
        `Or use grokinou --api-key <key> --session ${cliSessionId}`
      );
    }

    const baseURL = providerManager.getProviderForModel(model)?.baseURL;

    return {
      status: 'restored',
      model,
      provider,
      apiKey,
      baseURL,
      message: `🎯 Launching Session #${cliSessionId}: ${targetSession.session_name || 'Unnamed'} (${model})`
    };
  }

  // PRIORITY 1: CLI args
  if (cliModel) {
    const provider = providerManager.detectProvider(cliModel) || 'grok';
    const apiKey = cliApiKey || settingsManager.getApiKeyForProvider(provider);
    const baseURL = cliBaseURL || providerManager.getProviderForModel(cliModel)?.baseURL;
    
    return {
      status: 'new',
      model: cliModel,
      provider,
      apiKey,
      baseURL,
      message: `🤖 Starting with: ${cliModel}`
    };
  }
  
  // PRIORITY 2: ENV vars
  if (process.env.GROK_MODEL) {
    const model = process.env.GROK_MODEL;
    const provider = providerManager.detectProvider(model) || 'grok';
    const apiKey = process.env.GROK_API_KEY || settingsManager.getApiKeyForProvider(provider);
    const baseURL = providerManager.getProviderForModel(model)?.baseURL;
    
    return {
      status: 'new',
      model,
      provider,
      apiKey,
      baseURL,
      message: `🤖 Starting with: ${model}`
    };
  }
  
  // PRIORITY 3: Last session from SQLite
  const lastSession = sessionManager.findLastSessionByWorkdir(cwd);
  
  if (lastSession && lastSession.default_model) {
    const model = lastSession.default_model;
    let provider = lastSession.default_provider;
    
    // Fallback if provider missing (old sessions)
    if (!provider) {
      provider = providerManager.detectProvider(model) || 'grok';
    }
    
    // Try to find API key for this provider
    const apiKey = settingsManager.getApiKeyForProvider(provider);
    
    if (!apiKey) {
      // API key missing - need user input
      return {
        status: 'needs_api_key',
        model,
        provider,
        needsInput: true,
        message: `
⚠️  Cannot restore session

🔒 Previous model: ${model}
🔑 Provider: ${provider}
❌ API key not found in ~/.grok/user-settings.json

Please provide API key:
   /apikey ${provider} <your-key>

Or switch to another model:
   /model

⏸️  Waiting for your input...
`
      };
    }
    
    // API key found - restore session
    const baseURL = providerManager.getProviderForModel(model)?.baseURL;
    
    return {
      status: 'restored',
      model,
      provider,
      apiKey,
      baseURL,
      message: `🔄 Restored session: ${model} (${provider})`
    };
  }
  
  // PRIORITY 4-6: Project → User → System default
  const model = settingsManager.getCurrentModel();
  const provider = providerManager.detectProvider(model) || 'grok';
  const apiKey = settingsManager.getApiKeyForProvider(provider);
  const baseURL = providerManager.getProviderForModel(model)?.baseURL;
  
  return {
    status: 'new',
    model,
    provider,
    apiKey,
    baseURL,
    message: `🤖 Starting with: ${model}`
  };
}

function parseConfigOverrides(overrides?: string[]): Record<string, any> | undefined {
  if (!overrides || overrides.length === 0) return undefined;
  const out: Record<string, any> = {};
  for (const kv of overrides) {
    const idx = kv.indexOf("=");
    if (idx === -1) continue;
    const key = kv.slice(0, idx).trim();
    const val = kv.slice(idx + 1).trim();
    applyKeyValue(out, key, val);
  }
  return out;
}

// Handle commit-and-push command in headless mode
async function handleCommitAndPushHeadless(
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
): Promise<void> {
  try {
    const agent = new GrokAgent(apiKey, baseURL, model, maxToolRounds);

    // Configure confirmation service for headless mode (auto-approve all operations)
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setSessionFlag("allOperations", true);

    console.log("🤖 Processing commit and push...\n");
    console.log("> /commit-and-push\n");

    // First check if there are any changes at all
    const initialStatusResult = await agent.executeBashCommand(
      "git status --porcelain"
    );

    if (!initialStatusResult.success || !initialStatusResult.output?.trim()) {
      console.log("❌ No changes to commit. Working directory is clean.");
      process.exit(1);
    }

    console.log("✅ git status: Changes detected");

    // Add all changes
    const addResult = await agent.executeBashCommand("git add .");

    if (!addResult.success) {
      console.log(
        `❌ git add: ${addResult.error || "Failed to stage changes"}`
      );
      process.exit(1);
    }

    console.log("✅ git add: Changes staged");

    // Get staged changes for commit message generation
    const diffResult = await agent.executeBashCommand("git diff --cached");

    // Generate commit message using AI
    const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`;

    console.log("🤖 Generating commit message...");

    const commitMessageEntries = await agent.processUserMessage(commitPrompt);
    let commitMessage = "";

    // Extract the commit message from the AI response
    for (const entry of commitMessageEntries) {
      if (entry.type === "assistant" && entry.content.trim()) {
        commitMessage = entry.content.trim();
        break;
      }
    }

    if (!commitMessage) {
      console.log("❌ Failed to generate commit message");
      process.exit(1);
    }

    // Clean the commit message
    const cleanCommitMessage = commitMessage.replace(/^["']|["']$/g, "");
    console.log(`✅ Generated commit message: "${cleanCommitMessage}"`);

    // Execute the commit
    const commitCommand = `git commit -m "${cleanCommitMessage}"`;
    const commitResult = await agent.executeBashCommand(commitCommand);

    if (commitResult.success) {
      console.log(
        `✅ git commit: ${
          commitResult.output?.split("\n")[0] || "Commit successful"
        }`
      );

      // If commit was successful, push to remote
      // First try regular push, if it fails try with upstream setup
      let pushResult = await agent.executeBashCommand("git push");

      if (
        !pushResult.success &&
        pushResult.error?.includes("no upstream branch")
      ) {
        console.log("🔄 Setting upstream and pushing...");
        pushResult = await agent.executeBashCommand("git push -u origin HEAD");
      }

      if (pushResult.success) {
        console.log(
          `✅ git push: ${
            pushResult.output?.split("\n")[0] || "Push successful"
          }`
        );
      } else {
        console.log(`❌ git push: ${pushResult.error || "Push failed"}`);
        process.exit(1);
      }
    } else {
      console.log(`❌ git commit: ${commitResult.error || "Commit failed"}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Error during commit and push:", error.message);
    process.exit(1);
  }
}

// Headless mode processing function
async function processPromptHeadless(
  prompt: string,
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
): Promise<void> {
  try {
    const agent = new GrokAgent(apiKey, baseURL, model, maxToolRounds);

    // Configure confirmation service for headless mode (auto-approve all operations)
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setSessionFlag("allOperations", true);

    // Process the user message
    const chatEntries = await agent.processUserMessage(prompt);

    // Convert chat entries to OpenAI compatible message objects
    const messages: ChatCompletionMessageParam[] = [];

    for (const entry of chatEntries) {
      switch (entry.type) {
        case "user":
          messages.push({
            role: "user",
            content: entry.content,
          });
          break;

        case "assistant":
          const assistantMessage: ChatCompletionMessageParam = {
            role: "assistant",
            content: entry.content,
          };

          // Add tool calls if present
          if (entry.toolCalls && entry.toolCalls.length > 0) {
            assistantMessage.tool_calls = entry.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            }));
          }

          messages.push(assistantMessage);
          break;

        case "tool_result":
          if (entry.toolCall) {
            // ✅ Truncate tool_call_id to 40 chars max (OpenAI API requirement)
            // Prevents error: "string too long. Expected a string with maximum length 40"
            const truncatedId = entry.toolCall.id.substring(0, 40);
            messages.push({
              role: "tool",
              tool_call_id: truncatedId,
              content: entry.content,
            });
          }
          break;
      }
    }

    // Output each message as a separate JSON object
    for (const message of messages) {
      console.log(JSON.stringify(message));
    }
  } catch (error: any) {
    // Output error in OpenAI compatible format
    console.log(
      JSON.stringify({
        role: "assistant",
        content: `Error: ${error.message}`,
      })
    );
    process.exit(1);
  }
}

program
  .name("grok")
  .description(
    "A conversational AI CLI tool powered by Grok with text editor capabilities"
  )
  .version("1.0.1")
  .argument("[message...]", "Initial message to send to Grok")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "Grok API key (or set GROK_API_KEY env var)")
  .option(
    "-u, --base-url <url>",
    "Grok API base URL (or set GROK_BASE_URL env var)"
  )
  .option(
    "-m, --model <model>",
    "AI model to use (e.g., grok-code-fast-1, grok-4-latest) (or set GROK_MODEL env var)"
  )
  .option(
    "-s, --session <id>",
    "launch specific session by ID (overrides last session detection)"
  )
  .option(
    "-p, --prompt <prompt>",
    "process a single prompt and exit (headless mode)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    "maximum number of tool execution rounds (default: 400)",
    "400"
  )
  .option(
    "-c, --config <key=value...>",
    "override config values (supports dot notation)"
  )
  .action(async (message, options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          error.message
        );
        process.exit(1);
      }
    }

    try {
      // Load TOML config and CLI overrides
      const tomlCfg = loadTomlConfig();
      const overrides = parseConfigOverrides(options.config);
      const effective = resolveEffectiveConfig(overrides, tomlCfg);

      // Resolve startup configuration with proper priority
      const maxToolRounds = parseInt(options.maxToolRounds) || 400;
      const sessionId = options.session ? parseInt(options.session) : undefined;
      const startupConfig = await resolveStartupConfiguration(
        options.model || effective.model,
        options.apiKey || effective.provider?.apiKey,
        options.baseUrl || effective.provider?.baseURL,
        sessionId
      );

      // Save API key and base URL to user settings if provided via command line
      if (options.apiKey || options.baseUrl) {
        await saveCommandLineSettings(options.apiKey, options.baseUrl);
      }

      // Headless mode: process prompt and exit
      if (options.prompt) {
        if (!startupConfig.apiKey) {
          console.error(
            "❌ Error: API key required. Set GROK_API_KEY environment variable, use --api-key flag, or save to ~/.grok/user-settings.json"
          );
          process.exit(1);
        }
        
        await processPromptHeadless(
          options.prompt,
          startupConfig.apiKey,
          startupConfig.baseURL,
          startupConfig.model,
          maxToolRounds
        );
        return;
      }

      // Interactive mode: launch UI
      // Note: agent can be undefined if no API key is configured
      // The UI will handle the "unconfigured" state and prompt for configuration
      let agent: GrokAgent | undefined;
      let initialConfigMessage: string | undefined;
      
      if (!startupConfig.apiKey) {
        // No API key - start in "configuration mode"
        initialConfigMessage = 
          "⚙️  **Configuration Required**\n\n" +
          "No model is configured for this session.\n\n" +
          "**To get started:**\n" +
          "1. Choose a model: `/models` (lists available models)\n" +
          "2. Set API key: `/apikey <provider> <your-key>`\n" +
          "   Example: `/apikey openai sk-proj-...`\n\n" +
          "**Available providers:** grok, openai, claude, deepseek, mistral\n\n" +
          "**Or set a global default:**\n" +
          "`/model-default <model-name>` (applies to all future sessions)\n\n" +
          `${startupConfig.message || ''}`;
        agent = undefined;
      } else {
        // API key available - initialize agent normally
        agent = new GrokAgent(
          startupConfig.apiKey,
          startupConfig.baseURL,
          startupConfig.model,
          maxToolRounds
        );

        // If --session was provided, switch to that session immediately
        if (sessionId !== undefined) {
          try {
            const { SessionManagerSQLite } = await import('./utils/session-manager-sqlite.js');
            const sessionManager = SessionManagerSQLite.getInstance();
            await sessionManager.switchSession(sessionId);

            // Load history from the target session
            const history = await sessionManager.loadChatHistory();

            // Note: History will be loaded by ChatInterface via agent.getChatHistory()
            // This just ensures the session is active in sessionManager
          } catch (error: any) {
            console.error(`❌ Failed to switch to session #${sessionId}:`, error.message);
            process.exit(1);
          }
        }
      }
      
      // Afficher le logo et instructions AVANT le démarrage d'Ink (une seule fois, jamais re-rendu)
      const logoOutput = cfonts.render("GROKINOU", {
        font: "block",
        align: "left",
        colors: ["#8B4513"], // Brown color
        space: true,
        maxLength: "0",
        env: "node",
      }) as any;
      console.log(logoOutput.string);

      console.log("\x1b[33m                    Based on Grok-CLI\x1b[0m\n");
      console.log("\x1b[90mType your request in natural language. Ctrl+C to clear, 'exit' to quit.\x1b[0m");
      console.log("\x1b[90mDebug logs: ~/.grok/debug.log\x1b[0m");
      console.log("\x1b[90mLoading session...\x1b[0m\n");

      ensureUserSettingsDirectory();
      initializeTimeline();

      // Support variadic positional arguments for multi-word initial message
      let initialMessage = Array.isArray(message)
        ? message.join(" ")
        : message;
      
      // If we're in configuration mode, use the config message instead
      if (initialConfigMessage) {
        initialMessage = initialConfigMessage;
      }

      // Disable alternate screen buffer for native terminal scrolling
      process.stdout.write('\x1b[?1049l');

      render(React.createElement(ChatInterface, {
        agent,
        initialMessage,
        startupConfig
      }));
    } catch (error: any) {
      console.error("❌ Error initializing Grok CLI:", error.message);
      process.exit(1);
    }
  });

// Git subcommand
const gitCommand = program
  .command("git")
  .description("Git operations with AI assistance");

gitCommand
  .command("commit-and-push")
  .description("Generate AI commit message and push to remote")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "Grok API key (or set GROK_API_KEY env var)")
  .option(
    "-u, --base-url <url>",
    "Grok API base URL (or set GROK_BASE_URL env var)"
  )
  .option(
    "-m, --model <model>",
    "AI model to use (e.g., grok-code-fast-1, grok-4-latest) (or set GROK_MODEL env var)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    "maximum number of tool execution rounds (default: 400)",
    "400"
  )
  .action(async (options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          error.message
        );
        process.exit(1);
      }
    }

    try {
      // Get API key from options, environment, or user settings
      const apiKey = options.apiKey || loadApiKey();
      const baseURL = options.baseUrl || loadBaseURL();
      const model = options.model || loadModel();
      const maxToolRounds = parseInt(options.maxToolRounds) || 400;

      if (!apiKey) {
        console.error(
          "❌ Error: API key required. Set GROK_API_KEY environment variable, use --api-key flag, or save to ~/.grok/user-settings.json"
        );
        process.exit(1);
      }

      // Save API key and base URL to user settings if provided via command line
      if (options.apiKey || options.baseUrl) {
        await saveCommandLineSettings(options.apiKey, options.baseUrl);
      }

      await handleCommitAndPushHeadless(apiKey, baseURL, model, maxToolRounds);
    } catch (error: any) {
      console.error("❌ Error during git commit-and-push:", error.message);
      process.exit(1);
    }
  });

// MCP command
program.addCommand(createMCPCommand());

// Exec subcommand: stream events as JSONL for automation
const execCommand = program
  .command("exec")
  .description("Run a prompt non-interactively and stream JSONL events")
  .argument("[message...]", "Prompt to run; if omitted, reads from STDIN")
  .option("-k, --api-key <key>", "Grok API key (or set GROK_API_KEY env var)")
  .option("-u, --base-url <url>", "Grok API base URL (or set GROK_BASE_URL env var)")
  .option("-m, --model <model>", "AI model to use")
  .option("--max-tool-rounds <rounds>", "maximum number of tool execution rounds (default: 400)", "400")
  .option("-c, --config <key=value...>", "override config values (supports dot notation)")
  .action(async (message, options) => {
    try {
      // Assemble prompt from args or stdin
      let prompt = Array.isArray(message) ? message.join(" ") : message;
      if (!prompt || !prompt.trim()) {
        // read stdin
        prompt = await new Promise<string>((resolve) => {
          let data = "";
          process.stdin.setEncoding("utf-8");
          process.stdin.on("data", (chunk) => (data += chunk));
          process.stdin.on("end", () => resolve(data));
        });
      }
      prompt = (prompt || "").trim();
      if (!prompt) {
        console.error("No prompt provided");
        process.exit(1);
      }

      // Resolve config
      const tomlCfg = loadTomlConfig();
      const overrides = parseConfigOverrides(options.config);
      const effective = resolveEffectiveConfig(overrides, tomlCfg);

      const model = options.model || effective.model || loadModel();
      const baseURL = options.baseUrl || effective.provider?.baseURL || loadBaseURL();
      const apiKey = options.apiKey || effective.provider?.apiKey || loadApiKey();
      const maxToolRounds = parseInt(options.maxToolRounds) || 400;

      if (!apiKey) {
        console.error("API key required");
        process.exit(1);
      }

      const agent = new GrokAgent(apiKey, baseURL, model, maxToolRounds);
      // Auto-approve to avoid confirmations in headless mode
      const confirmationService = ConfirmationService.getInstance();
      confirmationService.setSessionFlag("allOperations", true);

      // Stream results as JSON lines
      const encoder = (obj: any) => {
        process.stdout.write(JSON.stringify(obj) + "\n");
      };
      for await (const chunk of agent.processUserMessageStream(prompt)) {
        // Directly forward chunk structure
        encoder(chunk);
      }
    } catch (e: any) {
      process.stderr.write(JSON.stringify({ type: "error", message: e?.message || String(e) }) + "\n");
      process.exit(1);
    }
  });

// 🛡️ AUTO-START WATCHER DAEMON (if enabled)
// Détection "à rebours" : fichiers altérés AVANT lancement seront détectés
autoStartWatcher(process.cwd()).catch(error => {
  console.warn('⚠️  Failed to auto-start watcher daemon:', error.message);
});

program.parse();
