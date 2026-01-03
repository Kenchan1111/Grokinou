#!/usr/bin/env node
/**
 * Integration test for /review-list and /review-view commands.
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
    console.warn("⚠️  Node runtime lacks addAbortListener; skipping review CLI tests.");
    process.exit(0);
  }
} catch {
  console.warn("⚠️  Cannot import node:events; skipping review CLI tests.");
  process.exit(0);
}

const repoRoot = process.cwd();
const distIndex = path.join(repoRoot, "dist", "index.js");
if (!fs.existsSync(distIndex)) {
  console.warn("⚠️  dist/index.js not found; build first (npm run build). Skipping.");
  process.exit(0);
}

function runCli(args, cwd, env) {
  return spawnSync("node", [distIndex, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env, TERM: "xterm-256color" },
  });
}

async function seedReviewEvent(tmpHome) {
  process.env.HOME = tmpHome;
  const { getTimelineDb } = await import(path.join(repoRoot, "dist", "timeline", "database.js"));
  const { EventBus } = await import(path.join(repoRoot, "dist", "timeline", "event-bus.js"));
  const { EventType } = await import(path.join(repoRoot, "dist", "timeline", "event-types.js"));

  const db = getTimelineDb();
  if (!db.healthCheck()) {
    throw new Error("Timeline DB health check failed");
  }

  const bus = EventBus.getInstance();
  const viewId = `review-test-${Date.now()}`;
  await bus.emit({
    event_type: EventType.REVIEW_VIEW_STATE,
    actor: "user",
    aggregate_id: "1",
    aggregate_type: "session",
    payload: {
      session_id: 1,
      view_id: viewId,
      mode: "review",
      layout: "split-vertical",
      active_pane: "viewer",
      panes: [
        { id: "conversation", type: "conversation", resource: { kind: "session", session_id: 1 } },
        { id: "viewer", type: "execution", resource: { kind: "execution", execution_ids: [] } },
      ],
      meta: { session_key: "1.20250101-000000.hashabcd" },
    },
  });

  return viewId;
}

async function main() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "review-cli-home-"));
  const grokDir = path.join(tmpHome, ".grok");
  fs.mkdirSync(grokDir, { recursive: true });

  const viewId = await seedReviewEvent(tmpHome);

  const listRes = runCli(["--raw", "--once", "/review-list --limit 5"], repoRoot, { HOME: tmpHome });
  if (listRes.status !== 0) {
    console.error("❌ /review-list exited with non-zero code", listRes.status, listRes.stderr);
    process.exit(1);
  }
  if (!listRes.stdout.includes("Review view states")) {
    console.error("❌ /review-list output missing header");
    process.exit(1);
  }
  if (!listRes.stdout.includes(viewId)) {
    console.error("❌ /review-list output missing view_id");
    process.exit(1);
  }

  const viewRes = runCli(["--raw", "--once", `/review-view ${viewId}`], repoRoot, { HOME: tmpHome });
  if (viewRes.status !== 0) {
    console.error("❌ /review-view exited with non-zero code", viewRes.status, viewRes.stderr);
    process.exit(1);
  }
  if (!viewRes.stdout.includes("Review view state")) {
    console.error("❌ /review-view output missing header");
    process.exit(1);
  }

  fs.rmSync(tmpHome, { recursive: true, force: true });
  console.log("✅ CLI review-list/review-view integration tests passed.");
}

main().catch((err) => {
  console.error("❌ Review CLI integration tests failed:", err?.message || err);
  process.exit(1);
});
