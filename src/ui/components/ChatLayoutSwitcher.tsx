/**
 * Chat Layout Switcher - Smooth Transitions Edition
 *
 * Uses display-based rendering instead of conditional mounting to eliminate:
 * - Unmount/remount glitches during mode transitions
 * - Scroll position loss
 * - Flash/blink visual artifacts
 *
 * All layouts are mounted once and toggled via CSS display property.
 * This preserves component state and enables smooth transitions.
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
import type { ConfirmationOptions } from '../../utils/confirmation-service.js';

// ============================================================================
// CHAT LAYOUT SWITCHER - SMOOTH MODE
// ============================================================================

interface ChatLayoutSwitcherProps {
  /**
   * Render key to force re-render of ConversationView (prevents ghost duplication)
   */
  renderKey?: number;

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

  /**
   * Confirmation dialog props (passed down to ConversationView)
   */
  confirmationOptions?: ConfirmationOptions | null;
  onConfirmation?: (dontAskAgain?: boolean) => void;
  onRejection?: (feedback?: string) => void;

  /**
   * Input controller to render (placed appropriately based on mode)
   */
  inputController?: React.ReactNode;
}

const ChatLayoutSwitcherComponent: React.FC<ChatLayoutSwitcherProps> = ({
  renderKey = 0,
  scrollRef,
  onCloseSearch,
  onPasteToInput,
  onToggleFullscreen,
  confirmationOptions,
  onConfirmation,
  onRejection,
  inputController
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
      maxExecutionsShown: 1000,
      detailsMode: false
    };
  }, []);

  const viewerEnabled = executionViewerSettings.enabled;

  // Calculate which layout should be visible
  const isNormalMode = !searchMode && !viewerEnabled;
  const isViewerMode = !searchMode && viewerEnabled;
  const isSearchMode = searchMode;

  // All layouts are always mounted, visibility controlled by display
  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* ============================================
          NORMAL MODE (No viewer, no search) - Conditional rendering
          ============================================ */}
      {isNormalMode && (
        <Box
          flexDirection="column"
          width="100%"
          height="100%"
        >
          <ConversationView
            key={`normal-conversation-${renderKey}`}
            scrollRef={scrollRef}
            confirmationOptions={confirmationOptions}
            onConfirmation={onConfirmation}
            onRejection={onRejection}
          >
            {inputController}
          </ConversationView>
        </Box>
      )}

      {/* ============================================
          EXECUTION VIEWER MODE - Conditional rendering
          ============================================ */}
      {isViewerMode && (
        <Box
          flexDirection="column"
          width="100%"
          height="100%"
        >
          <LayoutManager
            key="viewer-layout"
            conversation={
              <ConversationView
                key={`viewer-conversation-${renderKey}`}
                scrollRef={scrollRef}
                confirmationOptions={confirmationOptions}
                onConfirmation={onConfirmation}
                onRejection={onRejection}
              >
                {inputController}
              </ConversationView>
            }
            executionViewer={<ExecutionViewer key="execution-viewer" mode="split" settings={executionViewerSettings} />}
            config={{
              defaultMode: executionViewerSettings.defaultMode as 'hidden' | 'split' | 'fullscreen',
              autoShow: executionViewerSettings.autoShow,
              autoHide: executionViewerSettings.autoHide,
              splitRatio: 0.6,
              layout: 'horizontal'
            }}
          />
        </Box>
      )}

      {/* ============================================
          SEARCH MODE (conditional rendering to avoid useInput issues)
          ============================================ */}
      {isSearchMode && (
        <Box
          flexDirection="column"
          width="100%"
          height="100%"
        >
          {searchFullscreen ? (
            // Fullscreen search results
            <SearchResults
              key="search-fullscreen"
              query={searchQuery}
              results={searchResults}
              onClose={onCloseSearch}
              onPasteToInput={onPasteToInput}
              fullscreen={true}
            />
          ) : (
            // Split layout: conversation left, search right
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
          )}
        </Box>
      )}
    </Box>
  );
};

// Memoize to prevent re-renders when ChatContext changes but props don't
// Note: React.memo returns true to SKIP re-render (props are equal)
export const ChatLayoutSwitcher = React.memo(ChatLayoutSwitcherComponent);
