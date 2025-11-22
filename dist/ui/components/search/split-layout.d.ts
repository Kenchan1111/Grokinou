import React from 'react';
interface SplitLayoutProps {
    left: React.ReactNode;
    right: React.ReactNode;
    splitRatio?: number;
    showBorder?: boolean;
}
/**
 * Split screen layout component
 */
export declare const SplitLayout: React.FC<SplitLayoutProps>;
export {};
