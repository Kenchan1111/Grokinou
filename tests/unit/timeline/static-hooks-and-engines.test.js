#!/usr/bin/env node
/**
 * Static invariants pour le module timeline/ (hooks, engines, logger, index).
 *
 * Objectifs:
 * - Vérifier que les principaux exports existent dans les fichiers src/timeline/*.ts
 * - Sans toucher au code ni exécuter de DB.
 *
 * Ce test lit les fichiers source et cherche des signatures/export clés.
 */

import fs from "fs";
import path from "path";
import process from "process";

function fail(msg) {
  console.error("❌ timeline static invariants FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

function mustContain(file, pattern, desc) {
  const content = fs.readFileSync(file, "utf8");
  if (!pattern.test(content)) {
    fail(`${path.relative(process.cwd(), file)}: missing ${desc}`);
  }
}

const base = path.join(process.cwd(), "src", "timeline");

// event-bus.ts: EventBus class
const eventBusPath = path.join(base, "event-bus.ts");
mustContain(
  eventBusPath,
  /export\s+class\s+EventBus/,
  "EventBus class export"
);

// timeline-logger.ts: TimelineLogger + getTimelineLogger
const loggerPath = path.join(base, "timeline-logger.ts");
mustContain(
  loggerPath,
  /export\s+class\s+TimelineLogger/,
  "TimelineLogger class"
);
mustContain(
  loggerPath,
  /export\s+function\s+getTimelineLogger/,
  "getTimelineLogger() export"
);

// storage/merkle-dag.ts: MerkleDAG
const merklePath = path.join(base, "storage", "merkle-dag.ts");
mustContain(
  merklePath,
  /export\s+class\s+MerkleDAG/,
  "MerkleDAG class export"
);

// rewind-engine.ts: RewindEngine + getRewindEngine
const rewindPath = path.join(base, "rewind-engine.ts");
mustContain(
  rewindPath,
  /export\s+class\s+RewindEngine/,
  "RewindEngine class"
);
mustContain(
  rewindPath,
  /export\s+function\s+getRewindEngine/,
  "getRewindEngine() export"
);

// snapshot-manager.ts: SnapshotManager + getSnapshotManager
const snapshotPath = path.join(base, "snapshot-manager.ts");
mustContain(
  snapshotPath,
  /export\s+class\s+SnapshotManager/,
  "SnapshotManager class"
);
mustContain(
  snapshotPath,
  /export\s+function\s+getSnapshotManager/,
  "getSnapshotManager() export"
);

// query-engine.ts: QueryEngine + getQueryEngine
const queryPath = path.join(base, "query-engine.ts");
mustContain(
  queryPath,
  /export\s+class\s+QueryEngine/,
  "QueryEngine class"
);
mustContain(
  queryPath,
  /export\s+function\s+getQueryEngine/,
  "getQueryEngine() export"
);

// hooks: LLMHook, ToolHook, SessionHook, FileHook, GitHook via getXHook
const hooks = [
  { file: "hooks/llm-hook.ts", fn: "getLLMHook" },
  { file: "hooks/tool-hook.ts", fn: "getToolHook" },
  { file: "hooks/session-hook.ts", fn: "getSessionHook" },
  { file: "hooks/file-hook.ts", fn: "getFileHook" },
  { file: "hooks/git-hook.ts", fn: "getGitHook" },
];

for (const h of hooks) {
  const p = path.join(base, h.file);
  mustContain(
    p,
    new RegExp(`export\\s+function\\s+${h.fn}`),
    `${h.fn}() export`
  );
}

// index.ts: initTimeline() export
const indexPath = path.join(base, "index.ts");
mustContain(
  indexPath,
  /export\s+async\s+function\s+initTimeline/,
  "initTimeline() export in index"
);

pass("timeline static invariants OK.");
