#!/usr/bin/env node
/**
 * Static invariants for src/security/self-integrity.ts
 *
 * Goal:
 * - Ensure EXPECTED_HASHES includes BOTH src/ and dist/ watcher files
 * - Ensure verifyBeforeExecution() checks the right sets of files
 *
 * This test does NOT recompute hashes; it only guards structure and
 * prevents accidental removal of critical self‑integrity coverage.
 *
 * Run:
 *   node tests/unit/security/self-integrity.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "security", "self-integrity.ts");

function fail(msg) {
  console.error("❌ SELF-INTEGRITY STATIC TEST FAILED:", msg);
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

// 1) EXPECTED_HASHES must include all src/security watcher files
const requiredSrcKeys = [
  "src/security/integrity-watcher.ts",
  "src/security/llm-guard.ts",
  "src/security/watcher-daemon.ts",
  "src/security/self-integrity.ts",
  "src/security/watcher-cli.ts",
  "src/security/llm-guard-cli.ts",
  "src/security/watcher-daemon-cli.ts",
];

for (const key of requiredSrcKeys) {
  const pattern = new RegExp("'" + key.replace(/\./g, "\\.") + "'\\s*:");
  if (!pattern.test(content)) {
    fail(`EXPECTED_HASHES is missing src key: ${key}`);
  }
}

// 2) EXPECTED_HASHES must include corresponding dist/security watcher files
const requiredDistKeys = [
  "dist/security/integrity-watcher.js",
  "dist/security/llm-guard.js",
  "dist/security/watcher-daemon.js",
  "dist/security/self-integrity.js",
  "dist/security/watcher-cli.js",
  "dist/security/llm-guard-cli.js",
  "dist/security/watcher-daemon-cli.js",
];

for (const key of requiredDistKeys) {
  const pattern = new RegExp("'" + key.replace(/\./g, "\\.") + "'\\s*:");
  if (!pattern.test(content)) {
    fail(`EXPECTED_HASHES is missing dist key: ${key}`);
  }
}

// 3) verifyBeforeExecution() must map watcherName → full paths that match EXPECTED_HASHES
const integrityMapSnippet = /integrity:\s*\[\s*'src\/security\/integrity-watcher\.ts'[\s\S]+?'dist\/security\/self-integrity\.js',?\s*\],/m;
if (!integrityMapSnippet.test(content)) {
  fail("verifyBeforeExecution('integrity') mapping does not include expected src/dist files.");
}

const daemonMapSnippet = /daemon:\s*\[\s*'src\/security\/watcher-daemon\.ts'[\s\S]+?'dist\/security\/self-integrity\.js',?\s*\],/m;
if (!daemonMapSnippet.test(content)) {
  fail("verifyBeforeExecution('daemon') mapping does not include expected src/dist files.");
}

const llmGuardMapSnippet = /'llm-guard':\s*\[\s*'src\/security\/llm-guard\.ts'[\s\S]+?'dist\/security\/self-integrity\.js',?\s*\],/m;
if (!llmGuardMapSnippet.test(content)) {
  fail("verifyBeforeExecution('llm-guard') mapping does not include expected src/dist files.");
}

pass("self-integrity.ts invariants OK (EXPECTED_HASHES + verifyBeforeExecution mappings).");

