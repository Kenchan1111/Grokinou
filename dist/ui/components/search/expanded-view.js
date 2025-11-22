import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { HighlightedText } from './highlighted-text.js';
/**
 * Expanded view of a single search result (scrollable)
 */
export const ExpandedView = ({ result, query, scrollOffset, maxHeight, currentIndex, totalResults, }) => {
    const { message, session, contextBefore, contextAfter } = result;
    // Split content into lines for scrolling
    const contentLines = useMemo(() => {
        const lines = [];
        // Session header
        lines.push({ type: 'header', text: `Session #${session.id} - ${session.sessionDate}` });
        lines.push({ type: 'header', text: `Working Directory: ${session.workdir}` });
        lines.push({ type: 'header', text: `Provider: ${session.provider} (${session.model})` });
        lines.push({ type: 'separator', text: '─'.repeat(60) });
        // Context before (if exists)
        if (contextBefore) {
            const icon = contextBefore.role === 'user' ? '👤' : '🤖';
            const role = contextBefore.role === 'user' ? 'User' : 'Assistant';
            lines.push({ type: 'content', text: `${icon} ${role} (context):`, role: contextBefore.role });
            const beforeLines = contextBefore.content.split('\n');
            beforeLines.forEach(line => {
                lines.push({ type: 'content', text: line, role: contextBefore.role });
            });
            lines.push({ type: 'separator', text: '' });
        }
        // Main message
        const icon = message.role === 'user' ? '👤' : '🤖';
        const role = message.role === 'user' ? 'User' : 'Assistant';
        lines.push({ type: 'content', text: `${icon} ${role}:`, role: message.role });
        const messageLines = message.content.split('\n');
        messageLines.forEach(line => {
            lines.push({ type: 'content', text: line, role: message.role });
        });
        // Context after (if exists)
        if (contextAfter) {
            lines.push({ type: 'separator', text: '' });
            const icon = contextAfter.role === 'user' ? '👤' : '🤖';
            const role = contextAfter.role === 'user' ? 'User' : 'Assistant';
            lines.push({ type: 'content', text: `${icon} ${role} (context):`, role: contextAfter.role });
            const afterLines = contextAfter.content.split('\n');
            afterLines.forEach(line => {
                lines.push({ type: 'content', text: line, role: contextAfter.role });
            });
        }
        return lines;
    }, [message, session, contextBefore, contextAfter]);
    // Calculate visible lines
    const visibleLines = contentLines.slice(scrollOffset, scrollOffset + maxHeight - 4); // Reserve space for header/footer
    const scrollPercentage = Math.round((scrollOffset / Math.max(1, contentLines.length - maxHeight)) * 100);
    const canScrollUp = scrollOffset > 0;
    const canScrollDown = scrollOffset + maxHeight < contentLines.length;
    return (React.createElement(Box, { flexDirection: "column", height: maxHeight },
        React.createElement(Box, { borderStyle: "single", borderBottom: true, paddingX: 1 },
            React.createElement(Text, { bold: true, color: "cyan" },
                "\uD83D\uDD0D Result [",
                currentIndex,
                "/",
                totalResults,
                "] - \"",
                query,
                "\"")),
        React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1, paddingY: 1 }, visibleLines.map((line, i) => {
            const hasMatch = line.text.toLowerCase().includes(query.toLowerCase());
            if (line.type === 'header') {
                return (React.createElement(Box, { key: i },
                    React.createElement(Text, { bold: true, color: "cyan" }, line.text)));
            }
            if (line.type === 'separator') {
                return (React.createElement(Box, { key: i },
                    React.createElement(Text, { dimColor: true }, line.text)));
            }
            return (React.createElement(Box, { key: i },
                React.createElement(HighlightedText, { text: line.text, pattern: query })));
        })),
        React.createElement(Box, { borderStyle: "single", borderTop: true, paddingX: 1, flexDirection: "column" },
            React.createElement(Box, { justifyContent: "space-between" },
                React.createElement(Text, { dimColor: true },
                    canScrollDown ? '⬇' : ' ',
                    " Scroll: ",
                    scrollPercentage,
                    "% ",
                    canScrollUp ? '⬆' : ' '),
                React.createElement(Text, { dimColor: true },
                    contentLines.length,
                    " lines (showing ",
                    visibleLines.length,
                    ")")),
            React.createElement(Box, { marginTop: 0 },
                React.createElement(Text, { dimColor: true }, "\u2191/\u2193 Scroll \u2022 PgUp/PgDn Page \u2022 n/p Next/Prev \u2022 ^S Copy \u2022 Esc Back")))));
};
//# sourceMappingURL=expanded-view.js.map