import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { pasteManager } from "../../utils/paste-manager.js";
import { imagePathManager } from "../../utils/image-path-detector.js";
export const ChatInput = React.memo(function ChatInput({ input, cursorPosition, isProcessing, isStreaming, }) {
    const beforeCursor = input.slice(0, cursorPosition);
    const afterCursor = input.slice(cursorPosition);
    // Function to render text with styled placeholders (cyan for text, magenta for images)
    const renderWithPlaceholders = useMemo(() => {
        return (text) => {
            const pendingPastes = pasteManager.getPendingPastes();
            const attachedImages = imagePathManager.getAttachedImages();
            if (pendingPastes.length === 0 && attachedImages.length === 0) {
                return text;
            }
            // Build a combined list of all placeholders with their types
            const placeholders = [
                ...pendingPastes.map(p => ({ text: p.placeholder, type: 'paste' })),
                ...attachedImages.map(img => ({ text: img.placeholder, type: 'image' })),
            ];
            // Sort by position in text for correct rendering
            const segments = [];
            let remaining = text;
            let changed = true;
            while (changed && remaining) {
                changed = false;
                let earliestIndex = Infinity;
                let earliestPlaceholder = null;
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
                    return React.createElement(Text, { key: idx, color: "cyan" }, segment.text);
                }
                else if (segment.type === 'image') {
                    return React.createElement(Text, { key: idx, color: "magenta" }, segment.text);
                }
                else {
                    return React.createElement(Text, { key: idx }, segment.text);
                }
            });
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
        return (React.createElement(Box, { borderStyle: "round", borderColor: borderColor, paddingY: 0, marginTop: 1 }, lines.map((line, index) => {
            const isCurrentLine = index === currentLineIndex;
            const promptChar = index === 0 ? "❯" : "│";
            if (isCurrentLine) {
                const beforeCursorInLine = line.slice(0, currentCharIndex);
                const cursorChar = line.slice(currentCharIndex, currentCharIndex + 1) || " ";
                const afterCursorInLine = line.slice(currentCharIndex + 1);
                return (React.createElement(Box, { key: index },
                    React.createElement(Text, { color: promptColor },
                        promptChar,
                        " "),
                    React.createElement(Text, null,
                        renderWithPlaceholders(beforeCursorInLine),
                        showCursor && (React.createElement(Text, { backgroundColor: "white", color: "black" }, cursorChar)),
                        !showCursor && cursorChar !== " " && cursorChar,
                        renderWithPlaceholders(afterCursorInLine))));
            }
            else {
                return (React.createElement(Box, { key: index },
                    React.createElement(Text, { color: promptColor },
                        promptChar,
                        " "),
                    React.createElement(Text, null, renderWithPlaceholders(line))));
            }
        })));
    }
    // Single line input box
    const cursorChar = input.slice(cursorPosition, cursorPosition + 1) || " ";
    const afterCursorText = input.slice(cursorPosition + 1);
    return (React.createElement(Box, { borderStyle: "round", borderColor: borderColor, paddingX: 1, paddingY: 0, marginTop: 1 },
        React.createElement(Box, null,
            React.createElement(Text, { color: promptColor }, "\u276F "),
            isPlaceholder ? (React.createElement(React.Fragment, null,
                React.createElement(Text, { color: "gray", dimColor: true }, placeholderText),
                showCursor && (React.createElement(Text, { backgroundColor: "white", color: "black" }, " ")))) : (React.createElement(Text, null,
                renderWithPlaceholders(beforeCursor),
                showCursor && (React.createElement(Text, { backgroundColor: "white", color: "black" }, cursorChar)),
                !showCursor && cursorChar !== " " && cursorChar,
                renderWithPlaceholders(afterCursorText))))));
});
//# sourceMappingURL=chat-input.js.map