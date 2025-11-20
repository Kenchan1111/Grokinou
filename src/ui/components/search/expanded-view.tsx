import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { SearchResult } from '../../../utils/search-manager.js';
import { HighlightedText } from './highlighted-text.js';

interface ExpandedViewProps {
  result: SearchResult;
  query: string;
  scrollOffset: number;
  maxHeight: number;
  currentIndex: number;
  totalResults: number;
}

/**
 * Expanded view of a single search result (scrollable)
 */
export const ExpandedView: React.FC<ExpandedViewProps> = ({
  result,
  query,
  scrollOffset,
  maxHeight,
  currentIndex,
  totalResults,
}) => {
  const { message, session, contextBefore, contextAfter } = result;
  
  // Split content into lines for scrolling
  const contentLines = useMemo(() => {
    const lines: Array<{ type: 'header' | 'content' | 'separator'; text: string; role?: string }> = [];
    
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
  
  return (
    <Box flexDirection="column" height={maxHeight}>
      {/* Header */}
      <Box borderStyle="single" borderBottom paddingX={1}>
        <Text bold color="cyan">
          🔍 Result [{currentIndex}/{totalResults}] - "{query}"
        </Text>
      </Box>
      
      {/* Content (scrollable) */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {visibleLines.map((line, i) => {
          const hasMatch = line.text.toLowerCase().includes(query.toLowerCase());
          
          if (line.type === 'header') {
            return (
              <Box key={i}>
                <Text bold color="cyan">{line.text}</Text>
              </Box>
            );
          }
          
          if (line.type === 'separator') {
            return (
              <Box key={i}>
                <Text dimColor>{line.text}</Text>
              </Box>
            );
          }
          
          return (
            <Box key={i}>
              <HighlightedText text={line.text} pattern={query} />
            </Box>
          );
        })}
      </Box>
      
      {/* Footer with scroll indicator and help */}
      <Box borderStyle="single" borderTop paddingX={1} flexDirection="column">
        <Box justifyContent="space-between">
          <Text dimColor>
            {canScrollDown ? '⬇' : ' '} Scroll: {scrollPercentage}% {canScrollUp ? '⬆' : ' '}
          </Text>
          <Text dimColor>
            {contentLines.length} lines (showing {visibleLines.length})
          </Text>
        </Box>
        
        <Box marginTop={0}>
          <Text dimColor>
            ↑/↓ Scroll • PgUp/PgDn Page • n/p Next/Prev • ^S Copy • Esc Back
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
