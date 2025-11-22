import React from 'react';
import { SearchResult } from '../../../utils/search-manager.js';
interface SearchResultItemProps {
    result: SearchResult;
    query: string;
    isSelected: boolean;
    index: number;
    total: number;
    compact?: boolean;
}
export declare const SearchResultItem: React.NamedExoticComponent<SearchResultItemProps>;
export {};
