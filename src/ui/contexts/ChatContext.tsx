/**
 * Chat Context - Centralized State Management
 *
 * This context separates DATA from VIEWS, solving the "duplicate view" glitch
 * caused by reusing the same JSX element (chatViewContent) in different layouts.
 *
 * Architecture:
 * - ChatContext (Provider): Holds all chat state
 * - Components (Consumers): Each view creates its own JSX from the data
 * - No JSX reuse = No glitch
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { ChatEntry } from '../../agent/grok-agent.js';
import type { ConfirmationOptions } from '../../utils/confirmation-service.js';
import type { SearchResult } from '../../utils/search-manager.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chat state data structure
 * Contains ALL data needed to render conversation views
 */
export interface ChatState {
  // Chat history
  chatHistory: ChatEntry[];
  committedHistory: ChatEntry[];
  activeMessages: ChatEntry[];

  // Streaming state
  isStreaming: boolean;
  streamingContent: string;
  streamingTools: any[];
  streamingToolResults: any[];

  // Processing state
  isProcessing: boolean;
  processingTime: number;
  tokenCount: number;

  // UI state
  showTips: boolean;
  confirmationOptions: ConfirmationOptions | null;

  // Search state
  searchMode: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  searchFullscreen: boolean;
}

/**
 * Chat actions (setters)
 */
export interface ChatActions {
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setCommittedHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setActiveMessages: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSearchResults: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  setSearchFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Combined context value
 */
export interface ChatContextValue {
  state: ChatState;
  actions: ChatActions;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface ChatProviderProps {
  children: ReactNode;
  value: ChatContextValue;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, value }) => {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to access chat state
 * Throws if used outside ChatProvider
 */
export const useChatState = (): ChatState => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatState must be used within ChatProvider');
  }
  return context.state;
};

/**
 * Hook to access chat actions
 * Throws if used outside ChatProvider
 */
export const useChatActions = (): ChatActions => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatActions must be used within ChatProvider');
  }
  return context.actions;
};

/**
 * Hook to access full chat context
 * Throws if used outside ChatProvider
 */
export const useChatContext = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};
