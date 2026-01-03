# Report for Claude: Split View Input Focus Fix

## Problem
When using split view, arrow keys were affecting both the Execution Viewer and the conversation/input, causing:
- execution selection to change
- conversation/input to scroll or re-render
- visible duplication/flicker

Root cause:
- `ExecutionViewer` listens to all arrow keys via `useInput` regardless of focus.
- Input layer also listens to arrows (history/cursor), so both respond simultaneously.
- Focus is tracked in `LayoutManager` but not enforced for input handlers.

## Fix Summary
### 1) Gate ExecutionViewer input by focus
- `ExecutionViewer` now accepts `isFocused` and ignores keyboard input when not focused in split mode.
- `LayoutManager` clones the viewer element and injects `isFocused` based on local focus state.

Files:
- `src/ui/components/execution-viewer.tsx`
- `src/ui/components/layout-manager.tsx`

### 2) Gate input handler when viewer is focused
- `InputController` accepts `inputEnabled` and forwards to `useInputHandler`.
- `useInputHandler` passes `disabled` into `useEnhancedInput` and exits early in its `useInput` hook when input is disabled.
- `ChatInterface` tracks `viewerFocused` from `LayoutManager` and disables input when focus is on viewer.

Files:
- `src/ui/components/input-controller.tsx`
- `src/hooks/use-input-handler.ts`
- `src/ui/components/chat-interface.tsx`
- `src/ui/components/ChatLayoutSwitcher.tsx`
- `src/ui/components/layout-manager.tsx`

## Behavior Changes
- When focus is on conversation: viewer ignores arrows; input works normally.
- When focus is on viewer: input ignores arrows; viewer handles navigation.
- Fullscreen viewer forces focus to viewer.

## Validation Steps
1) Enter split mode, ensure focus = conversation.
2) Press ↑/↓: input history moves, viewer selection stays.
3) Press Tab to focus viewer.
4) Press ↑/↓: viewer selection changes, input remains stable.
5) Press Tab back to conversation.

---
If you want, I can add a small visual indicator when focus changes.
