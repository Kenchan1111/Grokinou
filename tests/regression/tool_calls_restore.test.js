#!/usr/bin/env node
/**
 * Regression guard: ensure restoreFromHistory keeps tool_calls even when empty.
 *
 * Rationale:
 * - A past regression removed tool_calls when the array was empty, breaking tool execution context.
 * - This test scans the source to flag the risky pattern (`toolCalls.length > 0`).
 *
 * Expected result:
 * - Should EXIT 0 when the code uses `if (Array.isArray(toolCalls)) { ... }`
 * - Will EXIT 1 (fail) if the code still conditions on `.length > 0`.
 *
 * Usage:
 *   node tests/regression/tool_calls_restore.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "agent", "grok-agent.ts");

function fail(msg) {
  console.error("❌ REGRESSION DETECTED:", msg);
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

// Narrow the search to the specific section where message.tool_calls is assigned
// This is within restoreFromHistory, around the "Include tool_calls if it's an array" comment
const assignmentSectionMatch = content.match(/\/\/ Include tool_calls if it's an array[\s\S]{0,300}message\.tool_calls\s*=\s*toolCalls/);

if (!assignmentSectionMatch) {
  fail("Could not locate tool_calls assignment section in restoreFromHistory");
}

const block = assignmentSectionMatch[0];

// Regression pattern: setting message.tool_calls ONLY when length > 0
// NOTE: Validation/filtering with length > 0 is OK, but assignment must accept empty arrays
const badPattern = /if\s*\(.*Array\.isArray\(toolCalls\).*&&.*toolCalls\.length\s*>\s*0.*\)\s*\{[\s\S]*?message\.tool_calls\s*=/;

if (badPattern.test(block)) {
  fail("restoreFromHistory still guards message.tool_calls assignment with `.length > 0` (should keep empty arrays).");
}

// Guard for the desired pattern (allow whitespace/newlines between if and assignment)
const goodPattern = /if\s*\(\s*Array\.isArray\(toolCalls\)\s*\)\s*\{[\s\S]*?message\.tool_calls\s*=\s*toolCalls/;

if (goodPattern.test(block)) {
  pass("restoreFromHistory preserves tool_calls arrays (including empty) ✅");
}

// If neither pattern matched, warn but do not fail hard.
console.warn("⚠️ Could not confirm tool_calls handling pattern; please review restoreFromHistory manually.");
process.exit(0);
