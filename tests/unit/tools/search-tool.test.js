#!/usr/bin/env node
/**
 * Behavior tests pour SearchTool (sans dépendre fortement de rg).
 *
 * On crée un petit répertoire temporaire avec un fichier et on lance
 * une recherche texte; si `rg` n'est pas installé, on skip proprement.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

const distPath = path.join(process.cwd(), "dist", "tools", "search.js");

function fail(msg) {
  console.error("❌ SearchTool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/search.js not found, skipping SearchTool tests (build first with `npm run build`).");
  process.exit(0);
}

// Vérifier que rg est disponible
const rgCheck = spawnSync("rg", ["--version"], { encoding: "utf8" });
if (rgCheck.error || rgCheck.status !== 0) {
  console.warn("⚠️  ripgrep (rg) not found, skipping SearchTool tests.");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let SearchTool;
try {
  ({ SearchTool } = await import(pathToFileUrl(distPath).href));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary is incompatible with this Node.js version; " +
        "skipping SearchTool tests (requires DB layer)."
    );
    process.exit(0);
  }
  throw err;
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "search-tool-test-"));
  const filePath = path.join(tmpDir, "note.txt");
  fs.writeFileSync(filePath, "hello search-tool\nanother line\n", "utf8");

  // Exécuter la recherche en fixant currentDirectory à tmpDir
  const tool = new SearchTool();
  const origCwd = process.cwd();
  process.chdir(tmpDir);

  const res = await tool.search("hello", { searchType: "text" });
  process.chdir(origCwd);

  // On ne sait pas exactement comment SearchTool formate le chemin;
  // on se contente de vérifier que la recherche réussit et que l'output
  // mentionne le mot-clé recherché.
  if (!res.success) {
    fail("SearchTool.search returned success=false");
  }
  if (!res.output || !res.output.includes("hello")) {
    fail("SearchTool.search output does not mention the query term");
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  pass("SearchTool basic text search OK.");
}

main().catch((err) => fail(err?.message || String(err)));
