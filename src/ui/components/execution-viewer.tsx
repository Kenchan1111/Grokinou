/**
 * Execution Viewer Component
 * 
 * Displays real-time execution information:
 * - Chain of Thought (COT) entries
 * - Command executions and outputs
 * - Execution status and metadata
 * 
 * Supports multiple executions, navigation, and detailed/compact modes.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { executionManager } from '../../execution/index.js';
import type { ExecutionState, COTEntry, CommandExecution, COTType, CommandStatus } from '../../execution/index.js';

// ============================================================================
// TYPES
// ============================================================================

import type { ExecutionViewerSettings } from '../../utils/settings-manager.js';

export interface ExecutionViewerProps {
  mode?: 'split' | 'fullscreen';
  settings?: Partial<ExecutionViewerSettings>;
}

// ============================================================================
// EXECUTION VIEWER COMPONENT
// ============================================================================

export const ExecutionViewer: React.FC<ExecutionViewerProps> = ({ mode = 'split', settings }) => {
  const [executions, setExecutions] = useState<ExecutionState[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [detailsMode, setDetailsMode] = useState(settings?.detailsMode ?? false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);

  /**
   * Subscribe to execution manager updates
   */
  useEffect(() => {
    const limit = settings?.maxExecutionsShown ?? 1000;

    // Initial load - get active executions
    const active = executionManager.getActiveExecutions();
    if (active.length > 0) {
      setExecutions(active.slice(-limit));
    }

    // Subscribe to updates
    const unsubscribe = executionManager.subscribeToAll((execution) => {
      setExecutions(prev => {
        const index = prev.findIndex(e => e.id === execution.id);
        let updated: ExecutionState[];

        if (index >= 0) {
          // Update existing execution
          updated = [...prev];
          updated[index] = execution;
        } else {
          // Add new execution
          updated = [...prev, execution];
        }

        // Apply limit (keep most recent executions)
        if (updated.length > limit) {
          updated = updated.slice(-limit);
        }

        return updated;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [settings]);

  /**
   * Clamp selectedIndex when executions list changes
   */
  useEffect(() => {
    if (selectedIndex >= executions.length && executions.length > 0) {
      setSelectedIndex(executions.length - 1);
    }
  }, [executions.length, selectedIndex]);

  /**
   * Reset command index and scroll when changing execution
   */
  useEffect(() => {
    setSelectedCommandIndex(0);
    setScrollOffset(0);
  }, [selectedIndex]);

  /**
   * Reset scroll when changing command
   */
  useEffect(() => {
    setScrollOffset(0);
  }, [selectedCommandIndex]);

  /**
   * Keyboard shortcuts
   */
  useInput((input, key) => {
    const current = executions[selectedIndex];
    const commandCount = current?.commands.length ?? 0;

    // Ctrl+D: Toggle details mode
    if (key.ctrl && input === 'd') {
      setDetailsMode(d => !d);
    }

    // Ctrl+C: Copy current execution output
    if (key.ctrl && input === 'c') {
      if (current) {
        handleCopyExecution(current);
      }
    }

    // Ctrl+S: Save current execution to file
    if (key.ctrl && input === 's') {
      if (current) {
        handleSaveExecution(current).catch(console.error);
      }
    }

    // Arrow Up: Navigate to previous execution
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(i => i - 1);
    }

    // Arrow Down: Navigate to next execution
    if (key.downArrow && selectedIndex < executions.length - 1) {
      setSelectedIndex(i => i + 1);
    }

    // Arrow Left: Navigate to previous command
    if (key.leftArrow && selectedCommandIndex > 0) {
      setSelectedCommandIndex(i => i - 1);
    }

    // Arrow Right: Navigate to next command
    if (key.rightArrow && selectedCommandIndex < commandCount - 1) {
      setSelectedCommandIndex(i => i + 1);
    }

    // Enter: Toggle expand for selected command
    if (key.return && commandCount > 0) {
      setDetailsMode(d => !d);
    }

    // PageDown: Scroll down (10 lines at a time)
    if (key.pageDown) {
      const currentCommand = current?.commands[selectedCommandIndex];
      if (currentCommand) {
        const maxLines = mode === 'split' ? 20 : 100;
        const totalLines = currentCommand.output.length;
        const visibleLines = detailsMode ? totalLines : Math.min(maxLines, totalLines);
        const maxScroll = Math.max(0, totalLines - visibleLines);
        setScrollOffset(prev => Math.min(prev + 10, maxScroll));
      }
    }

    // PageUp: Scroll up (10 lines at a time)
    if (key.pageUp) {
      setScrollOffset(prev => Math.max(0, prev - 10));
    }

    // Home: Scroll to top
    if (input === 'h' && !key.ctrl) {
      setScrollOffset(0);
    }

    // End: Scroll to bottom
    if (input === 'e' && !key.ctrl) {
      const currentCommand = current?.commands[selectedCommandIndex];
      if (currentCommand) {
        const maxLines = mode === 'split' ? 20 : 100;
        const totalLines = currentCommand.output.length;
        const visibleLines = detailsMode ? totalLines : Math.min(maxLines, totalLines);
        const maxScroll = Math.max(0, totalLines - visibleLines);
        setScrollOffset(maxScroll);
      }
    }
  });

  const currentExecution = executions[selectedIndex];

  return (
    <Box flexDirection="column" height="100%">
      {/* Execution List Header (if multiple) */}
      {executions.length > 1 && (
        <Box borderStyle="single" borderColor="yellow" paddingX={1} flexShrink={0}>
          <Text bold color="yellow">
            Executions ({selectedIndex + 1}/{executions.length})
          </Text>
          <Text dimColor> [↑↓ to navigate]</Text>
        </Box>
      )}

      {currentExecution ? (
        <>
          {/* COT Section */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="yellow"
            marginTop={executions.length > 1 ? 1 : 0}
            paddingX={1}
            flexShrink={0}
          >
            <Text bold color="yellow">🧠 Chain of Thought</Text>
            <Box flexDirection="column" marginTop={1}>
              {currentExecution.cot.length > 0 ? (
                currentExecution.cot.map((entry, i) => (
                  <COTEntryDisplay key={i} entry={entry} compact={!detailsMode} />
                ))
              ) : (
                <Text dimColor>No reasoning yet...</Text>
              )}
            </Box>
          </Box>

          {/* Commands Section */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="green"
            marginTop={1}
            paddingX={1}
            flexGrow={1}
          >
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold color="green">📜 Command Output</Text>
              {currentExecution.commands.length > 1 && (
                <Text dimColor>
                  [{selectedCommandIndex + 1}/{currentExecution.commands.length}] [←→ navigate • Enter expand]
                </Text>
              )}
            </Box>
            <Box flexDirection="column" marginTop={1}>
              {currentExecution.commands.length > 0 ? (
                currentExecution.commands.map((cmd, i) => (
                  <CommandDisplay
                    key={i}
                    command={cmd}
                    detailed={detailsMode}
                    mode={mode}
                    isSelected={i === selectedCommandIndex}
                    isVisible={i === selectedCommandIndex || currentExecution.commands.length === 1}
                    scrollOffset={i === selectedCommandIndex ? scrollOffset : 0}
                  />
                ))
              ) : (
                <Text dimColor>No commands executed yet...</Text>
              )}
            </Box>
          </Box>

          {/* Status Bar */}
          <Box
            borderStyle="single"
            borderColor="cyan"
            marginTop={1}
            paddingX={1}
            flexShrink={0}
          >
            <ExecutionStatusBar execution={currentExecution} />
          </Box>
        </>
      ) : (
        <EmptyState />
      )}
    </Box>
  );
};

// ============================================================================
// COT ENTRY DISPLAY
// ============================================================================

interface COTEntryDisplayProps {
  entry: COTEntry;
  compact?: boolean;
}

const COTEntryDisplay: React.FC<COTEntryDisplayProps> = ({ entry, compact = false }) => {
  const icons: Record<COTType, string> = {
    thinking: '💭',
    action: '⚡',
    observation: '👁️',
    decision: '✅'
  };

  const colors: Record<COTType, string> = {
    thinking: 'yellow',
    action: 'cyan',
    observation: 'blue',
    decision: 'green'
  };

  const icon = icons[entry.type];
  const color = colors[entry.type];

  return (
    <Box flexDirection="column" marginBottom={compact ? 0 : 1}>
      <Box>
        <Text color={color}>
          {icon} {entry.content}
        </Text>
      </Box>
      {!compact && entry.duration && (
        <Box marginLeft={2}>
          <Text dimColor>({entry.duration}ms)</Text>
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// COMMAND DISPLAY
// ============================================================================

interface CommandDisplayProps {
  command: CommandExecution;
  detailed?: boolean;
  mode?: 'split' | 'fullscreen';
  isSelected?: boolean;
  isVisible?: boolean;
  scrollOffset?: number;
}

const CommandDisplay: React.FC<CommandDisplayProps> = ({
  command,
  detailed = false,
  mode = 'split',
  isSelected = false,
  isVisible = true,
  scrollOffset = 0
}) => {
  // Don't render if not visible (for navigation)
  if (!isVisible) return null;
  const statusIcons: Record<CommandStatus, string> = {
    pending: '⏳',
    running: '🔄',
    success: '✅',
    error: '❌'
  };

  const statusIcon = statusIcons[command.status];

  // Limit output lines in split mode and apply scroll offset
  const maxLines = mode === 'split' ? 20 : 100;
  const totalLines = command.output.length;

  // Calculate the window of lines to display
  const startLine = scrollOffset;
  const endLine = detailed ? totalLines : Math.min(startLine + maxLines, totalLines);
  const displayLines = command.output.slice(startLine, endLine);

  const hasMore = endLine < totalLines;
  const hasScrolled = scrollOffset > 0;

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      marginBottom={1}
      borderStyle={isSelected ? "round" : undefined}
      borderColor={isSelected ? "cyan" : undefined}
      paddingX={isSelected ? 1 : 0}
    >
      {/* Command line */}
      <Box>
        <Text color={isSelected ? "black" : "cyan"} bold backgroundColor={isSelected ? "cyan" : undefined}>
          $ {command.command}
        </Text>
        <Text> {statusIcon}</Text>
      </Box>

      {/* Output */}
      {displayLines.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {displayLines.map((line, i) => {
            // Detect stderr lines (prefixed with [STDERR])
            const isStderr = line.startsWith('[STDERR]');
            const displayLine = isStderr ? line.substring(8).trim() : line;
            
            return (
              <Text 
                key={i} 
                dimColor={command.status === 'running'}
                color={isStderr ? 'red' : undefined}
              >
                {isStderr && '⚠️  '}
                {displayLine}
              </Text>
            );
          })}
          {/* Scroll indicators */}
          {hasScrolled && (
            <Text dimColor italic>
              ... ({scrollOffset} lines above, use PageUp or 'h' to scroll up)
            </Text>
          )}
          {hasMore && (
            <Text dimColor italic>
              ... ({totalLines - endLine} more lines below, use PageDown or 'e' to scroll down)
            </Text>
          )}
          {!hasMore && !hasScrolled && totalLines > maxLines && (
            <Text dimColor italic>
              (Showing lines {startLine + 1}-{endLine} of {totalLines}, use PageUp/PageDown or h/e to scroll)
            </Text>
          )}
        </Box>
      )}

      {/* Error */}
      {command.error && (
        <Box marginLeft={2} marginTop={1}>
          <Text color="red">Error: {command.error}</Text>
        </Box>
      )}

      {/* Duration/Status */}
      {command.status !== 'pending' && command.status !== 'running' && (
        <Box marginLeft={2} marginTop={1}>
          <Text dimColor>
            {command.status === 'success' ? '✅' : '❌'} Completed in{' '}
            {command.duration}ms
            {command.exitCode !== undefined && ` (exit code: ${command.exitCode})`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// STATUS BAR
// ============================================================================

interface ExecutionStatusBarProps {
  execution: ExecutionState;
}

const ExecutionStatusBar: React.FC<ExecutionStatusBarProps> = ({ execution }) => {
  const statusIcons = {
    running: '🔄',
    success: '✅',
    error: '❌',
    cancelled: '⏹️'
  };

  const statusColors = {
    running: 'yellow',
    success: 'green',
    error: 'red',
    cancelled: 'gray'
  };

  const duration = execution.endTime
    ? execution.endTime.getTime() - execution.startTime.getTime()
    : Date.now() - execution.startTime.getTime();

  return (
    <Box justifyContent="space-between">
      <Box>
        <Text bold>{statusIcons[execution.status]} </Text>
        <Text color={statusColors[execution.status]} bold>
          {execution.status.toUpperCase()}
        </Text>
      </Box>

      <Box>
        <Text dimColor>Tool: </Text>
        <Text>{execution.toolName}</Text>
      </Box>

      <Box>
        <Text dimColor>Duration: </Text>
        <Text>{(duration / 1000).toFixed(1)}s</Text>
      </Box>

      <Box>
        <Text dimColor>Commands: </Text>
        <Text>{execution.commands.length}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// EMPTY STATE
// ============================================================================

const EmptyState: React.FC = () => {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      paddingY={4}
    >
      <Text bold color="gray">No executions yet</Text>
      <Text dimColor>Commands will appear here when the LLM executes tools</Text>
      <Box marginTop={2}>
        <Text dimColor>Press </Text>
        <Text color="cyan" bold>Ctrl+E</Text>
        <Text dimColor> to hide this viewer</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import {
  copyExecutionToClipboard,
  saveExecutionToFile,
  formatExecutionOutput
} from '../../execution/execution-utils.js';

/**
 * Copy execution to clipboard (wrapper with UI feedback)
 */
function handleCopyExecution(execution: ExecutionState): void {
  try {
    copyExecutionToClipboard(execution);
    // In a real implementation, show a toast notification
    console.log('✅ Execution copied to clipboard');
  } catch (error) {
    console.error('❌ Failed to copy to clipboard:', error);
  }
}

/**
 * Save execution to file (wrapper with UI feedback)
 */
async function handleSaveExecution(execution: ExecutionState): Promise<void> {
  try {
    const filepath = await saveExecutionToFile(execution);
    console.log(`✅ Execution saved to: ${filepath}`);
  } catch (error) {
    console.error('❌ Failed to save execution:', error);
  }
}
