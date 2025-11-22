import React from 'react';
interface HighlightedTextProps {
    text: string;
    pattern: string;
    highlightColor?: string;
    highlightBg?: string;
}
/**
 * Component to highlight search pattern in text
 */
export declare const HighlightedText: React.FC<HighlightedTextProps>;
export {};
