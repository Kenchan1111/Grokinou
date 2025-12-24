#!/usr/bin/env node
/**
 * Static / lightweight behavior tests for BashTool.
 *
 * Constraints:
 * - Ne pas toucher au code source.
 * - Ne pas exécuter de commandes destructrices.
 * - Vérifier les chemins "simples": cd, commande ok, commande invalide.
 *
 * On importe la version compilée si disponible (dist/tools/bash.js),
 * sinon on fait un skip proprement.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "bash.js");

function fail(msg) {
  console.error("❌ BashTool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/bash.js not found, skipping BashTool runtime tests (build first with `npm run build`).");
  process.exit(0);
}

// Dynamic import of compiled BashTool
const { BashTool } = await import(pathToFileUrl(distPath).href);

// Helper to build file:// URL for ESM dynamic import
function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

async function main() {
  const tool = new BashTool();

  // 1) Simple echo
  const resEcho = await tool.execute("echo hello-bash-tool");
  if (!resEcho.success || !resEcho.output?.includes("hello-bash-tool")) {
    fail("echo test did not return expected output");
  }

  // 2) cd change directory
  const originalCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "bashtool-test-"));
  const resCd = await tool.execute(`cd ${tmpDir}`);
  if (!resCd.success || !resCd.output?.includes("Changed directory to:")) {
    fail("cd test did not report directory change");
  }
  if (tool.getCurrentDirectory() !== tmpDir) {
    fail("BashTool currentDirectory not updated after cd");
  }

  // 3) invalid command
  const resBad = await tool.execute("this_command_does_not_exist_12345");
  if (resBad.success) {
    fail("Invalid command should not succeed");
  }

  // Restore cwd (best-effort)
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  pass("BashTool basic behavior OK.");
}

main().catch((err) => fail(err?.message || String(err)));

