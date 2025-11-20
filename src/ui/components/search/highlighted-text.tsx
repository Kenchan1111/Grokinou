import React from 'react';
import { Text } from 'ink';

interface HighlightedTextProps {
  text: string;
  pattern: string;
  highlightColor?: string;
  highlightBg?: string;
}

/**
 * Component to highlight search pattern in text
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  pattern,
  highlightColor = 'black',
  highlightBg = 'yellow',
}) => {
  if (!pattern) {
    return <Text>{text}</Text>;
  }

  // Escape regex special characters
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  try {
    const regex = new RegExp(`(${escapedPattern})`, 'gi');
    const parts = text.split(regex);

    return (
      <Text>
        {parts.map((part, i) => {
          // Check if this part matches the pattern
          const isMatch = new RegExp(`^${escapedPattern}$`, 'i').test(part);
          
          if (isMatch) {
            return (
              <Text key={i} backgroundColor={highlightBg} color={highlightColor} bold>
                {part}
              </Text>
            );
          }
          
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  } catch (error) {
    // Fallback if regex fails
    return <Text>{text}</Text>;
  }
};
