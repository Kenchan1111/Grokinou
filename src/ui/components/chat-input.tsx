import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { pasteManager } from "../../utils/paste-manager.js";

interface ChatInputProps {
  input: string;
  cursorPosition: number;
  isProcessing: boolean;
  isStreaming: boolean;
}

export const ChatInput = React.memo(function ChatInput({
  input,
  cursorPosition,
  isProcessing,
  isStreaming,
}: ChatInputProps) {
  const beforeCursor = input.slice(0, cursorPosition);
  const afterCursor = input.slice(cursorPosition);

  // Function to render text with cyan-styled placeholders
  const renderWithPlaceholders = useMemo(() => {
    return (text: string) => {
      const pendingPastes = pasteManager.getPendingPastes();
      
      if (pendingPastes.length === 0) {
        return text;
      }

      // Split text by placeholders and create styled segments
      const segments: Array<{ text: string; isPlaceholder: boolean }> = [];
      let remaining = text;

      for (const paste of pendingPastes) {
        const index = remaining.indexOf(paste.placeholder);
        if (index !== -1) {
          // Add text before placeholder
          if (index > 0) {
            segments.push({ text: remaining.slice(0, index), isPlaceholder: false });
          }
          // Add placeholder
          segments.push({ text: paste.placeholder, isPlaceholder: true });
          // Continue with remaining text
          remaining = remaining.slice(index + paste.placeholder.length);
        }
      }

      // Add any remaining text
      if (remaining) {
        segments.push({ text: remaining, isPlaceholder: false });
      }

      // Render segments
      return segments.map((segment, idx) => (
        segment.isPlaceholder ? (
          <Text key={idx} color="cyan">{segment.text}</Text>
        ) : (
          <Text key={idx}>{segment.text}</Text>
        )
      ));
    };
  }, []);

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
                <Text>
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
                <Text>{renderWithPlaceholders(line)}</Text>
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
    >
      <Box>
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
          <Text>
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
  );
});
