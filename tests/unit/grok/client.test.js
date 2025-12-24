#!/usr/bin/env node
/**
 * Static invariants for src/grok/client.ts
 *
 * Goals:
 * - Ensure formatToolsForProvider enforces `type: "function"` for Mistral/Claude
 * - Ensure OpenAI/Grok/DeepSeek path passes tools through unchanged except for type fix
 * - Ensure cleanMessagesForProvider has the OpenAI/Grok/DeepSeek tool_calls sanitizer
 *
 * Run:
 *   node tests/unit/grok/client.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "grok", "client.ts");

function fail(msg) {
  console.error("❌ GROK-CLIENT STATIC TEST FAILED:", msg);
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

// 1) Mistral branch must force type: "function"
if (!/if\s*\(provider\s*===\s*'mistral'\)[\s\S]+type:\s*"function"/.test(content)) {
  fail("Mistral tool formatting no longer forces type: \"function\".");
}

// 2) Claude branch must also set type: "function"
if (!/if\s*\(provider\s*===\s*'claude'\)[\s\S]+type:\s*"function"/.test(content)) {
  fail("Claude tool formatting no longer sets type: \"function\".");
}

// 3) OpenAI/Grok/DeepSeek branch must exist and mention type: "function"
if (!/provider\s*===\s*'openai'\s*\|\|\s*provider\s*===\s*'grok'\s*\|\|\s*provider\s*===\s*'deepseek'/.test(content)) {
  fail("OpenAI/Grok/DeepSeek branch in cleanMessagesForProvider is missing.");
}

// Ensure that somewhere after that branch, we still have a type: "function" assignment,
// which is our sanitizer for corrupted tool_calls.
if (!/For OpenAI, Grok, DeepSeek:[\s\S]+type:\s*"function"/m.test(content)) {
  fail("OpenAI/Grok/DeepSeek tool_calls sanitizer (type: \"function\") appears to be missing.");
}

pass("grok/client.ts invariants OK (tool formatting + OpenAI/Grok/DeepSeek sanitizer).");

