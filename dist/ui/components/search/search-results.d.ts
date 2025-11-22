import React from 'react';
import { SearchResult } from '../../../utils/search-manager.js';
interface SearchResultsProps {
    query: string;
    results: SearchResult[];
    onClose: () => void;
    onPasteToInput?: (text: string) => void;
    onToggleFullscreen?: () => void;
    fullscreen?: boolean;
}
/**
 * Main search results component with list and expanded modes
 */
export declare const SearchResults: React.FC<SearchResultsProps>;
export {};
