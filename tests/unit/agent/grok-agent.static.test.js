#!/usr/bin/env node
/**
 * Static invariants for src/agent/grok-agent.ts
 *
 * Complementary to the existing regression tests:
 * - placeholder_skip.test.js
 * - tool_calls_restore.test.js
 *
 * Goals:
 * - Ensure updateSystemMessage() purges ALL previous system messages
 * - Ensure restoreFromHistory() converts tool_result entries to role:\"tool\"
 *   and keeps tool_call_id + (for Mistral) name field.
 *
 * Run:
 *   node tests/unit/agent/grok-agent.static.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "agent", "grok-agent.ts");

function fail(msg) {
  console.error("❌ GROK-AGENT STATIC TEST FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  fail(`Source file not found: ${filePath}`);
}

const content = fs.readFileSync(filePath, "utf8");

// 1) updateSystemMessage() must purge previous system messages before adding a new one
const purgeSnippet = /this\.messages\s*=\s*this\.messages\.filter\(m\s*=>\s*m\.role\s*!==\s*'system'\);/;
if (!purgeSnippet.test(content)) {
  fail("updateSystemMessage() no longer purges old system messages before adding a new one.");
}

// 2) restoreFromHistory must push tool_result entries as role:'tool' with tool_call_id
const restoreToolResultSnippet = /else if\s*\(entry\.type\s*===\s*"tool_result"[\s\S]+role:\s*"tool"[\s\S]+tool_call_id:\s*entry\.toolCall\.id/;
if (!restoreToolResultSnippet.test(content)) {
  fail("restoreFromHistory() no longer converts tool_result entries into role:'tool' messages with tool_call_id.");
}

pass("grok-agent.ts invariants OK (system message purge + tool_result restoration).");

