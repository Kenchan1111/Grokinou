#!/usr/bin/env node
/**
 * Static tests pour src/mcp/transports.ts
 *
 * Objectifs:
 * - Vérifier que createTransport() accepte les 4 types: stdio, http, sse, streamable_http
 * - Vérifier que getType() renvoie le bon type pour chaque transport.
 *
 * On importe dist/mcp/transports.js si disponible.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "mcp", "transports.js");

function fail(msg) {
  console.error("❌ MCP transports test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/mcp/transports.js not found, skipping MCP transports tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { createTransport } = await import(pathToFileUrl(distPath).href);

const stdio = createTransport({
  type: "stdio",
  command: "echo",
  args: ["ok"],
});
if (stdio.getType() !== "stdio") fail("Stdio transport getType() mismatch");

const http = createTransport({
  type: "http",
  url: "http://localhost:1234",
});
if (http.getType() !== "http") fail("Http transport getType() mismatch");

const sse = createTransport({
  type: "sse",
  url: "http://localhost:1234/sse",
});
if (sse.getType() !== "sse") fail("SSE transport getType() mismatch");

const streamable = createTransport({
  type: "streamable_http",
  url: "http://localhost:1234",
});
if (streamable.getType() !== "streamable_http")
  fail("Streamable_http transport getType() mismatch");

pass("MCP transports basic behavior OK.");

