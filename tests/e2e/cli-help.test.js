#!/usr/bin/env node
/**
 * E2E léger : vérifier que le binaire CLI démarre et affiche l'aide.
 *
 * Pré-requis :
 * - dist/index.js présent (npm run build)
 * - better-sqlite3 compilé pour la version actuelle de Node (sinon skip)
 *
 * Ce test n'appelle aucun LLM ni réseau (flag --help).
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

const distIndex = path.join(process.cwd(), "dist", "index.js");

function skip(msg) {
  console.warn("⚠️  CLI help test skipped:", msg);
  process.exit(0);
}

function fail(msg, detail = "") {
  console.error("❌ CLI help test FAILED:", msg);
  if (detail) console.error(detail);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distIndex)) {
  skip("dist/index.js not found (run `npm run build` first).");
}

const res = spawnSync(process.execPath, [distIndex, "--help"], {
  encoding: "utf8",
  timeout: 20000,
});

if (res.error) {
  const msg = res.error.message || String(res.error);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    skip("better-sqlite3 binary incompatible with this Node.js version.");
  }
  fail("Failed to spawn CLI", msg);
}

if (res.status !== 0) {
  const stderr = res.stderr || "";
  const stdout = res.stdout || "";
  if (stderr.includes("NODE_MODULE_VERSION") || stderr.includes("ERR_DLOPEN_FAILED")) {
    skip("better-sqlite3 binary incompatible with this Node.js version.");
  }
  fail(`CLI exited with status ${res.status}`, `stdout:\n${stdout}\n\nstderr:\n${stderr}`);
}

if (!res.stdout.includes("Usage:") && !res.stdout.includes("Options:") && !res.stdout.includes("Grok")) {
  fail("Help output does not look like CLI usage.", res.stdout);
}

pass("CLI --help runs successfully.");

