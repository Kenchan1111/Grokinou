#!/usr/bin/env node
/**
 * Static integrity check: verify SHA-256 hashes of all source .ts files.
 * Fails on any modification vs baseline.
 *
 * Baseline file: tests/static/source-hashes.json
 *
 * Usage:
 *   node tests/static/source_hash_integrity.test.js
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import process from "process";

const baselinePath = path.join(process.cwd(), "tests", "static", "source-hashes.json");

function sha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function fail(msg) {
  console.error("❌ SOURCE INTEGRITY FAILED:", msg);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(baselinePath)) {
    fail(`Baseline missing: ${baselinePath}`);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  const mismatches = [];
  const missing = [];

  for (const [rel, expected] of Object.entries(baseline)) {
    const abs = path.join(process.cwd(), rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const actual = sha256(abs);
    if (actual !== expected) {
      mismatches.push({ file: rel, expected, actual });
    }
  }

  if (missing.length || mismatches.length) {
    if (missing.length) {
      console.error("Missing files:", missing);
    }
    if (mismatches.length) {
      console.error("Hash mismatches:");
      mismatches.forEach(m =>
        console.error(` - ${m.file}\n    expected: ${m.expected}\n    actual:   ${m.actual}`)
      );
    }
    fail("Source files differ from baseline.");
  }

  console.log(`✅ Source integrity passed (${Object.keys(baseline).length} files verified).`);
  process.exit(0);
}

main();
