#!/usr/bin/env node
/**
 * Simple benchmark for code search (ripgrep + ranking).
 * Usage: node scripts/performance/fts-search-benchmark.mjs "query"
 */
import process from "process";
import { getSharedSearchTool } from "../../dist/tools/shared-search.js";

const query = process.argv.slice(2).join(" ").trim() || "function";
const tool = getSharedSearchTool();

const start = process.hrtime.bigint();
const res = await tool.search(query, {});
const end = process.hrtime.bigint();
const ms = Number(end - start) / 1e6;

console.log(`Query: "${query}"`);
console.log(`Duration: ${ms.toFixed(2)} ms`);
console.log(res.success ? "Status: OK" : `Status: ERROR - ${res.error}`);
