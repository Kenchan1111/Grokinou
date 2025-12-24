#!/usr/bin/env node
/**
 * Static behavior tests pour TokenCounter.
 *
 * On ne vérifie pas la précision parfaite, seulement:
 * - countTokens() >= 0 et augmente avec la longueur du texte
 * - countMessageTokens() retourne un entier cohérent
 * - formatTokenCount() formate k/m correctement
 */

import { createRequire } from "module";
import path from "path";
import process from "process";
import fs from "fs";

const require = createRequire(import.meta.url);

const distPath = path.join(process.cwd(), "dist", "utils", "token-counter.js");

function fail(msg) {
  console.error("❌ TokenCounter test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/token-counter.js not found, skipping TokenCounter tests (build first with `npm run build`).");
  process.exit(0);
}

const mod = await import("file://" + distPath);
const { createTokenCounter, formatTokenCount } = mod;

const counter = createTokenCounter("gpt-4");

const short = counter.countTokens("hello");
const long = counter.countTokens("hello world, this is a longer string");
if (short <= 0 || long <= short) {
  fail("countTokens should return positive count and increase with input length");
}

const msgTokens = counter.countMessageTokens([
  { role: "user", content: "Hi" },
  { role: "assistant", content: "Hello there" },
]);
if (!Number.isInteger(msgTokens) || msgTokens <= 0) {
  fail("countMessageTokens should return positive integer");
}

if (formatTokenCount(999) !== "999") {
  fail("formatTokenCount(999) should be '999'");
}
if (formatTokenCount(1200) !== "1.2k") {
  fail("formatTokenCount(1200) should be '1.2k'");
}
if (formatTokenCount(1000000) !== "1m") {
  fail("formatTokenCount(1000000) should be '1m'");
}

pass("TokenCounter basic behavior OK.");

