/**
 * Layout Manager Component
 * 
 * Manages the 3-mode layout system:
 * - HIDDEN: Full-width conversation (no execution viewer)
 * - SPLIT: Side-by-side conversation + execution viewer (60/40)
 * - FULLSCREEN: Full-width execution viewer
 * 
 * Handles automatic transitions, keyboard shortcuts, and mode persistence.
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

    // Clear existing timeout
    if (autoHideTimeout) {
      clearTimeout(autoHideTimeout);
    }

    // Schedule new timeout
    const timeout = setTimeout(() => {
      if (!hasActiveExecution && mode === 'split') {
        changeMode('hidden');
      }
    }, config.autoHideDelay);

    setAutoHideTimeout(timeout);
  }, [config.autoHide, config.autoHideDelay, hasActiveExecution, mode, autoHideTimeout, changeMode]);

  /**
   * Cancel auto-hide
   */
  const cancelAutoHide = useCallback(() => {
    if (autoHideTimeout) {
      clearTimeout(autoHideTimeout);
      setAutoHideTimeout(null);
    }
  }, [autoHideTimeout]);

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

      // Schedule auto-hide if configured
      if (!stillActive) {
        scheduleAutoHide();
      }
    });

    return () => {
      unsubscribeStart();
      unsubscribeEnd();
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }
    };
  }, [config.autoShow, mode, changeMode, cancelAutoHide, scheduleAutoHide, autoHideTimeout]);

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
      // If fullscreen, do nothing (must Esc first)
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
  });

  /**
   * Render layout based on mode
   */
  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Main content area */}
      <Box flexGrow={1} flexDirection="column">
        {mode === 'hidden' && (
          <ConversationOnly>{conversation}</ConversationOnly>
        )}

        {mode === 'split' && (
          <SplitView
            conversation={conversation}
            viewer={executionViewer}
            splitRatio={config.splitRatio}
            layout={config.layout}
          />
        )}

        {mode === 'fullscreen' && (
          <FullscreenViewer>{executionViewer}</FullscreenViewer>
        )}
      </Box>

      {/* Keyboard hints bar */}
      <KeyboardHints mode={mode} hasExecution={hasActiveExecution} />
    </Box>
  );
};

// ============================================================================
// CONVERSATION ONLY VIEW
// ============================================================================

const ConversationOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Box flexDirection="column" width="100%" height="100%">
      {children}
    </Box>
  );
};

// ============================================================================
// SPLIT VIEW
// ============================================================================

interface SplitViewProps {
  conversation: React.ReactNode;
  viewer: React.ReactNode;
  splitRatio: number;
  layout: 'horizontal' | 'vertical';
}

const SplitView: React.FC<SplitViewProps> = ({
  conversation,
  viewer,
  splitRatio,
  layout
}) => {
  const [focused, setFocused] = useState<'conversation' | 'viewer'>('conversation');

  useInput((input, key) => {
    // Tab: Switch focus between panels
    if (key.tab) {
      setFocused(f => f === 'conversation' ? 'viewer' : 'conversation');
    }
  });

  if (layout === 'vertical') {
    // Vertical split (conversation top, viewer bottom)
    return (
      <Box flexDirection="column" width="100%" height="100%">
        {/* Conversation panel (top) */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={focused === 'conversation' ? 'cyan' : 'gray'}
          paddingX={1}
          height={`${Math.floor(splitRatio * 100)}%`}
        >
          <Box marginBottom={1}>
            <Text bold color="cyan">💬 Conversation</Text>
            {focused === 'conversation' && <Text dimColor> (focused)</Text>}
          </Box>
          <Box flexGrow={1} flexDirection="column" overflow="hidden">
            {conversation}
          </Box>
        </Box>

        {/* Execution viewer panel (bottom) */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={focused === 'viewer' ? 'green' : 'gray'}
          paddingX={1}
          height={`${Math.floor((1 - splitRatio) * 100)}%`}
        >
          <Box marginBottom={1}>
            <Text bold color="green">🔧 Execution Viewer</Text>
            {focused === 'viewer' && <Text dimColor> (focused)</Text>}
          </Box>
          <Box flexGrow={1} flexDirection="column" overflow="hidden">
            {viewer}
          </Box>
        </Box>
      </Box>
    );
  }

  // Horizontal split (conversation left, viewer right) - DEFAULT
  return (
    <Box width="100%" height="100%">
      {/* Conversation panel (left) */}
      <Box
        width={`${Math.floor(splitRatio * 100)}%`}
        flexDirection="column"
        borderStyle="single"
        borderColor={focused === 'conversation' ? 'cyan' : 'gray'}
        paddingX={1}
      >
        <Box marginBottom={1}>
          <Text bold color="cyan">💬 Conversation</Text>
          {focused === 'conversation' && <Text dimColor> (focused)</Text>}
        </Box>
        <Box flexGrow={1} flexDirection="column" overflow="hidden">
          {conversation}
        </Box>
      </Box>

      {/* Execution viewer panel (right) */}
      <Box
        width={`${Math.floor((1 - splitRatio) * 100)}%`}
        flexDirection="column"
        borderStyle="single"
        borderColor={focused === 'viewer' ? 'green' : 'gray'}
        paddingX={1}
      >
        <Box marginBottom={1}>
          <Text bold color="green">🔧 Execution Viewer</Text>
          {focused === 'viewer' && <Text dimColor> (focused)</Text>}
        </Box>
        <Box flexGrow={1} flexDirection="column" overflow="hidden">
          {viewer}
        </Box>
      </Box>
    </Box>
  );
};

// ============================================================================
// FULLSCREEN VIEWER
// ============================================================================

const FullscreenViewer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Box
      flexDirection="column"
      width="100%"
      height="100%"
      borderStyle="double"
      borderColor="green"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="green">🔧 Execution Viewer</Text>
        <Text dimColor> (fullscreen)</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>
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
