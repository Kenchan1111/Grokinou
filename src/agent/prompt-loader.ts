/**
 * Prompt Loader - Load system prompts from external markdown files
 *
 * Benefits:
 * - Edit prompts without recompiling
 * - Version control for prompt changes
 * - A/B testing different prompts
 * - Multilingual support
 * - Hot-reload capability
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type PromptLanguage = 'en' | 'fr';
export type PromptVariant = 'default' | 'compact';

export interface PromptConfig {
  language?: PromptLanguage;
  variant?: PromptVariant;
  customInstructions?: string;
}

/**
 * Load system prompt from markdown file
 */
export async function loadSystemPrompt(config: PromptConfig = {}): Promise<string> {
  const {
    language = 'en',
    variant = 'default',
    customInstructions = '',
  } = config;

  // Determine filename
  const filename = variant === 'compact'
    ? 'compact-prompt.md'
    : `system-prompt${language === 'fr' ? '-fr' : ''}.md`;

  const promptPath = join(__dirname, '../prompts', filename);

  try {
    let prompt = await readFile(promptPath, 'utf-8');

    // Replace custom instructions placeholder
    if (customInstructions) {
      prompt = prompt.replace(
        '{CUSTOM_INSTRUCTIONS_PLACEHOLDER}',
        customInstructions
      );
    } else {
      // Remove the placeholder section if no custom instructions
      prompt = prompt.replace(
        /## Custom Instructions\s*\n\s*\{CUSTOM_INSTRUCTIONS_PLACEHOLDER\}\s*\n/g,
        ''
      );
    }

    return prompt;
  } catch (error) {
    // Fallback to inline prompt if file not found
    console.warn(`Failed to load prompt from ${promptPath}, using fallback`);
    return getFallbackPrompt(customInstructions);
  }
}

/**
 * Synchronous version for contexts that can't use async
 */
export function loadSystemPromptSync(config: PromptConfig = {}): string {
  const { customInstructions = '' } = config;

  // For now, return fallback (we can enhance this later with sync fs.readFileSync)
  return getFallbackPrompt(customInstructions);
}

/**
 * Fallback prompt if external file can't be loaded
 */
function getFallbackPrompt(customInstructions: string): string {
  const customSection = customInstructions
    ? `\n\n## Custom Instructions\n\n${customInstructions}\n`
    : '';

  return `You are a coding assistant in Grokinou CLI.

# Your Role

Help developers with code, files, and system operations. Be concise, direct, and friendly.

# Available Tools

- view_file: Read files and list directories
- str_replace_editor: Edit existing files
- create_file: Create new files
- bash: Execute shell commands
- search: Find text or files
- Todo tools: Plan and track tasks
- Session tools: Manage conversation sessions

# Guidelines

- Read files before editing them (view_file first)
- Edit existing files with str_replace_editor
- Create new files with create_file only
- Work autonomously until task is complete
- Communicate naturally and concisely
- Test your changes when possible
${customSection}
Remember: Solve problems completely, communicate naturally, and focus on delivering working solutions.`;
}

/**
 * Cache for loaded prompts (for hot-reload support in future)
 */
const promptCache = new Map<string, { content: string; timestamp: number }>();

/**
 * Clear prompt cache (useful for hot-reload)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Get cache key for a prompt configuration
 */
function getCacheKey(config: PromptConfig): string {
  const { language = 'en', variant = 'default' } = config;
  return `${language}-${variant}`;
}
