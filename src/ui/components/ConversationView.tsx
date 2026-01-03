/**
 * Conversation View Component
 *
 * Pure view component that renders the conversation from ChatContext data.
 * Each layout (normal, split, search) creates its OWN instance of this component.
 *
 * This solves the "duplicate view" glitch by ensuring each view is independent,
 * rather than reusing the same JSX element across different layouts.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, Static, useStdout } from 'ink';
import { useChatState } from '../contexts/ChatContext.js';
import { ChatHistory, MemoizedArchived } from './chat-history.js';
// TODO: Import or create StreamingDisplay component
// import { StreamingDisplay } from './streaming-display.js';
import { LoadingSpinner } from './loading-spinner.js';
import { useScrollPosition } from '../hooks/use-scroll-position.js';
import ConfirmationDialog from './confirmation-dialog.js';
import type { ConfirmationOptions } from '../../utils/confirmation-service.js';
import {
  getConversationScrollState,
  setConversationScrollOffset,
  subscribeConversationScrollOffset,
} from '../conversation-scroll-store.js';

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

  const { stdout } = useStdout();
  const [scrollState, setScrollState] = useState(getConversationScrollState());

  useEffect(() => {
    const unsubscribe = subscribeConversationScrollOffset((state) => {
      setScrollState(state);
    });
    return () => unsubscribe();
  }, []);

  const terminalColumns = stdout?.columns || 80;
  const terminalRows = stdout?.rows || 24;

  const estimateEntryLines = (entry: any): number => {
    if (!entry) return 1;
    const content = typeof entry.content === "string" ? entry.content : "";
    const lines = content.split("\n");
    const wrapped = lines.reduce((acc, line) => {
      const width = Math.max(10, terminalColumns - 6);
      return acc + Math.max(1, Math.ceil(line.length / width));
    }, 0);
    return Math.max(2, wrapped + 2);
  };

  const computeLineOffsetFromMessages = (messageOffset: number): number => {
    if (messageOffset <= 0) return 0;
    let total = 0;
    let count = 0;
    for (let i = committedHistory.length - 1; i >= 0 && count < messageOffset; i -= 1) {
      total += estimateEntryLines(committedHistory[i]);
      count += 1;
    }
    return total;
  };

  const resolveLineOffset = (): number => {
    if (scrollState.mode === "line") {
      return scrollState.lineOffset;
    }
    return computeLineOffsetFromMessages(scrollState.messageOffset);
  };

  const lineOffset = resolveLineOffset();

  useEffect(() => {
    if (scrollState.mode === "message") {
      setConversationScrollOffset(lineOffset);
    }
  }, [lineOffset, scrollState.mode]);

  const { slice: committedSlice, maxLineOffset } = useMemo(() => {
    if (searchMode) {
      return { slice: committedHistory.slice(-100), maxLineOffset: 0 };
    }
    const windowLines = Math.max(24, Math.floor(terminalRows * 3));
    let totalLines = 0;
    let linesRemaining = lineOffset + windowLines;
    let startIndex = 0;
    let endIndex = committedHistory.length;

    for (let i = committedHistory.length - 1; i >= 0; i -= 1) {
      const entryLines = estimateEntryLines(committedHistory[i]);
      totalLines += entryLines;
      linesRemaining -= entryLines;
      if (linesRemaining <= 0) {
        startIndex = Math.max(0, i);
        break;
      }
    }

    const maxOffset = Math.max(0, totalLines - windowLines);
    const effectiveOffset = Math.min(lineOffset, maxOffset);
    if (effectiveOffset === 0) {
      return { slice: committedHistory, maxLineOffset: maxOffset };
    }

    if (effectiveOffset !== lineOffset) {
      startIndex = 0;
      linesRemaining = effectiveOffset + windowLines;
      for (let i = committedHistory.length - 1; i >= 0; i -= 1) {
        const entryLines = estimateEntryLines(committedHistory[i]);
        linesRemaining -= entryLines;
        if (linesRemaining <= 0) {
          startIndex = Math.max(0, i);
          break;
        }
      }
    }

    return { slice: committedHistory.slice(startIndex, endIndex), maxLineOffset: maxOffset };
  }, [committedHistory, lineOffset, searchMode, terminalColumns, terminalRows]);

  useEffect(() => {
    if (lineOffset > maxLineOffset) {
      setConversationScrollOffset(maxLineOffset);
    }
  }, [lineOffset, maxLineOffset]);

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
        <Static items={committedSlice}>
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
        lineOffset > 0 ? (
          <Box flexDirection="row" justifyContent="space-between">
            <Text dimColor>
              Scroll: {lineOffset} lines up (PageUp/PageDown)
            </Text>
            <LoadingSpinner
              isActive={isProcessing || isStreaming}
              processingTime={processingTime}
              tokenCount={tokenCount}
            />
          </Box>
        ) : (
          <LoadingSpinner
            isActive={isProcessing || isStreaming}
            processingTime={processingTime}
            tokenCount={tokenCount}
          />
        )
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

      {/* Optional children (e.g., InputController) */}
      {children}
    </Box>
  );
};
