#!/usr/bin/env node
/**
 * Behavior tests pour TextEditorTool.
 *
 * On utilise dist/tools/text-editor.js si disponible.
 * On teste:
 * - view() sur un fichier simple
 * - create() pour un nouveau fichier
 *
 * Les confirmations sont gérées par ConfirmationService; ici on ne teste
 * que le chemin "avec confirmation déjà accordée" en posant le flag.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distEditorPath = path.join(process.cwd(), "dist", "tools", "text-editor.js");
const distConfirmPath = path.join(process.cwd(), "dist", "utils", "confirmation-service.js");

function fail(msg) {
  console.error("❌ TextEditorTool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distEditorPath) || !fs.existsSync(distConfirmPath)) {
  console.warn("⚠️  dist/tools/text-editor.js or dist/utils/confirmation-service.js missing, skipping TextEditorTool tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { TextEditorTool } = await import(pathToFileUrl(distEditorPath).href);
const { ConfirmationService } = await import(pathToFileUrl(distConfirmPath).href);

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "text-editor-test-"));
  const filePath = path.join(tmpDir, "file.txt");
  fs.writeFileSync(filePath, "a\nb\nc\n", "utf8");

  // Activer fileOperations pour éviter le prompt de confirmation
  const svc = ConfirmationService.getInstance();
  svc.setSessionFlag("fileOperations", true);

  const editor = new TextEditorTool();

  // 1) view() simple
  const resView = await editor.view(filePath);
  if (!resView.success || !resView.output?.includes("a")) {
    fail("view() failed or missing content");
  }

  // 2) create() nouveau fichier
  const newFile = path.join(tmpDir, "new.txt");
  const resCreate = await editor.create(newFile, "hello\nworld");
  if (!resCreate.success) {
    fail("create() failed: " + (resCreate.error || ""));
  }
  const created = fs.readFileSync(newFile, "utf8");
  if (!created.includes("world")) {
    fail("create() did not write expected content");
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  pass("TextEditorTool basic view/create OK.");
}

main().catch((err) => fail(err?.message || String(err)));

