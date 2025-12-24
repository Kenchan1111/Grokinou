#!/usr/bin/env node
/**
 * Static integration guard for src/security/watcher-daemon-cli.ts
 *
 * Goal:
 * - Ensure watcher-daemon CLI ALWAYS calls verifySelfIntegrityOrDie('daemon')
 *   before instantiating WatcherDaemon.
 *
 * This prevents accidental removal of the self-integrity check.
 *
 * Run:
 *   node tests/integration/security/watcher-daemon.test.js
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "security", "watcher-daemon-cli.ts");

function fail(msg) {
  console.error("❌ WATCHER-DAEMON INTEGRATION TEST FAILED:", msg);
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

// 1) verifySelfIntegrityOrDie('daemon') must be present as a top-level await
if (!/await\s+verifySelfIntegrityOrDie\(\s*'daemon'\s*\)/.test(content)) {
  fail("watcher-daemon-cli.ts no longer calls verifySelfIntegrityOrDie('daemon') at startup.");
}

// 2) WatcherDaemon should be constructed AFTER the self-integrity call
const idxVerify = content.indexOf("await verifySelfIntegrityOrDie('daemon')");
const idxNewDaemon = content.indexOf("new WatcherDaemon");
if (idxNewDaemon !== -1 && idxNewDaemon < idxVerify) {
  fail("WatcherDaemon is constructed BEFORE self-integrity verification (should be after).");
}

pass("watcher-daemon-cli.ts preserves self-integrity check before daemon startup.");

