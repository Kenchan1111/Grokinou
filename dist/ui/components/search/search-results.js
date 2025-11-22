import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { SearchResultItem } from './search-result-item.js';
import { ExpandedView } from './expanded-view.js';
import { clipboardManager } from '../../../utils/clipboard-manager.js';
/**
 * Main search results component with list and expanded modes
 */
export const SearchResults = ({ query, results, onClose, onPasteToInput, onToggleFullscreen, fullscreen = false, }) => {
    const { stdout } = useStdout();
    const [viewMode, setViewMode] = useState('list');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [expandedScrollOffset, setExpandedScrollOffset] = useState(0);
    const [notification, setNotification] = useState(null);
    // Calculate fixed height based on terminal height
    const terminalHeight = stdout?.rows || 24;
    // In fullscreen mode: more results visible (full terminal width)
    // In split mode: fewer results (half terminal width)
    const maxVisibleResults = fullscreen
        ? Math.floor(terminalHeight - 8) // Fullscreen: one result per line (more visible)
        : Math.min(8, Math.floor((terminalHeight - 10) / 4)); // Split: compact view
    const expandedMaxHeight = terminalHeight - 8;
    // Show notification with auto-dismiss
    const showNotification = useCallback((message, duration = 3000) => {
        setNotification(message);
        setTimeout(() => setNotification(null), duration);
    }, []);
    // Copy current result (compact mode)
    const handleCopyCompact = useCallback(async () => {
        const result = results[selectedIndex];
        try {
            const charCount = await clipboardManager.copySingleMessage(result.message, {
                sessionDate: result.session.sessionDate,
                workdir: result.session.workdir,
                provider: result.session.provider,
                model: result.session.model,
            }, { includeMetadata: true, format: 'markdown' });
            showNotification(`✅ Copied to clipboard (${charCount} characters)`);
        }
        catch (error) {
            showNotification(`❌ Failed to copy: ${error}`, 5000);
        }
    }, [results, selectedIndex, showNotification]);
    // Copy full message (expanded mode)
    const handleCopyFull = useCallback(async () => {
        const result = results[selectedIndex];
        try {
            const charCount = await clipboardManager.copySingleMessage(result.message, {
                sessionDate: result.session.sessionDate,
                workdir: result.session.workdir,
                provider: result.session.provider,
                model: result.session.model,
            }, { includeMetadata: true, format: 'markdown' });
            showNotification(`✅ Full message copied (${charCount} characters)`);
        }
        catch (error) {
            showNotification(`❌ Failed to copy: ${error}`, 5000);
        }
    }, [results, selectedIndex, showNotification]);
    // Paste clipboard content to input
    const handlePasteToInput = useCallback(async () => {
        try {
            const content = await clipboardManager.readClipboard();
            if (content && onPasteToInput) {
                onPasteToInput(content);
                showNotification(`📋 Pasted ${content.length} characters to input`);
            }
            else {
                showNotification('⚠️ Clipboard is empty', 2000);
            }
        }
        catch (error) {
            showNotification(`❌ Failed to read clipboard: ${error}`, 5000);
        }
    }, [onPasteToInput, showNotification]);
    // Keyboard navigation
    useInput((input, key) => {
        if (viewMode === 'list') {
            // List mode navigation
            if (key.upArrow) {
                setSelectedIndex(Math.max(0, selectedIndex - 1));
            }
            else if (key.downArrow) {
                setSelectedIndex(Math.min(results.length - 1, selectedIndex + 1));
            }
            else if (key.return) {
                // Expand selected result
                setViewMode('expanded');
                setExpandedScrollOffset(0);
            }
            else if (input === 'f' && onToggleFullscreen) {
                // Toggle fullscreen mode
                onToggleFullscreen();
            }
            else if (key.ctrl && input === 's') {
                handleCopyCompact();
            }
            else if (key.ctrl && input === 'p') {
                handlePasteToInput();
            }
            else if (key.escape) {
                onClose();
            }
        }
        else if (viewMode === 'expanded') {
            // Expanded mode navigation
            if (key.upArrow) {
                setExpandedScrollOffset(Math.max(0, expandedScrollOffset - 1));
            }
            else if (key.downArrow) {
                setExpandedScrollOffset(expandedScrollOffset + 1);
            }
            else if (key.pageDown) {
                setExpandedScrollOffset(expandedScrollOffset + 10);
            }
            else if (key.pageUp) {
                setExpandedScrollOffset(Math.max(0, expandedScrollOffset - 10));
            }
            else if (input === 'n') {
                // Next result
                if (selectedIndex < results.length - 1) {
                    setSelectedIndex(selectedIndex + 1);
                    setExpandedScrollOffset(0);
                }
            }
            else if (input === 'p') {
                // Previous result
                if (selectedIndex > 0) {
                    setSelectedIndex(selectedIndex - 1);
                    setExpandedScrollOffset(0);
                }
            }
            else if (key.ctrl && input === 's') {
                handleCopyFull();
            }
            else if (key.ctrl && input === 'p') {
                handlePasteToInput();
            }
            else if (key.escape) {
                setViewMode('list');
                setExpandedScrollOffset(0);
            }
        }
    });
    // No results
    if (results.length === 0) {
        return (React.createElement(Box, { flexDirection: "column", borderStyle: "single", borderColor: "yellow", paddingX: 2, paddingY: 1 },
            React.createElement(Text, { color: "yellow" },
                "\uD83D\uDD0D No results found for \"",
                query,
                "\""),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, "Try a different search term or check your spelling.")),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, "Press Esc to close"))));
    }
    // Memoize visible results to prevent unnecessary recalculations
    const visibleResultsData = useMemo(() => {
        const halfWindow = Math.floor(maxVisibleResults / 2);
        let windowStart = Math.max(0, selectedIndex - halfWindow);
        const windowEnd = Math.min(results.length, windowStart + maxVisibleResults);
        if (windowEnd === results.length) {
            windowStart = Math.max(0, results.length - maxVisibleResults);
        }
        return {
            windowStart,
            windowEnd,
            visibleResults: results.slice(windowStart, windowEnd),
        };
    }, [results, selectedIndex, maxVisibleResults]);
    return (React.createElement(Box, { flexDirection: "column", height: terminalHeight - 4 },
        viewMode === 'list' ? (React.createElement(Box, { flexDirection: "column", height: "100%" },
            React.createElement(Box, { borderStyle: "single", borderBottom: true, paddingX: 1 },
                React.createElement(Text, { bold: true, color: "cyan" },
                    "\uD83D\uDD0D Search: \"",
                    query,
                    "\""),
                fullscreen && (React.createElement(Text, { color: "yellow", dimColor: true }, " [FULLSCREEN]"))),
            React.createElement(Box, null,
                React.createElement(Text, null,
                    "\uD83D\uDCCA ",
                    results.length,
                    " result",
                    results.length > 1 ? 's' : '',
                    " found")),
            React.createElement(Box, { flexDirection: "column", flexGrow: 1, overflow: "hidden" }, visibleResultsData.visibleResults.map((result, localIndex) => {
                const globalIndex = visibleResultsData.windowStart + localIndex;
                return (React.createElement(SearchResultItem, { key: `result-${result.message.id}-${globalIndex}`, result: result, query: query, isSelected: globalIndex === selectedIndex, index: globalIndex + 1, total: results.length, compact: true }));
            })),
            React.createElement(Box, { flexDirection: "column", flexShrink: 0 },
                results.length > maxVisibleResults && (React.createElement(Box, null,
                    React.createElement(Text, { dimColor: true },
                        "Showing ",
                        Math.min(maxVisibleResults, results.length),
                        " of ",
                        results.length,
                        " results",
                        selectedIndex >= 0 && ` • Currently at #${selectedIndex + 1}`))),
                React.createElement(Box, { borderStyle: "single", borderTop: true, paddingX: 1 },
                    React.createElement(Text, { dimColor: true }, "\u2191/\u2193 Navigate \u2022 Enter Expand \u2022 f Fullscreen \u2022 ^S Copy \u2022 Esc Close"))))) : (
        // Expanded view
        React.createElement(ExpandedView, { result: results[selectedIndex], query: query, scrollOffset: expandedScrollOffset, maxHeight: expandedMaxHeight, currentIndex: selectedIndex + 1, totalResults: results.length })),
        notification && (React.createElement(Box, { marginTop: 1, borderStyle: "round", borderColor: "green", paddingX: 2, paddingY: 0 },
            React.createElement(Text, { color: "green" }, notification)))));
};
//# sourceMappingURL=search-results.js.map