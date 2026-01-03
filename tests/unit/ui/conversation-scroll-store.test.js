#!/usr/bin/env node
/**
 * Unit tests for conversation scroll store.
 */
import fs from "fs";
import path from "path";
import assert from "assert";

const distPath = path.join(process.cwd(), "dist", "ui", "conversation-scroll-store.js");
if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/ui/conversation-scroll-store.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const mod = await import(new URL(`file://${path.resolve(distPath)}`).href);
const {
  setConversationScrollOffset,
  setConversationMessageOffset,
  getConversationScrollState,
  subscribeConversationScrollOffset,
} = mod;

let updates = 0;
const unsubscribe = subscribeConversationScrollOffset(() => {
  updates += 1;
});

setConversationScrollOffset(12);
let state = getConversationScrollState();
assert.strictEqual(state.mode, "line");
assert.strictEqual(state.lineOffset, 12);

setConversationMessageOffset(3);
state = getConversationScrollState();
assert.strictEqual(state.mode, "message");
assert.strictEqual(state.messageOffset, 3);

unsubscribe();
if (updates === 0) {
  console.error("❌ Scroll store did not emit updates");
  process.exit(1);
}

console.log("✅ Conversation scroll store unit tests passed.");
