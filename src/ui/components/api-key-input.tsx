import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { GrokAgent } from "../../agent/grok-agent.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { providerManager } from "../../utils/provider-manager.js";
import type { StartupConfig } from "../../index.js";
import { getAllModelsFlat, fuzzyMatch, formatModelMenu } from "./api-key-input-helpers.js";

interface ApiKeyInputProps {
  onApiKeySet: (agent: GrokAgent) => void;
  startupConfig?: StartupConfig;
  initialMessage?: string;
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
      "**Available commands:**\n" +
      "• `/models` - List available models (↑/↓ to navigate)\n" +
      "• `/apikey <provider> <key>` - Set API key\n" +
      "• `/model-default <model>` - Set global default model\n\n" +
      "**Example:**\n" +
      "```\n" +
      "/apikey openai sk-proj-...\n" +
      "/model-default gpt-4o\n" +
      "```\n\n" +
      "**Tip:** Type `/models deep` to filter models";
    
    return [{ type: 'system', content: configMessage }];
  });
  
  const [input, setInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New states for interactive model menu (Option D - Hybrid)
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [modelList, setModelList] = useState<string[]>([]);
  
  const { exit } = useApp();

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
    const userInput = input.trim();
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
                onApiKeySet(agent);
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
                  onApiKeySet(agent);
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
          "• `/help` - Show this help message\n" +
          "• `exit` - Quit\n\n" +
          "**Quick start:**\n" +
          "1. Run `/models` to see available models\n" +
          "2. Run `/apikey <provider> <your-key>` to add your API key\n" +
          "3. Run `/model-default <model>` to set your preferred model\n";
        
        setMessages(prev => [...prev, { type: 'system', content: helpMsg }]);
      }
      
      // Handle exit
      else if (userInput === 'exit' || userInput === 'quit') {
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

  // Handle keyboard input (Option D: with interactive menu navigation)
  useInput((inputChar, key) => {
    if (isProcessing) return;
    
    // ============================================
    // MODE 1: Interactive Model Menu Navigation
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
                onApiKeySet(agent);
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
    // MODE 2: Normal Input Mode (Original behavior preserved)
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
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput(prev => prev + inputChar);
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
      
      {isProcessing && (
        <Box>
          <Text color="yellow">⏳ Processing...</Text>
        </Box>
      )}
    </Box>
  );
}
