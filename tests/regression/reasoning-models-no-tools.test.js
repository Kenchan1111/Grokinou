#!/usr/bin/env node
/**
 * Regression guard: ensure reasoning models (o1, o3, gpt-5) do NOT receive tools
 *
 * Rationale:
 * - Reasoning models like o1, o3, gpt-5 do NOT support function calling
 * - If we send tools to them, OpenAI API returns: 400 Invalid value for tool_choice
 * - This causes the model to generate "reasoning summaries" instead of actual responses
 *
 * Past regression:
 * - Commit 3ead8ad added `!isReasoning` check
 * - Later commit removed this check
 * - Bug returned: reasoning models received tools and generated summaries
 *
 * Expected result:
 * - Code should check `!isReasoning` before adding tools to payload
 * - Pattern: `if (tools && tools.length > 0 && !isReasoning)`
 *
 * Usage:
 *   node tests/regression/reasoning-models-no-tools.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "grok", "client.ts");

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

// Find the section where tools are added to request payload
// Look for the specific if statement with tools check
const toolsIfMatch = content.match(
  /if\s*\(\s*tools\s*&&\s*tools\.length\s*>\s*0[^)]*\)/
);

if (!toolsIfMatch) {
  fail("Could not locate 'if (tools && tools.length > 0' statement in src/grok/client.ts");
}

const section = toolsIfMatch[0];

// Pattern 1: Check that isReasoning check exists
const hasReasoningCheck = /!isReasoning/.test(section);

if (!hasReasoningCheck) {
  fail(
    "Missing !isReasoning check when adding tools. " +
    "Reasoning models (o1, o3, gpt-5) do NOT support tools and will break!"
  );
}

// Pattern 2: Verify the full correct pattern
const correctPattern = /if\s*\(\s*tools\s*&&\s*tools\.length\s*>\s*0\s*&&\s*!isReasoning\s*\)/;

if (!correctPattern.test(section)) {
  fail(
    "Found !isReasoning but not in correct position. " +
    "Expected: if (tools && tools.length > 0 && !isReasoning)"
  );
}

// Pattern 3: Ensure comment is present for clarity
const hasComment = /Reasoning models.*do NOT support tools/i.test(section);

if (!hasComment) {
  console.warn(
    "⚠️  WARNING: Missing explanatory comment about reasoning models. " +
    "Consider adding: // ⚠️ Reasoning models (o1, o3, gpt-5) do NOT support tools"
  );
}

pass(
  "Reasoning models correctly excluded from tool calls ✅ " +
  "(checks !isReasoning before adding tools)"
);
