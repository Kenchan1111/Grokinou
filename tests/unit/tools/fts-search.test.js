#!/usr/bin/env node
/**
 * Unit tests for FTSSearch incremental indexing:
 * - initial index
 * - modification (sha change) reflected
 * - deletion reflected
 */
import fs from "fs";
import path from "path";
import os from "os";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "fts-search.js");

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/fts-search.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

let FTSSearch;
try {
  ({ FTSSearch } = await import(pathToFileUrl(distPath).href));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary incompatible with this Node.js runtime; " +
        "skipping FTSSearch unit tests. Try `npm rebuild` or reinstall."
    );
    process.exit(0);
  }
  console.error("❌ Failed to import FTSSearch:", err);
  process.exit(1);
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fts-search-test-"));
  const f1 = path.join(tmpDir, "a.js");
  fs.writeFileSync(f1, "hello world\n", "utf8");

  const fts = new FTSSearch(path.join(tmpDir, "fts.db")); // use temp db

  // Initial index
  await fts.indexDirectory(tmpDir);
  let results = fts.search("hello*", 10);
  if (!results.some((r) => r.path === f1)) {
    throw new Error("FTS did not find initial file");
  }

  // Modify file (sha change)
  fs.writeFileSync(f1, "bye world\n", "utf8");
  await fts.indexDirectory(tmpDir);
  results = fts.search("hello*", 10);
  if (results.some((r) => r.path === f1)) {
    throw new Error("FTS still returns old content after modification");
  }
  results = fts.search("bye", 10);
  if (!results.some((r) => r.path === f1)) {
    throw new Error("FTS did not pick up modified content");
  }

  // Delete file
  fs.unlinkSync(f1);
  await fts.indexDirectory(tmpDir);
  results = fts.search("bye", 10);
  if (results.some((r) => r.path === f1)) {
    throw new Error("FTS still returns deleted file");
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("✅ FTSSearch incremental tests passed.");
}

main().catch((err) => {
  console.error("❌ FTSSearch incremental tests failed:", err?.message || err);
  process.exit(1);
});
