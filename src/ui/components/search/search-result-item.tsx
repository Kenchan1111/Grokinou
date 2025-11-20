import React from 'react';
import { Box, Text } from 'ink';
import { SearchResult } from '../../../utils/search-manager.js';
import { HighlightedText } from './highlighted-text.js';

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  isSelected: boolean;
  index: number;
  total: number;
  compact?: boolean;
}

/**
 * Single search result item (compact view)
 */
const SearchResultItemComponent: React.FC<SearchResultItemProps> = ({
  result,
  query,
  isSelected,
  index,
  total,
  compact = true,
}) => {
  const { message, session } = result;
  
  // Truncate content for compact view
  const truncateContent = (text: string, maxLength = 120): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const roleIcon = message.role === 'user' ? '👤' : '🤖';
  const borderStyle = isSelected ? 'double' : 'single';
  const borderColor = isSelected ? 'cyan' : 'gray';

  return (
    <Box 
      flexDirection="column" 
      borderStyle={borderStyle}
      borderColor={borderColor}
      paddingX={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box>
        <Text bold color={isSelected ? 'cyan' : 'white'}>
          [{index}/{total}] Session #{session.id} - {session.sessionDate}
        </Text>
      </Box>
      
      {/* Message content */}
      <Box marginTop={0} flexDirection="column">
        <Box>
          <Text dimColor>{roleIcon} </Text>
          {compact ? (
            <Text>
              <HighlightedText 
                text={truncateContent(message.content)} 
                pattern={query}
              />
            </Text>
          ) : (
            <HighlightedText 
              text={message.content} 
              pattern={query}
            />
          )}
        </Box>
      </Box>
      
      {/* Metadata */}
      {!compact && (
        <Box marginTop={1}>
          <Text dimColor>
            {session.provider} ({session.model}) • {result.matchCount} matches
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Memoize to prevent re-renders when only selection changes
export const SearchResultItem = React.memo(SearchResultItemComponent, (prevProps, nextProps) => {
  // Only re-render if the item's selection state changed or content changed
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.result.message.id === nextProps.result.message.id &&
    prevProps.query === nextProps.query &&
    prevProps.index === nextProps.index
  );
});
