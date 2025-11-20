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
  
  const leftWidth = Math.floor(totalWidth * splitRatio);
  const rightWidth = totalWidth - leftWidth - (showBorder ? 1 : 0); // Account for border

  return (
    <Box flexDirection="row" width={totalWidth}>
      <Box 
        width={leftWidth} 
        flexDirection="column"
        borderStyle={showBorder ? 'single' : undefined}
        borderRight={showBorder}
        paddingRight={showBorder ? 1 : 0}
      >
        {left}
      </Box>
      
      <Box 
        width={rightWidth} 
        flexDirection="column"
        paddingLeft={showBorder ? 1 : 0}
      >
        {right}
      </Box>
    </Box>
  );
};
