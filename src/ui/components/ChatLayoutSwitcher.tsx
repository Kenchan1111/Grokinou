/**
 * Chat Layout Switcher
 *
 * Decides which layout to render based on current mode.
 * Each layout creates its OWN instance of ConversationView,
 * preventing the JSX reuse glitch.
 *
 * This is the key component that replaces the old "finalContent" logic.
 */

import React, { useMemo } from 'react';
import { Box } from 'ink';
import { useChatState } from '../contexts/ChatContext.js';
import { ConversationView } from './ConversationView.js';
import { LayoutManager } from './layout-manager.js';
import { ExecutionViewer } from './execution-viewer.js';
import { SplitLayout } from './search/split-layout.js';
import { SearchResults } from './search/search-results.js';
import { getSettingsManager } from '../../utils/settings-manager.js';

// ============================================================================
// CHAT LAYOUT SWITCHER
// ============================================================================

interface ChatLayoutSwitcherProps {
  /**
   * Scroll ref to pass to ConversationView
   */
  scrollRef?: React.RefObject<any>;

  /**
   * Callbacks for search mode
   */
  onCloseSearch?: () => void;
  onPasteToInput?: (text: string) => void;
  onToggleFullscreen?: () => void;
}

const ChatLayoutSwitcherComponent: React.FC<ChatLayoutSwitcherProps> = ({
  scrollRef,
  onCloseSearch,
  onPasteToInput,
  onToggleFullscreen
}) => {
  // Get state from context
  const {
    searchMode,
    searchQuery,
    searchResults,
    searchFullscreen
  } = useChatState();

  // Get execution viewer settings (memoized to prevent re-renders)
  const executionViewerSettings = useMemo(() => {
    const settingsManager = getSettingsManager();
    return settingsManager.getProjectSetting('executionViewer') || {
      enabled: true,
      defaultMode: 'hidden' as const,
      autoShow: true,
      autoHide: false,
      maxExecutionsShown: 10,
      detailsMode: false
    };
  }, []);

  // ============================================
  // SEARCH MODE
  // ============================================
  if (searchMode) {
    if (searchFullscreen) {
      // Fullscreen search results
      return (
        <SearchResults
          key="search-fullscreen"
          query={searchQuery}
          results={searchResults}
          onClose={onCloseSearch}
          onPasteToInput={onPasteToInput}
          fullscreen={true}
        />
      );
    } else {
      // Split layout: conversation left, search right
      return (
        <SplitLayout
          key="search-split-layout"
          left={<ConversationView key="search-conversation" scrollRef={scrollRef} searchMode={true} />}
          right={
            <SearchResults
              query={searchQuery}
              results={searchResults}
              onClose={onCloseSearch}
              onPasteToInput={onPasteToInput}
              onToggleFullscreen={onToggleFullscreen}
              fullscreen={false}
            />
          }
        />
      );
    }
  }

  // ============================================
  // EXECUTION VIEWER MODE
  // ============================================
  if (executionViewerSettings.enabled) {
    // Add unique keys to prevent JSX reuse and duplication
    return (
      <LayoutManager
        key="viewer-layout"
        conversation={<ConversationView key="viewer-conversation" scrollRef={scrollRef} />}
        executionViewer={<ExecutionViewer key="execution-viewer" mode="split" settings={executionViewerSettings} />}
        config={{
          defaultMode: executionViewerSettings.defaultMode as 'hidden' | 'split' | 'fullscreen',
          autoShow: executionViewerSettings.autoShow,
          autoHide: executionViewerSettings.autoHide,
          splitRatio: 0.6,
          layout: 'horizontal'
        }}
      />
    );
  }

  // ============================================
  // NORMAL MODE (No viewer, no search)
  // ============================================
  return <ConversationView key="normal-conversation" scrollRef={scrollRef} />;
};

// Memoize to prevent re-renders when ChatContext changes but props don't
// Note: React.memo returns true to SKIP re-render (props are equal)
export const ChatLayoutSwitcher = React.memo(ChatLayoutSwitcherComponent);
