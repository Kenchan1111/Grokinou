/**
 * SubAgent - Sous-agent léger qui wrap un GrokClient dédié
 *
 * Chaque SubAgent:
 * - Instancie son propre GrokClient via providerManager
 * - Injecte le prompt du skill comme message system
 * - Filtre les tools disponibles selon skill.tools
 * - Gère son propre cycle tool_calls (max 3 rounds)
 * - NE partage PAS l'historique du chat principal (isolation)
 */

import { GrokClient, GrokMessage, GrokTool, GrokToolCall } from '../grok/client.js';
import { GROK_TOOLS } from '../grok/tools.js';
import { providerManager } from '../utils/provider-manager.js';
import { debugLog } from '../utils/debug-logger.js';
import { BashTool, TextEditorTool } from '../tools/index.js';
import { getSharedSearchTool } from '../tools/shared-search.js';
import type { SkillDefinition } from './skill-registry.js';
import { ToolResult } from '../types/index.js';

const MAX_TOOL_ROUNDS = 3;

export interface SubAgentResult {
  skillName: string;
  model: string;
  provider: string;
  content: string;
  toolCalls?: GrokToolCall[];
  tokenCount?: number;
  duration: number;
}

export class SubAgent {
  private client: GrokClient | null = null;
  private skill: SkillDefinition;
  private allowedTools: GrokTool[];
  private aborted = false;

  // Outils partagés pour l'exécution des tool calls
  private textEditor = new TextEditorTool();
  private bash = new BashTool();
  private search = getSharedSearchTool();

  constructor(skill: SkillDefinition) {
    this.skill = skill;
    this.allowedTools = this.filterTools();
  }

  /**
   * Filtre les tools disponibles selon skill.tools
   */
  private filterTools(): GrokTool[] {
    if (!this.skill.tools || this.skill.tools.length === 0) {
      // Pas de restriction → subset sûr par défaut (lecture seule)
      return GROK_TOOLS.filter(t =>
        ['view_file', 'search', 'search_more'].includes(t.function.name)
      );
    }

    return GROK_TOOLS.filter(t =>
      this.skill.tools!.includes(t.function.name)
    );
  }

  /**
   * Crée un GrokClient avec le provider/model du skill ou fallback
   */
  private initClient(): GrokClient {
    const model = this.skill.model;
    const providerName = this.skill.provider;

    // Résoudre le provider et ses credentials
    let providerConfig = providerName
      ? providerManager.getProvider(providerName)
      : undefined;

    // Si un modèle est spécifié, détecter le provider depuis le modèle
    if (!providerConfig && model) {
      providerConfig = providerManager.getProviderForModel(model) || undefined;
    }

    // Fallback: provider par défaut (grok)
    if (!providerConfig) {
      providerConfig = providerManager.getProvider('grok');
    }

    if (!providerConfig?.apiKey) {
      throw new Error(
        `No API key for provider "${providerConfig?.name || providerName || 'unknown'}". ` +
        `Configure it with /apikey ${providerConfig?.name || providerName} <key>`
      );
    }

    const modelToUse = model || providerConfig.models[0] || 'grok-3-fast';

    debugLog.log(
      `🤖 SubAgent[${this.skill.name}]: ` +
      `provider=${providerConfig.name}, model=${modelToUse}`
    );

    return new GrokClient(
      providerConfig.apiKey,
      modelToUse,
      providerConfig.baseURL
    );
  }

  /**
   * Exécute le skill avec un contexte donné
   */
  async execute(context: string): Promise<SubAgentResult> {
    const startTime = Date.now();

    this.client = this.initClient();

    const messages: GrokMessage[] = [
      {
        role: 'system',
        content: this.skill.prompt,
      },
      {
        role: 'user',
        content: context,
      },
    ];

    const tools = this.allowedTools.length > 0 ? this.allowedTools : undefined;
    let finalContent = '';
    let allToolCalls: GrokToolCall[] = [];

    // Boucle tool_calls (max rounds)
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (this.aborted) break;

      const response = await this.client.chat(messages, tools);
      const choice = response.choices[0];

      if (!choice) break;

      const msg = choice.message;

      // Accumuler le contenu textuel
      if (msg.content) {
        finalContent += (finalContent ? '\n' : '') + msg.content;
      }

      // Pas de tool calls → terminé
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        break;
      }

      // Ajouter le message assistant avec tool_calls à l'historique
      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      } as GrokMessage);

      // Exécuter chaque tool call
      for (const tc of msg.tool_calls) {
        allToolCalls.push(tc);

        const result = await this.executeToolCall(tc);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.success
            ? (result.output || 'Success')
            : `Error: ${result.error || 'Unknown error'}`,
        } as GrokMessage);
      }
    }

    const model = this.client.getCurrentModel();
    const providerConfig = providerManager.getProviderForModel(model);

    return {
      skillName: this.skill.name,
      model,
      provider: providerConfig?.name || this.skill.provider || 'unknown',
      content: finalContent || '(no response)',
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Exécute un tool call individuel (subset limité)
   */
  private async executeToolCall(toolCall: GrokToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolCall.function.name) {
        case 'view_file': {
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);
        }

        case 'search':
          return await this.search.search(args.query, {
            searchType: args.search_type,
            includePattern: args.include_pattern,
            excludePattern: args.exclude_pattern,
            caseSensitive: args.case_sensitive,
            wholeWord: args.whole_word,
            regex: args.regex,
            maxResults: args.max_results,
            fileTypes: args.file_types,
          });

        case 'search_more':
          return await this.search.searchMore(args.search_id, args.limit);

        case 'bash':
          return await this.bash.execute(args.command, 30000);

        case 'create_file':
          return await this.textEditor.create(args.path, args.content);

        case 'str_replace_editor':
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str,
            args.replace_all
          );

        default:
          return {
            success: false,
            error: `Tool "${toolCall.function.name}" not available for sub-agent`,
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Tool execution error: ${err.message}`,
      };
    }
  }

  /**
   * Annulation propre
   */
  abort(): void {
    this.aborted = true;
  }
}
