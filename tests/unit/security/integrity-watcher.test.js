#!/usr/bin/env node
/**
 * Static invariants for src/security/integrity-watcher.ts
 *
 * Goal:
 * - Ensure critical patterns list covers the core files (agent, client, tools, settings, dist, package.json)
 * - Ensure MALICIOUS_PATTERNS include the generalized LLM‑blocking patterns
 *
 * Run:
 *   node tests/unit/security/integrity-watcher.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "security", "integrity-watcher.ts");

function fail(msg) {
  console.error("❌ INTEGRITY-WATCHER STATIC TEST FAILED:", msg);
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

// 1) CRITICAL_PATTERNS must include the known critical files
const requiredCritical = [
  "src/agent/grok-agent.ts",
  "src/grok/client.ts",
  "src/grok/tools.ts",
  "src/utils/settings-manager.ts",
  "dist/**/*.js",
  "package.json",
  "tsconfig.json",
];

for (const pat of requiredCritical) {
  const regex = new RegExp("'" + pat.replace(/\*/g, "\\*") + "'");
  if (!regex.test(content)) {
    fail(`CRITICAL_PATTERNS is missing entry: ${pat}`);
  }
}

// 2) MALICIOUS_PATTERNS must include generalized LLM blocking & safety snippets.
// We check for simple substrings in the source rather than re‑parsing the
// full regular expressions. This keeps the test robust to formatting changes.
const simpleRequiredSnippets = [
  "gpt-5",
  "grok",
  "claude",
  "deepseek",
  "mistral",
  "needsSummary\\s*=",
  "maxToolRounds\\s*=",
  "eval\\s*\\(",
];

for (const snippet of simpleRequiredSnippets) {
  if (!content.includes(snippet)) {
    fail(`MALICIOUS_PATTERNS / heuristics no longer contain expected snippet: ${snippet}`);
  }
}

// Also ensure there is at least one pattern mentioning \"model\" blocking generically
if (!content.includes("model")) {
  fail("Generic LLM blocking pattern for 'model' no longer present in MALICIOUS_PATTERNS.");
}

pass("integrity-watcher.ts invariants OK (critical patterns + malicious heuristics).");
