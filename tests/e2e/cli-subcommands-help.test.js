#!/usr/bin/env node
/**
 * E2E : vérifier que les sous-commandes du binaire compilé affichent bien leur aide/version.
 *
 * Pré-requis :
 * - dist/index.js présent (npm run build)
 * - better-sqlite3 compilé pour la version actuelle de Node (sinon skip propre)
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

const distIndex = path.join(process.cwd(), "dist", "index.js");

function isBinaryMismatch(output = "") {
  return (
    output.includes("NODE_MODULE_VERSION") ||
    output.includes("ERR_DLOPEN_FAILED") ||
    output.includes("was compiled against a different Node.js version")
  );
}

function skip(msg) {
  console.warn("⚠️  CLI subcommands help test skipped:", msg);
  process.exit(0);
}

function fail(msg, detail = "") {
  console.error("❌ CLI subcommands help FAILED:", msg);
  if (detail) console.error(detail);
  process.exit(1);
}

if (!fs.existsSync(distIndex)) {
  skip("dist/index.js not found (run `npm run build`).");
}

const scenarios = [
  {
    name: "--version",
    args: ["--version"],
    expect: [
      (out) => /\d+\.\d+\.\d+/.test(out),
    ],
  },
  {
    name: "git --help",
    args: ["git", "--help"],
    expect: [
      (out) => out.toLowerCase().includes("commit-and-push"),
      (out) => out.toLowerCase().includes("git operations"),
    ],
  },
  {
    name: "exec --help",
    args: ["exec", "--help"],
    expect: [
      (out) => out.toLowerCase().includes("jsonl"),
      (out) => out.toLowerCase().includes("non-interactively"),
    ],
  },
  {
    name: "mcp --help",
    args: ["mcp", "--help"],
    expect: [
      (out) => out.toLowerCase().includes("mcp"),
      (out) => out.toLowerCase().includes("server"),
    ],
  },
];

for (const scenario of scenarios) {
  const res = spawnSync(process.execPath, [distIndex, ...scenario.args], {
    encoding: "utf8",
    timeout: 20000,
  });

  const merged = `${res.stdout || ""}\n${res.stderr || ""}`;

  if (res.error) {
    const msg = res.error.message || String(res.error);
    if (isBinaryMismatch(msg)) {
      skip("better-sqlite3 binary incompatible with this Node.js version.");
    }
    fail(`Failed to spawn CLI for ${scenario.name}`, msg);
  }

  if (res.status !== 0) {
    if (isBinaryMismatch(merged)) {
      skip("better-sqlite3 binary incompatible with this Node.js version.");
    }
    fail(`CLI exited with status ${res.status} for ${scenario.name}`, merged);
  }

  for (const checker of scenario.expect) {
    if (!checker(merged)) {
      fail(`Output for ${scenario.name} missing expected content.`, merged);
    }
  }

  console.log(`✅ ${scenario.name} OK`);
}

console.log("✅ All CLI subcommand help/version paths reachable.");
