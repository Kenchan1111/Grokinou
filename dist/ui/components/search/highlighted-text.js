import React from 'react';
import { Text } from 'ink';
/**
 * Component to highlight search pattern in text
 */
export const HighlightedText = ({ text, pattern, highlightColor = 'black', highlightBg = 'yellow', }) => {
    if (!pattern) {
        return React.createElement(Text, null, text);
    }
    // Escape regex special characters
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        const regex = new RegExp(`(${escapedPattern})`, 'gi');
        const parts = text.split(regex);
        return (React.createElement(Text, null, parts.map((part, i) => {
            // Check if this part matches the pattern
            const isMatch = new RegExp(`^${escapedPattern}$`, 'i').test(part);
            if (isMatch) {
                return (React.createElement(Text, { key: i, backgroundColor: highlightBg, color: highlightColor, bold: true }, part));
            }
            return React.createElement(Text, { key: i }, part);
        })));
    }
    catch (error) {
        // Fallback if regex fails
        return React.createElement(Text, null, text);
    }
};
//# sourceMappingURL=highlighted-text.js.map