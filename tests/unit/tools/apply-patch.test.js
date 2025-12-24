#!/usr/bin/env node
/**
 * Behavior + invariants tests for ApplyPatchTool.
 *
 * On utilise la version compilée (dist/tools/apply-patch.js) si présente.
 * On travaille uniquement dans un fichier temporaire, jamais dans le repo.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "apply-patch.js");

function fail(msg) {
  console.error("❌ ApplyPatchTool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/apply-patch.js not found, skipping ApplyPatchTool tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { ApplyPatchTool } = await import(pathToFileUrl(distPath).href);

async function main() {
  const tool = new ApplyPatchTool();

  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "apply-patch-test-"));
  const filePath = path.join(tmpDir, "foo.txt");
  fs.writeFileSync(filePath, "line1\nline2\n");

  // Unified diff pour remplacer line2 par line2-modified
  const patch = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    "@@ -1,2 +1,2 @@",
    " line1",
    "-line2",
    "+line2-modified",
    "",
  ].join("\n");

  const res = await tool.apply(patch, false);
  if (!res.success) {
    fail("apply() failed on simple patch: " + (res.error || res.output || ""));
  }

  const newContent = fs.readFileSync(filePath, "utf8");
  if (!newContent.includes("line2-modified")) {
    fail("apply() did not modify file as expected");
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  pass("ApplyPatchTool basic patching OK.");
}

main().catch((err) => fail(err?.message || String(err)));

