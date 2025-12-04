/**
 * Chat Layout Switcher
 *
 * Decides which layout to render based on current mode.
 * Each layout creates its OWN instance of ConversationView,
 * preventing the JSX reuse glitch.
 *
 * This is the key component that replaces the old "finalContent" logic.
 */

import React from 'react';
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

export const ChatLayoutSwitcher: React.FC<ChatLayoutSwitcherProps> = ({
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

  // Get execution viewer settings
  const settingsManager = getSettingsManager();
  const executionViewerSettings = settingsManager.getProjectSetting('executionViewer') || {
    enabled: true,
    defaultMode: 'hidden',
    autoShow: true,
    autoHide: false,
    maxExecutionsShown: 10,
    detailsMode: false
  };

  // ============================================
  // SEARCH MODE
  // ============================================
  if (searchMode) {
    if (searchFullscreen) {
      // Fullscreen search results
      return (
        <SearchResults
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
          left={<ConversationView scrollRef={scrollRef} searchMode={true} />}
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
    return (
      <LayoutManager
        conversation={<ConversationView scrollRef={scrollRef} />}
        executionViewer={<ExecutionViewer mode="split" settings={executionViewerSettings} />}
        config={{
          defaultMode: executionViewerSettings.defaultMode,
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
  return <ConversationView scrollRef={scrollRef} />;
};
