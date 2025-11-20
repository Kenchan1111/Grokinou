import React from 'react';
import { Box, useStdout } from 'ink';

interface SplitLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  splitRatio?: number; // 0.5 = 50/50
  showBorder?: boolean;
}

/**
 * Split screen layout component
 */
export const SplitLayout: React.FC<SplitLayoutProps> = ({
  left,
  right,
  splitRatio = 0.5,
  showBorder = true,
}) => {
  const { stdout } = useStdout();
  const totalWidth = stdout?.columns || 80;
  const totalHeight = (stdout?.rows || 24) - 6; // Reserve space for margins
  
  const leftWidth = Math.floor(totalWidth * splitRatio);
  const rightWidth = totalWidth - leftWidth - (showBorder ? 1 : 0); // Account for border

  return (
    <Box flexDirection="row" width={totalWidth} height={totalHeight} overflow="hidden">
      <Box 
        width={leftWidth} 
        height="100%"
        flexDirection="column"
        borderStyle={showBorder ? 'single' : undefined}
        borderRight={showBorder}
        paddingRight={showBorder ? 1 : 0}
        overflow="hidden"
      >
        {left}
      </Box>
      
      <Box 
        width={rightWidth}
        height="100%"
        flexDirection="column"
        paddingLeft={showBorder ? 1 : 0}
        overflow="hidden"
      >
        {right}
      </Box>
    </Box>
  );
};
