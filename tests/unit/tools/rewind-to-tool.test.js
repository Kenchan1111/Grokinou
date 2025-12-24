#!/usr/bin/env node
/**
 * Static tests pour rewind-to-tool.
 *
 * On vérifie que executeRewindTo et getAvailableTimePoints existent.
 * Les exécuter nécessiterait timeline.db + RewindEngine, donc on se limite
 * à des invariants d'exports.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "rewind-to-tool.js");

function fail(msg) {
  console.error("❌ rewind-to-tool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/rewind-to-tool.js not found, skipping rewind-to-tool tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const mod = await import(pathToFileUrl(distPath).href);

if (typeof mod.executeRewindTo !== "function") {
  fail("executeRewindTo export is missing or not a function");
}
if (typeof mod.getAvailableTimePoints !== "function") {
  fail("getAvailableTimePoints export is missing or not a function");
}

pass("rewind-to-tool exports OK.");

