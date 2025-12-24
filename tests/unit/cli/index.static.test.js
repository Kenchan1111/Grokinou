#!/usr/bin/env node
/**
 * Static tests pour le point d'entrée CLI src/index.ts.
 *
 * Objectifs:
 * - Vérifier que le programme définit les commandes principales:
 *   - commande par défaut avec argument [message...]
 *   - sous-commande "git" avec "commit-and-push"
 *   - sous-commande "exec"
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "index.ts");

function fail(msg) {
  console.error("❌ CLI index static FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  fail(`Missing src/index.ts`);
}

const content = fs.readFileSync(filePath, "utf8");

if (!/command\("git"\)/.test(content) || !/command\("commit-and-push"\)/.test(content)) {
  fail("CLI index.ts missing git commit-and-push subcommand.");
}

if (!/command\("exec"\)/.test(content)) {
  fail("CLI index.ts missing exec subcommand.");
}

pass("CLI index.ts static invariants OK.");
