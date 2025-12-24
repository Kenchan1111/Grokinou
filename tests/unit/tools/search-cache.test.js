#!/usr/bin/env node
/**
 * Unit tests for SearchCache (cursor pagination, atomic counters, TTL cleanup).
 * Run after build: npm run build && node tests/unit/tools/search-cache.test.js
 */
import path from "path";
import os from "os";
import fs from "fs";
import assert from "assert";

const distPath = path.join(process.cwd(), "dist", "utils", "search-cache.js");

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/utils/search-cache.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

let SearchCache;
try {
  ({ SearchCache } = await import(pathToFileUrl(distPath).href));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary incompatible with this Node.js runtime; " +
        "skipping SearchCache unit tests. Try `npm rebuild` or reinstall."
    );
    process.exit(0);
  }
  console.error("❌ Failed to import SearchCache:", err);
  process.exit(1);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

function tmpDb() {
  const file = path.join(os.tmpdir(), `search-cache-test-${Date.now()}-${Math.random()}.db`);
  return file;
}

async function testCursorPagination() {
  const dbPath = tmpDb();
  const cache = new SearchCache(dbPath);
  const searchId = cache.createSearch("q");
  const rows = [];
  for (let i = 0; i < 10; i++) {
    rows.push({ file: `f${i}.txt`, line: i + 1, column: 0, text: `line ${i}`, score: 100 - i });
  }
  cache.addResults(searchId, rows);

  // First page
  let page = cache.getNextResults(searchId, null, 3);
  assert.strictEqual(page.length, 3, "page1 length");
  assert.strictEqual(page[0].file, "f0.txt");
  const lastId1 = page[page.length - 1].id;

  // Second page using cursor (id > last)
  page = cache.getNextResults(searchId, lastId1, 3);
  assert.strictEqual(page.length, 3, "page2 length");
  assert.strictEqual(page[0].file, "f3.txt");

  // Mark shown and remaining
  const remaining = cache.markShownAndGetRemaining(searchId, 6, page[page.length - 1].id);
  assert.strictEqual(remaining, 4, "remaining after 6 shown");
}

async function testTTL() {
  const dbPath = tmpDb();
  const cache = new SearchCache(dbPath);
  const id1 = cache.createSearch("old");
  cache.addResults(id1, [{ file: "a.txt" }]);
  // Backdate created_at
  cache["db"]
    .prepare(`UPDATE searches SET created_at = ? WHERE id = ?`)
    .run(Date.now() - 72 * 60 * 60 * 1000, id1);

  const id2 = cache.createSearch("new");
  cache.addResults(id2, [{ file: "b.txt" }]);

  await cache.cleanupOldSearches(48 * 60 * 60 * 1000);
  const rows = cache["db"].prepare(`SELECT id FROM searches ORDER BY id`).all();
  assert.deepStrictEqual(rows.map((r) => r.id), [id2], "TTL cleanup should keep only recent search");
}

async function testMarkShownAtomic() {
  const dbPath = tmpDb();
  const cache = new SearchCache(dbPath);
  const sid = cache.createSearch("q");
  cache.addResults(sid, [{ file: "a" }, { file: "b" }]);
  const remaining1 = cache.markShownAndGetRemaining(sid, 1, 1);
  const remaining2 = cache.markShownAndGetRemaining(sid, 1, 2);
  assert.strictEqual(remaining1, 1, "remaining after first mark");
  assert.strictEqual(remaining2, 0, "remaining after second mark");
}

async function main() {
  try {
    // Quick instantiation check to catch native binary issues
    const cache = new SearchCache(tmpDb());
    cache.createSearch("probe");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
      console.warn(
        "⚠️  better-sqlite3 binary incompatible with this Node.js runtime; " +
          "skipping SearchCache unit tests. Try `npm rebuild` or reinstall."
      );
      process.exit(0);
    }
    throw err;
  }

  await testCursorPagination();
  await testTTL();
  await testMarkShownAtomic();
  console.log("✅ SearchCache unit tests passed.");
}

main().catch((err) => {
  console.error("❌ SearchCache unit tests failed:", err);
  process.exit(1);
});
