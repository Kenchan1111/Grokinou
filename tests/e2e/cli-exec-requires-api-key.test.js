#!/usr/bin/env node
/**
 * E2E : la commande `exec` doit refuser l'exécution sans clé API et sortir proprement.
 *
 * Pré-requis :
 * - dist/index.js présent (npm run build)
 * - better-sqlite3 compilé pour la version actuelle de Node (sinon skip propre)
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

const distIndex = path.join(process.cwd(), "dist", "index.js");

function isBinaryMismatch(output = "") {
  return (
    output.includes("NODE_MODULE_VERSION") ||
    output.includes("ERR_DLOPEN_FAILED") ||
    output.includes("was compiled against a different Node.js version")
  );
}

function skip(msg) {
  console.warn("⚠️  CLI exec API-key test skipped:", msg);
  process.exit(0);
}

function fail(msg, detail = "") {
  console.error("❌ CLI exec API-key test FAILED:", msg);
  if (detail) console.error(detail);
  process.exit(1);
}

if (!fs.existsSync(distIndex)) {
  skip("dist/index.js not found (run `npm run build`).");
}

const res = spawnSync(process.execPath, [distIndex, "exec", "ping"], {
  encoding: "utf8",
  timeout: 15000,
  env: {
    ...process.env,
    GROK_API_KEY: "",
    GROK_AUTO_WATCHER: "0",
  },
});

const merged = `${res.stdout || ""}\n${res.stderr || ""}`;

if (res.error) {
  const msg = res.error.message || String(res.error);
  if (isBinaryMismatch(msg)) {
    skip("better-sqlite3 binary incompatible with this Node.js version.");
  }
  fail("Failed to spawn CLI exec", msg);
}

if (isBinaryMismatch(merged)) {
  skip("better-sqlite3 binary incompatible with this Node.js version.");
}

if (res.status === 0) {
  fail("exec without API key should exit with non-zero status", merged);
}

if (!/api key required/i.test(merged)) {
  fail("Missing 'API key required' message for exec without credentials", merged);
}

console.log("✅ exec refuses to run without API key and exits cleanly.");
