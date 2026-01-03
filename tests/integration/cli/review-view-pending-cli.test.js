#!/usr/bin/env node
/**
 * Integration test for pending + apply review view restore in search mode.
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
    console.warn("⚠️  Node runtime lacks addAbortListener; skipping pending review CLI tests.");
    process.exit(0);
  }
} catch {
  console.warn("⚠️  Cannot import node:events; skipping pending review CLI tests.");
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
  const viewId = `review-test-pending-${Date.now()}`;
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
        {
          id: "viewer",
          type: "execution",
          resource: { kind: "execution", execution_ids: [], selected_command_index: 0, scroll_offset: 0 },
          selection: { start_line: 0, end_line: 0 },
          scroll: { line: 0 },
        },
      ],
      meta: { session_key: "1.20250101-000000.hashabcd" },
    },
  });

  return viewId;
}

async function main() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "review-cli-pending-"));
  const grokDir = path.join(tmpHome, ".grok");
  fs.mkdirSync(grokDir, { recursive: true });

  const viewId = await seedReviewEvent(tmpHome);

  const env = {
    HOME: tmpHome,
    GROKINOU_TEST_FORCE_SEARCH_MODE: "1",
    GROKINOU_TEST_ALLOW_INPUT_IN_SEARCH: "1",
    GROKINOU_TEST_AUTO_EXIT_SEARCH_MS: "50",
    GROKINOU_TEST_LOG_REVIEW_APPLY: "1",
  };

  const viewRes = runCli(["--raw", "--once", `/review-view ${viewId}`], repoRoot, env);
  if (viewRes.status !== 0) {
    console.error("❌ /review-view (pending) exited with non-zero code", viewRes.status, viewRes.stderr);
    process.exit(1);
  }
  if (!viewRes.stdout.includes("Review view state")) {
    console.error("❌ /review-view output missing header");
    process.exit(1);
  }
  if (!viewRes.stdout.includes("Applied pending review view state")) {
    console.error("❌ pending review view state was not applied");
    process.exit(1);
  }

  fs.rmSync(tmpHome, { recursive: true, force: true });
  console.log("✅ CLI pending review-view apply test passed.");
}

main().catch((err) => {
  console.error("❌ CLI pending review-view apply test failed:", err?.message || err);
  process.exit(1);
});
