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

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { executionManager } from '../../execution/index.js';
import type { ExecutionState, COTEntry, CommandExecution, COTType, CommandStatus } from '../../execution/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionViewerProps {
  mode?: 'split' | 'fullscreen';
}

// ============================================================================
// EXECUTION VIEWER COMPONENT
// ============================================================================

export const ExecutionViewer: React.FC<ExecutionViewerProps> = ({ mode = 'split' }) => {
  const [executions, setExecutions] = useState<ExecutionState[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsMode, setDetailsMode] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  /**
   * Subscribe to execution manager updates
   */
  useEffect(() => {
    // Initial load - get active executions
    const active = executionManager.getActiveExecutions();
    if (active.length > 0) {
      setExecutions(active);
    }

    // Subscribe to updates
    const unsubscribe = executionManager.subscribeToAll((execution) => {
      setExecutions(prev => {
        const index = prev.findIndex(e => e.id === execution.id);
        
        if (index >= 0) {
          // Update existing execution
          const updated = [...prev];
          updated[index] = execution;
          return updated;
        } else {
          // Add new execution
          return [...prev, execution];
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Keyboard shortcuts
   */
  useInput((input, key) => {
    // Ctrl+D: Toggle details mode
    if (key.ctrl && input === 'd') {
      setDetailsMode(d => !d);
    }

    // Ctrl+C: Copy current execution output
    if (key.ctrl && input === 'c') {
      const current = executions[selectedIndex];
      if (current) {
        handleCopyExecution(current);
      }
    }

    // Ctrl+S: Save current execution to file
    if (key.ctrl && input === 's') {
      const current = executions[selectedIndex];
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
            <Text bold color="green">📜 Command Output</Text>
            <Box flexDirection="column" marginTop={1}>
              {currentExecution.commands.length > 0 ? (
                currentExecution.commands.map((cmd, i) => (
                  <CommandDisplay
                    key={i}
                    command={cmd}
                    detailed={detailsMode}
                    mode={mode}
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
}

const CommandDisplay: React.FC<CommandDisplayProps> = ({
  command,
  detailed = false,
  mode = 'split'
}) => {
  const statusIcons: Record<CommandStatus, string> = {
    pending: '⏳',
    running: '🔄',
    success: '✅',
    error: '❌'
  };

  const statusIcon = statusIcons[command.status];

  // Limit output lines in split mode
  const maxLines = mode === 'split' ? 10 : 50;
  const displayLines = detailed
    ? command.output
    : command.output.slice(0, maxLines);
  const hasMore = command.output.length > displayLines.length;

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {/* Command line */}
      <Box>
        <Text color="cyan" bold>$ {command.command}</Text>
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
          {hasMore && (
            <Text dimColor italic>
              ... ({command.output.length - displayLines.length} more lines, press Ctrl+D for details)
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
