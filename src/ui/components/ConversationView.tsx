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
import { useScrollPosition } from '../hooks/use-scroll-position.js';
import ConfirmationDialog from './confirmation-dialog.js';
import type { ConfirmationOptions } from '../../utils/confirmation-service.js';

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

  /**
   * Confirmation dialog props (passed from parent, overrides context)
   */
  confirmationOptions?: ConfirmationOptions | null;
  onConfirmation?: (dontAskAgain?: boolean) => void;
  onRejection?: (feedback?: string) => void;

  /**
   * Optional children to render at the end (e.g., InputController)
   */
  children?: React.ReactNode;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  showStatus = true,
  scrollRef,
  searchMode = false,
  confirmationOptions: confirmationOptionsProp,
  onConfirmation,
  onRejection,
  children
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
    confirmationOptions: confirmationOptionsContext,
    isProcessing,
    processingTime,
    tokenCount
  } = useChatState();

  // Use prop if provided, otherwise use context
  const confirmationOptions = confirmationOptionsProp ?? confirmationOptionsContext;

  // Preserve scroll position during re-renders (disabled in searchMode)
  useScrollPosition(!searchMode && !isStreaming);

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

      <Box flexDirection="column" ref={scrollRef} flexGrow={1}>
        {/* HISTORIQUE STATIQUE : Tous les messages TERMINÉS (committed) */}
        {/* En mode recherche, limiter l'affichage pour éviter le scroll */}
        <Static items={searchMode ? committedHistory.slice(-100) : committedHistory}>
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

      {/* Confirmation dialog (rendered at end, visible above conversation) */}
      {confirmationOptions && onConfirmation && onRejection && (
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
          paddingY={1}
          marginTop={1}
        >
          <ConfirmationDialog
            operation={confirmationOptions.operation}
            filename={confirmationOptions.filename}
            showVSCodeOpen={confirmationOptions.showVSCodeOpen}
            content={confirmationOptions.content}
            onConfirm={onConfirmation}
            onReject={onRejection}
          />
        </Box>
      )}

      {/* Optional children (e.g., InputController in splitview mode) */}
      {children}
    </Box>
  );
};
