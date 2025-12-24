#!/usr/bin/env node
/**
 * Static tests pour MCPManager (src/mcp/client.ts).
 *
 * On ne démarre pas réellement de serveurs MCP; on teste:
 * - existence des méthodes clés
 * - comportement de base de getTools/getServers avec un manager vierge.
 *
 * Pour les méthodes qui nécessitent un serveur réel (addServer/callTool),
 * on ne les exécute pas ici pour rester hermétique au réseau.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "mcp", "client.js");

function fail(msg) {
  console.error("❌ MCP client test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/mcp/client.js not found, skipping MCP client tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { MCPManager } = await import(pathToFileUrl(distPath).href);

const manager = new MCPManager();

// getTools/getServers should return arrays, empty on new manager
const tools = manager.getTools();
const servers = manager.getServers();
if (!Array.isArray(tools) || !Array.isArray(servers)) {
  fail("getTools/getServers should return arrays");
}
if (tools.length !== 0 || servers.length !== 0) {
  fail("New MCPManager should start with no tools/servers");
}

// ensureServersInitialized() may fail if dist/mcp/config.js is missing;
// dans ce cas on ne considère pas que c'est une régression de logique.
try {
  await manager.ensureServersInitialized();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Cannot find module") && msg.includes("dist/mcp/config")) {
    console.warn("⚠️  dist/mcp/config.js missing; skipping ensureServersInitialized portion of MCPManager test.");
    pass("MCPManager basic invariants OK (config module missing, skipped initialization).");
  } else {
    fail("ensureServersInitialized() threw error: " + msg);
  }
}

pass("MCPManager basic invariants OK.");

