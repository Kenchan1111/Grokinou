#!/usr/bin/env node
/**
 * Unit tests for SearchTool.search and searchMore end-to-end on a tiny corpus.
 * Requires rg installed and dist build available.
 */
import fs from "fs";
import path from "path";
import process from "process";
import os from "os";
import { spawnSync } from "child_process";

const distPath = path.join(process.cwd(), "dist", "tools", "search.js");

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/search.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

// Check rg availability
const rgCheck = spawnSync("rg", ["--version"], { encoding: "utf8" });
if (rgCheck.error || rgCheck.status !== 0) {
  console.warn("⚠️  ripgrep (rg) not found, skipping SearchTool tests.");
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
        "skipping SearchTool tests. Try `npm rebuild` or reinstall."
    );
    process.exit(0);
  }
  console.error("❌ Failed to import SearchTool:", err);
  process.exit(1);
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "search-basic-"));
  const fileA = path.join(tmpDir, "a.js");
  const fileB = path.join(tmpDir, "b.js");
  fs.writeFileSync(fileA, "function foo() { return 1; }\n", "utf8");
  fs.writeFileSync(fileB, "function bar() { return 2; }\n", "utf8");

  const tool = new SearchTool();
  const origCwd = process.cwd();
  process.chdir(tmpDir);

  const res = await tool.search("function", { searchType: "text", searchContext: "foo", maxResults: 1 });
  process.chdir(origCwd);

  if (!res.success) throw new Error("search() failed");
  if (!res.output || !res.output.includes("Search results for")) {
    throw new Error("search() output not formatted as expected");
  }
  if (!res.output.includes("function")) {
    throw new Error("search() output missing query term");
  }
  // Should either return all or indicate remaining; accept both
  const hasRemaining = res.output.match(/additional results/i);

  if (hasRemaining) {
    const searchIdMatch = res.output.match(/search #(\d+)/);
    if (!searchIdMatch) throw new Error("search_id not found in output");
    const searchId = Number(searchIdMatch[1]);
    const more = await tool.searchMore(searchId, 5);
    if (!more.success) throw new Error("searchMore() failed");
    if (!more.output.includes("a.js") && !more.output.includes("b.js")) {
      throw new Error("searchMore() missing expected filenames");
    }
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("✅ SearchTool search/searchMore E2E test passed.");
}

main().catch((err) => {
  console.error("❌ SearchTool search/searchMore test failed:", err?.message || err);
  process.exit(1);
});
