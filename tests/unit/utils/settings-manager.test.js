#!/usr/bin/env node
/**
 * Static invariants for src/utils/settings-manager.ts
 *
 * Goals:
 * - Ensure DEFAULT_USER_SETTINGS has a sensible defaultModel and baseURL
 * - Ensure DEFAULT_PROJECT_SETTINGS.model is grok-code-fast-1
 * - Ensure getCurrentModel() implements the documented priority:
 *     project model → user defaultModel → system default
 *
 * This test does not execute TypeScript; it guards the structure to
 * prevent accidental regressions when editing settings-manager.ts.
 *
 * Run:
 *   node tests/unit/utils/settings-manager.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "utils", "settings-manager.ts");

function fail(msg) {
  console.error("❌ SETTINGS-MANAGER STATIC TEST FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  fail(`Source file not found: ${filePath}`);
}

const content = fs.readFileSync(filePath, "utf8");

// 1) DEFAULT_USER_SETTINGS must define baseURL and defaultModel
if (!/const DEFAULT_USER_SETTINGS[\s\S]+baseURL:\s*"https:\/\/api\.x\.ai\/v1"/.test(content)) {
  fail("DEFAULT_USER_SETTINGS.baseURL is missing or no longer set to https://api.x.ai/v1");
}

if (!/const DEFAULT_USER_SETTINGS[\s\S]+defaultModel:\s*"grok-4-latest"/.test(content)) {
  fail("DEFAULT_USER_SETTINGS.defaultModel is missing or not set to grok-4-latest.");
}

// 2) DEFAULT_PROJECT_SETTINGS.model should be grok-code-fast-1
if (!/const DEFAULT_PROJECT_SETTINGS[\s\S]+model:\s*"grok-code-fast-1"/.test(content)) {
  fail("DEFAULT_PROJECT_SETTINGS.model is no longer grok-code-fast-1.");
}

// 3) getCurrentModel() priority: project → user default → system default
const getCurrentModelSnippet = /getCurrentModel\(\)\s*:\s*string\s*\{[\s\S]+projectModel\s*=\s*this\.getProjectSetting\("model"\)[\s\S]+if\s*\(projectModel\)[\s\S]+const userDefaultModel\s*=\s*this\.getUserSetting\("defaultModel"\)[\s\S]+if\s*\(userDefaultModel\)[\s\S]+return DEFAULT_PROJECT_SETTINGS\.model/m;
if (!getCurrentModelSnippet.test(content)) {
  fail("getCurrentModel() no longer follows project → user default → system default priority.");
}

pass("settings-manager.ts invariants OK (defaults + getCurrentModel priority).");

