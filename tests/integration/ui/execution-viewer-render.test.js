#!/usr/bin/env node
/**
 * Execution state smoke test (no Ink render).
 */
import fs from "fs";
import path from "path";
import process from "process";

const distExec = path.join(process.cwd(), "dist", "execution", "index.js");
if (!fs.existsSync(distExec)) {
  console.warn("⚠️  dist execution manager not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const { executionManager } = await import(new URL(`file://${path.resolve(distExec)}`).href);

const stream = executionManager.createExecution("test-tool");
stream.emitCOT("thinking", "planning");
stream.startCommand("echo hello");
stream.commandOutput("hello world");
stream.endCommand(0);
stream.complete();

const state = stream.getState();
executionManager.clearAll();

const outputLines = state.commands?.[0]?.output || [];
if (!outputLines.some((line) => /hello world/i.test(line))) {
  console.error("❌ Execution stream state missing command output");
  process.exit(1);
}

console.log("✅ Execution state test passed.");
