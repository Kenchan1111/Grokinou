#!/usr/bin/env node
/**
 * Static behavior test pour generateStatusMessage().
 *
 * On ne touche pas au code; on importe dist/utils/status-message.js si possible,
 * et on appelle generateStatusMessage() avec un agent factice.
 *
 * En cas d'erreur liée à better-sqlite3 (DB), on skip proprement.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "utils", "status-message.js");

function fail(msg) {
  console.error("❌ status-message test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/status-message.js not found, skipping status-message tests (build first with `npm run build`).");
  process.exit(0);
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
        "skipping status-message runtime test (requires SQLite)."
    );
    process.exit(0);
  }
  throw err;
}

const { generateStatusMessage } = mod;

const fakeAgent = {
  getCurrentModel() {
    return "grok-code-fast-1";
  },
  getApiKey() {
    return "xai-FAKE-APIKEY-1234567890";
  },
};

// TypeScript-style "as any" is not valid JS; we just pass fakeAgent.
const entry = generateStatusMessage(fakeAgent);
if (!entry || entry.type !== "assistant") {
  fail("generateStatusMessage should return a ChatEntry of type 'assistant'");
}
if (!entry.content.includes("SESSION STATUS") && !entry.content.includes("Current Configuration")) {
  fail("generateStatusMessage content does not look like a status block");
}

pass("status-message basic behavior OK.");
