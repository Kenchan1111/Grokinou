import { useState, useCallback, useRef, useEffect } from "react";
import {
  deleteCharBefore,
  deleteCharAfter,
  deleteWordBefore,
  deleteWordAfter,
  insertText,
  moveToLineStart,
  moveToLineEnd,
  moveToPreviousWord,
  moveToNextWord,
} from "../utils/text-utils.js";
import { useInputHistory } from "./use-input-history.js";
import { pasteManager } from "../utils/paste-manager.js";
import { pasteBurstDetector } from "../utils/paste-burst-detector.js";
import { imagePathManager } from "../utils/image-path-detector.js";
import { debugLog } from "../utils/debug-logger.js";

export interface Key {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  paste?: boolean;
  sequence?: string;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
}

export interface EnhancedInputHook {
  input: string;
  cursorPosition: number;
  isMultiline: boolean;
  setInput: (text: string) => void;
  setCursorPosition: (position: number) => void;
  clearInput: () => void;
  insertAtCursor: (text: string) => void;
  resetHistory: () => void;
  handleInput: (inputChar: string, key: Key) => void;
}

interface UseEnhancedInputProps {
  onSubmit?: (text: string) => void;
  onEscape?: () => void;
  onSpecialKey?: (key: Key) => boolean; // Return true to prevent default handling
  disabled?: boolean;
  multiline?: boolean;
}

export function useEnhancedInput({
  onSubmit,
  onEscape,
  onSpecialKey,
  disabled = false,
  multiline = false,
}: UseEnhancedInputProps = {}): EnhancedInputHook {
  // Batch input and cursor state together to prevent double re-renders
  const [inputState, setInputAndCursor] = useState({ text: "", cursor: 0 });
  const input = inputState.text;
  const cursorPosition = inputState.cursor;
  const isMultilineRef = useRef(multiline);
  
  // Use refs to avoid recreating handleInput on every change
  const inputRef = useRef(input);
  const cursorRef = useRef(cursorPosition);
  useEffect(() => {
    inputRef.current = input;
    cursorRef.current = cursorPosition;
  }, [input, cursorPosition]);
  
  // Helper to update both at once
  const setInputState = useCallback((text: string) => {
    setInputAndCursor(prev => ({ text, cursor: Math.min(text.length, prev.cursor) }));
  }, []);
  
  const setCursorPositionState = useCallback((position: number) => {
    setInputAndCursor(prev => ({ text: prev.text, cursor: Math.max(0, Math.min(prev.text.length, position)) }));
  }, []);
  
  const {
    addToHistory,
    navigateHistory,
    resetHistory,
    setOriginalInput,
    isNavigatingHistory,
  } = useInputHistory();

  const setInput = useCallback((text: string) => {
    setInputAndCursor({ text, cursor: Math.min(text.length, cursorPosition) });
    if (!isNavigatingHistory()) {
      setOriginalInput(text);
    }
  }, [cursorPosition, isNavigatingHistory, setOriginalInput]);

  const setCursorPosition = useCallback((position: number) => {
    setInputAndCursor(prev => ({ text: prev.text, cursor: Math.max(0, Math.min(prev.text.length, position)) }));
  }, []);

  const clearInput = useCallback(() => {
    setInputAndCursor({ text: "", cursor: 0 });
    setOriginalInput("");
  }, [setOriginalInput]);

  const insertAtCursor = useCallback((text: string) => {
    console.log('[insertAtCursor] CALLED with text length:', text.length, 'preview:', text.substring(0, 30));
    const result = insertText(input, cursorPosition, text);
    console.log('[insertAtCursor] Setting input to:', result.text.substring(0, 30), 'cursor:', result.position);
    setInputAndCursor({ text: result.text, cursor: result.position });
    setOriginalInput(result.text);
  }, [input, cursorPosition, setOriginalInput]);

  const handleSubmit = useCallback(() => {
    if (input.trim()) {
      addToHistory(input);
      onSubmit?.(input);
      clearInput();
    }
  }, [input, addToHistory, onSubmit, clearInput]);

  const handleInput = useCallback((inputChar: string, key: Key) => {
    if (disabled) return;
    
    // Use refs to get current values without depending on them
    const currentInput = inputRef.current;
    const currentCursor = cursorRef.current;

    // Handle Ctrl+C - check multiple ways it could be detected
    if ((key.ctrl && inputChar === "c") || inputChar === "\x03") {
      setInputAndCursor({ text: "", cursor: 0 });
      setOriginalInput("");
      return;
    }

    // Allow special key handler to override default behavior
    if (onSpecialKey?.(key)) {
      return;
    }

    // Handle Escape
    if (key.escape) {
      onEscape?.();
      return;
    }

    // Handle Enter/Return
    if (key.return) {
      if (multiline && key.shift) {
        // Shift+Enter in multiline mode inserts newline
        const result = insertText(currentInput, currentCursor, "\n");
        setInputAndCursor({ text: result.text, cursor: result.position });
        setOriginalInput(result.text);
      } else {
        handleSubmit();
      }
      return;
    }

    // Handle history navigation
    if ((key.upArrow || key.name === 'up') && !key.ctrl && !key.meta) {
      const historyInput = navigateHistory("up");
      if (historyInput !== null) {
        setInputAndCursor({ text: historyInput, cursor: historyInput.length });
      }
      return;
    }

    if ((key.downArrow || key.name === 'down') && !key.ctrl && !key.meta) {
      const historyInput = navigateHistory("down");
      if (historyInput !== null) {
        setInputAndCursor({ text: historyInput, cursor: historyInput.length });
      }
      return;
    }

    // Handle cursor movement - ignore meta flag for arrows as it's unreliable in terminals
    // Only do word movement if ctrl is pressed AND no arrow escape sequence is in inputChar
    if ((key.leftArrow || key.name === 'left') && key.ctrl && !inputChar.includes('[')) {
      const newPos = moveToPreviousWord(currentInput, currentCursor);
      setCursorPositionState(newPos);
      return;
    }

    if ((key.rightArrow || key.name === 'right') && key.ctrl && !inputChar.includes('[')) {
      const newPos = moveToNextWord(currentInput, currentCursor);
      setCursorPositionState(newPos);
      return;
    }

    // Handle regular cursor movement - single character (ignore meta flag)
    if (key.leftArrow || key.name === 'left') {
      const newPos = Math.max(0, currentCursor - 1);
      setCursorPositionState(newPos);
      return;
    }

    if (key.rightArrow || key.name === 'right') {
      const newPos = Math.min(currentInput.length, currentCursor + 1);
      setCursorPositionState(newPos);
      return;
    }

    // Handle Home/End keys or Ctrl+A/E
    if ((key.ctrl && inputChar === "a") || key.name === "home") {
      setCursorPositionState(0); // Simple start of input
      return;
    }

    if ((key.ctrl && inputChar === "e") || key.name === "end") {
      setCursorPositionState(currentInput.length); // Simple end of input
      return;
    }

    // Handle deletion - check multiple ways backspace might be detected
    // Backspace can be detected in different ways depending on terminal
    // In some terminals, backspace shows up as delete:true with empty inputChar
    const isBackspace = key.backspace || 
                       key.name === 'backspace' || 
                       inputChar === '\b' || 
                       inputChar === '\x7f' ||
                       (key.delete && inputChar === '' && !key.shift);
                       
    if (isBackspace) {
      // Check if cursor is at the end of a paste placeholder (atomic delete)
      const pastePlaceholderInfo = pasteManager.findPlaceholderAtCursor(currentInput, currentCursor);
      if (pastePlaceholderInfo) {
        const { placeholder, start, end } = pastePlaceholderInfo;
        const newInput = currentInput.slice(0, start) + currentInput.slice(end);
        pasteManager.removeByPlaceholder(placeholder);
        setInputAndCursor({ text: newInput, cursor: start });
        setOriginalInput(newInput);
        return;
      }

      // Check if cursor is at the end of an image placeholder (atomic delete)
      const imagePlaceholderInfo = imagePathManager.findImagePlaceholderAtCursor(currentInput, currentCursor);
      if (imagePlaceholderInfo) {
        const { placeholder, start, end } = imagePlaceholderInfo;
        const newInput = currentInput.slice(0, start) + currentInput.slice(end);
        imagePathManager.removeImage(placeholder);
        setInputAndCursor({ text: newInput, cursor: start });
        setOriginalInput(newInput);
        return;
      }

      if (key.ctrl || key.meta) {
        // Ctrl/Cmd + Backspace: Delete word before cursor
        const result = deleteWordBefore(currentInput, currentCursor);
        setInputAndCursor({ text: result.text, cursor: result.position });
        setOriginalInput(result.text);
      } else {
        // Regular backspace
        const result = deleteCharBefore(currentInput, currentCursor);
        setInputAndCursor({ text: result.text, cursor: result.position });
        setOriginalInput(result.text);
      }
      return;
    }

    // Handle forward delete (Del key) - but not if it was already handled as backspace above
    if ((key.delete && inputChar !== '') || (key.ctrl && inputChar === "d")) {
      if (key.ctrl || key.meta) {
        // Ctrl/Cmd + Delete: Delete word after cursor
        const result = deleteWordAfter(currentInput, currentCursor);
        setInputAndCursor({ text: result.text, cursor: result.position });
        setOriginalInput(result.text);
      } else {
        // Regular delete
        const result = deleteCharAfter(currentInput, currentCursor);
        setInputAndCursor({ text: result.text, cursor: result.position });
        setOriginalInput(result.text);
      }
      return;
    }

    // Handle Ctrl+K: Delete from cursor to end of line
    if (key.ctrl && inputChar === "k") {
      const lineEnd = moveToLineEnd(currentInput, currentCursor);
      const newText = currentInput.slice(0, currentCursor) + currentInput.slice(lineEnd);
      setInputState(newText);
      setOriginalInput(newText);
      return;
    }

    // Handle Ctrl+U: Delete from cursor to start of line
    if (key.ctrl && inputChar === "u") {
      const lineStart = moveToLineStart(currentInput, currentCursor);
      const newText = currentInput.slice(0, lineStart) + currentInput.slice(currentCursor);
      setInputAndCursor({ text: newText, cursor: lineStart });
      setOriginalInput(newText);
      return;
    }

    // Handle Ctrl+W: Delete word before cursor
    if (key.ctrl && inputChar === "w") {
      const result = deleteWordBefore(currentInput, currentCursor);
      setInputAndCursor({ text: result.text, cursor: result.position });
      setOriginalInput(result.text);
      return;
    }

    // Handle Ctrl+X: Clear entire input
    if (key.ctrl && inputChar === "x") {
      setInputAndCursor({ text: "", cursor: 0 });
      setOriginalInput("");
      return;
    }

    // Handle regular character input
    if (inputChar && !key.ctrl && !key.meta) {
      // Use paste burst detector to buffer rapid inputs (paste chunks)
      const shouldBuffer = pasteBurstDetector.handleInput(inputChar, (bufferedContent) => {
        // This callback is called after the burst ends (100ms timeout)
        // Process the complete buffered content
        debugLog.log('[use-enhanced-input] Paste burst callback fired! Content length:', bufferedContent.length);

        // First, check if it's an image path (like Codex does)
        const imageResult = imagePathManager.processPaste(bufferedContent);
        debugLog.log('[use-enhanced-input] Image detection result:', imageResult.isImage);

        if (imageResult.isImage) {
          // It's an image path! Insert placeholder
          // Use functional state update to avoid stale ref values
          let newText = '';
          setInputAndCursor(prev => {
            const result = insertText(prev.text, prev.cursor, imageResult.textToInsert);
            newText = result.text;
            return { text: result.text, cursor: result.position };
          });
          setOriginalInput(newText);
        } else {
          // Not an image, check if it's large text
          const { textToInsert } = pasteManager.processPaste(bufferedContent);
          // Use functional state update to avoid stale ref values
          let newText = '';
          setInputAndCursor(prev => {
            // Check if cursor is right after another placeholder - add space separator
            let finalTextToInsert = textToInsert;
            if (textToInsert.startsWith('[Pasted ') && prev.cursor > 0) {
              const beforeCursor = prev.text.slice(Math.max(0, prev.cursor - 10), prev.cursor);
              if (beforeCursor.endsWith('chars]')) {
                finalTextToInsert = ' ' + textToInsert; // Add space between consecutive placeholders
              }
            }
            
            const result = insertText(prev.text, prev.cursor, finalTextToInsert);
            newText = result.text;
            return { text: result.text, cursor: result.position };
          });
          setOriginalInput(newText);
        }
      });

      // If buffering, don't insert yet (wait for flush)
      if (!shouldBuffer) {
        // Normal single character typing (not a paste burst)
        const result = insertText(currentInput, currentCursor, inputChar);
        setInputAndCursor({ text: result.text, cursor: result.position });
        setOriginalInput(result.text);
      }
    }
  }, [disabled, onSpecialKey, multiline, handleSubmit, navigateHistory, setOriginalInput]);

  return {
    input,
    cursorPosition,
    isMultiline: isMultilineRef.current,
    setInput,
    setCursorPosition,
    clearInput,
    insertAtCursor,
    resetHistory,
    handleInput,
  };
}