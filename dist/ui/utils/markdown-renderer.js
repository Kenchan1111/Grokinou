import React, { useMemo } from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
// Configure marked to use the terminal renderer with default settings
marked.setOptions({
    renderer: new TerminalRenderer()
});
export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }) {
    const rendered = useMemo(() => {
        try {
            const result = marked.parse(content);
            return typeof result === 'string' ? result : content;
        }
        catch {
            return content;
        }
    }, [content]);
    return React.createElement(Text, null, rendered);
});
//# sourceMappingURL=markdown-renderer.js.map