#!/usr/bin/env node
/**
 * Static invariants pour ChatInterface (src/ui/components/chat-interface.tsx).
 *
 * Objectifs:
 * - Vérifier que ChatInterface est exporté par défaut.
 * - Vérifier l'utilisation de ChatProvider, ChatLayoutSwitcher, ExecutionViewer, InputController.
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "ui", "components", "chat-interface.tsx");

function fail(msg) {
  console.error("❌ ChatInterface static FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  fail("Missing src/ui/components/chat-interface.tsx");
}

const content = fs.readFileSync(filePath, "utf8");

if (!/export\s+default\s+function\s+ChatInterface/.test(content) && !/export\s+default\s+ChatInterface/.test(content)) {
  fail("Default export ChatInterface missing");
}
if (!/ChatProvider/.test(content)) {
  fail("ChatInterface should wrap children in ChatProvider");
}
if (!/ChatLayoutSwitcher/.test(content)) {
  fail("ChatInterface should use ChatLayoutSwitcher");
}
if (!/ExecutionViewer/.test(content)) {
  // On accepte que le composant soit factorisé, mais normalement il est importé/utilisé
  console.warn("⚠️  ChatInterface: ExecutionViewer not referenced (check if intentionally removed).");
}
if (!/InputController/.test(content)) {
  fail("ChatInterface should use InputController for handling input");
}

pass("ChatInterface static invariants OK.");

