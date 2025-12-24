#!/usr/bin/env node
/**
 * Static tests pour timeline-query-tool.
 *
 * On vérifie que executeTimelineQuery est exportée comme fonction.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "timeline-query-tool.js");

function fail(msg) {
  console.error("❌ timeline-query-tool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/timeline-query-tool.js not found, skipping timeline-query-tool tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const mod = await import(pathToFileUrl(distPath).href);

if (typeof mod.executeTimelineQuery !== "function") {
  fail("executeTimelineQuery export is missing or not a function");
}

pass("timeline-query-tool exports OK.");

