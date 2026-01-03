#!/usr/bin/env node
/**
 * E2E workflow: search-code + review-view using raw CLI mode.
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
    console.warn("⚠️  Node runtime lacks addAbortListener; skipping E2E workflow test.");
    process.exit(0);
  }
} catch {
  console.warn("⚠️  Cannot import node:events; skipping E2E workflow test.");
  process.exit(0);
}

const distIndex = path.join(process.cwd(), "dist", "index.js");
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
  const { getTimelineDb } = await import(path.join(process.cwd(), "dist", "timeline", "database.js"));
  const { EventBus } = await import(path.join(process.cwd(), "dist", "timeline", "event-bus.js"));
  const { EventType } = await import(path.join(process.cwd(), "dist", "timeline", "event-types.js"));

  const db = getTimelineDb();
  if (!db.healthCheck()) {
    throw new Error("Timeline DB health check failed");
  }

  const bus = EventBus.getInstance();
  const viewId = `review-e2e-${Date.now()}`;
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-search-"));
  fs.writeFileSync(path.join(tmpDir, "a.js"), "function alpha() { return 1; }\n", "utf8");

  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-home-"));
  fs.mkdirSync(path.join(tmpHome, ".grok"), { recursive: true });

  const resSearch = runCli(["--raw", "--once", "/search-code function"], tmpDir, { HOME: tmpHome });
  if (resSearch.status !== 0 || !/Search results/i.test(resSearch.stdout)) {
    console.error("❌ E2E search-code failed");
    process.exit(1);
  }

  const viewId = await seedReviewEvent(tmpHome);
  const resReview = runCli(["--raw", "--once", `/review-view ${viewId}`], tmpDir, { HOME: tmpHome });
  if (resReview.status !== 0 || !/Review view state/i.test(resReview.stdout)) {
    console.error("❌ E2E review-view failed");
    process.exit(1);
  }

  console.log("✅ E2E search + review workflow passed.");
}

main().catch((err) => {
  console.error("❌ E2E workflow failed:", err?.message || err);
  process.exit(1);
});
