#!/usr/bin/env node
/**
 * UI render smoke test for LayoutManager.
 */
import fs from "fs";
import path from "path";
import process from "process";
import { PassThrough } from "stream";
import React from "react";

// Skip if Node runtime lacks addAbortListener (Node < 18)
try {
  const ev = await import("node:events");
  if (!ev.addAbortListener) {
    console.warn("⚠️  Node runtime lacks addAbortListener; skipping UI render test.");
    process.exit(0);
  }
} catch {
  console.warn("⚠️  Cannot import node:events; skipping UI render test.");
  process.exit(0);
}

const distLayout = path.join(process.cwd(), "dist", "ui", "components", "layout-manager.js");
if (!fs.existsSync(distLayout)) {
  console.warn("⚠️  dist/ui/components/layout-manager.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const { render } = await import("ink");
const { LayoutManager } = await import(new URL(`file://${path.resolve(distLayout)}`).href);
const { Text } = await import("ink");

const stdout = new PassThrough();
const stderr = new PassThrough();
let output = "";
stdout.on("data", (chunk) => {
  output += chunk.toString();
});

const app = render(
  React.createElement(LayoutManager, {
    conversation: React.createElement(Text, null, "Conversation Content"),
    executionViewer: React.createElement(Text, null, "Execution Content"),
    config: { defaultMode: "split", autoShow: false, autoHide: false, splitRatio: 0.6, layout: "horizontal" },
  }),
  { stdout, stderr, exitOnCtrlC: false }
);

await new Promise((resolve) => setTimeout(resolve, 150));
app.unmount();

if (!/Conversation/i.test(output) || !/Execution Viewer/i.test(output)) {
  console.error("❌ LayoutManager render output missing expected headers");
  process.exit(1);
}

console.log("✅ LayoutManager render test passed.");
