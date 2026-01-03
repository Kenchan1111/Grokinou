#!/usr/bin/env node
/**
 * Unit tests for ExecutionManager viewer state.
 */
import fs from "fs";
import path from "path";
import assert from "assert";

const distPath = path.join(process.cwd(), "dist", "execution", "execution-manager.js");
if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/execution/execution-manager.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const mod = await import(new URL(`file://${path.resolve(distPath)}`).href);
const { ExecutionManager } = mod;

const manager = new ExecutionManager();
let updates = 0;
const unsubscribe = manager.onViewerState(() => {
  updates += 1;
});

manager.setViewerState({ selectedCommandIndex: 2, scrollOffset: 10, detailsMode: true });
const state = manager.getViewerState();
assert.strictEqual(state.selectedCommandIndex, 2);
assert.strictEqual(state.scrollOffset, 10);
assert.strictEqual(state.detailsMode, true);

unsubscribe();
if (updates === 0) {
  console.error("❌ Viewer state listener did not fire");
  process.exit(1);
}

console.log("✅ ExecutionManager viewer state unit tests passed.");
