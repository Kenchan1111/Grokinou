import React from "react";
import { Box, Text } from "ink";

interface ModelOption {
  model: string;
}

interface ModelSelectionProps {
  models: ModelOption[];
  selectedIndex: number;
  isVisible: boolean;
  currentModel: string;
}

export function ModelSelection({
  models,
  selectedIndex,
  isVisible,
  currentModel,
}: ModelSelectionProps) {
  if (!isVisible) return null;

  // Pagination: Show 15 models at a time, centered on selection
  const WINDOW_SIZE = 15;
  const halfWindow = Math.floor(WINDOW_SIZE / 2);

  let startIdx = Math.max(0, selectedIndex - halfWindow);
  let endIdx = Math.min(models.length, startIdx + WINDOW_SIZE);

  // Adjust if we're near the end
  if (endIdx - startIdx < WINDOW_SIZE) {
    startIdx = Math.max(0, endIdx - WINDOW_SIZE);
  }

  const visibleModels = models.slice(startIdx, endIdx);
  const hiddenAbove = startIdx;
  const hiddenBelow = models.length - endIdx;

  return (
    <Box marginTop={1} flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan">
          Select Grok Model (current: {currentModel}) [{selectedIndex + 1}/{models.length}]
        </Text>
      </Box>

      {hiddenAbove > 0 && (
        <Box paddingLeft={1}>
          <Text color="gray" dimColor>
            ... ({hiddenAbove} more above)
          </Text>
        </Box>
      )}

      {visibleModels.map((modelOption, visibleIndex) => {
        const actualIndex = startIdx + visibleIndex;
        return (
          <Box key={actualIndex} paddingLeft={1}>
            <Text
              color={actualIndex === selectedIndex ? "black" : "white"}
              backgroundColor={actualIndex === selectedIndex ? "cyan" : undefined}
            >
              {modelOption.model}
            </Text>
          </Box>
        );
      })}

      {hiddenBelow > 0 && (
        <Box paddingLeft={1}>
          <Text color="gray" dimColor>
            ... ({hiddenBelow} more below)
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter/Tab select • Esc cancel
        </Text>
      </Box>
    </Box>
  );
}
