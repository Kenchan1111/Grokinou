#!/usr/bin/env node
/**
 * Integration test for /search-code and /search-code-advanced commands.
 * Spins up a tiny workspace, runs the CLI with the commands, and checks output.
 */
import fs from "fs";
import path from "path";
import os from "os";
import process from "process";
import { spawnSync } from "child_process";

// Skip if Node runtime lacks addAbortListener (Node < 18)
try {
  const ev = await import("node:events");
  if (!ev.addAbortListener) {
    console.warn("⚠️  Node runtime lacks addAbortListener; skipping CLI search integration tests.");
    process.exit(0);
  }
} catch {
  // If import fails, skip
  console.warn("⚠️  Cannot import node:events; skipping CLI search integration tests.");
  process.exit(0);
}

function runCli(args, cwd) {
  const exe = path.join(process.cwd(), "dist", "index.js");
  const res = spawnSync("node", [exe, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TERM: "xterm-256color" },
  });
  return res;
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-search-"));
  fs.writeFileSync(path.join(tmpDir, "a.js"), "function alpha() { return 1; }\n", "utf8");
  fs.writeFileSync(path.join(tmpDir, "b.js"), "function beta() { return 2; }\n", "utf8");

  // /search-code
  const resCode = runCli(["--raw", "--once", "/search-code function"], tmpDir);
  if (resCode.status !== 0) {
    console.error("❌ /search-code exited with non-zero code", resCode.status, resCode.stderr);
    process.exit(1);
  }
  const out = resCode.stdout || "";
  if (!/Search results for "function"/i.test(out)) {
    console.error("❌ /search-code output missing header");
    process.exit(1);
  }

  // /search-code-advanced (FTS)
  const resAdv = runCli(["--raw", "--once", "/search-code-advanced function"], tmpDir);
  if (resAdv.status !== 0) {
    console.error("❌ /search-code-advanced exited with non-zero code", resAdv.status, resAdv.stderr);
    process.exit(1);
  }
  const outAdv = resAdv.stdout || "";
  if (!/FTS results for "function"/i.test(outAdv)) {
    console.error("❌ /search-code-advanced output missing FTS header");
    process.exit(1);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("✅ CLI search-code/search-code-advanced integration tests passed.");
}

main().catch((err) => {
  console.error("❌ CLI search integration tests failed:", err?.message || err);
  process.exit(1);
});
