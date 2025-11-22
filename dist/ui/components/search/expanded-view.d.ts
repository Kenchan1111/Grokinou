import React from 'react';
import { SearchResult } from '../../../utils/search-manager.js';
interface ExpandedViewProps {
    result: SearchResult;
    query: string;
    scrollOffset: number;
    maxHeight: number;
    currentIndex: number;
    totalResults: number;
}
/**
 * Expanded view of a single search result (scrollable)
 */
export declare const ExpandedView: React.FC<ExpandedViewProps>;
export {};
