#!/usr/bin/env node
/**
 * Static / light behavior tests for ProviderManager.
 *
 * Objectifs:
 * - Vérifier que les providers par défaut (grok, claude, openai, deepseek, mistral) existent.
 * - Vérifier que detectProvider() renvoie le provider attendu selon le nom de modèle.
 * - Vérifier que getMaskedApiKey() masque les clés correctement.
 *
 * On importe la version compilée si disponible, sinon on skip.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "utils", "provider-manager.js");

function fail(msg) {
  console.error("❌ ProviderManager test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/provider-manager.js not found, skipping ProviderManager tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { providerManager, ProviderManager } = await import(pathToFileUrl(distPath).href);

function ensure(cond, msg) {
  if (!cond) fail(msg);
}

// Basic static tests
const allProviders = providerManager.getAllProviders();
ensure(allProviders.grok && allProviders.claude && allProviders.openai && allProviders.deepseek && allProviders.mistral, "Default providers missing (grok/claude/openai/deepseek/mistral).");

// detectProvider heuristics
ensure(providerManager.detectProvider("grok-code-fast-1") === "grok", "detectProvider should return 'grok' for grok-code-fast-1");
ensure(providerManager.detectProvider("claude-3-5-sonnet-20241022") === "claude", "detectProvider should return 'claude' for claude models");
ensure(providerManager.detectProvider("gpt-4o") === "openai", "detectProvider should return 'openai' for gpt-* models");
ensure(providerManager.detectProvider("deepseek-chat") === "deepseek", "detectProvider should return 'deepseek' for deepseek models");
ensure(providerManager.detectProvider("mistral-large-latest") === "mistral", "detectProvider should return 'mistral' for mistral models");

// Masked key formatting (synthetic provider)
const pm = new ProviderManager();
pm.setApiKey("test", "sk-test-EXAMPLEKEY123");
const masked = pm.getMaskedApiKey("test");
ensure(masked.includes("***"), "getMaskedApiKey should include ***");

pass("ProviderManager basic invariants OK.");

