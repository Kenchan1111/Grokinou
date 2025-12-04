/**
 * Conversation View Component
 *
 * Pure view component that renders the conversation from ChatContext data.
 * Each layout (normal, split, search) creates its OWN instance of this component.
 *
 * This solves the "duplicate view" glitch by ensuring each view is independent,
 * rather than reusing the same JSX element across different layouts.
 */

import React from 'react';
import { Box, Text, Static } from 'ink';
import { useChatState } from '../contexts/ChatContext.js';
import { ChatHistory, MemoizedArchived } from './chat-history.js';
// TODO: Import or create StreamingDisplay component
// import { StreamingDisplay } from './streaming-display.js';
import { LoadingSpinner } from './loading-spinner.js';

// ============================================================================
// CONVERSATION VIEW
// ============================================================================

interface ConversationViewProps {
  /**
   * Whether to show loading spinner and token counter
   */
  showStatus?: boolean;

  /**
   * Ref for scrolling
   */
  scrollRef?: React.RefObject<any>;

  /**
   * Whether to limit history in search mode
   */
  searchMode?: boolean;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  showStatus = true,
  scrollRef,
  searchMode = false
}) => {
  // Get data from context
  const {
    committedHistory,
    activeMessages,
    isStreaming,
    streamingContent,
    streamingTools,
    streamingToolResults,
    showTips,
    confirmationOptions,
    isProcessing,
    processingTime,
    tokenCount
  } = useChatState();

  return (
    <Box flexDirection="column" height={searchMode ? "100%" : undefined} overflow={searchMode ? "hidden" : undefined}>
      {/* Tips uniquement au premier démarrage sans historique */}
      {showTips && !searchMode && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Tips for getting started:
          </Text>
          <Box flexDirection="column">
            <Text color="gray">
              1. Ask questions, edit files, or run commands.
            </Text>
            <Text color="gray">2. Be specific for the best results.</Text>
            <Text color="gray">
              3. Create GROK.md files to customize your interactions with Grok.
            </Text>
            <Text color="gray">
              4. Press Shift+Tab to toggle auto-edit mode.
            </Text>
            <Text color="gray">5. /help for more information.</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" ref={scrollRef} flexGrow={1} overflow={searchMode ? "hidden" : undefined}>
        {/* HISTORIQUE STATIQUE : Tous les messages TERMINÉS (committed) */}
        {/* En mode recherche, limiter l'affichage pour éviter le scroll */}
        {/* NOTE: Pas de clé dynamique ici - chaque instance de ConversationView est indépendante */}
        <Static items={searchMode ? committedHistory.slice(-10) : committedHistory}>
          {(entry, index) => (
            <MemoizedArchived key={`committed-${entry.timestamp.getTime()}-${index}`} entry={entry} />
          )}
        </Static>

        {/* MESSAGES ACTIFS : En cours de création/affichage */}
        <ChatHistory
          entries={activeMessages}
          isConfirmationActive={!!confirmationOptions}
        />

        {/* STREAMING EN COURS : Message de Grok en train d'être écrit */}
        {/* TODO: Add StreamingDisplay component */}
        {isStreaming && (
          <Box flexDirection="column">
            <Text color="cyan">{streamingContent}</Text>
          </Box>
        )}
      </Box>

      {/* Status bar */}
      {showStatus && !confirmationOptions && !searchMode && (
        <LoadingSpinner
          isActive={isProcessing || isStreaming}
          processingTime={processingTime}
          tokenCount={tokenCount}
        />
      )}
    </Box>
  );
};
