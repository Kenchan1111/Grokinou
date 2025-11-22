import React from 'react';
import { Box, useStdout } from 'ink';
/**
 * Split screen layout component
 */
export const SplitLayout = ({ left, right, splitRatio = 0.5, showBorder = true, }) => {
    const { stdout } = useStdout();
    const totalWidth = stdout?.columns || 80;
    const totalHeight = (stdout?.rows || 24) - 6; // Reserve space for margins
    const leftWidth = Math.floor(totalWidth * splitRatio);
    const rightWidth = totalWidth - leftWidth - (showBorder ? 1 : 0); // Account for border
    return (React.createElement(Box, { flexDirection: "row", width: totalWidth, height: totalHeight, overflow: "hidden" },
        React.createElement(Box, { width: leftWidth, height: "100%", flexDirection: "column", borderStyle: showBorder ? 'single' : undefined, borderRight: showBorder, paddingRight: showBorder ? 1 : 0, overflow: "hidden" }, left),
        React.createElement(Box, { width: rightWidth, height: "100%", flexDirection: "column", paddingLeft: showBorder ? 1 : 0, overflow: "hidden" }, right)));
};
//# sourceMappingURL=split-layout.js.map