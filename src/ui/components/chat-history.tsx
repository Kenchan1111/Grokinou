import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { ChatEntry } from "../../agent/grok-agent.js";
import { DiffRenderer } from "./diff-renderer.js";
import { MarkdownRenderer } from "../utils/markdown-renderer.js";
import { providerManager } from "../../utils/provider-manager.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import wrapAnsi from "wrap-ansi";

interface ChatHistoryProps {
  entries: ChatEntry[];
  isConfirmationActive?: boolean;
}

// Helper: Format timestamp for headers
const formatTimestamp = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `[${day}/${month} ${hours}:${minutes}]`;
};

// Helper: Get abbreviated model name
const getModelAbbreviation = (modelName?: string): string => {
  if (!modelName) return "assistant";
  const lower = modelName.toLowerCase();

  if (lower.includes("grok")) return "grok";
  if (lower.includes("claude")) return "claude";
  if (lower.includes("gpt") || lower.includes("chatgpt")) return "chatgpt";
  if (lower.includes("deepseek")) return "deepseek";
  if (lower.includes("mistral")) return "mistral";
  if (lower.includes("gemini")) return "gemini";
  if (lower.includes("llama")) return "llama";

  return "assistant";
};

const getAssistantLabel = (entry: ChatEntry): string => {
  // 1) Explicit override in project settings
  try {
    const mgr = getSettingsManager();
    const override = mgr.getProjectSetting("assistantName");
    if (override && typeof override === "string" && override.trim()) {
      return override.trim();
    }

    // 2) If no model on entry, fallback to project/user defaults to guess provider
    if (!entry.model) {
      const projectModel = mgr.getProjectSetting("model");
      if (projectModel) {
        const prov = providerManager.detectProvider(projectModel);
        if (prov) return getModelAbbreviation(projectModel);
      }
      const userDefault = mgr.getUserSetting("defaultModel") as string | undefined;
      if (userDefault) {
        const prov = providerManager.detectProvider(userDefault);
        if (prov) return getModelAbbreviation(userDefault);
      }
    }
  } catch {
    // ignore
  }

  const model = entry.model;
  if (model) {
    const provider = providerManager.detectProvider(model);
    if (provider) {
      return getModelAbbreviation(model);
    }
  }
  return "assistant";
};

const getUserLabel = (): string => {
  try {
    const mgr = getSettingsManager();
    const userSetting = mgr.getUserSetting("displayName");
    if (userSetting && typeof userSetting === "string" && userSetting.trim()) {
      return userSetting.trim();
    }
    const projectUser = mgr.getProjectSetting("userName");
    if (projectUser && typeof projectUser === "string" && projectUser.trim()) {
      return projectUser.trim();
    }
  } catch {
    // ignore settings errors
  }
  return "user";
};

// Memoized ChatEntry component to prevent unnecessary re-renders
const MemoizedChatEntry = React.memo(
  ({ entry, index }: { entry: ChatEntry; index: number }) => {
    const renderDiff = (diffContent: string, filename?: string) => {
      return (
        <DiffRenderer
          diffContent={diffContent}
          filename={filename}
          terminalWidth={process.stdout.columns || 80}
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
        const userDisplayName = getUserLabel();
        const userContent = (entry.content || "").trimEnd();
        const columns = process.stdout.columns || 80;
        // Reserve 2 cols for border + 2 for padding so the background fills the inner box
        const innerWidth = Math.max(10, columns - 4);
        const wrappedUserContent = wrapAnsi(`▸ ${userContent}`, innerWidth, {
          hard: false,
          trim: false,
        });
        const paddedLines = wrappedUserContent.split("\n").map((line) => line.padEnd(innerWidth, " "));

        return (
          <Box key={index} width="100%" flexDirection="column" marginBottom={1}>
            <Box width="100%" paddingX={1}>
              <Text dimColor wrap="wrap">
                {formatTimestamp(entry.timestamp)} {userDisplayName}
              </Text>
            </Box>
            <Box width="100%" paddingX={1} paddingY={0} borderStyle="single" borderColor="gray">
              <Box width="100%" flexDirection="column">
                {paddedLines.map((line, idx) => (
                  <Text
                    key={idx}
                    color="whiteBright"
                    backgroundColor="gray"
                    wrap="truncate"
                  >
                    {line}
                  </Text>
                ))}
              </Box>
            </Box>
          </Box>
        );

      case "assistant":
        // ✅ Skip assistant entries that have toolCalls (internal protocol messages)
        if (entry.toolCalls && entry.toolCalls.length > 0) {
          return null;
        }

        const modelName = getAssistantLabel(entry);

        return (
          <Box key={index} width="100%" flexDirection="column" marginBottom={1}>
            {/* Header: timestamp + model abbreviation */}
            <Box width="100%" paddingX={1}>
              <Text dimColor wrap="wrap">
                {formatTimestamp(entry.timestamp)} {modelName}
              </Text>
            </Box>
            {/* Content: markdown with icon */}
            <Box width="100%" paddingX={1} flexDirection="row" alignItems="flex-start">
              <Text color="white" dimColor>◉ </Text>
              <Box flexDirection="column" flexGrow={1}>
                <MarkdownRenderer content={entry.content.trimEnd()} />
                {entry.isStreaming && <Text color="cyan" dimColor wrap="wrap">▊</Text>}
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
              if (Array.isArray(parsed) || typeof parsed === 'object') {
                // ✅ RESTAURATION: Afficher le JSON complet, pas juste un résumé
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
          if (toolName === "get_my_identity") {
            return content; // Show full identity block
          }
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
          <Box key={index} width="100%" flexDirection="column" marginBottom={1}>
            {/* Header: timestamp + tool name */}
            <Box width="100%" paddingX={1}>
              <Text dimColor wrap="wrap">
                {formatTimestamp(entry.timestamp)} tool
              </Text>
            </Box>
            {/* Tool action line - full width */}
            <Box width="100%" paddingX={1}>
              <Text color="magenta" dimColor wrap="wrap">
                {"● "}{filePath ? `${actionName}(${filePath})` : actionName}
              </Text>
            </Box>
            {/* Tool result - indented but full width */}
            <Box width="100%" paddingX={1} marginLeft={1}>
              {isExecuting ? (
                <Text color="cyan" dimColor wrap="wrap">├─ Executing...</Text>
              ) : toolName === "get_my_identity" ? (
                <Box flexDirection="column" width="100%">
                  {entry.content.split("\n").map((line, idx) => (
                    <Text key={idx} color="green" dimColor wrap="wrap">
                      {idx === 0 ? "└─ " + line : "   " + line}
                    </Text>
                  ))}
                </Box>
              ) : shouldShowFileContent ? (
                // Show compact summary by default, full content if GROK_VERBOSE_TOOLS=true
                verboseToolOutput ? (
                  <Box width="100%" flexDirection="column">
                    <Text color="blue" dimColor wrap="wrap">├─ File contents:</Text>
                    <Box marginLeft={1} flexDirection="column">
                      {renderFileContent(entry.content)}
                    </Box>
                  </Box>
                ) : (
                  <Text color="green" dimColor wrap="wrap">
                    {"└─ "}{createCompactSummary(entry.content, toolName).slice(0, 200)}
                  </Text>
                )
              ) : shouldShowDiff ? (
                // For diff results, show only the summary line, not the raw content
                <Text color="green" dimColor wrap="wrap">
                  {"└─ "}{entry.content.split("\n")[0]}
                </Text>
              ) : (
                <Text color="green" dimColor wrap="wrap">
                  {"└─ "}{createCompactSummary(entry.content, toolName).slice(0, 200)}
                </Text>
              )}
            </Box>
            {shouldShowDiff && !isExecuting && (
              <Box width="100%" paddingX={1} marginLeft={2} flexDirection="column">
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
    <Box width="100%" flexDirection="column" paddingX={1}>
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
