#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const mode = (process.env.GROKINOU_STARTUP_VERIFY || "off").toLowerCase();

if (!["soft", "strict"].includes(mode)) {
  process.exit(0);
}

const repoRoot = process.cwd();
const candidates = [
  "tests/static/source_hash_integrity.test.js",
  "tests/unit/db/schema.test.js",
  "tests/unit/db/session-identifiers.test.js",
  "tests/unit/tools/conversation-fts.test.js",
];

const tests = candidates
  .map((rel) => path.join(repoRoot, rel))
  .filter((p) => fs.existsSync(p));

if (tests.length === 0) {
  if (mode === "strict") {
    console.error("❌ Startup verify: no tests found.");
    process.exit(1);
  }
  console.warn("⚠️  Startup verify: no tests found.");
  process.exit(0);
}

let failures = 0;
for (const testPath of tests) {
  const res = spawnSync(process.execPath, [testPath], {
    encoding: "utf8",
    env: { ...process.env },
  });
  if (res.status !== 0) {
    failures++;
    console.error(`❌ Startup verify failed: ${path.relative(repoRoot, testPath)}`);
    if (res.stderr) console.error(res.stderr.trim());
  }
}

if (failures > 0) {
  if (mode === "strict") {
    console.error(`❌ Startup verify: ${failures} failure(s). Exiting.`);
    process.exit(1);
  }
  console.warn(`⚠️  Startup verify: ${failures} failure(s). Continuing.`);
}
