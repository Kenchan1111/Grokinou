#!/usr/bin/env node
/**
 * Static invariants for src/security/llm-guard.ts
 *
 * Goal:
 * - Ensure DEFAULT_WATCH_PATTERNS include the expected directories/files
 * - Ensure ignored patterns protect node_modules, .git and integrity files
 *
 * We do NOT start the watcher; this test is purely structural.
 *
 * Run:
 *   node tests/unit/security/llm-guard.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "security", "llm-guard.ts");

function fail(msg) {
  console.error("❌ LLM-GUARD STATIC TEST FAILED:", msg);
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

// DEFAULT_WATCH_PATTERNS should contain src, dist, package.json, package-lock.json, tsconfig.json, .env, scripts
const requiredDefaultPatterns = [
  "'src/**/*'",
  "'dist/**/*'",
  "'package.json'",
  "'package-lock.json'",
  "'tsconfig.json'",
  "'.env'",
  "'.env.example'",
  "'scripts/**/*'",
];

for (const snippet of requiredDefaultPatterns) {
  if (!content.includes(snippet)) {
    fail(`DEFAULT_WATCH_PATTERNS is missing entry: ${snippet}`);
  }
}

// Ignored patterns should include node_modules, .git, integrity artefacts and watcher files
const requiredIgnoredSnippets = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.integrity-*",
  "**/.llm-guard-*",
  "**/.watcher-daemon.pid",
  "**/.security-integrity-failure.json",
];

for (const pat of requiredIgnoredSnippets) {
  const re = new RegExp(pat.replace(/\*/g, "\\*"));
  if (!re.test(content)) {
    fail(`Ignored patterns in chokidar config missing: ${pat}`);
  }
}

pass("llm-guard.ts invariants OK (watch + ignored patterns).");

