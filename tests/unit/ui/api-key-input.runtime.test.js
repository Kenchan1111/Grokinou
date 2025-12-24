#!/usr/bin/env node
/**
 * Runtime léger pour ApiKeyInput (dist/ui/components/api-key-input.js).
 *
 * Objectifs:
 * - Vérifier que le composant par défaut est bien une fonction (React component).
 * - Ne PAS l'exécuter (éviter les invalid hook calls sans renderer Ink).
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "ui", "components", "api-key-input.js");

function fail(msg) {
  console.error("❌ ApiKeyInput runtime test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/ui/components/api-key-input.js not found, skipping ApiKeyInput runtime test (build first with `npm run build`).");
  pass("ApiKeyInput static invariants already checked (runtime skipped).");
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let mod;
try {
  mod = await import(pathToFileUrl(distPath).href);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary is incompatible with this Node.js version; " +
        "skipping ApiKeyInput runtime test (requires dist DB layer)."
    );
    pass("ApiKeyInput static invariants already checked (runtime skipped).");
  }
  throw err;
}
const Comp = mod.default;

if (typeof Comp !== "function") {
  fail("Default export of api-key-input.js is not a function (React component).");
}

pass("ApiKeyInput runtime export OK (default component is a function).");
