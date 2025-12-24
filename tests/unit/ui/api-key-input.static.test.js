#!/usr/bin/env node
/**
 * Static invariants pour ApiKeyInput (src/ui/components/api-key-input.tsx).
 *
 * Objectifs:
 * - Vérifier l'export par défaut.
 * - Vérifier la présence des commandes de config (/models, /apikey, /model-default, /session_name, /help, /exit).
 * - Vérifier l'utilisation de providerManager et SettingsManager.
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "ui", "components", "api-key-input.tsx");

function fail(msg) {
  console.error("❌ ApiKeyInput static FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  fail("Missing src/ui/components/api-key-input.tsx");
}

const content = fs.readFileSync(filePath, "utf8");

if (!/export\s+default\s+function\s+ApiKeyInput/.test(content) && !/export\s+default\s+ApiKeyInput/.test(content)) {
  fail("ApiKeyInput default export missing");
}

// Vérifier les commandes /models, /apikey, /model-default, /session_name, /help, /exit
const commands = ["/models", "/apikey", "/model-default", "/session_name", "/help", "/exit"];
for (const cmd of commands) {
  if (!content.includes(cmd)) {
    fail(`ApiKeyInput: command "${cmd}" not referenced in source`);
  }
}

// Vérifier l'usage de providerManager et SettingsManager
if (!content.includes("providerManager")) {
  fail("ApiKeyInput does not reference providerManager");
}
if (!content.includes("getSettingsManager")) {
  fail("ApiKeyInput does not reference getSettingsManager");
}

pass("ApiKeyInput static invariants OK.");

