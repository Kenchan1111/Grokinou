#!/usr/bin/env node
/**
 * Lightweight tests for scoring and adaptive cutoff behavior (sanity checks).
 */
import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "search.js");

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/search.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let SearchTool;
try {
  ({ SearchTool } = await import(pathToFileUrl(distPath).href));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary incompatible with this Node.js runtime; " +
        "skipping scoring tests. Try `npm rebuild` or reinstall."
    );
    process.exit(0);
  }
  console.error("❌ Failed to import SearchTool:", err);
  process.exit(1);
}

async function main() {
  const tool = new SearchTool();
  const scoreResult = tool["scoreResult"].bind(tool);
  const applyAdaptiveCutoff = tool["applyAdaptiveCutoff"].bind(tool);

  // Score should boost context matches and preferred file type
  const base = scoreResult(
    { type: "text", file: "src/foo.ts", text: "export function hello() {}", score: 0 },
    "hello foo",
    { fileTypes: ["ts"] }
  );
  const unrelated = scoreResult(
    { type: "text", file: "test/bar.js", text: "console.log('x')", score: 0 },
    "hello foo",
    { fileTypes: ["ts"] }
  );
  if (base <= unrelated) {
    throw new Error("Scoring did not favor context/path/fileType as expected");
  }

  // Adaptive cutoff should keep at least min results and not return negative
  const results = [];
  for (let i = 0; i < 10; i++) {
    results.push({ type: "text", file: `f${i}`, score: 100 - i * 5 });
  }
  const cut = applyAdaptiveCutoff(results);
  if (!cut.topResults || cut.topResults.length === 0) {
    throw new Error("applyAdaptiveCutoff returned no results");
  }
  if (cut.remainingCount < 0) {
    throw new Error("applyAdaptiveCutoff remainingCount negative");
  }

  console.log("✅ Search scoring/cutoff tests passed.");
}

main().catch((err) => {
  console.error("❌ Search scoring/cutoff tests failed:", err?.message || err);
  process.exit(1);
});
