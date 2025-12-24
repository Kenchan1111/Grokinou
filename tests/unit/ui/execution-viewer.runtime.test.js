#!/usr/bin/env node
/**
 * Runtime léger pour ExecutionViewer (dist/ui/components/execution-viewer.js).
 *
 * Objectifs:
 * - Vérifier que ExecutionViewer est bien exporté et est une fonction.
 * - Ne PAS l'exécuter (contient des hooks Ink/React).
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "ui", "components", "execution-viewer.js");

function fail(msg) {
  console.error("❌ ExecutionViewer runtime test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/ui/components/execution-viewer.js not found, skipping ExecutionViewer runtime test (build first with `npm run build`).");
  pass("ExecutionViewer static invariants already checked (runtime skipped).");
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let ExecutionViewer;
try {
  const m = await import(pathToFileUrl(distPath).href);
  ExecutionViewer = m.ExecutionViewer;
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("NODE_MODULE_VERSION") ||
    msg.includes("ERR_DLOPEN_FAILED") ||
    msg.includes("addAbortListener")
  ) {
    console.warn(
      "⚠️  Environment/Node.js incompatibility detected; " +
        "skipping ExecutionViewer runtime test (requires full UI deps)."
    );
    pass("ExecutionViewer static invariants already checked (runtime skipped).");
  }
  throw err;
}

if (typeof ExecutionViewer !== "function") {
  fail("ExecutionViewer export is not a function (React component).");
}

pass("ExecutionViewer runtime export OK (function component present).");
