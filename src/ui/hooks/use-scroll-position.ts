import { useEffect, useRef } from 'react';
import { useStdout } from 'ink';

/**
 * Custom hook to preserve scroll position during re-renders
 *
 * Uses ANSI escape codes to save and restore cursor position:
 * - \x1b[s : Save cursor position
 * - \x1b[u : Restore cursor position
 * - \x1b[?25l : Hide cursor
 * - \x1b[?25h : Show cursor
 */
export function useScrollPosition(enabled: boolean = true) {
  const { stdout } = useStdout();
  const savedPosition = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !stdout) return;

    // Save cursor position before render
    const saveCursorPosition = () => {
      if (stdout.isTTY) {
        stdout.write('\x1b[s'); // Save cursor position
        savedPosition.current = true;
      }
    };

    // Restore cursor position after render
    const restoreCursorPosition = () => {
      if (stdout.isTTY && savedPosition.current) {
        stdout.write('\x1b[u'); // Restore cursor position
      }
    };

    saveCursorPosition();

    // Restore on cleanup
    return () => {
      restoreCursorPosition();
    };
  }, [enabled, stdout]);

  return {
    saveCursor: () => {
      if (stdout?.isTTY) {
        stdout.write('\x1b[s');
        savedPosition.current = true;
      }
    },
    restoreCursor: () => {
      if (stdout?.isTTY && savedPosition.current) {
        stdout.write('\x1b[u');
      }
    },
    hideCursor: () => {
      if (stdout?.isTTY) {
        stdout.write('\x1b[?25l');
      }
    },
    showCursor: () => {
      if (stdout?.isTTY) {
        stdout.write('\x1b[?25h');
      }
    }
  };
}
