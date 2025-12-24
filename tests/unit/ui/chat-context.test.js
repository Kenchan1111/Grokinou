#!/usr/bin/env node
/**
 * Static + runtime léger pour ChatContext (src/ui/contexts/ChatContext.tsx)
 *
 * Objectifs:
 * - Vérifier que ChatProvider, useChatState, useChatActions, useChatContext existent.
 * - Vérifier que les hooks lèvent une erreur claire s'ils sont utilisés hors provider.
 */

import fs from "fs";
import path from "path";
import process from "process";

const srcPath = path.join(process.cwd(), "src", "ui", "contexts", "ChatContext.tsx");
const distPath = path.join(process.cwd(), "dist", "ui", "contexts", "ChatContext.js");

function fail(msg) {
  console.error("❌ ChatContext test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

// 1) Vérif statique sur le source
if (!fs.existsSync(srcPath)) {
  fail(`Missing src/ui/contexts/ChatContext.tsx`);
}
const srcContent = fs.readFileSync(srcPath, "utf8");
if (!/export\s+const\s+ChatProvider/.test(srcContent)) {
  fail("ChatProvider export missing in ChatContext.tsx");
}
if (!/export\s+const\s+useChatState/.test(srcContent)) {
  fail("useChatState export missing in ChatContext.tsx");
}
if (!/export\s+const\s+useChatActions/.test(srcContent)) {
  fail("useChatActions export missing in ChatContext.tsx");
}
if (!/export\s+const\s+useChatContext/.test(srcContent)) {
  fail("useChatContext export missing in ChatContext.tsx");
}

// 2) Runtime léger si dist disponible
if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/ui/contexts/ChatContext.js not found, skipping runtime ChatContext tests (build first with `npm run build`).");
  pass("ChatContext static invariants OK (runtime skipped).");
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const mod = await import(pathToFileUrl(distPath).href);
const { useChatState, useChatActions, useChatContext, ChatProvider } = mod;

if (typeof ChatProvider !== "function") {
  fail("ChatProvider is not a function/component in dist build");
}
if (typeof useChatState !== "function" || typeof useChatActions !== "function" || typeof useChatContext !== "function") {
  fail("ChatContext hooks are not functions in dist build");
}

// On ne monte pas réellement React/Ink ici (trop d'infra),
// on se contente de vérifier qu'appeler les hooks hors provider
// jette bien une erreur (capturable).
let threw = false;
try {
  // @ts-ignore – on teste juste l'appel brut
  useChatState();
} catch (e) {
  threw = true;
}
if (!threw) {
  fail("useChatState() should throw when called outside ChatProvider");
}

pass("ChatContext exports + basic hook behavior OK.");

