import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { SearchResult } from '../../../utils/search-manager.js';
import { SearchResultItem } from './search-result-item.js';
import { ExpandedView } from './expanded-view.js';
import { clipboardManager } from '../../../utils/clipboard-manager.js';

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  onClose: () => void;
  onPasteToInput?: (text: string) => void;
}

type ViewMode = 'list' | 'expanded';

/**
 * Main search results component with list and expanded modes
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  results,
  onClose,
  onPasteToInput,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedScrollOffset, setExpandedScrollOffset] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  
  const maxVisibleResults = 8; // Number of results visible in list mode
  const expandedMaxHeight = 20; // Max height for expanded view
  
  // Show notification with auto-dismiss
  const showNotification = useCallback((message: string, duration = 3000) => {
    setNotification(message);
    setTimeout(() => setNotification(null), duration);
  }, []);
  
  // Copy current result (compact mode)
  const handleCopyCompact = useCallback(async () => {
    const result = results[selectedIndex];
    
    try {
      const charCount = await clipboardManager.copySingleMessage(
        result.message,
        {
          sessionDate: result.session.sessionDate,
          workdir: result.session.workdir,
          provider: result.session.provider,
          model: result.session.model,
        },
        { includeMetadata: true, format: 'markdown' }
      );
      
      showNotification(`✅ Copied to clipboard (${charCount} characters)`);
    } catch (error) {
      showNotification(`❌ Failed to copy: ${error}`, 5000);
    }
  }, [results, selectedIndex, showNotification]);
  
  // Copy full message (expanded mode)
  const handleCopyFull = useCallback(async () => {
    const result = results[selectedIndex];
    
    try {
      const charCount = await clipboardManager.copySingleMessage(
        result.message,
        {
          sessionDate: result.session.sessionDate,
          workdir: result.session.workdir,
          provider: result.session.provider,
          model: result.session.model,
        },
        { includeMetadata: true, format: 'markdown' }
      );
      
      showNotification(`✅ Full message copied (${charCount} characters)`);
    } catch (error) {
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
      } else {
        showNotification('⚠️ Clipboard is empty', 2000);
      }
    } catch (error) {
      showNotification(`❌ Failed to read clipboard: ${error}`, 5000);
    }
  }, [onPasteToInput, showNotification]);
  
  // Keyboard navigation
  useInput((input, key) => {
    if (viewMode === 'list') {
      // List mode navigation
      if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow) {
        setSelectedIndex(Math.min(results.length - 1, selectedIndex + 1));
      } else if (key.return) {
        // Expand selected result
        setViewMode('expanded');
        setExpandedScrollOffset(0);
      } else if (key.ctrl && input === 's') {
        handleCopyCompact();
      } else if (key.ctrl && input === 'p') {
        handlePasteToInput();
      } else if (key.escape) {
        onClose();
      }
    } else if (viewMode === 'expanded') {
      // Expanded mode navigation
      if (key.upArrow) {
        setExpandedScrollOffset(Math.max(0, expandedScrollOffset - 1));
      } else if (key.downArrow) {
        setExpandedScrollOffset(expandedScrollOffset + 1);
      } else if (key.pageDown) {
        setExpandedScrollOffset(expandedScrollOffset + 10);
      } else if (key.pageUp) {
        setExpandedScrollOffset(Math.max(0, expandedScrollOffset - 10));
      } else if (input === 'n') {
        // Next result
        if (selectedIndex < results.length - 1) {
          setSelectedIndex(selectedIndex + 1);
          setExpandedScrollOffset(0);
        }
      } else if (input === 'p') {
        // Previous result
        if (selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
          setExpandedScrollOffset(0);
        }
      } else if (key.ctrl && input === 's') {
        handleCopyFull();
      } else if (key.ctrl && input === 'p') {
        handlePasteToInput();
      } else if (key.escape) {
        setViewMode('list');
        setExpandedScrollOffset(0);
      }
    }
  });
  
  // No results
  if (results.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={2} paddingY={1}>
        <Text color="yellow">🔍 No results found for "{query}"</Text>
        <Box marginTop={1}>
          <Text dimColor>
            Try a different search term or check your spelling.
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Press Esc to close
          </Text>
        </Box>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column">
      {viewMode === 'list' ? (
        <Box flexDirection="column">
          {/* Header */}
          <Box borderStyle="single" borderBottom paddingX={1} marginBottom={1}>
            <Text bold color="cyan">
              🔍 Search: "{query}"
            </Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text>
              📊 {results.length} result{results.length > 1 ? 's' : ''} found
            </Text>
          </Box>
          
          {/* Results list */}
          <Box flexDirection="column">
            {(() => {
              // Sliding window: center the selected result in the visible area
              const halfWindow = Math.floor(maxVisibleResults / 2);
              let windowStart = Math.max(0, selectedIndex - halfWindow);
              const windowEnd = Math.min(results.length, windowStart + maxVisibleResults);
              
              // Adjust if we're at the end
              if (windowEnd === results.length) {
                windowStart = Math.max(0, results.length - maxVisibleResults);
              }
              
              const visibleResults = results.slice(windowStart, windowEnd);
              
              return visibleResults.map((result, localIndex) => {
                const globalIndex = windowStart + localIndex;
                
                return (
                  <SearchResultItem
                    key={result.message.id}
                    result={result}
                    query={query}
                    isSelected={globalIndex === selectedIndex}
                    index={globalIndex + 1}
                    total={results.length}
                    compact={true}
                  />
                );
              });
            })()}
            
            {results.length > maxVisibleResults && (
              <Box marginTop={1}>
                <Text dimColor>
                  Showing {Math.min(maxVisibleResults, results.length)} of {results.length} results
                  {selectedIndex > 0 && ` • Currently at #${selectedIndex + 1}`}
                </Text>
              </Box>
            )}
          </Box>
          
          {/* Help footer */}
          <Box borderStyle="single" borderTop paddingX={1} marginTop={1}>
            <Text dimColor>
              ↑/↓ Navigate • Enter Expand • ^S Copy • ^P Paste • Esc Close
            </Text>
          </Box>
        </Box>
      ) : (
        // Expanded view
        <ExpandedView
          result={results[selectedIndex]}
          query={query}
          scrollOffset={expandedScrollOffset}
          maxHeight={expandedMaxHeight}
          currentIndex={selectedIndex + 1}
          totalResults={results.length}
        />
      )}
      
      {/* Notification toast */}
      {notification && (
        <Box 
          marginTop={1} 
          borderStyle="round" 
          borderColor="green" 
          paddingX={2}
          paddingY={0}
        >
          <Text color="green">{notification}</Text>
        </Box>
      )}
    </Box>
  );
};
