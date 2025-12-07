#!/usr/bin/env node
/**
 * Regression guard: ensure reasoning models (o1, o3 ONLY) do NOT receive tools
 *
 * Rationale:
 * - True reasoning models (o1, o3) do NOT support function calling
 * - GPT-5 is NOT a reasoning model - it DOES support tools normally
 * - If we send tools to o1/o3, OpenAI API returns: 400 Invalid value for tool_choice
 * - This causes the model to generate "reasoning summaries" instead of actual responses
 *
 * Past regression:
 * - Initial fix incorrectly classified GPT-5 as reasoning model
 * - This prevented GPT-5 from using tools (wrong!)
 * - Corrected: Only o1/o3 are reasoning models
 *
 * Expected result:
 * - Code should check `!isReasoning` before adding tools to payload
 * - Pattern: `if (tools && tools.length > 0 && !isReasoning)`
 * - isReasoningModel() should only return true for o1/o3 (NOT gpt-5)
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

// Pattern 4: Verify GPT-5 is NOT classified as reasoning model
const gpt5Check = /modelName\.includes\s*\(\s*['"]gpt-5['"]\s*\)/;
const hasGpt5InCheck = gpt5Check.test(content);

if (hasGpt5InCheck) {
  fail(
    "GPT-5 incorrectly classified as reasoning model! " +
    "GPT-5 DOES support tools. Only o1/o3 are reasoning models."
  );
}

pass(
  "Reasoning models correctly excluded from tool calls ✅ " +
  "(checks !isReasoning before adding tools, GPT-5 NOT classified as reasoning)"
);
