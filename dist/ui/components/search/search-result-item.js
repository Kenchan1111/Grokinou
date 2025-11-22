import React from 'react';
import { Box, Text } from 'ink';
import { HighlightedText } from './highlighted-text.js';
/**
 * Single search result item (compact view)
 */
const SearchResultItemComponent = ({ result, query, isSelected, index, total, compact = true, }) => {
    const { message, session } = result;
    // Truncate content for compact view
    const truncateContent = (text, maxLength = 120) => {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength) + '...';
    };
    const roleIcon = message.role === 'user' ? '👤' : '🤖';
    const borderStyle = isSelected ? 'double' : 'single';
    const borderColor = isSelected ? 'cyan' : 'gray';
    return (React.createElement(Box, { flexDirection: "column", borderStyle: borderStyle, borderColor: borderColor, paddingX: 1, marginBottom: 1 },
        React.createElement(Box, null,
            React.createElement(Text, { bold: true, color: isSelected ? 'cyan' : 'white' },
                "[",
                index,
                "/",
                total,
                "] Session #",
                session.id,
                " - ",
                session.sessionDate)),
        React.createElement(Box, { marginTop: 0, flexDirection: "column" },
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true },
                    roleIcon,
                    " "),
                compact ? (React.createElement(Text, null,
                    React.createElement(HighlightedText, { text: truncateContent(message.content), pattern: query }))) : (React.createElement(HighlightedText, { text: message.content, pattern: query })))),
        !compact && (React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true },
                session.provider,
                " (",
                session.model,
                ") \u2022 ",
                result.matchCount,
                " matches")))));
};
// Memoize to prevent re-renders when only selection changes
export const SearchResultItem = React.memo(SearchResultItemComponent, (prevProps, nextProps) => {
    // Only re-render if the item's selection state changed or content changed
    return (prevProps.isSelected === nextProps.isSelected &&
        prevProps.result.message.id === nextProps.result.message.id &&
        prevProps.query === nextProps.query &&
        prevProps.index === nextProps.index);
});
//# sourceMappingURL=search-result-item.js.map