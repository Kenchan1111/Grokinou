# Report for Claude: Search Tool Fixes + FTS/BM25 + Semantic Rerank

## 1) Critical bug fix: /search-code-advanced in raw mode
- Root cause: `runRawOnce()` in `src/index.ts` tested `/search-code` before `/search-code-advanced`.
- Effect: `/search-code-advanced` was parsed as `/search-code` and query became `-advanced ...`.
- Fix: order reversed so advanced checks happen first.
- File: `src/index.ts` (runRawOnce handler order).

## 2) Advanced code search behavior (FTS/BM25)
- `search_advanced` now performs FTS5 search via `FTSSearch` for code snippets.
- Output shows FTS results (ranked, snippet-based).
- File: `src/tools/search.ts` (method `searchAdvanced`).

## 3) Semantic layer (optional rerank or semantic results)
### Key behavior
- Default: **heuristic/BM25 only**.
- Semantic is **opt-in** and **per-request**.
- If semantic mode is requested but not configured, tool returns a clear error.

### Configuration
- Runtime command (no restart): `/semantic-config` or `/semantic_config`
- Can persist to `project` or `user` settings; can also be `none` for temporary.
- Stored in:
  - Project: `.grok/settings.json`
  - User: `~/.grok/user-settings.json`

### Per-request toggle
- CLI: `/search-code-advanced <query> --semantic|--heuristic|--auto`
- Tool param: `semantic_mode` with values `heuristic | semantic | auto`.

### Files touched
- `src/tools/semantic-search.ts`: `reloadConfig()` to re-init embeddings without restart.
- `src/tools/search.ts`: `searchAdvanced` takes `semanticMode` and enforces opt-in.
- `src/grok/tools.ts`: tool description + `semantic_mode` parameter with guidance for LLM.
- `src/agent/grok-agent.ts`: passes `semantic_mode` to `searchAdvanced`.
- `src/hooks/use-input-handler.ts`: `/semantic-config`, CLI flags for search mode.

## 4) LLM guidance & user prompt flow
- `search_advanced` tool description explicitly tells the model:
  - Use heuristic for precise identifiers.
  - Ask user to enable semantic for vague/conceptual queries.
  - Provide the exact config command:
    - `GROKINOU_SEMANTIC_ENABLED=true`
    - `GROKINOU_EMBEDDING_PROVIDER=...`
    - `GROKINOU_EMBEDDING_MODEL=...`
    - `GROKINOU_EMBEDDING_API_KEY=...`

## 5) /semantic-config behavior (summary)
- Parses flags: `--enable`, `--provider`, `--model`, `--api-key`, `--base-url`, `--persist`.
- Updates `process.env` live.
- Reloads semantic config immediately (`SearchTool.reloadSemanticConfig()`).
- Prints current state + missing keys + .env path.
- Adds a per-request usage reminder:
  - `--heuristic` (default), `--semantic`, `--auto`.

## 6) Suggested validation steps
1) Default heuristic (no semantic):
   - `/search-code-advanced "auth middleware"`
2) Semantic on-demand (temp):
   - `/semantic-config --enable true --provider openai --model text-embedding-3-small --api-key sk-... --persist none`
   - `/search-code-advanced "authentication flow" --semantic`
3) Confirm error when semantic requested but not configured:
   - `/search-code-advanced "authentication flow" --semantic` (should show guidance)

---
If you want exact diffs or line numbers, I can provide them.
