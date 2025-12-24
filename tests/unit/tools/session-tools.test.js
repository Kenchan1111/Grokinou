#!/usr/bin/env node
/**
 * Static tests pour session-tools (src/tools/session-tools.ts).
 *
 * On se contente de vérifier que les exports clés existent:
 * - executeSessionList
 * - executeSessionSwitch
 * - executeSessionNew
 *
 * On ne les exécute pas, car ils dépendent fortement de SQLite + sessions.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "session-tools.js");

function fail(msg) {
  console.error("❌ session-tools test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/session-tools.js not found, skipping session-tools tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const mod = await import(pathToFileUrl(distPath).href);

if (typeof mod.executeSessionList !== "function") {
  fail("executeSessionList export is missing or not a function");
}
if (typeof mod.executeSessionSwitch !== "function") {
  fail("executeSessionSwitch export is missing or not a function");
}
if (typeof mod.executeSessionNew !== "function") {
  fail("executeSessionNew export is missing or not a function");
}

pass("session-tools exports OK.");

