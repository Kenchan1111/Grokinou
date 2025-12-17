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
      const resultString = typeof result === 'string' ? result : content;
      // ✅ Reduce spacing: replace double newlines with single newlines
      //    Makes paragraphs more compact (one blank line instead of two)
      return resultString.replace(/\n\n+/g, '\n');
    } catch {
      return content;
    }
  }, [content]);

  return <Text wrap="wrap">{rendered}</Text>;
});
