#!/usr/bin/env node
/**
 * Static tests pour src/mcp/config.ts
 *
 * Objectifs:
 * - Vérifier que loadMCPConfig() renvoie une structure { servers: [...] }
 * - Vérifier que addMCPServer/removeMCPServer manipulent bien cette liste.
 *
 * On importe la version compilée si disponible.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "mcp", "config.js");

function fail(msg) {
  console.error("❌ MCP config test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/mcp/config.js not found, skipping MCP config tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { loadMCPConfig, addMCPServer, removeMCPServer } = await import(
  pathToFileUrl(distPath).href
);

// Charger config initiale
const initial = loadMCPConfig();
if (!initial || !Array.isArray(initial.servers)) {
  fail("loadMCPConfig() should return { servers: [] }");
}

// Ajouter un serveur factice, vérifier qu'il apparaît
const testServer = {
  name: "test-server",
  transport: {
    type: "stdio",
    command: "echo",
    args: ["hello"],
  },
};

addMCPServer(testServer);
const withServer = loadMCPConfig();
if (!withServer.servers.find((s) => s.name === "test-server")) {
  fail("addMCPServer() did not persist test-server");
}

// Supprimer le serveur, vérifier disparition
removeMCPServer("test-server");
const afterRemove = loadMCPConfig();
if (afterRemove.servers.find((s) => s.name === "test-server")) {
  fail("removeMCPServer() did not remove test-server");
}

pass("MCP config basic behavior OK.");

