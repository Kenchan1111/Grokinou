#!/usr/bin/env node
/**
 * Static tests pour MorphEditorTool.
 *
 * Cet outil dépend d'une API externe (Morph) et de MORPH_API_KEY,
 * donc on ne teste pas le runtime, uniquement:
 * - l'existence de la classe MorphEditorTool dans dist/tools/morph-editor.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "morph-editor.js");

function fail(msg) {
  console.error("❌ morph-editor test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/morph-editor.js not found, skipping morph-editor tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const mod = await import(pathToFileUrl(distPath).href);

if (typeof mod.MorphEditorTool !== "function") {
  fail("MorphEditorTool export is missing or not a class/function");
}

pass("morph-editor exports OK.");

