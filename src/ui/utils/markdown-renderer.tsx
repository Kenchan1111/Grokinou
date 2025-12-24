import React, { useMemo } from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked to use the terminal renderer with sane defaults
// and a dynamic width based on the current terminal.
const renderer = new (TerminalRenderer as any)({
  reflowText: true,
  width: process.stdout?.columns || 80,
});

marked.setOptions({ renderer });

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: { content: string }) {
  const rendered = useMemo(() => {
    try {
      const result = marked.parse(content);
      const resultString = typeof result === 'string' ? result : content;
      // Normalize spacing: collapse multiple blank lines, trim trailing
      return resultString.replace(/\n{3,}/g, '\n\n').trimEnd();
    } catch {
      return content;
    }
  }, [content]);

  return <Text wrap="wrap">{rendered}</Text>;
});
