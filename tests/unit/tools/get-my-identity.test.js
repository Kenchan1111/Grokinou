#!/usr/bin/env node
/**
 * Static behavior test for get_my_identity tool.
 *
 * On ne modifie pas le code; on importe la version compilée si possible
 * et on appelle la fonction avec un agent factice minimal.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "get-my-identity.js");

function fail(msg) {
  console.error("❌ get_my_identity test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/get-my-identity.js not found, skipping get_my_identity tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { get_my_identity } = await import(pathToFileUrl(distPath).href).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NODE_MODULE_VERSION") || msg.includes("ERR_DLOPEN_FAILED")) {
    console.warn(
      "⚠️  better-sqlite3 binary is incompatible with this Node.js version; " +
        "skipping get_my_identity runtime test (requires dist DB layer)."
    );
    process.exit(0);
  }
  throw err;
});

async function main() {
  // Fake minimal agent with required methods
  const fakeAgent = {
    getCurrentModel() {
      return "grok-code-fast-1";
    },
    getApiKey() {
      return "xai-FAKE-APIKEY-1234567890";
    },
  };

  const res = await get_my_identity({}, fakeAgent);
  if (!res.success) {
    fail("get_my_identity returned failure");
  }
  if (!res.output || !res.output.includes("MY IDENTITY")) {
    fail("get_my_identity output does not contain expected header");
  }
  if (!res.output.includes("grok-code-fast-1")) {
    fail("get_my_identity output does not mention current model");
  }

  pass("get_my_identity basic behavior OK.");
}

main().catch((err) => fail(err?.message || String(err)));
