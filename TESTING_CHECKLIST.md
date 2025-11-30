# ✅ Testing Checklist - Command Validation

**Purpose:** Systematic validation of all Grokinou commands  
**Version:** 2.0.0  
**Last Updated:** 2025-11-30

---

## 📋 How to Use This Checklist

1. **Test each command** listed below
2. **Check all boxes** for each test case
3. **Document failures** in the "Issues Found" section
4. **Re-test** after fixes until all boxes checked
5. **Sign off** when complete

---

## 🎯 Testing Progress

**Overall Progress:** 0/87 tests (0%)

**By Category:**
- [ ] General Commands (0/7)
- [ ] Search Commands (0/4)
- [ ] Session Management (0/14)
- [ ] Timeline & Time Machine (0/18)
- [ ] Model & Provider (0/11)
- [ ] Git Integration (0/3)
- [ ] Edge Cases (0/6)

---

## 1️⃣ General Commands (7 tests)

### `/help`

- [ ] **T1.1:** Help text displays
- [ ] **T1.2:** All commands listed
- [ ] **T1.3:** Format is readable
- [ ] **T1.4:** No errors

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/status`

- [ ] **T2.1:** Model name displayed
- [ ] **T2.2:** Provider identified
- [ ] **T2.3:** API key status shown
- [ ] **T2.4:** Current directory shown
- [ ] **T2.5:** All info accurate

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/clear`

- [ ] **T3.1:** Chat history cleared (with messages)
- [ ] **T3.2:** Database cleared
- [ ] **T3.3:** Success message shown
- [ ] **T3.4:** Works when already empty (idempotent)
- [ ] **T3.5:** No errors

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/clear-session`

- [ ] **T4.1:** In-memory conversation cleared
- [ ] **T4.2:** Database unchanged
- [ ] **T4.3:** Success message shown
- [ ] **T4.4:** No errors

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/clear-disk-session`

- [ ] **T5.1:** In-memory conversation cleared
- [ ] **T5.2:** Database session deleted
- [ ] **T5.3:** Success message shown
- [ ] **T5.4:** No errors

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/exit`

- [ ] **T6.1:** App exits cleanly with `/exit`
- [ ] **T6.2:** App exits cleanly with `exit`
- [ ] **T6.3:** App exits cleanly with `quit`
- [ ] **T6.4:** No orphan processes
- [ ] **T6.5:** Database connections closed

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### Empty Input

- [ ] **T7.1:** No action on empty Enter
- [ ] **T7.2:** No errors
- [ ] **T7.3:** No empty messages added

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

## 2️⃣ Search Commands (4 tests)

### `/search <query>`

- [ ] **T8.1:** Basic text search finds results
- [ ] **T8.2:** Results highlighted correctly
- [ ] **T8.3:** Navigation works (↑/↓, Enter, Esc)
- [ ] **T8.4:** Case-insensitive by default
- [ ] **T8.5:** "No results" message for invalid query
- [ ] **T8.6:** Multiple results handled

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/search` (Interactive)

- [ ] **T9.1:** Interactive mode opens
- [ ] **T9.2:** Typing works
- [ ] **T9.3:** Real-time filtering
- [ ] **T9.4:** Esc exits gracefully
- [ ] **T9.5:** Enter selects result

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

## 3️⃣ Session Management (14 tests)

### `/list_sessions`

- [ ] **T10.1:** Empty message when no sessions
- [ ] **T10.2:** All sessions listed when present
- [ ] **T10.3:** IDs, names, models shown
- [ ] **T10.4:** Message counts accurate
- [ ] **T10.5:** Dates formatted correctly
- [ ] **T10.6:** Table aligned properly

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/switch-session <id>`

- [ ] **T11.1:** Switch to existing session works
- [ ] **T11.2:** Conversation history loaded
- [ ] **T11.3:** CWD unchanged
- [ ] **T11.4:** Model switched if different
- [ ] **T11.5:** No duplicates in history
- [ ] **T11.6:** Error for non-existent session
- [ ] **T11.7:** Idempotent (switch to current session)

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rename_session <name>`

- [ ] **T12.1:** Session renamed in database
- [ ] **T12.2:** New name shows in `/list_sessions`
- [ ] **T12.3:** Special characters handled
- [ ] **T12.4:** Error on empty name
- [ ] **T12.5:** Usage message clear

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/new-session <directory>` (Empty)

- [ ] **T13.1:** Directory created
- [ ] **T13.2:** Session created in database
- [ ] **T13.3:** CWD changed to new directory
- [ ] **T13.4:** Empty conversation started
- [ ] **T13.5:** Works with existing directory

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/new-session --clone-git`

- [ ] **T14.1:** Directory created
- [ ] **T14.2:** Git repository cloned
- [ ] **T14.3:** `.git/` directory present
- [ ] **T14.4:** All commits copied
- [ ] **T14.5:** HEAD state matches source

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/new-session --copy-files`

- [ ] **T15.1:** Files copied
- [ ] **T15.2:** `.git/` excluded
- [ ] **T15.3:** `node_modules/` excluded
- [ ] **T15.4:** Hidden files excluded
- [ ] **T15.5:** File count accurate

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/new-session --from-rewind`

- [ ] **T16.1:** Directory created
- [ ] **T16.2:** State reconstructed from timeline
- [ ] **T16.3:** Git history rebuilt
- [ ] **T16.4:** Files match snapshot
- [ ] **T16.5:** Event count displayed

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/new-session --import-history`

- [ ] **T17.1:** Directory created
- [ ] **T17.2:** Conversation history imported
- [ ] **T17.3:** Only date range messages included
- [ ] **T17.4:** Messages in chronological order
- [ ] **T17.5:** Source session specified correctly

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/new-session --model`

- [ ] **T18.1:** Session uses specified model
- [ ] **T18.2:** Provider configured
- [ ] **T18.3:** Model saved in settings

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### Date Formats

- [ ] **T19.1:** DD/MM/YYYY format works
- [ ] **T19.2:** YYYY-MM-DD format works
- [ ] **T19.3:** `today` works
- [ ] **T19.4:** `yesterday` works
- [ ] **T19.5:** Invalid date shows error

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

## 4️⃣ Timeline & Time Machine (18 tests)

### `/timeline` (Basic)

- [ ] **T20.1:** All events displayed
- [ ] **T20.2:** Table formatted correctly
- [ ] **T20.3:** Timestamps accurate
- [ ] **T20.4:** Event types shown

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/timeline --type <type>`

- [ ] **T21.1:** FILE_CREATED filtering works
- [ ] **T21.2:** FILE_MODIFIED filtering works
- [ ] **T21.3:** GIT_COMMIT filtering works
- [ ] **T21.4:** CONVERSATION_MESSAGE filtering works
- [ ] **T21.5:** No other types shown

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/timeline --since / --before`

- [ ] **T22.1:** `--since` filters correctly
- [ ] **T22.2:** `--before` filters correctly
- [ ] **T22.3:** Combined filters work (AND logic)
- [ ] **T22.4:** Relative dates work (yesterday, today)

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/timeline --path`

- [ ] **T23.1:** File path filtering works
- [ ] **T23.2:** Directory filtering includes subdirectories
- [ ] **T23.3:** Relative paths work

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/timeline --actor`

- [ ] **T24.1:** User actor filtering works
- [ ] **T24.2:** System actor filtering works

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/timeline --limit`

- [ ] **T25.1:** Limit respected
- [ ] **T25.2:** Most recent events shown

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/timeline` (Combined)

- [ ] **T26.1:** Multiple filters work together
- [ ] **T26.2:** AND logic applied correctly
- [ ] **T26.3:** Results accurate

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind` (Basic)

- [ ] **T27.1:** Directory created
- [ ] **T27.2:** Files match state at timestamp
- [ ] **T27.3:** Git history reconstructed
- [ ] **T27.4:** Event count displayed
- [ ] **T27.5:** Duration shown

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind --output`

- [ ] **T28.1:** Custom directory used
- [ ] **T28.2:** Directory created if not exists

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind --git-mode`

- [ ] **T29.1:** `none` - No .git/ directory
- [ ] **T29.2:** `metadata` - .git/ with index only
- [ ] **T29.3:** `full` - Complete Git history
- [ ] **T29.4:** Default is `full`

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind --create-session`

- [ ] **T30.1:** Session created
- [ ] **T30.2:** Switched to new session
- [ ] **T30.3:** CWD changed

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind --auto-checkout`

- [ ] **T31.1:** CWD changed to rewind directory
- [ ] **T31.2:** `process.cwd()` updated

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind --compare-with`

- [ ] **T32.1:** Comparison performed
- [ ] **T32.2:** Differences listed (added, removed, modified)
- [ ] **T32.3:** Report accurate

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind` (Combined Options)

- [ ] **T33.1:** All options work together
- [ ] **T33.2:** No conflicts between options
- [ ] **T33.3:** All features functional

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind` (Error Handling)

- [ ] **T34.1:** Invalid timestamp shows error
- [ ] **T34.2:** Format guidance provided
- [ ] **T34.3:** Future timestamp handled

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/snapshots`

- [ ] **T35.1:** Snapshots listed chronologically
- [ ] **T35.2:** Details accurate
- [ ] **T35.3:** Sizes formatted
- [ ] **T35.4:** Empty message when no snapshots

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/rewind-history`

- [ ] **T36.1:** All rewind operations listed
- [ ] **T36.2:** Details accurate
- [ ] **T36.3:** Status shown
- [ ] **T36.4:** Empty message when no history

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

## 5️⃣ Model & Provider (11 tests)

### `/models` (Interactive)

- [ ] **T37.1:** Interactive menu shown
- [ ] **T37.2:** ↑/↓ navigation works
- [ ] **T37.3:** Enter/Tab selects model
- [ ] **T37.4:** Esc cancels
- [ ] **T37.5:** Model switched on selection

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/models <name>`

- [ ] **T38.1:** Model switched immediately
- [ ] **T38.2:** No interactive menu
- [ ] **T38.3:** Settings saved
- [ ] **T38.4:** Error for unknown model

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/model-default <name>`

- [ ] **T39.1:** Default saved in settings
- [ ] **T39.2:** New sessions use this model
- [ ] **T39.3:** Error for invalid model

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/apikey <provider> <key>`

- [ ] **T40.1:** API key saved
- [ ] **T40.2:** Key partially masked in output
- [ ] **T40.3:** Settings persisted
- [ ] **T40.4:** Works for all providers (openai, anthropic, xai, mistral, deepseek)

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/apikey show <provider>`

- [ ] **T41.1:** Full key displayed
- [ ] **T41.2:** Security warning shown
- [ ] **T41.3:** Works for all providers

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/apikey` (Error Handling)

- [ ] **T42.1:** Missing provider shows usage
- [ ] **T42.2:** Provider list shown
- [ ] **T42.3:** Invalid provider shows error

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/list_tools`

- [ ] **T43.1:** All tools listed
- [ ] **T43.2:** Grouped by category
- [ ] **T43.3:** Descriptions shown
- [ ] **T43.4:** MCP tools included (if configured)

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

## 6️⃣ Git Integration (3 tests)

### `/commit-and-push` (Normal)

- [ ] **T44.1:** Git status analyzed
- [ ] **T44.2:** Commit message generated
- [ ] **T44.3:** Commit created
- [ ] **T44.4:** Pushed to remote

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/commit-and-push` (No Changes)

- [ ] **T45.1:** Clear message shown
- [ ] **T45.2:** No errors

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### `/commit-and-push` (No Remote)

- [ ] **T46.1:** Commit still created
- [ ] **T46.2:** Push skipped gracefully
- [ ] **T46.3:** Clear message shown

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

## 7️⃣ Edge Cases (6 tests)

### Invalid Command

- [ ] **T47.1:** Clear error message
- [ ] **T47.2:** Help suggestion

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### Command with Wrong Arguments

- [ ] **T48.1:** Clear usage message
- [ ] **T48.2:** Example shown

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### Database Corruption

- [ ] **T49.1:** Auto-recovery works
- [ ] **T49.2:** New database created
- [ ] **T49.3:** No crash

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### Very Long Input

- [ ] **T50.1:** Long input accepted
- [ ] **T50.2:** No buffer overflow
- [ ] **T50.3:** API limits respected

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### Concurrent Operations

- [ ] **T51.1:** Multiple sessions work
- [ ] **T51.2:** No race conditions
- [ ] **T51.3:** Timeline sequence correct

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

### Special Characters

- [ ] **T52.1:** File paths with spaces work
- [ ] **T52.2:** Unicode characters handled
- [ ] **T52.3:** Emoji in messages work

**Status:** ⏳ Not Started  
**Tester:** _________  
**Date:** _________

---

## 📊 Issues Found

### Critical Issues

_None found (or list here)_

---

### Major Issues

_None found (or list here)_

---

### Minor Issues

_None found (or list here)_

---

## ✅ Sign-Off

**All Tests Completed:** ⏳ No / ⏳ Yes

**Sign-Off:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Developer** | _________ | _________ | _________ |
| **QA Lead** | _________ | _________ | _________ |
| **Product Owner** | _________ | _________ | _________ |

---

**Certification:**

This document certifies that all 87 test cases have been executed and validated for Grokinou CLI v2.0.0.

---

**Last Updated:** 2025-11-30  
**Version:** 2.0.0  
**Status:** ⏳ Testing in Progress
