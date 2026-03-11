import { createTokenCounter, TokenCounter } from "../utils/token-counter.js";
import type { GrokMessage } from "../grok/client.js";

// --- Configuration ---

export interface CompactionConfig {
  /** Pourcentage du context window qui déclenche la compaction (default: 0.75) */
  threshold: number;
  /** Nombre minimum de messages récents à conserver intacts */
  keepRecentMessages: number;
  /** Nombre minimum de messages avant de déclencher (éviter compaction trop tôt) */
  minMessagesBeforeCompaction: number;
}

export interface CompactionResult {
  compacted: boolean;
  originalMessageCount: number;
  newMessageCount: number;
  tokensFreed: number;
  summary?: string;
}

const DEFAULT_CONFIG: CompactionConfig = {
  threshold: 0.75,
  keepRecentMessages: 10,
  minMessagesBeforeCompaction: 20,
};

// Prompt utilisé pour demander au LLM de résumer la conversation
const SUMMARY_PROMPT = `Résume cette conversation de manière concise mais complète.
Conserve: les décisions techniques, les fichiers modifiés, les bugs identifiés,
les préférences utilisateur, et tout contexte nécessaire pour continuer le travail.
Ne conserve PAS: les détails de code verbatim, les outputs de commandes longs,
les contenus de fichiers déjà lus.`;

// --- Classe principale ---

export class ContextCompactor {
  private config: CompactionConfig;
  private tokenCounter: TokenCounter;

  constructor(config?: Partial<CompactionConfig>, model?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokenCounter = createTokenCounter(model);
  }

  /**
   * Vérifie si la compaction est nécessaire.
   */
  shouldCompact(messages: GrokMessage[], contextWindowSize: number): boolean {
    if (messages.length < this.config.minMessagesBeforeCompaction) {
      return false;
    }

    const totalTokens = this.countTokensForMessages(messages);
    return totalTokens > this.config.threshold * contextWindowSize;
  }

  /**
   * Effectue la compaction des messages.
   *
   * @param messages - Tableau de messages courant
   * @param contextWindowSize - Taille du context window du modèle
   * @param summarizer - Fonction qui appelle le LLM pour résumer du texte
   * @returns Les messages compactés et les statistiques
   */
  async compact(
    messages: GrokMessage[],
    contextWindowSize: number,
    summarizer: (text: string) => Promise<string>,
  ): Promise<{ messages: GrokMessage[]; result: CompactionResult }> {
    const originalCount = messages.length;
    const tokensBefore = this.countTokensForMessages(messages);

    // Pas assez de messages pour compacter
    if (!this.shouldCompact(messages, contextWindowSize)) {
      return {
        messages,
        result: {
          compacted: false,
          originalMessageCount: originalCount,
          newMessageCount: originalCount,
          tokensFreed: 0,
        },
      };
    }

    // Séparer: system prompt, messages anciens, messages récents
    const { systemMessages, oldMessages, recentMessages } =
      this.splitMessages(messages);

    // Rien à compacter (tous les messages sont récents ou system)
    if (oldMessages.length === 0) {
      return {
        messages,
        result: {
          compacted: false,
          originalMessageCount: originalCount,
          newMessageCount: originalCount,
          tokensFreed: 0,
        },
      };
    }

    // Formater les anciens messages en texte pour le résumé
    const textToSummarize = this.formatMessagesForSummary(oldMessages);

    // Appeler le summarizer (LLM)
    const promptWithContext = `${SUMMARY_PROMPT}\n\n---\n\n${textToSummarize}`;
    const summary = await summarizer(promptWithContext);

    // Construire le message de résumé
    const summaryMessage: GrokMessage = {
      role: "user",
      content: `[Context compacté - ${oldMessages.length} messages résumés]\n\n${summary}`,
    } as GrokMessage;

    // Reconstruire le tableau de messages
    const newMessages: GrokMessage[] = [
      ...systemMessages,
      summaryMessage,
      ...recentMessages,
    ];

    const tokensAfter = this.countTokensForMessages(newMessages);

    return {
      messages: newMessages,
      result: {
        compacted: true,
        originalMessageCount: originalCount,
        newMessageCount: newMessages.length,
        tokensFreed: tokensBefore - tokensAfter,
        summary,
      },
    };
  }

  /**
   * Sépare les messages en 3 groupes:
   * - system prompt (premier message si role=system)
   * - messages anciens (à compacter)
   * - messages récents (à conserver intacts)
   *
   * Respecte les paires tool_call/tool_result:
   * si une paire chevauche la frontière, elle est incluse dans la zone compactée.
   */
  private splitMessages(messages: GrokMessage[]): {
    systemMessages: GrokMessage[];
    oldMessages: GrokMessage[];
    recentMessages: GrokMessage[];
  } {
    // Extraire le system prompt
    let systemMessages: GrokMessage[] = [];
    let restMessages: GrokMessage[] = messages;

    if (messages.length > 0 && (messages[0] as any).role === "system") {
      systemMessages = [messages[0]];
      restMessages = messages.slice(1);
    }

    // Calculer la frontière: on garde au minimum keepRecentMessages à la fin
    const keepCount = Math.min(
      this.config.keepRecentMessages,
      restMessages.length,
    );
    let splitIndex = restMessages.length - keepCount;

    // Ajuster la frontière pour ne pas casser une paire tool_call/tool_result
    splitIndex = this.adjustSplitForToolPairs(restMessages, splitIndex);

    // Si après ajustement il n'y a rien à compacter
    if (splitIndex <= 0) {
      return {
        systemMessages,
        oldMessages: [],
        recentMessages: restMessages,
      };
    }

    return {
      systemMessages,
      oldMessages: restMessages.slice(0, splitIndex),
      recentMessages: restMessages.slice(splitIndex),
    };
  }

  /**
   * Ajuste l'index de split pour ne jamais séparer un assistant+tool_calls
   * de ses tool_result correspondants.
   *
   * Si le message juste avant le split est un assistant avec tool_calls,
   * on recule le split pour inclure ce message ET ses tool results dans la zone ancienne.
   *
   * Si le message juste après le split est un tool result (role=tool),
   * on recule le split pour inclure l'assistant+tool_calls correspondant.
   */
  private adjustSplitForToolPairs(
    messages: GrokMessage[],
    splitIndex: number,
  ): number {
    if (splitIndex <= 0 || splitIndex >= messages.length) {
      return splitIndex;
    }

    // Cas 1: le message au split est un tool result → reculer pour garder la paire ensemble
    // On recule tant qu'on tombe sur des tool results
    let adjusted = splitIndex;
    while (
      adjusted > 0 &&
      (messages[adjusted] as any).role === "tool"
    ) {
      adjusted--;
    }

    // Si on a reculé et qu'on est sur un assistant avec tool_calls, l'inclure aussi
    if (
      adjusted < splitIndex &&
      adjusted >= 0 &&
      (messages[adjusted] as any).role === "assistant" &&
      (messages[adjusted] as any).tool_calls
    ) {
      // Inclure l'assistant dans la zone compactée → avancer le split après les tool results
      // Trouver la fin des tool results liés
      let endOfToolResults = adjusted + 1;
      while (
        endOfToolResults < messages.length &&
        (messages[endOfToolResults] as any).role === "tool"
      ) {
        endOfToolResults++;
      }
      return endOfToolResults;
    }

    // Cas 2: le dernier message compacté est un assistant avec tool_calls
    // → inclure les tool results qui suivent dans la zone compactée
    const lastCompacted = splitIndex - 1;
    if (
      lastCompacted >= 0 &&
      (messages[lastCompacted] as any).role === "assistant" &&
      (messages[lastCompacted] as any).tool_calls
    ) {
      let endOfToolResults = splitIndex;
      while (
        endOfToolResults < messages.length &&
        (messages[endOfToolResults] as any).role === "tool"
      ) {
        endOfToolResults++;
      }
      return endOfToolResults;
    }

    return splitIndex;
  }

  /**
   * Formate les messages en texte lisible pour le résumé.
   */
  private formatMessagesForSummary(messages: GrokMessage[]): string {
    const lines: string[] = [];

    for (const msg of messages) {
      const role = (msg as any).role || "unknown";
      const content = this.extractContent(msg);

      if (role === "assistant" && (msg as any).tool_calls) {
        // Message assistant avec tool_calls
        const toolNames = ((msg as any).tool_calls as any[])
          .map((tc: any) => tc.function?.name || "unknown")
          .join(", ");
        if (content) {
          lines.push(`[assistant]: ${content}`);
        }
        lines.push(`[assistant → tools]: ${toolNames}`);
      } else if (role === "tool") {
        // Résultat d'un tool call — on tronque si trop long
        const truncated = content.length > 500
          ? content.substring(0, 500) + "... [tronqué]"
          : content;
        lines.push(`[tool_result]: ${truncated}`);
      } else {
        lines.push(`[${role}]: ${content}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Extrait le contenu textuel d'un message, quelle que soit sa forme.
   */
  private extractContent(msg: GrokMessage): string {
    const message = msg as any;

    if (!message.content) return "";

    // Contenu string simple
    if (typeof message.content === "string") {
      return message.content;
    }

    // Contenu tableau (multimodal: text + images)
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text || "")
        .join("\n");
    }

    return String(message.content);
  }

  /**
   * Compte les tokens pour un tableau de messages.
   * Utilise le TokenCounter (tiktoken) avec fallback estimation.
   */
  private countTokensForMessages(messages: GrokMessage[]): number {
    try {
      // Caster en format attendu par countMessageTokens
      const formatted = messages.map((msg) => ({
        role: (msg as any).role || "user",
        content: this.extractContent(msg),
        ...((msg as any).tool_calls ? { tool_calls: (msg as any).tool_calls } : {}),
      }));
      return this.tokenCounter.countMessageTokens(formatted);
    } catch {
      // Fallback: estimation grossière (1 token ≈ 4 chars)
      let totalChars = 0;
      for (const msg of messages) {
        const content = this.extractContent(msg);
        totalChars += content.length;
        if ((msg as any).tool_calls) {
          totalChars += JSON.stringify((msg as any).tool_calls).length;
        }
      }
      return Math.ceil(totalChars / 4);
    }
  }

  /**
   * Libère les ressources du token counter.
   */
  dispose(): void {
    this.tokenCounter.dispose();
  }
}
