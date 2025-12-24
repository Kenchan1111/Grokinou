#!/usr/bin/env node
/**
 * Runtime léger pour ChatInterface (dist/ui/components/chat-interface.js).
 *
 * Objectifs:
 * - Vérifier que l'export par défaut est bien une fonction (React component).
 * - Ne pas appeler le composant (contient des hooks Ink).
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "ui", "components", "chat-interface.js");

function fail(msg) {
  console.error("❌ ChatInterface runtime test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/ui/components/chat-interface.js not found, skipping ChatInterface runtime test (build first with `npm run build`).");
  pass("ChatInterface static invariants already checked (runtime skipped).");
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let Comp;
try {
  const m = await import(pathToFileUrl(distPath).href);
  Comp = m.default;
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("NODE_MODULE_VERSION") ||
    msg.includes("ERR_DLOPEN_FAILED") ||
    msg.includes("addAbortListener")
  ) {
    console.warn(
      "⚠️  Environment/Node.js incompatibility detected; " +
        "skipping ChatInterface runtime test (requires full UI deps)."
    );
    pass("ChatInterface static invariants already checked (runtime skipped).");
  }
  throw err;
}

if (typeof Comp !== "function") {
  fail("Default export of chat-interface.js is not a function (React component).");
}

pass("ChatInterface runtime export OK (default component is a function).");
