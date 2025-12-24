#!/usr/bin/env node
/**
 * Static tests pour ConfirmationService.
 *
 * On ne lance pas VS Code, on vérifie juste:
 * - présence du singleton getInstance()
 * - fonctionnement des flags de session (fileOperations, bashCommands, allOperations)
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "utils", "confirmation-service.js");

function fail(msg) {
  console.error("❌ ConfirmationService test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/confirmation-service.js not found, skipping ConfirmationService tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { ConfirmationService } = await import(pathToFileUrl(distPath).href);

const svc = ConfirmationService.getInstance();

// Flags initialement à false
const initial = svc.getSessionFlags();
if (initial.fileOperations || initial.bashCommands || initial.allOperations) {
  fail("Session flags should be false by default");
}

// Set + reset
svc.setSessionFlag("fileOperations", true);
let flags = svc.getSessionFlags();
if (!flags.fileOperations) {
  fail("fileOperations flag not set to true");
}
svc.resetSession();
flags = svc.getSessionFlags();
if (flags.fileOperations || flags.bashCommands || flags.allOperations) {
  fail("resetSession did not clear flags");
}

pass("ConfirmationService session flags behavior OK.");

