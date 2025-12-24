#!/usr/bin/env node
/**
 * Unit test for search_more tool logic using pre-populated cache.
 * Uses the SearchTool's internal cache to simulate a prior search with cutoff.
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
        "skipping search_more unit tests. Try `npm rebuild` or reinstall."
    );
    process.exit(0);
  }
  console.error("❌ Failed to import SearchTool:", err);
  process.exit(1);
}

async function main() {
  const tool = new SearchTool();
  const cache = tool["searchCache"];
  const searchId = cache.createSearch("q");

  // Pre-populate 6 results
  const rows = [];
  for (let i = 0; i < 6; i++) {
    rows.push({ file: `file${i}.txt`, line: i + 1, column: 0, text: `line ${i}`, score: 100 - i });
  }
  cache.addResults(searchId, rows);

  // First page
  let res = await tool.searchMore(searchId, 3);
  if (!res.success) throw new Error("searchMore page1 failed");
  if (!res.output.includes("file0.txt") || !res.output.includes("file2.txt")) {
    throw new Error("searchMore page1 missing expected files");
  }
  if (!res.output.includes("additional results remain cached")) {
    throw new Error("searchMore page1 should report remaining results");
  }

  // Second page should exhaust
  res = await tool.searchMore(searchId, 3);
  if (!res.success) throw new Error("searchMore page2 failed");
  if (!res.output.includes("file3.txt") || !res.output.includes("file5.txt")) {
    throw new Error("searchMore page2 missing expected files");
  }
  if (!res.output.includes("End of cached results")) {
    throw new Error("searchMore page2 should indicate end of results");
  }

  console.log("✅ search_more pagination test passed.");
}

main().catch((err) => {
  console.error("❌ search_more pagination test failed:", err?.message || err);
  process.exit(1);
});
