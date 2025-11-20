import React, { useMemo } from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked to use the terminal renderer with default settings
marked.setOptions({
  renderer: new (TerminalRenderer as any)()
});

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: { content: string }) {
  const rendered = useMemo(() => {
    try {
      const result = marked.parse(content);
      return typeof result === 'string' ? result : content;
    } catch {
      return content;
    }
  }, [content]);

  return <Text>{rendered}</Text>;
});
