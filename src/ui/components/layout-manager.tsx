/**
 * Layout Manager Component
 *
 * Manages the 3-mode layout system:
 * - HIDDEN: Full-width conversation (no execution viewer)
 * - SPLIT: Side-by-side conversation + execution viewer (60/40)
 * - FULLSCREEN: Full-width execution viewer
 *
 * Uses a FIXED STRUCTURE with both panels always mounted to prevent
 * ConversationView remounting and Static component re-rendering.
 * Only visibility and dimensions change between modes.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { executionManager } from '../../execution/index.js';
import type { ExecutionState } from '../../execution/index.js';
import { getReviewHook } from '../../timeline/hooks/review-hook.js';
import { sessionManager } from '../../utils/session-manager-sqlite.js';
import { nanoid } from 'nanoid';
import { subscribeReviewViewState, consumePendingReviewViewState } from '../review-view-store.js';
import {
  getConversationScrollOffset,
  setConversationMessageOffset,
  setConversationScrollOffset,
} from '../conversation-scroll-store.js';

// ============================================================================
// TYPES
// ============================================================================

export type ViewerMode = 'hidden' | 'split' | 'fullscreen';

export interface LayoutConfig {
  defaultMode: ViewerMode;
  autoShow: boolean;
  autoHide: boolean;
  autoHideDelay: number;
  splitRatio: number;
  layout: 'horizontal' | 'vertical';
}

export interface LayoutManagerProps {
  conversation: React.ReactNode;
  executionViewer: React.ReactNode;
  config?: Partial<LayoutConfig>;
  onModeChange?: (mode: ViewerMode) => void;
  onFocusChange?: (focused: 'conversation' | 'viewer') => void;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: LayoutConfig = {
  defaultMode: 'hidden',
  autoShow: true,
  autoHide: false,
  autoHideDelay: 5000,
  splitRatio: 0.6,
  layout: 'horizontal'
};

// ============================================================================
// LAYOUT MANAGER COMPONENT
// ============================================================================

export const LayoutManager: React.FC<LayoutManagerProps> = ({
  conversation,
  executionViewer,
  config: userConfig,
  onModeChange,
  onFocusChange
}) => {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const [mode, setMode] = useState<ViewerMode>(config.defaultMode);
  const [focused, setFocused] = useState<'conversation' | 'viewer'>('conversation');
  const [hasActiveExecution, setHasActiveExecution] = useState(false);
  const [autoHideTimeout, setAutoHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const viewIdRef = useRef<string | null>(null);
  const lastEmitRef = useRef<number>(0);
  const [splitRatio, setSplitRatio] = useState(config.splitRatio);

  // Get terminal dimensions for numeric width calculation
  const { stdout } = useStdout();
  const terminalColumns = stdout?.columns || 80;
  const terminalRows = stdout?.rows || 24;

  /**
   * Change mode and notify
   */
  const changeMode = useCallback((newMode: ViewerMode) => {
    setMode(newMode);
    onModeChange?.(newMode);
  }, [onModeChange]);

  /**
   * Schedule auto-hide
   */
  const scheduleAutoHide = useCallback(() => {
    if (!config.autoHide) return;

    setAutoHideTimeout(prevTimeout => {
      // Clear existing timeout
      if (prevTimeout) {
        clearTimeout(prevTimeout);
      }

      // Schedule new timeout
      return setTimeout(() => {
        if (!hasActiveExecution && mode === 'split') {
          changeMode('hidden');
        }
      }, config.autoHideDelay);
    });
  }, [config.autoHide, config.autoHideDelay, hasActiveExecution, mode, changeMode]);

  /**
   * Cancel auto-hide
   */
  const cancelAutoHide = useCallback(() => {
    setAutoHideTimeout(prevTimeout => {
      if (prevTimeout) {
        clearTimeout(prevTimeout);
      }
      return null;
    });
  }, []);

  /**
   * Listen to execution lifecycle
   */
  useEffect(() => {
    const unsubscribeStart = executionManager.onExecutionStart(() => {
      setHasActiveExecution(true);
      cancelAutoHide();

      // Auto-show viewer when execution starts
      if (config.autoShow && mode === 'hidden') {
        changeMode('split');
      }
    });

    const unsubscribeEnd = executionManager.onExecutionEnd(() => {
      // Check if there are still active executions
      const stillActive = executionManager.hasActiveExecutions();
      setHasActiveExecution(stillActive);

      // Auto-hide viewer when execution completes (if enabled)
      if (!stillActive && config.autoHide && mode === 'split') {
        if (config.autoHideDelay > 0) {
          scheduleAutoHide();
        } else {
          changeMode('hidden');
        }
      }
    });

    return () => {
      unsubscribeStart();
      unsubscribeEnd();
    };
  }, [config.autoShow, mode, changeMode, cancelAutoHide, scheduleAutoHide]);

  useEffect(() => {
    const applyState = (state: any) => {
      if (!state) return;
      if (state.layout === 'fullscreen') {
        changeMode('fullscreen');
      } else if (state.layout === 'single') {
        changeMode('hidden');
      } else {
        changeMode('split');
      }
      if (state.active_pane === 'viewer') {
        setFocused('viewer');
      } else {
        setFocused('conversation');
      }
      if (state.meta?.split_ratio && Number.isFinite(state.meta.split_ratio)) {
        setSplitRatio(Math.max(0.1, Math.min(0.9, Number(state.meta.split_ratio))));
      }
      const panes = Array.isArray(state.panes) ? state.panes : [];
      const viewerPane = panes.find((p) => p.type === 'execution');
      const conversationPane = panes.find((p) => p.type === 'conversation');
      const selectedExecutionId = viewerPane?.resource?.selected_execution_id;
      if (selectedExecutionId) {
        executionManager.setSelectedExecutionId(selectedExecutionId);
      }
      const selectedCommandIndex = viewerPane?.resource?.selected_command_index ?? viewerPane?.selection?.start_line;
      const scrollOffset = viewerPane?.resource?.scroll_offset ?? viewerPane?.scroll?.line;
      const detailsMode = viewerPane?.resource?.details_mode;
      if (
        typeof selectedCommandIndex === 'number' ||
        typeof scrollOffset === 'number' ||
        typeof detailsMode === 'boolean'
      ) {
        executionManager.setViewerState({
          selectedCommandIndex: typeof selectedCommandIndex === 'number' ? selectedCommandIndex : undefined,
          scrollOffset: typeof scrollOffset === 'number' ? scrollOffset : undefined,
          detailsMode: typeof detailsMode === 'boolean' ? detailsMode : undefined,
        });
      }
      const conversationLineScroll =
        conversationPane?.resource?.scroll_line_offset ??
        conversationPane?.scroll?.line;
      const conversationMessageScroll = conversationPane?.resource?.scroll_offset;
      if (typeof conversationLineScroll === 'number') {
        setConversationScrollOffset(conversationLineScroll);
      } else if (typeof conversationMessageScroll === 'number') {
        setConversationMessageOffset(conversationMessageScroll);
      }
    };

    const pending = consumePendingReviewViewState();
    if (pending) {
      applyState(pending);
      if (process.env.GROKINOU_TEST_LOG_REVIEW_APPLY === '1') {
        console.log('✅ Applied pending review view state');
      }
    }

    const unsubscribe = subscribeReviewViewState((state) => {
      applyState(state);
    });
    return () => unsubscribe();
  }, [changeMode]);

  useEffect(() => {
    onFocusChange?.(focused);
  }, [focused, onFocusChange]);

  useEffect(() => {
    if (mode === 'fullscreen' && focused !== 'viewer') {
      setFocused('viewer');
    }
  }, [mode, focused]);

  useEffect(() => {
    if (mode === 'hidden') {
      viewIdRef.current = null;
      return;
    }
    if (!viewIdRef.current) {
      viewIdRef.current = `review-${Date.now()}-${nanoid(6)}`;
    }
    const now = Date.now();
    if (now - lastEmitRef.current < 300) return;
    lastEmitRef.current = now;

    const session = sessionManager.getCurrentSession();
    if (!session) return;
    const executions = executionManager.getActiveExecutions();
    const selectedExecutionId = executionManager.getSelectedExecutionId();
    const viewerState = executionManager.getViewerState();

    const createdAt = session.created_at || session.started_at;
    const createdDate = createdAt ? new Date(createdAt) : undefined;
    const hashPart = session.session_hash ? session.session_hash.slice(0, 8) : 'nohash';
    const sessionKey = createdDate && !Number.isNaN(createdDate.getTime())
      ? `${session.id}.${createdDate.getUTCFullYear().toString().padStart(4, '0')}${(createdDate.getUTCMonth() + 1).toString().padStart(2, '0')}${createdDate.getUTCDate().toString().padStart(2, '0')}-${createdDate.getUTCHours().toString().padStart(2, '0')}${createdDate.getUTCMinutes().toString().padStart(2, '0')}${createdDate.getUTCSeconds().toString().padStart(2, '0')}.${hashPart}`
      : `${session.id}.unknown.${hashPart}`;

    const reviewHook = getReviewHook();
    const layoutType = mode === 'fullscreen'
      ? 'fullscreen'
      : (config.layout === 'vertical' ? 'split-horizontal' : 'split-vertical');
    const conversationScrollOffset = getConversationScrollOffset();
    reviewHook.captureViewState({
      session_id: session.id,
      view_id: viewIdRef.current,
      mode: 'review',
      layout: layoutType,
      active_pane: focused === 'viewer' ? 'viewer' : 'conversation',
      panes: [
        {
          id: 'conversation',
          type: 'conversation',
          resource: {
            kind: 'session',
            session_id: session.id,
            session_key: sessionKey,
            scroll_line_offset: conversationScrollOffset,
          },
          scroll: { line: conversationScrollOffset },
        },
        {
          id: 'viewer',
          type: 'execution',
          resource: {
            kind: 'execution',
            selected_execution_id: selectedExecutionId,
            execution_ids: executions.map((e) => e.id),
            selected_command_index: viewerState.selectedCommandIndex,
            scroll_offset: viewerState.scrollOffset,
            details_mode: viewerState.detailsMode,
          },
          scroll: { line: viewerState.scrollOffset },
          selection: { start_line: viewerState.selectedCommandIndex, end_line: viewerState.selectedCommandIndex },
        },
      ],
      meta: {
        viewer_mode: mode,
        split_ratio: splitRatio,
        session_key: sessionKey,
      },
    }).catch(() => {
      // best-effort
    });
  }, [mode, focused, splitRatio]);

  /**
   * Keyboard shortcuts
   */
  useInput((input, key) => {
    // Ctrl+E: Toggle viewer (hidden <-> split)
    if (key.ctrl && input === 'e') {
      if (mode === 'hidden') {
        changeMode('split');
        cancelAutoHide();
      } else if (mode === 'split') {
        changeMode('hidden');
        cancelAutoHide();
      }
    }

    // Ctrl+F: Fullscreen viewer (from split only)
    if (key.ctrl && input === 'f') {
      if (mode === 'split') {
        changeMode('fullscreen');
        cancelAutoHide();
      }
    }

    // Esc: Exit fullscreen (back to split)
    if (key.escape) {
      if (mode === 'fullscreen') {
        changeMode('split');
      }
    }

    // Ctrl+Shift+E: Force hide (even during execution)
    if (key.ctrl && key.shift && input === 'e') {
      changeMode('hidden');
      cancelAutoHide();
    }

    // Tab: Switch focus between panels (only in split mode)
    if (key.tab && mode === 'split') {
      setFocused(f => f === 'conversation' ? 'viewer' : 'conversation');
    }

    // PageUp/PageDown: Scroll conversation history when focused
    if (focused === 'conversation' && !key.ctrl && !key.meta) {
      const step = key.shift ? terminalRows : Math.max(5, Math.floor(terminalRows / 2));
      if (key.pageUp) {
        setConversationScrollOffset(getConversationScrollOffset() + step);
      }
      if (key.pageDown) {
        setConversationScrollOffset(Math.max(0, getConversationScrollOffset() - step));
      }
    }
  });

  /**
   * Calculate panel dimensions and visibility based on mode
   * Uses numeric widths (columns) instead of percentages for precise layout control
   */
  const getConversationStyle = () => {
    if (mode === 'hidden') {
      return { width: terminalColumns, display: 'flex' as const };
    } else if (mode === 'split') {
      if (config.layout === 'horizontal') {
        // Account for borders (2 chars per panel) and padding (2 chars per panel)
        const borderAndPadding = 4; // 2 for left border+padding, 2 for right
        const availableColumns = terminalColumns - borderAndPadding;
        const leftColumns = Math.floor(availableColumns * splitRatio);
        return { width: leftColumns, display: 'flex' as const };
      } else {
        const height = `${Math.floor(splitRatio * 100)}%`;
        return { width: terminalColumns, height, display: 'flex' as const };
      }
    } else {
      // fullscreen: hide conversation
      return { width: 0, display: 'none' as const };
    }
  };

  const getViewerStyle = () => {
    if (mode === 'hidden') {
      return { width: 0, display: 'none' as const };
    } else if (mode === 'split') {
      if (config.layout === 'horizontal') {
        // Account for borders (2 chars per panel) and padding (2 chars per panel)
        const borderAndPadding = 4;
        const availableColumns = terminalColumns - borderAndPadding;
        const leftColumns = Math.floor(availableColumns * splitRatio);
        const rightColumns = availableColumns - leftColumns;
        return { width: rightColumns, display: 'flex' as const };
      } else {
        const height = `${Math.floor((1 - splitRatio) * 100)}%`;
        return { width: terminalColumns, height, display: 'flex' as const };
      }
    } else {
      // fullscreen: viewer takes full width
      return { width: terminalColumns, display: 'flex' as const };
    }
  };

  const conversationStyle = getConversationStyle();
  const viewerStyle = getViewerStyle();
  const isVertical = config.layout === 'vertical';
  const viewerNode = React.isValidElement(executionViewer)
    ? React.cloneElement(executionViewer, { isFocused: focused === 'viewer' } as any)
    : executionViewer;

  /**
   * Render fixed structure with both panels always mounted
   */
  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Main content area - FIXED STRUCTURE */}
      <Box
        flexGrow={1}
        flexDirection={isVertical ? 'column' : 'row'}
        width="100%"
        height="100%"
      >
        {/* Conversation panel - ALWAYS MOUNTED */}
        <Box
          width={conversationStyle.width}
          height={conversationStyle.height}
          display={conversationStyle.display}
          flexDirection="column"
          borderStyle={mode !== 'fullscreen' ? 'single' : undefined}
          borderColor={
            mode === 'hidden'
              ? undefined
              : (mode === 'split' && focused === 'conversation')
                ? 'cyan'
                : 'gray'
          }
          paddingX={mode !== 'fullscreen' ? 1 : 0}
        >
          {mode !== 'fullscreen' && (
            <Box marginBottom={1}>
              <Text bold color="cyan">💬 Conversation</Text>
              {mode === 'split' && focused === 'conversation' && (
                <Text dimColor> (focused)</Text>
              )}
            </Box>
          )}
          <Box flexGrow={1} flexDirection="column" overflow="hidden">
            {conversation}
          </Box>
        </Box>

        {/* Execution viewer panel - ALWAYS MOUNTED */}
        <Box
          width={viewerStyle.width}
          height={viewerStyle.height}
          display={viewerStyle.display}
          flexDirection="column"
          borderStyle={mode !== 'hidden' ? (mode === 'fullscreen' ? 'double' : 'single') : undefined}
          borderColor={
            mode === 'hidden'
              ? undefined
              : (mode === 'split' && focused === 'viewer')
                ? 'green'
                : mode === 'fullscreen'
                  ? 'green'
                  : 'gray'
          }
          paddingX={mode !== 'hidden' ? 1 : 0}
        >
          {mode !== 'hidden' && (
            <Box marginBottom={1}>
              <Text bold color="green">🔧 Execution Viewer</Text>
              {mode === 'split' && focused === 'viewer' && (
                <Text dimColor> (focused)</Text>
              )}
              {mode === 'fullscreen' && (
                <Text dimColor> (fullscreen)</Text>
              )}
            </Box>
          )}
          <Box flexGrow={1} flexDirection="column">
            {viewerNode}
          </Box>
        </Box>
      </Box>

      {/* Keyboard hints bar */}
      <KeyboardHints mode={mode} hasExecution={hasActiveExecution} />
    </Box>
  );
};

// ============================================================================
// KEYBOARD HINTS
// ============================================================================

interface KeyboardHintsProps {
  mode: ViewerMode;
  hasExecution: boolean;
}

const KeyboardHints: React.FC<KeyboardHintsProps> = ({ mode, hasExecution }) => {
  const hints: Record<ViewerMode, Array<{ key: string; action: string }>> = {
    hidden: [
      { key: 'Ctrl+E', action: 'Show viewer' },
      ...(hasExecution ? [{ key: '●', action: 'Execution active' }] : [])
    ],
    split: [
      { key: 'Ctrl+E', action: 'Hide viewer' },
      { key: 'Ctrl+F', action: 'Fullscreen' },
      { key: 'Tab', action: 'Switch focus' },
      { key: 'PgUp/PgDn', action: 'Scroll convo' },
      { key: 'Ctrl+C', action: 'Copy output' },
      { key: 'Ctrl+D', action: 'Toggle details' }
    ],
    fullscreen: [
      { key: 'Esc', action: 'Exit fullscreen' },
      { key: 'Ctrl+E', action: 'Hide viewer' },
      { key: 'Ctrl+C', action: 'Copy' },
      { key: 'Ctrl+S', action: 'Save' }
    ]
  };

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      flexShrink={0}
    >
      {hints[mode].map((hint, i) => (
        <Box key={i} marginRight={2}>
          <Text color="cyan" bold>{hint.key}</Text>
          <Text dimColor> {hint.action}</Text>
        </Box>
      ))}
    </Box>
  );
};
