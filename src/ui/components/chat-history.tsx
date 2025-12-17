import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { ChatEntry } from "../../agent/grok-agent.js";
import { DiffRenderer } from "./diff-renderer.js";
import { MarkdownRenderer } from "../utils/markdown-renderer.js";

interface ChatHistoryProps {
  entries: ChatEntry[];
  isConfirmationActive?: boolean;
}

// Memoized ChatEntry component to prevent unnecessary re-renders
const MemoizedChatEntry = React.memo(
  ({ entry, index }: { entry: ChatEntry; index: number }) => {
    const renderDiff = (diffContent: string, filename?: string) => {
      return (
        <DiffRenderer
          diffContent={diffContent}
          filename={filename}
          terminalWidth={80}
        />
      );
    };

    const renderFileContent = (content: string) => {
      const lines = content.split("\n");

      // Calculate minimum indentation like DiffRenderer does
      let baseIndentation = Infinity;
      for (const line of lines) {
        if (line.trim() === "") continue;
        const firstCharIndex = line.search(/\S/);
        const currentIndent = firstCharIndex === -1 ? 0 : firstCharIndex;
        baseIndentation = Math.min(baseIndentation, currentIndent);
      }
      if (!isFinite(baseIndentation)) {
        baseIndentation = 0;
      }

      return lines.map((line, index) => {
        const displayContent = line.substring(baseIndentation);
        return (
          <Text key={index} color="gray" wrap="wrap">
            {displayContent}
          </Text>
        );
      });
    };

    switch (entry.type) {
      case "user":
        return (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Box paddingX={1} paddingY={0}>
              <Text inverse wrap="wrap">
                {"▸ "}{entry.content}
              </Text>
            </Box>
          </Box>
        );

      case "assistant":
        // ✅ Skip assistant entries that have toolCalls (internal protocol messages)
        if (entry.toolCalls && entry.toolCalls.length > 0) {
          return null;
        }

        return (
          <Box key={index} flexDirection="column">
            <Box flexDirection="row" alignItems="flex-start">
              <Text color="white" dimColor>◉ </Text>
              <Box flexDirection="column" flexGrow={1}>
                <MarkdownRenderer content={entry.content.trim()} />
                {entry.isStreaming && <Text color="cyan" dimColor>▊</Text>}
              </Box>
            </Box>
          </Box>
        );

      case "tool_call":
      case "tool_result":
        const getToolActionName = (toolName: string) => {
          // Handle MCP tools with mcp__servername__toolname format
          if (toolName.startsWith("mcp__")) {
            const parts = toolName.split("__");
            if (parts.length >= 3) {
              const serverName = parts[1];
              const actualToolName = parts.slice(2).join("__");
              return `${serverName.charAt(0).toUpperCase() + serverName.slice(1)}(${actualToolName.replace(/_/g, " ")})`;
            }
          }

          switch (toolName) {
            case "view_file":
              return "Read";
            case "str_replace_editor":
              return "Update";
            case "create_file":
              return "Create";
            case "bash":
              return "Bash";
            case "search":
              return "Search";
            case "create_todo_list":
              return "Created Todo";
            case "update_todo_list":
              return "Updated Todo";
            default:
              return "Tool";
          }
        };

        const toolName = entry.toolCall?.function?.name || "unknown";
        const actionName = getToolActionName(toolName);

        const getFilePath = (toolCall: any) => {
          if (toolCall?.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              if (toolCall.function.name === "search") {
                return args.query;
              }
              return args.path || args.file_path || args.command || "";
            } catch {
              return "";
            }
          }
          return "";
        };

        const filePath = getFilePath(entry.toolCall);
        const isExecuting = entry.type === "tool_call" || !entry.toolResult;
        
        // Format JSON content for better readability
        const formatToolContent = (content: string, toolName: string) => {
          if (toolName.startsWith("mcp__")) {
            try {
              // Try to parse as JSON and format it
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                // For arrays, show a summary instead of full JSON
                return `Found ${parsed.length} items`;
              } else if (typeof parsed === 'object') {
                // For objects, show a formatted version
                return JSON.stringify(parsed, null, 2);
              }
            } catch {
              // If not JSON, return as is
              return content;
            }
          }
          return content;
        };
        const shouldShowDiff =
          entry.toolCall?.function?.name === "str_replace_editor" &&
          entry.toolResult?.success &&
          entry.content.includes("Updated") &&
          entry.content.includes("---") &&
          entry.content.includes("+++");

        const shouldShowFileContent =
          (entry.toolCall?.function?.name === "view_file" ||
            entry.toolCall?.function?.name === "create_file") &&
          entry.toolResult?.success &&
          !shouldShowDiff;

        // Check if user wants verbose tool output (default: compact)
        const verboseToolOutput = process.env.GROK_VERBOSE_TOOLS === "true";

        // Create compact summary for file operations
        const createCompactSummary = (content: string, toolName: string) => {
          if (toolName === "view_file" || toolName === "create_file") {
            const lines = content.split("\n").length;
            const chars = content.length;
            return `✓ ${lines} lines (${(chars / 1024).toFixed(1)}KB) - Details in Execution Viewer (Ctrl+E)`;
          }
          if (toolName === "search") {
            const lines = content.split("\n").filter(l => l.trim()).length;
            return `✓ ${lines} matches`;
          }
          if (toolName === "bash") {
            const lines = content.split("\n").length;
            return lines > 10 ? `✓ ${lines} lines output` : content;
          }
          return formatToolContent(content, toolName);
        };

        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="magenta" dimColor>●</Text>
              <Text color="magenta" dimColor wrap="wrap">
                {" "}
                {filePath ? `${actionName}(${filePath})` : actionName}
              </Text>
            </Box>
            <Box marginLeft={2} flexDirection="column">
              {isExecuting ? (
                <Text color="cyan" dimColor wrap="wrap">├─ Executing...</Text>
              ) : shouldShowFileContent ? (
                // Show compact summary by default, full content if GROK_VERBOSE_TOOLS=true
                verboseToolOutput ? (
                  <Box flexDirection="column">
                    <Text color="blue" dimColor wrap="wrap">├─ File contents:</Text>
                    <Box marginLeft={2} flexDirection="column">
                      {renderFileContent(entry.content)}
                    </Box>
                  </Box>
                ) : (
                  <Text color="green" dimColor wrap="wrap">└─ {createCompactSummary(entry.content, toolName)}</Text>
                )
              ) : shouldShowDiff ? (
                // For diff results, show only the summary line, not the raw content
                <Text color="green" dimColor wrap="wrap">└─ {entry.content.split("\n")[0]}</Text>
              ) : (
                <Text color="green" dimColor wrap="wrap">└─ {createCompactSummary(entry.content, toolName)}</Text>
              )}
            </Box>
            {shouldShowDiff && !isExecuting && (
              <Box marginLeft={4} flexDirection="column">
                {renderDiff(entry.content, filePath)}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  }
);

MemoizedChatEntry.displayName = "MemoizedChatEntry";

// Lightweight archived entry renderer to print finalized entries once
export const MemoizedArchived = React.memo(({ entry }: { entry: ChatEntry }) => {
  return <MemoizedChatEntry entry={entry} index={0} />;
});

const ChatHistoryComponent = ({
  entries,
  isConfirmationActive = false,
}: ChatHistoryProps) => {
  // Filter out tool_call entries with "Executing..." when confirmation is active
  const filteredEntries = useMemo(() => {
    if (!isConfirmationActive) return entries;
    return entries.filter(
      (entry) => !(entry.type === "tool_call" && entry.content === "Executing...")
    );
  }, [entries, isConfirmationActive]);

  return (
    <Box flexDirection="column">
      {filteredEntries.map((entry, index) => (
        <MemoizedChatEntry
          key={`${entry.timestamp.getTime()}-${index}`}
          entry={entry}
          index={index}
        />
      ))}
    </Box>
  );
};

export const ChatHistory = React.memo(ChatHistoryComponent, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // Only re-render if entries actually changed
  if (prevProps.entries.length !== nextProps.entries.length) return false;
  if (prevProps.isConfirmationActive !== nextProps.isConfirmationActive) return false;
  
  // Check if the last entry is the same (most common case)
  const prevLast = prevProps.entries[prevProps.entries.length - 1];
  const nextLast = nextProps.entries[nextProps.entries.length - 1];
  if (prevLast?.timestamp !== nextLast?.timestamp) return false;
  
  return true; // Props are equal, skip re-render
});
