#!/usr/bin/env node
/**
 * Static tests for ConfirmationTool.
 *
 * On ne déclenche pas réellement de dialogues; on vérifie:
 * - le mode autoAccept
 * - la présence de checkSessionAcceptance / resetSession / isPending
 *
 * On importe la version compilée si disponible.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "confirmation-tool.js");

function fail(msg) {
  console.error("❌ ConfirmationTool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/confirmation-tool.js not found, skipping ConfirmationTool tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { ConfirmationTool } = await import(pathToFileUrl(distPath).href);

async function main() {
  const tool = new ConfirmationTool();

  // 1) autoAccept path
  const resAuto = await tool.requestConfirmation({
    operation: "Write file",
    filename: "foo.txt",
    autoAccept: true,
  });
  if (!resAuto.success || !resAuto.output?.includes("Auto-accepted")) {
    fail("autoAccept path did not behave as expected");
  }

  // 2) checkSessionAcceptance returns structured data
  const resSession = await tool.checkSessionAcceptance();
  if (!resSession.success || typeof resSession.data !== "object") {
    fail("checkSessionAcceptance should return structured data");
  }

  // 3) resetSession + isPending must exist (no runtime assert, just check methods exist)
  if (typeof tool.resetSession !== "function") {
    fail("resetSession method missing on ConfirmationTool");
  }
  if (typeof tool.isPending !== "function") {
    fail("isPending method missing on ConfirmationTool");
  }

  pass("ConfirmationTool basic behavior OK.");
}

main().catch((err) => fail(err?.message || String(err)));

