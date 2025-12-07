#!/usr/bin/env node
/**
 * Regression guard: ensure the placeholder "Using tools to help you..." is handled by
 * an early return (not treated as a real answer needing summary).
 *
 * This is a static check on src/agent/grok-agent.ts to detect removal of the guard.
 */

import fs from "fs";
import path from "path";

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

// Look for an early return pattern guarding the placeholder.
const earlyReturn = /contentTrimmed\s*===\s*"Using tools to help you\.\.\."\s*[^}]*return\s+newEntries|return\s*\[/m.test(
  content
);

if (!earlyReturn) {
  fail('Missing early return guard for placeholder "Using tools to help you..."');
}

// Ensure the placeholder is not part of the needsSummary condition.
const inNeedsSummary = /needsSummary[^;]*Using tools to help you\.\.\./.test(content);

if (inNeedsSummary) {
  fail('Placeholder "Using tools to help you..." should not trigger needsSummary logic.');
}

pass('Placeholder guard present and not included in needsSummary logic.');
