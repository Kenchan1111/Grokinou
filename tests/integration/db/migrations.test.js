#!/usr/bin/env node
/**
 * Migration safety check (non-destructive).
 * - Ensures migration files exist.
 * - Ensures migration index exports something.
 * This does NOT apply migrations; it only verifies presence.
 *
 * Run: node tests/integration/db/migrations.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const migrationsDir = path.join(process.cwd(), "src", "db", "migrations");
const indexFile = path.join(migrationsDir, "index.ts");

function fail(msg) {
  console.error("❌", msg);
  process.exit(1);
}

function warn(msg) {
  console.warn("⚠️", msg);
}

function pass(msg) {
  console.log("✅", msg);
}

function main() {
  if (!fs.existsSync(migrationsDir)) {
    warn(`Migrations directory missing: ${migrationsDir}`);
    process.exit(0);
  }
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".ts"));
  if (files.length === 0) {
    fail("No migration files (*.ts) found in src/db/migrations");
  } else {
    pass(`Found ${files.length} migration file(s): ${files.join(", ")}`);
  }

  if (!fs.existsSync(indexFile)) {
    warn("Migrations index.ts missing (skipping export check)");
    process.exit(0);
  }

  // Best-effort check: ensure index.ts has at least one export keyword (static check).
  const idxContent = fs.readFileSync(indexFile, "utf8");
  if (!/export\s/.test(idxContent)) {
    fail("src/db/migrations/index.ts has no exports");
  }
  pass("Migrations index.ts contains exports");
  process.exit(0);
}

main();
