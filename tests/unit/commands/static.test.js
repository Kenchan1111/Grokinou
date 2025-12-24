#!/usr/bin/env node
/**
 * Static tests pour les fichiers src/commands/*.ts
 *
 * Objectifs:
 * - Vérifier présence des exports attendus dans commandes mcp & search.
 */

import fs from "fs";
import path from "path";
import process from "process";

function fail(msg) {
  console.error("❌ commands static FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

function mustContain(file, pattern, desc) {
  const rel = path.relative(process.cwd(), file);
  if (!fs.existsSync(file)) {
    fail(`Missing command source file: ${rel}`);
  }
  const content = fs.readFileSync(file, "utf8");
  if (!pattern.test(content)) {
    fail(`${rel}: missing ${desc}`);
  }
}

const base = path.join(process.cwd(), "src", "commands");

// mcp.ts: createMCPCommand
mustContain(
  path.join(base, "mcp.ts"),
  /export\s+function\s+createMCPCommand/,
  "createMCPCommand() export"
);

// search.ts: parseSearchInConversationsCommand / executeSearchInConversationsCommand
mustContain(
  path.join(base, "search.ts"),
  /export\s+function\s+parseSearchInConversationsCommand/,
  "parseSearchInConversationsCommand() export"
);
mustContain(
  path.join(base, "search.ts"),
  /export\s+function\s+executeSearchInConversationsCommand/,
  "executeSearchInConversationsCommand() export"
);

pass("commands static invariants OK.");
