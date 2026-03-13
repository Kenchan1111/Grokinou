# Grokinou Stabilization Backlog — v2

## Purpose

This document turns the stabilization plan into an executable backlog.

It is intended to be:

- short enough to drive execution
- explicit enough to avoid drift
- ordered enough to preserve the stabilization sequence

This backlog follows:

- [GROKINOU_STABILIZATION_PLAN.md](/home/zack/GROK_CLI/grok-cli/docs/GROKINOU_STABILIZATION_PLAN.md)

## Changelog v1 → v2

- **Phase 1 Atomic Tools implemented**: ReadTool, WriteTool, EditTool, GlobTool, GrepTool — all integrated in agent loop
- **Paste overflow bug fixed**: Tab/newline in pasted text no longer triggers focus switch or submit in split view
- **Context Compactor integrated**: Auto-summarizes old messages when approaching context window limit
- **Skills system shipped**: 5 builtins, YAML frontmatter, multi-agent delegation, `/skills` command
- **Updated task statuses** to reflect current reality
- **Added new tasks** for atomic tool stabilization and compactor validation
- **Reordered priorities** based on what's actually blocking production use

## Execution Rule

During this backlog:

- no unrelated feature expansion
- no speculative architecture work unless it unblocks a stabilization task
- no "quick fixes" without either a test or an explicit follow-up task

## Status Legend

- `todo`
- `in_progress`
- `done`
- `blocked`

---

## Phase 0: Stabilization Mode

### B0.1 Declare stabilization mode

- Status: `done`
- Goal: make stabilization the explicit development mode
- Notes: Active since v1. All feature work is tied to this backlog.

### B0.2 Create issue taxonomy

- Status: `done`
- Goal: separate product bugs from forensic/environmental incidents
- Categories defined:
  - `ui_regression`
  - `tool_loop_regression`
  - `routing_regression`
  - `provider_protocol_bug`
  - `forensic_suspicious`
  - `startup_failure`

### B0.3 Freeze and inventory current open pain points

- Status: `in_progress`
- Goal: avoid stabilization by vague memory
- Known issues:
  - ~~Page Up split view bug~~ → **fixed** (React.memo comparator)
  - ~~Paste overflow in split view~~ → **fixed** (pasteBurstDetector guards)
  - Tool result display inconsistency across tools → `todo`
  - Session switch UI can show stale model info → `todo`
  - Todos not persisted across restarts → `todo` (low priority)
  - search_advanced rebuilds FTS each call → `todo` (performance)

---

## Phase 1: Interface Stabilization

### B1.1 Identify critical UI flows

- Status: `done`
- Core flows enumerated:
  - startup → ✅ stable
  - normal chat → ✅ stable
  - tool execution display → 🟡 needs normalization (B1.3)
  - search result display → ✅ stable
  - session switch → 🟡 needs validation (B1.4)
  - interruption during tool execution → 🟡 needs hardening (B2.3)
  - paste in split view → ✅ fixed
  - keyboard navigation in split view → ✅ fixed (Page Up bug)

### B1.2 Reproduce top viewer/rendering regressions

- Status: `done`
- Results:
  - Page Up bug: reproduced & fixed (React.memo comparator + isInputActive guard)
  - Paste overflow: reproduced & fixed (pasteBurstDetector + layout-manager + use-enhanced-input guards)
  - Remaining: tool result rendering inconsistencies (tracked in B1.3)

### B1.3 Normalize tool result display

- Status: `todo`
- Goal: make tool summaries compact and consistent
- Actions:
  - audit current tool result summary behavior for all 22+ tools
  - ensure atomic tools (read/write/edit/glob/grep) return consistent format
  - ensure no oversized raw outputs flood the main chat
  - standardize ToolResult → ChatEntry rendering in execution-viewer
- Exit criteria:
  - tool outputs are compact and stable in common workflows

### B1.4 Validate session-switch UI consistency

- Status: `done`
- Goal: prevent mismatch between visible state and actual workdir/session
- Actions:
  - verify directory changes are reflected clearly
  - verify model/provider/session metadata remain coherent
  - test with multi-provider sessions (switch from Grok to Claude to Mistral)
- Exit criteria:
  - session switch no longer causes visible ambiguity

### B1.5 Add interface smoke test list

- Status: `done`
- Goal: avoid rebreaking the surface repeatedly
- Actions:
  - write a short smoke checklist covering all `done` flows from B1.1
  - include paste test cases (tab, newline, multi-line code blocks)
  - include split view keyboard navigation
- Exit criteria:
  - smoke checklist is reusable before merges/releases

### B1.6 Validate atomic tool display (NEW)

- Status: `done`
- Goal: ensure new Phase 1 tools render correctly in UI
- Actions:
  - test read_file output (cat -n format, line numbers, truncation)
  - test edit_file_replace diff preview in confirmation dialog
  - test glob_files result display (file list, mtime sorting)
  - test grep_search output modes (files, content with context, count)
  - test write_file confirmation diff
- Exit criteria:
  - all 5 atomic tools display predictably in execution-viewer

---

## Phase 2: Rules Hardening

### B2.1 Write explicit tool-use rules

- Status: `in_progress`
- Goal: reduce arbitrary agent behavior
- Progress:
  - read-before-edit enforced by ReadTool guard (WriteTool/EditTool check `ReadTool.hasBeenRead()`)
  - confirmation required for all file writes/edits (ConfirmationService)
  - delegation rules defined in skill frontmatter (allowed_tools, max_rounds)
- Remaining:
  - document when to use glob vs grep vs search vs search_advanced
  - define when to use atomic tools vs legacy tools (str_replace_editor vs edit_file_replace)
  - add rules to system prompt

### B2.2 Audit read-before-edit compliance

- Status: `done`
- Results:
  - ReadTool has static `readFiles: Set<string>` tracking all read paths
  - WriteTool and EditTool both check `ReadTool.hasBeenRead()` before proceeding
  - Legacy TextEditorTool does NOT have this guard (by design — different tool)
  - Recommendation: add system prompt instruction to prefer atomic tools

### B2.3 Harden interruption behavior

- Status: `todo`
- Goal: make pending tool-call interruption predictable
- Actions:
  - verify current canceled tool behavior (AbortController in grok-agent)
  - define expected behavior after interruption
  - ensure context compactor handles interrupted tool_call/tool_result pairs
- Exit criteria:
  - interruption semantics are documented and reproducible

### B2.4 Harden confirmation policy

- Status: `todo`
- Goal: make confirmation consistent for stateful operations
- Actions:
  - review current confirmation boundaries across all tools
  - ensure atomic write_file and edit_file_replace use ConfirmationService consistently
  - ensure bash tool confirmation covers destructive commands (rm, git reset, etc.)
- Exit criteria:
  - confirmation behavior is stable across common stateful tools

### B2.5 Define delegation rules

- Status: `done`
- Results:
  - Skills system implemented with YAML frontmatter defining:
    - `allowed_tools`: whitelist per skill
    - `max_rounds`: 3 by default
    - `provider`/`model`: per-skill LLM override
  - `delegate_to_specialist` tool available to agent
  - 5 builtin skills: code-review, security-scan, explain, refactor, test-gen
  - `/skills` command: list, run, reload

### B2.6 Define atomic vs legacy tool migration (NEW)

- Status: `done`
- Goal: clarify when LLM should use new atomic tools vs legacy tools
- Actions:
  - define precedence rules in system prompt
  - consider deprecating legacy tools or marking them as fallback
  - update tool descriptions to guide LLM selection
- Exit criteria:
  - LLM consistently prefers atomic tools for new workflows

---

## Phase 3: Tool Routing Stabilization

### B3.1 Create tool classification matrix

- Status: `in_progress`
- Progress:
  - Current classification (22+ tools):
    - **read_only**: read_file, view_file, glob_files, grep_search, search, search_more, search_conversation, search_conversation_advanced, search_advanced, get_my_identity, session_list, timeline_query, list_time_points
    - **stateful**: write_file, create_file, str_replace_editor, edit_file, edit_file_replace, apply_patch, bash
    - **confirmation_required**: write_file, create_file, str_replace_editor, edit_file, edit_file_replace, apply_patch, bash (destructive)
    - **delegating**: delegate_to_specialist
    - **search/retrieval**: search, search_more, search_advanced, search_conversation, search_conversation_advanced, grep_search, glob_files
    - **session_management**: session_list, session_switch, session_new, session_rewind
    - **timeline**: timeline_query, rewind_to, list_time_points
- Remaining:
  - formalize as metadata on tool definitions
  - use classification in parallel executor design (B3.5)

### B3.2 Audit wrong-first-tool patterns

- Status: `todo`
- Goal: identify routing mistakes from real usage
- Actions:
  - inspect recent workflows via timeline_query
  - identify where the agent picked the wrong first tool
  - check if LLM picks legacy tools when atomic tools would be better
- Exit criteria:
  - top routing errors are documented

### B3.3 Improve search routing heuristics

- Status: `done`
- Goal: make the agent choose better between search modes
- Actions:
  - clarify mapping:
    - exact identifier → `grep_search` (new) or `search`
    - file name pattern → `glob_files` (new)
    - vague/conceptual → `search_advanced`
    - conversation retrieval → `search_conversation` / `search_conversation_advanced`
  - update tool descriptions to make distinctions clear
- Exit criteria:
  - search tool selection becomes more predictable

### B3.4 Design dynamic tool shortlist

- Status: `todo`
- Goal: reduce tool overload per turn (22+ tools is a lot for LLMs)
- Actions:
  - define shortlist rules by task type
  - always visible: read_file, write_file, edit_file_replace, glob_files, grep_search, bash
  - conditional: timeline tools, session tools, MCP tools, legacy tools
- Exit criteria:
  - shortlist logic exists as a design artifact

### B3.5 Implement safe parallel executor design

- Status: `todo`
- Goal: prepare the highest-value routing/runtime improvement
- Actions:
  - use B3.1 classification (read_only vs stateful)
  - define safe parallel partitioning (all read_only in batch)
  - define ordered reinjection strategy
- Dependencies: `B3.1`
- Exit criteria:
  - implementation-ready design exists

### B3.6 Implement safe parallel executor

- Status: `todo`
- Dependencies: `B3.1`, `B3.5`
- Goal: reduce latency on read-only multi-call workloads
- Exit criteria:
  - read-only multi-call workflows are measurably faster

### B3.7 Validate context compactor in tool loops (NEW)

- Status: `done`
- Goal: ensure compaction doesn't break multi-round tool execution
- Actions:
  - verify tool_call/tool_result pair preservation (adjustSplitForToolPairs)
  - test compaction mid-loop (long tool sequences with 20+ rounds)
  - verify summarizer doesn't lose critical tool context
  - validate token counting accuracy across providers
- Exit criteria:
  - compaction works correctly in real multi-round workflows

---

## Phase 4: Launch and Regression Harness

### B4.1 Define golden workflows

- Status: `done`
- Goal: stop relying on memory for critical regressions
- Actions:
  - define canonical workflow set:
    - startup
    - read_file → grep_search → edit_file_replace (new atomic flow)
    - read → search → str_replace_editor (legacy flow)
    - search → search_more
    - glob_files → read_file (file discovery)
    - specialist delegation
    - session switch
    - interrupted tool calls
    - MCP read-only calls
    - paste multi-line code in split view
    - context compaction during long session
- Exit criteria:
  - golden workflow list is fixed

### B4.2 Add startup tests

- Status: `done`
- Goal: detect launch failures immediately
- Actions:
  - validate startup path
  - validate session init behavior
  - validate atomic tools initialization (ReadTool static state, ConfirmationService singleton)
  - validate context compactor initialization
- Exit criteria:
  - startup regressions fail fast

### B4.3 Add tool-loop regression tests

- Status: `todo`
- Goal: catch regressions in tool adjacency and execution semantics
- Actions:
  - test assistant/tool ordering
  - test canceled tool call handling
  - test orphaned tool message behavior
  - test atomic tool routing (all 5 tools: read, write, edit, glob, grep)
  - test context compaction during tool loops
- Exit criteria:
  - critical tool-loop failure modes are covered

### B4.4 Add provider compatibility tests

- Status: `todo`
- Goal: reduce hidden provider-specific breakage
- Actions:
  - validate message cleaning logic per provider family
  - validate tool protocol expectations
  - validate context compactor works with all providers (Grok, Claude, OpenAI, Mistral, DeepSeek)
- Exit criteria:
  - known provider quirks are covered by tests

### B4.5 Add MCP sanity tests

- Status: `todo`
- Goal: ensure MCP integration remains operational
- Exit criteria:
  - MCP core path is covered by a minimal test suite

### B4.6 Add regression runner checklist

- Status: `todo`
- Goal: make pre-release validation lightweight and repeatable
- Exit criteria:
  - a lightweight repeatable validation ritual exists

---

## Phase 5: Effective Tool Usage Measurement

### B5.1 Define telemetry questions

- Status: `todo`
- Goal: measure what actually matters
- Questions:
  - which tools are used most? (atomic vs legacy split)
  - which fail most?
  - which workflows overuse tools?
  - which first-tool choices correlate with success?
  - how often does context compaction trigger?
  - how effective is compaction (tokens freed vs summary quality)?

### B5.2 Baseline current tool usage

- Status: `todo`
- Goal: establish a before-state using timeline.db events
- Exit criteria:
  - baseline metrics exist

### B5.3 Track first-tool correctness proxy

- Status: `todo`
- Goal: measure routing quality indirectly
- Exit criteria:
  - routing quality can be tracked over time

### B5.4 Track redundant tool sequences

- Status: `todo`
- Goal: identify wasted tool activity
- Exit criteria:
  - top waste patterns are visible

### B5.5 Produce stabilization telemetry report

- Status: `todo`
- Goal: make routing and rule changes evidence-based
- Exit criteria:
  - the team can prioritize improvements from data

---

## Cross-Cutting Forensic Track

### F1 Separate suspicious regressions from product regressions

- Status: `done`
- Notes: Issue taxonomy (B0.2) includes `forensic_suspicious` category

### F2 Protect critical startup and loop files

- Status: `todo`
- Critical files identified:
  - `src/agent/grok-agent.ts` — main agent loop
  - `src/agent/context-compactor.ts` — compaction logic
  - `src/grok/client.ts` — LLM API interface
  - `src/grok/tools.ts` — tool definitions
  - `src/ui/components/layout-manager.tsx` — keyboard routing
  - `src/hooks/use-enhanced-input.ts` — input handling
  - `src/utils/paste-burst-detector.ts` — paste detection
- Exit criteria:
  - critical execution surfaces are protected

### F3 Add forensic note field to stabilization reports

- Status: `todo`
- Exit criteria:
  - stabilization reports preserve normal/suspicious distinction

---

## Immediate Next 10 Tasks (v2 priorities — updated 2026-03-13)

1. `B1.3` Normalize tool result display — blocks consistent UX
2. `B1.6` Validate atomic tool display — new tools need UI validation
3. `B2.6` Define atomic vs legacy tool migration — reduce LLM confusion
4. `B3.7` Validate context compactor in tool loops — safety-critical
5. ~~`B1.4` Validate session-switch UI consistency~~ → **done**
6. `B3.2` Audit wrong-first-tool patterns — use timeline data
7. ~~`B3.3` Improve search routing heuristics~~ → **done**
8. ~~`B1.5` Add interface smoke test list~~ → **done**
9. ~~`B4.1` Define golden workflows~~ → **done**
10. ~~`B4.2` Add startup tests~~ → **done**

**Remaining from top 10:** B1.3, B1.6, B2.6, B3.7, B3.2
**Next candidates:** B2.3, B2.4, B4.3, B3.4

---

## Completion Condition

The stabilization phase should be considered materially successful only when:

- the interface is stable on core flows (including paste, split view, scroll)
- atomic tools are the preferred path and render correctly
- context compaction works reliably across providers
- rules produce more consistent agent behavior
- routing quality improves measurably (atomic tools selected correctly)
- core regressions are covered by tests
- effective tool usage is measurable

Until then, Grokinou should still be considered in stabilization mode.
