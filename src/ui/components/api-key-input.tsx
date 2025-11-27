import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { GrokAgent } from "../../agent/grok-agent.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { providerManager } from "../../utils/provider-manager.js";
import type { StartupConfig } from "../../index.js";
import { getAllModelsFlat, fuzzyMatch, formatModelMenu } from "./api-key-input-helpers.js";
import { CommandSuggestions } from "./command-suggestions.js";

interface ApiKeyInputProps {
  onApiKeySet: (agent: GrokAgent, initialSessionName?: string) => void;
  startupConfig?: StartupConfig;
  initialMessage?: string;
}

interface CommandSuggestion {
  command: string;
  description: string;
}

// Available commands during initialization phase
const INIT_COMMANDS: CommandSuggestion[] = [
  { command: "/models", description: "List available models (↑/↓ to navigate)" },
  { command: "/apikey", description: "Set API key: /apikey <provider> <key>" },
  { command: "/model-default", description: "Set global default model" },
  { command: "/session_name", description: "Set initial session name" },
  { command: "/help", description: "Show help message" },
  { command: "/exit", description: "Quit application" },
];

/**
 * Filter commands based on user input
 * Returns matching commands or all commands if input is just "/"
 */
function filterCommands(input: string): CommandSuggestion[] {
  const trimmed = input.trim();
  
  // Show all commands if user types just "/"
  if (trimmed === "/") {
    return INIT_COMMANDS;
  }
  
  // Filter commands that start with the input
  if (trimmed.startsWith("/")) {
    const query = trimmed.toLowerCase();
    return INIT_COMMANDS.filter(cmd => 
      cmd.command.toLowerCase().startsWith(query)
    );
  }
  
  return [];
}

/**
 * Format command suggestions for display
 */
function formatCommandSuggestions(commands: CommandSuggestion[]): string {
  if (commands.length === 0) return "";
  
  const header = commands.length === INIT_COMMANDS.length 
    ? "📋 **Available commands:**\n\n"
    : "💡 **Did you mean:**\n\n";
  
  const list = commands
    .map(cmd => `• \`${cmd.command}\` - ${cmd.description}`)
    .join("\n");
  
  return header + list;
}

/**
 * Configuration interface shown when no agent is available.
 * Allows users to configure model and API key interactively.
 */
export default function ApiKeyInput({ 
  onApiKeySet, 
  startupConfig,
  initialMessage 
}: ApiKeyInputProps) {
  const [messages, setMessages] = useState<Array<{ type: 'system' | 'user'; content: string }>>(() => {
    // Show initial configuration message
    const configMessage = initialMessage || 
      "⚙️  **Configuration Required**\n\n" +
      "No model is configured.\n\n" +
      "**Quick Start:**\n" +
      "• Type `/` to see all available commands\n" +
      "• Type `/mod` to filter commands (e.g., /models, /model-default)\n" +
      "• Use arrow keys (↑/↓) to navigate model menu\n\n" +
      "**Example:**\n" +
      "```\n" +
      "/apikey openai sk-proj-...\n" +
      "/models deep\n" +
      "/model-default gpt-4o\n" +
      "```\n\n" +
      "💡 **Tip:** Start by typing `/` to discover all commands!";
    
    return [{ type: 'system', content: configMessage }];
  });
  
  const [input, setInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New states for interactive model menu (Option D - Hybrid)
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [modelList, setModelList] = useState<string[]>([]);
  
  // Store initial session name (if user sets it before configuration completes)
  const [pendingSessionName, setPendingSessionName] = useState<string | undefined>(undefined);
  
  // Command suggestions (real-time autocomplete)
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  
  const { exit } = useApp();

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
    const userInput = input.trim();
    
    // Handle command suggestions when user types just "/"
    if (userInput === "/") {
      const suggestions = formatCommandSuggestions(INIT_COMMANDS);
      setMessages(prev => [...prev, 
        { type: 'user', content: userInput },
        { type: 'system', content: suggestions }
      ]);
      setInput('');
      return;
    }
    
    // Handle partial command matching for suggestions
    if (userInput.startsWith("/") && !userInput.includes(" ")) {
      const matchedCommands = filterCommands(userInput);
      
      // If we have matches but it's not an exact command, show suggestions
      const isExactCommand = INIT_COMMANDS.some(cmd => cmd.command === userInput);
      
      if (matchedCommands.length > 0 && !isExactCommand && matchedCommands.length < INIT_COMMANDS.length) {
        const suggestions = formatCommandSuggestions(matchedCommands);
        setMessages(prev => [...prev, 
          { type: 'user', content: userInput },
          { type: 'system', content: suggestions }
        ]);
        setInput('');
        return;
      }
    }
    
    setInput(''); // Clear input immediately
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: userInput }]);
    setIsProcessing(true);

    try {
      // Handle /models command (Option D: Hybrid with fuzzy matching + interactive menu)
      if (userInput === '/models' || userInput.startsWith('/models ')) {
        const parts = userInput.split(/\s+/);
        const query = parts.slice(1).join(' '); // Get search query if any
        
        const allModels = getAllModelsFlat();
        const matchedModels = query ? fuzzyMatch(query, allModels) : allModels;
        
        if (matchedModels.length === 0) {
          // No matches found
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: `❌ No models found matching "${query}"\n\nUse /models to see all available models.` 
          }]);
        } else if (matchedModels.length === 1 && query) {
          // Exactly 1 match with a query - suggest it
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: `✅ Found: **${matchedModels[0]}**\n\nUse this command to set it as default:\n\`/model-default ${matchedModels[0]}\`` 
          }]);
        } else {
          // Multiple matches or no query - show interactive menu
          setModelList(matchedModels);
          setSelectedModelIndex(0);
          setShowModelMenu(true);
          
          const menuContent = formatModelMenu(matchedModels, 0);
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: menuContent
          }]);
        }
      }
      
      // Handle /apikey command
      else if (userInput.startsWith('/apikey ')) {
        const parts = userInput.split(/\s+/);
        if (parts.length < 3) {
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: "❌ Usage: `/apikey <provider> <your-api-key>`\n\nExample: `/apikey openai sk-proj-...`" 
          }]);
        } else {
          const provider = parts[1].toLowerCase();
          const apiKey = parts.slice(2).join(' '); // In case key has spaces
          
          const providerConfig = providerManager.getProvider(provider);
          if (!providerConfig) {
            const available = Object.keys(providerManager.getAllProviders()).join(', ');
            setMessages(prev => [...prev, { 
              type: 'system', 
              content: `❌ Unknown provider: ${provider}\n\nAvailable providers: ${available}` 
            }]);
          } else {
            // Save API key using settings manager
            const manager = getSettingsManager();
            const apiKeys = manager.getApiKeys() || {};
            apiKeys[provider] = apiKey;
            manager.updateUserSetting('apiKeys', apiKeys);
            
            // Check if we have a default model for this provider
            const currentModel = startupConfig?.model || manager.getCurrentModel();
            const modelProvider = providerManager.detectProvider(currentModel);
            
            if (modelProvider === provider) {
              // We can initialize the agent now!
              const baseURL = providerConfig.baseURL;
              const agent = new GrokAgent(apiKey, baseURL, currentModel);
              
              setMessages(prev => [...prev, { 
                type: 'system', 
                content: `✅ API key saved for ${provider}\n🚀 Initializing agent with ${currentModel}...` 
              }]);
              
              // Small delay to show the message
              setTimeout(() => {
                onApiKeySet(agent, pendingSessionName);
              }, 500);
            } else {
              // API key saved, but need to select a model
              setMessages(prev => [...prev, { 
                type: 'system', 
                content: `✅ API key saved for ${provider}\n\n` +
                  `**Next step:** Set a default model\n` +
                  `/model-default ${providerConfig.models[0]}\n\n` +
                  `Or use /models to see all available models.`
              }]);
            }
          }
        }
      }
      
      // Handle /model-default command (Option D: with fuzzy matching)
      else if (userInput.startsWith('/model-default ')) {
        const parts = userInput.split(/\s+/);
        if (parts.length < 2) {
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: "❌ Usage: `/model-default <model-name>`\n\nExample: `/model-default gpt-4o`\n\n**Tip:** Use `/models <query>` to find models" 
          }]);
        } else {
          const modelQuery = parts.slice(1).join(' ');
          
          // Try fuzzy matching first
          const allModels = getAllModelsFlat();
          const matches = fuzzyMatch(modelQuery, allModels);
          
          if (matches.length === 0) {
            // No matches
            setMessages(prev => [...prev, { 
              type: 'system', 
              content: `❌ No models found matching "${modelQuery}"\n\nUse /models to see all available models.` 
            }]);
          } else if (matches.length === 1) {
            // Exactly 1 match - use it
            const model = matches[0];
            const provider = providerManager.detectProvider(model);
            
            if (!provider) {
              setMessages(prev => [...prev, { 
                type: 'system', 
                content: `❌ Unknown provider for model: ${model}` 
              }]);
            } else {
              // Save default model
              const manager = getSettingsManager();
              manager.updateUserSetting('defaultModel', model);
              
              // Check if we have an API key for this provider
              const apiKey = manager.getApiKeyForProvider(provider);
              
              if (apiKey) {
                // We can initialize the agent now!
                const providerConfig = providerManager.getProviderForModel(model);
                const baseURL = providerConfig?.baseURL || 'https://api.x.ai/v1';
                const agent = new GrokAgent(apiKey, baseURL, model);
                
                setMessages(prev => [...prev, { 
                  type: 'system', 
                  content: `✅ Default model set to **${model}**\n🚀 Initializing agent...` 
                }]);
                
                // Small delay to show the message
                setTimeout(() => {
                  onApiKeySet(agent, pendingSessionName);
                }, 500);
              } else {
                // Model saved, but need API key
                setMessages(prev => [...prev, { 
                  type: 'system', 
                  content: `✅ Default model set to **${model}**\n\n` +
                    `**Next step:** Add your ${provider} API key\n` +
                    `/apikey ${provider} <your-key>`
                }]);
              }
            }
          } else {
            // Multiple matches - show suggestions
            const suggestions = matches.slice(0, 5).map(m => `  • ${m}`).join('\n');
            setMessages(prev => [...prev, { 
              type: 'system', 
              content: `❓ Multiple models match "${modelQuery}":\n\n${suggestions}\n\n` +
                `Please be more specific or use /models to navigate interactively.` 
            }]);
          }
        }
      }
      
      // Handle /help command
      else if (userInput === '/help') {
        const helpMsg = 
          "📖 **Configuration Help**\n\n" +
          "**Available commands:**\n" +
          "• `/models` - List all available models\n" +
          "• `/apikey <provider> <key>` - Set API key for a provider\n" +
          "• `/model-default <model>` - Set global default model\n" +
          "• `/session_name <name>` - Set initial session name\n" +
          "• `/help` - Show this help message\n" +
          "• `/exit` - Quit application\n\n" +
          "**Quick start:**\n" +
          "1. Run `/models` to see available models\n" +
          "2. Run `/apikey <provider> <your-key>` to add your API key\n" +
          "3. Run `/model-default <model>` to set your preferred model\n";
        
        setMessages(prev => [...prev, { type: 'system', content: helpMsg }]);
      }
      
      // Handle /session_name command (set initial session name before session creation)
      else if (userInput.startsWith('/session_name ')) {
        const parts = userInput.split(/\s+/);
        const sessionName = parts.slice(1).join(' ').trim();
        
        if (!sessionName) {
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: `❌ Please provide a session name.\n\nUsage: /session_name <name>` 
          }]);
        } else {
          setPendingSessionName(sessionName);
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: `✅ Session name set to: **${sessionName}**\n\nThis name will be used when the session is created.` 
          }]);
        }
      }
      
      // Handle exit (support both /exit and legacy exit/quit)
      else if (userInput === '/exit' || userInput === 'exit' || userInput === 'quit') {
        exit();
      }
      
      // Unknown command
      else {
        setMessages(prev => [...prev, { 
          type: 'system', 
          content: `❓ Unknown command. Type /help for available commands.` 
        }]);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        type: 'system', 
        content: `❌ Error: ${error.message}` 
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, onApiKeySet, startupConfig, exit]);

  // Handle keyboard input (Option D: with interactive menu navigation + command suggestions)
  useInput((inputChar, key) => {
    if (isProcessing) return;
    
    // ============================================
    // MODE 1: Command Suggestions Navigation (Real-time autocomplete)
    // ============================================
    if (showCommandSuggestions) {
      // Navigate up in suggestions
      if (key.upArrow) {
        setSelectedCommandIndex(prev => {
          const filtered = filterCommands(input);
          return Math.max(0, prev - 1);
        });
        return;
      }
      
      // Navigate down in suggestions
      if (key.downArrow) {
        setSelectedCommandIndex(prev => {
          const filtered = filterCommands(input);
          return Math.min(filtered.length - 1, prev + 1);
        });
        return;
      }
      
      // Select command with Tab or Enter
      if (key.tab || key.return) {
        const filtered = filterCommands(input);
        if (filtered.length > 0 && selectedCommandIndex < filtered.length) {
          const selectedCommand = filtered[selectedCommandIndex];
          setInput(selectedCommand.command + ' ');
          setShowCommandSuggestions(false);
          setSelectedCommandIndex(0);
        }
        return;
      }
      
      // Cancel suggestions with Escape
      if (key.escape) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return;
      }
    }
    
    // ============================================
    // MODE 2: Interactive Model Menu Navigation
    // ============================================
    if (showModelMenu) {
      // Navigate up
      if (key.upArrow) {
        setSelectedModelIndex(prev => {
          const newIdx = Math.max(0, prev - 1);
          // Update menu display with new selection
          const menuContent = formatModelMenu(modelList, newIdx);
          setMessages(prevMsgs => {
            const newMsgs = [...prevMsgs];
            // Replace last message (the menu) with updated version
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].type === 'system') {
              newMsgs[newMsgs.length - 1] = { type: 'system', content: menuContent };
            }
            return newMsgs;
          });
          return newIdx;
        });
        return;
      }
      
      // Navigate down
      if (key.downArrow) {
        setSelectedModelIndex(prev => {
          const newIdx = Math.min(modelList.length - 1, prev + 1);
          // Update menu display with new selection
          const menuContent = formatModelMenu(modelList, newIdx);
          setMessages(prevMsgs => {
            const newMsgs = [...prevMsgs];
            // Replace last message (the menu) with updated version
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].type === 'system') {
              newMsgs[newMsgs.length - 1] = { type: 'system', content: menuContent };
            }
            return newMsgs;
          });
          return newIdx;
        });
        return;
      }
      
      // Select model with Enter
      if (key.return) {
        const selectedModel = modelList[selectedModelIndex];
        setShowModelMenu(false);
        // Auto-fill /model-default command and submit
        setInput(`/model-default ${selectedModel}`);
        setMessages(prev => [...prev, { type: 'user', content: `/model-default ${selectedModel}` }]);
        // Trigger handleSubmit with the selected model
        setTimeout(() => {
          // Call handleSubmit logic directly
          setIsProcessing(true);
          const provider = providerManager.detectProvider(selectedModel);
          
          if (!provider) {
            setMessages(prev => [...prev, { 
              type: 'system', 
              content: `❌ Unknown provider for model: ${selectedModel}` 
            }]);
            setIsProcessing(false);
          } else {
            // Save default model
            const manager = getSettingsManager();
            manager.updateUserSetting('defaultModel', selectedModel);
            
            // Check if we have an API key for this provider
            const apiKey = manager.getApiKeyForProvider(provider);
            
            if (apiKey) {
              // We can initialize the agent now!
              const providerConfig = providerManager.getProviderForModel(selectedModel);
              const baseURL = providerConfig?.baseURL || 'https://api.x.ai/v1';
              const agent = new GrokAgent(apiKey, baseURL, selectedModel);
              
              setMessages(prev => [...prev, { 
                type: 'system', 
                content: `✅ Default model set to **${selectedModel}**\n🚀 Initializing agent...` 
              }]);
              
              // Small delay to show the message
              setTimeout(() => {
                onApiKeySet(agent, pendingSessionName);
              }, 500);
            } else {
              // Model saved, but need API key
              setMessages(prev => [...prev, { 
                type: 'system', 
                content: `✅ Default model set to **${selectedModel}**\n\n` +
                  `**Next step:** Add your ${provider} API key\n` +
                  `/apikey ${provider} <your-key>`
              }]);
              setIsProcessing(false);
            }
          }
          setInput(''); // Clear input
        }, 10);
        return;
      }
      
      // Cancel menu with Escape
      if (key.escape) {
        setShowModelMenu(false);
        setMessages(prev => [...prev, { type: 'system', content: '❌ Model selection cancelled.' }]);
        return;
      }
      
      // Block other inputs when menu is active
      return;
    }
    
    // ============================================
    // MODE 3: Normal Input Mode (with real-time command suggestions)
    // ============================================
    
    if (key.return) {
      handleSubmit();
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => {
        const newInput = prev.slice(0, -1);
        
        // Update command suggestions in real-time
        if (newInput.startsWith('/') && !newInput.includes(' ')) {
          const filtered = filterCommands(newInput);
          setShowCommandSuggestions(filtered.length > 0);
          setSelectedCommandIndex(0);
        } else {
          setShowCommandSuggestions(false);
        }
        
        return newInput;
      });
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput(prev => {
        const newInput = prev + inputChar;
        
        // Show command suggestions when typing "/" or a partial command
        if (newInput.startsWith('/') && !newInput.includes(' ')) {
          const filtered = filterCommands(newInput);
          setShowCommandSuggestions(filtered.length > 0);
          setSelectedCommandIndex(0);
        } else {
          setShowCommandSuggestions(false);
        }
        
        return newInput;
      });
    }
  }, { isActive: !isProcessing });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Message history */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.map((msg, idx) => (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            {msg.type === 'system' ? (
              <Text color="cyan">{msg.content}</Text>
            ) : (
              <Box>
                <Text color="green">❯ </Text>
                <Text color="white">{msg.content}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Input prompt */}
      {!isProcessing && (
        <Box>
          <Text color="green">❯ </Text>
          <Text color="white">{input}</Text>
          <Text color="cyan">█</Text>
        </Box>
      )}
      
      {/* Real-time command suggestions */}
      <CommandSuggestions
        suggestions={INIT_COMMANDS}
        input={input}
        selectedIndex={selectedCommandIndex}
        isVisible={showCommandSuggestions}
      />
      
      {isProcessing && (
        <Box>
          <Text color="yellow">⏳ Processing...</Text>
        </Box>
      )}
    </Box>
  );
}
