import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { GrokAgent } from "../../agent/grok-agent.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { providerManager } from "../../utils/provider-manager.js";
import type { StartupConfig } from "../../index.js";

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
      "• `/models` - List available models\n" +
      "• `/apikey <provider> <key>` - Set API key\n" +
      "• `/model-default <model>` - Set global default model\n\n" +
      "**Example:**\n" +
      "```\n" +
      "/apikey openai sk-proj-...\n" +
      "/model-default gpt-4o\n" +
      "```";
    
    return [{ type: 'system', content: configMessage }];
  });
  
  const [input, setInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { exit } = useApp();

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
    const userInput = input.trim();
    setInput(''); // Clear input immediately
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: userInput }]);
    setIsProcessing(true);

    try {
      // Handle /models command
      if (userInput === '/models' || userInput.startsWith('/models ')) {
        const providers = providerManager.getAllProviders();
        let response = "📋 **Available Models:**\n\n";
        
        for (const [providerName, provider] of Object.entries(providers)) {
          response += `**${providerName}** (${provider.baseURL}):\n`;
          for (const model of provider.models) {
            response += `  • ${model}\n`;
          }
          response += '\n';
        }
        
        response += "\n**Next steps:**\n";
        response += "1. Choose a model from the list above\n";
        response += "2. Set your API key: `/apikey <provider> <your-key>`\n";
        response += "   Example: `/apikey openai sk-proj-...`\n";
        
        setMessages(prev => [...prev, { type: 'system', content: response }]);
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
      
      // Handle /model-default command
      else if (userInput.startsWith('/model-default ')) {
        const parts = userInput.split(/\s+/);
        if (parts.length < 2) {
          setMessages(prev => [...prev, { 
            type: 'system', 
            content: "❌ Usage: `/model-default <model-name>`\n\nExample: `/model-default gpt-4o`" 
          }]);
        } else {
          const model = parts.slice(1).join(' ');
          const provider = providerManager.detectProvider(model);
          
          if (!provider) {
            setMessages(prev => [...prev, { 
              type: 'system', 
              content: `❌ Unknown model: ${model}\n\nUse /models to see available models.` 
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
                content: `✅ Default model set to ${model}\n🚀 Initializing agent...` 
              }]);
              
              // Small delay to show the message
              setTimeout(() => {
                onApiKeySet(agent);
              }, 500);
            } else {
              // Model saved, but need API key
              setMessages(prev => [...prev, { 
                type: 'system', 
                content: `✅ Default model set to ${model}\n\n` +
                  `**Next step:** Add your ${provider} API key\n` +
                  `/apikey ${provider} <your-key>`
              }]);
            }
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

  // Handle keyboard input
  useInput((inputChar, key) => {
    if (isProcessing) return;

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
