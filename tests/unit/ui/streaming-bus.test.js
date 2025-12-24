#!/usr/bin/env node
/**
 * Runtime léger pour StreamingBus (src/ui/streaming-bus.ts).
 *
 * On vérifie simplement que les méthodes émettent les bons événements.
 */

import fs from "fs";
import path from "path";
import process from "process";

const srcPath = path.join(process.cwd(), "src", "ui", "streaming-bus.ts");
const distPath = path.join(process.cwd(), "dist", "ui", "streaming-bus.js");

function fail(msg) {
  console.error("❌ StreamingBus test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(srcPath)) {
  fail("Missing src/ui/streaming-bus.ts");
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/ui/streaming-bus.js not found, skipping StreamingBus runtime test (build first with `npm run build`).");
  pass("StreamingBus static presence OK (runtime skipped).");
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { StreamingBus } = await import(pathToFileUrl(distPath).href);

const bus = new StreamingBus();

let seenContent = "";
let seenTools = 0;
let seenToolResults = 0;
let seenTokenCount = 0;
let done = false;

bus.on("content", (txt) => {
  seenContent += txt;
});
bus.on("tools", (tools) => {
  seenTools += tools.length || 0;
});
bus.on("tool_result", () => {
  seenToolResults += 1;
});
bus.on("token_count", (n) => {
  seenTokenCount += n;
});
bus.on("done", () => {
  done = true;
});

bus.emitContent("abc");
bus.emitTools([{ id: "1" }, { id: "2" }]);
bus.emitToolResult({ content: "ok" });
bus.emitTokenCount(5);
bus.emitDone();

if (seenContent !== "abc") {
  fail("StreamingBus.emitContent did not emit expected content");
}
if (seenTools !== 2) {
  fail("StreamingBus.emitTools did not emit expected tools");
}
if (seenToolResults !== 1) {
  fail("StreamingBus.emitToolResult did not emit expected count");
}
if (seenTokenCount !== 5) {
  fail("StreamingBus.emitTokenCount did not emit expected count");
}
if (!done) {
  fail("StreamingBus.emitDone did not emit 'done' event");
}

pass("StreamingBus basic behavior OK.");

