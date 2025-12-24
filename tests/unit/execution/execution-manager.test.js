#!/usr/bin/env node
/**
 * Static sanity checks for src/execution/execution-manager.ts
 *
 * Goal:
 * - Ensure ExecutionManager and ExecutionStream classes are present
 * - Ensure key methods used by the UI still exist (createExecution, getHistory, subscribeToAll)
 *
 * Run:
 *   node tests/unit/execution/execution-manager.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "execution", "execution-manager.ts");

function fail(msg) {
  console.error("❌ EXECUTION-MANAGER STATIC TEST FAILED:", msg);
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

// ExecutionStream class must exist
if (!/export\s+class\s+ExecutionStream/.test(content)) {
  fail("ExecutionStream class not exported in execution-manager.ts");
}

// ExecutionManager class must exist
if (!/export\s+class\s+ExecutionManager/.test(content)) {
  fail("ExecutionManager class not exported in execution-manager.ts");
}

// Singleton export executionManager must exist
if (!/export\s+const\s+executionManager\s*=\s*new\s+ExecutionManager\(\)/.test(content)) {
  fail("executionManager singleton export missing or renamed.");
}

// Key methods expected by UI / hooks
const requiredMethods = [
  "createExecution(",
  "getActiveExecutions(",
  "getHistory(",
  "subscribeToAll(",
  "onExecutionStart(",
  "onExecutionEnd(",
];

for (const snippet of requiredMethods) {
  if (!content.includes(snippet)) {
    fail(`ExecutionManager appears to be missing method: ${snippet}`);
  }
}

pass("execution-manager.ts invariants OK (classes + core methods).");

