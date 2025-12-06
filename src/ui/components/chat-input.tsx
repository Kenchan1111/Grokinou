import React, { useMemo, useState, useEffect } from "react";
import { Box, Text } from "ink";
import { pasteManager } from "../../utils/paste-manager.js";
import { imagePathManager } from "../../utils/image-path-detector.js";

interface ChatInputProps {
  input: string;
  cursorPosition: number;
  isProcessing: boolean;
  isStreaming: boolean;
}

export function ChatInput({
  input,
  cursorPosition,
  isProcessing,
  isStreaming,
}: ChatInputProps) {
  const beforeCursor = input.slice(0, cursorPosition);
  const afterCursor = input.slice(cursorPosition);

  // Force re-render when input changes (to pick up paste changes)
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    forceUpdate(prev => prev + 1);
  }, [input]);

  // Get pending pastes and images (will cause re-render when they change)
  const pendingPastes = pasteManager.getPendingPastes();
  const attachedImages = imagePathManager.getAttachedImages();

  // Component renders (debug logs removed for cleaner output)

  // Function to render text with styled placeholders (cyan for text, magenta for images)
  const renderWithPlaceholders = useMemo(() => {
    return (text: string) => {
      
      if (pendingPastes.length === 0 && attachedImages.length === 0) {
        return text;
      }

      // Build a combined list of all placeholders with their types
      const placeholders: Array<{ text: string; type: 'paste' | 'image' }> = [
        ...pendingPastes.map(p => ({ text: p.placeholder, type: 'paste' as const })),
        ...attachedImages.map(img => ({ text: img.placeholder, type: 'image' as const })),
      ];

      // Sort by position in text for correct rendering
      const segments: Array<{ text: string; type: 'text' | 'paste' | 'image' }> = [];
      let remaining = text;
      let changed = true;

      while (changed && remaining) {
        changed = false;
        let earliestIndex = Infinity;
        let earliestPlaceholder: { text: string; type: 'paste' | 'image' } | null = null;

        // Find the earliest placeholder in remaining text
        for (const placeholder of placeholders) {
          const index = remaining.indexOf(placeholder.text);
          if (index !== -1 && index < earliestIndex) {
            earliestIndex = index;
            earliestPlaceholder = placeholder;
            changed = true;
          }
        }

        if (earliestPlaceholder) {
          // Add text before placeholder
          if (earliestIndex > 0) {
            segments.push({ text: remaining.slice(0, earliestIndex), type: 'text' });
          }
          // Add placeholder
          segments.push({ text: earliestPlaceholder.text, type: earliestPlaceholder.type });
          // Continue with remaining text
          remaining = remaining.slice(earliestIndex + earliestPlaceholder.text.length);
        }
      }

      // Add any remaining text
      if (remaining) {
        segments.push({ text: remaining, type: 'text' });
      }

      // Render segments with appropriate colors
      return segments.map((segment, idx) => {
        if (segment.type === 'paste') {
          return <Text key={idx} color="cyan">{segment.text}</Text>;
        } else if (segment.type === 'image') {
          return <Text key={idx} color="magenta">{segment.text}</Text>;
        } else {
          return <Text key={idx}>{segment.text}</Text>;
        }
      });
    };
  }, [pendingPastes, attachedImages]);

  // Handle multiline input display
  const lines = input.split("\n");
  const isMultiline = lines.length > 1;

  // Calculate cursor position across lines
  let currentLineIndex = 0;
  let currentCharIndex = 0;
  let totalChars = 0;

  for (let i = 0; i < lines.length; i++) {
    if (totalChars + lines[i].length >= cursorPosition) {
      currentLineIndex = i;
      currentCharIndex = cursorPosition - totalChars;
      break;
    }
    totalChars += lines[i].length + 1; // +1 for newline
  }

  const showCursor = !isProcessing && !isStreaming;
  const borderColor = isProcessing || isStreaming ? "yellow" : "blue";
  const promptColor = "cyan";

  // Display placeholder when input is empty
  const placeholderText = "Ask me anything...";
  const isPlaceholder = !input;

  if (isMultiline) {
    return (
      <Box
        borderStyle="round"
        borderColor={borderColor}
        paddingY={0}
        marginTop={1}
        flexDirection="column"
        flexShrink={0}
        width="100%"
      >
        {lines.map((line, index) => {
          const isCurrentLine = index === currentLineIndex;
          const promptChar = index === 0 ? "❯" : "│";

          if (isCurrentLine) {
            const beforeCursorInLine = line.slice(0, currentCharIndex);
            const cursorChar =
              line.slice(currentCharIndex, currentCharIndex + 1) || " ";
            const afterCursorInLine = line.slice(currentCharIndex + 1);

            return (
              <Box key={index}>
                <Text color={promptColor}>{promptChar} </Text>
                <Text wrap="wrap">
                  {renderWithPlaceholders(beforeCursorInLine)}
                  {showCursor && (
                    <Text backgroundColor="white" color="black">
                      {cursorChar}
                    </Text>
                  )}
                  {!showCursor && cursorChar !== " " && cursorChar}
                  {renderWithPlaceholders(afterCursorInLine)}
                </Text>
              </Box>
            );
          } else {
            return (
              <Box key={index}>
                <Text color={promptColor}>{promptChar} </Text>
                <Text wrap="wrap">{renderWithPlaceholders(line)}</Text>
              </Box>
            );
          }
        })}
      </Box>
    );
  }

  // Single line input box
  const cursorChar = input.slice(cursorPosition, cursorPosition + 1) || " ";
  const afterCursorText = input.slice(cursorPosition + 1);

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginTop={1}
      flexDirection="column"
      flexShrink={0}
      width="100%"
    >
      <Box flexDirection="column" width="100%" flexShrink={0}>
        <Box flexDirection="row" flexWrap="wrap" width="100%">
          <Text color={promptColor}>❯ </Text>
          {isPlaceholder ? (
            <>
              <Text color="gray" dimColor>
                {placeholderText}
              </Text>
              {showCursor && (
                <Text backgroundColor="white" color="black">
                  {" "}
                </Text>
              )}
            </>
          ) : (
            <Text wrap="wrap">
              {renderWithPlaceholders(beforeCursor)}
              {showCursor && (
                <Text backgroundColor="white" color="black">
                  {cursorChar}
                </Text>
              )}
              {!showCursor && cursorChar !== " " && cursorChar}
              {renderWithPlaceholders(afterCursorText)}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
