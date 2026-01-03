#!/usr/bin/env node
/**
 * Unit tests for SemanticSearchIndex with mock embeddings.
 */
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import assert from "assert";

process.env.GROKINOU_EMBEDDING_PROVIDER = "mock";
process.env.GROKINOU_EMBEDDING_API_KEY = "mock-key";

const distPath = path.join(process.cwd(), "dist", "tools", "semantic-search.js");
if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/semantic-search.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

const { SemanticSearchIndex } = await import(new URL(`file://${path.resolve(distPath)}`).href);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "semantic-search-"));
const filePath = path.join(tmpDir, "a.js");
fs.writeFileSync(filePath, "function alpha() { return 1; }\n// beta gamma", "utf8");

const dbPath = path.join(tmpDir, "semantic.db");
let index;
try {
  index = new SemanticSearchIndex(dbPath);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn("⚠️  better-sqlite3 binary incompatible; skipping semantic search tests.");
    process.exit(0);
  }
  throw err;
}
assert.strictEqual(index.isEnabled(), true);

const results = await index.semanticSearch(tmpDir, "alpha", 5);
assert.ok(results.length > 0, "Expected at least one semantic result");
assert.ok(results[0].path.includes("a.js"));

const scores = await index.rerankTexts("alpha", ["alpha test", "zzz"]);
assert.strictEqual(scores.length, 2);

console.log("✅ Semantic search unit tests passed.");
