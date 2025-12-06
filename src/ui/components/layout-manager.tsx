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

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { executionManager } from '../../execution/index.js';
import type { ExecutionState } from '../../execution/index.js';

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
  onModeChange
}) => {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const [mode, setMode] = useState<ViewerMode>(config.defaultMode);
  const [focused, setFocused] = useState<'conversation' | 'viewer'>('conversation');
  const [hasActiveExecution, setHasActiveExecution] = useState(false);
  const [autoHideTimeout, setAutoHideTimeout] = useState<NodeJS.Timeout | null>(null);

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
  });

  /**
   * Calculate panel dimensions and visibility based on mode
   */
  const getConversationStyle = () => {
    if (mode === 'hidden') {
      return { width: '100%', display: 'flex' as const };
    } else if (mode === 'split') {
      const width = config.layout === 'horizontal'
        ? `${Math.floor(config.splitRatio * 100)}%`
        : '100%';
      const height = config.layout === 'vertical'
        ? `${Math.floor(config.splitRatio * 100)}%`
        : undefined;
      return { width, height, display: 'flex' as const };
    } else {
      // fullscreen: hide conversation
      return { width: 0, display: 'none' as const };
    }
  };

  const getViewerStyle = () => {
    if (mode === 'hidden') {
      return { width: 0, display: 'none' as const };
    } else if (mode === 'split') {
      const width = config.layout === 'horizontal'
        ? `${Math.floor((1 - config.splitRatio) * 100)}%`
        : '100%';
      const height = config.layout === 'vertical'
        ? `${Math.floor((1 - config.splitRatio) * 100)}%`
        : undefined;
      return { width, height, display: 'flex' as const };
    } else {
      // fullscreen: viewer takes full width
      return { width: '100%', display: 'flex' as const };
    }
  };

  const conversationStyle = getConversationStyle();
  const viewerStyle = getViewerStyle();
  const isVertical = config.layout === 'vertical';

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
            {executionViewer}
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
