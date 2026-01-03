#!/usr/bin/env node
/**
 * Benchmark conversation FTS rebuild.
 * Usage: node scripts/performance/conversation-fts-rebuild-benchmark.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { getConversationFTS } from "../../dist/tools/conversation-fts.js";

const convPath = path.join(os.homedir(), ".grok", "conversations.db");
if (!fs.existsSync(convPath)) {
  console.log("No conversations.db found; skipping conversation FTS rebuild benchmark.");
  process.exit(0);
}

const fts = getConversationFTS();
const start = process.hrtime.bigint();
await fts.rebuildFull();
const end = process.hrtime.bigint();
const ms = Number(end - start) / 1e6;

console.log(`Rebuild duration: ${ms.toFixed(2)} ms`);
