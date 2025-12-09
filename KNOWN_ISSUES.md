# Known Issues

## Paste with Leading Empty Lines

**Status**: Known limitation with Xubuntu clipboard manager
**Severity**: Medium
**Platform**: Xubuntu with xfce4-clipman or similar clipboard managers

### Problem
When pasting text that begins with one or more empty lines (newline characters), the paste does not appear in the input prompt. The clipboard content is lost before reaching the application.

### Root Cause
The Xubuntu clipboard manager's interactive paste dialog treats leading newlines as "Enter" key presses, which can trigger a submit action or clear the buffer before the rest of the content is transmitted to the application via Ink's `useInput` hook.

### Evidence
- Debug logs show NO input events when pasting text with leading `\n`
- The same text pastes successfully when leading empty lines are removed
- `key.paste` is always `undefined` in this terminal environment
- Large text chunks (>50 chars) arrive successfully when no leading newlines

### Workaround
**Current**: Manually remove leading empty lines from the clipboard dialog before confirming the paste.

### Potential Solutions (for future implementation)
1. **Node.js clipboard monitoring**: Use `clipboardy` or similar package to monitor and clean clipboard content before paste
2. **Disable Xubuntu clipboard manager**: Configure terminal to use native paste instead
3. **Input preprocessing**: Attempt to detect and handle the "Enter" event that comes from the leading newline

### Related Files
- `src/hooks/use-input-handler.ts` - Timing-based paste detection (detects >50 char chunks and rapid input bursts)
- `src/utils/paste-manager.ts` - Trims content but only AFTER it's received
- `src/utils/paste-burst-detector.ts` - Buffers fragmented pastes

### Test Case
```
Paste this text with leading newline:

## Test Content
This should create a placeholder but doesn't work with leading empty line.
```

**Expected**: `[Pasted XXX chars]` placeholder appears
**Actual**: Nothing appears, no input events logged
**Works if**: First empty line is removed
