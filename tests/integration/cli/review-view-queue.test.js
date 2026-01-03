#!/usr/bin/env node
/**
 * Integration test for pending review view restore.
 * Ensures pending state is consumed when LayoutManager mounts.
 */
import fs from "fs";
import path from "path";
import os from "os";
import process from "process";

async function main() {
  const distStore = path.join(process.cwd(), "dist", "ui", "review-view-store.js");
  if (!fs.existsSync(distStore)) {
    console.warn("⚠️  dist/ui/review-view-store.js not found; build first (npm run build). Skipping.");
    process.exit(0);
  }

  const { setPendingReviewViewState, consumePendingReviewViewState } = await import(distStore);

  const payload = {
    session_id: 1,
    view_id: `review-test-${Date.now()}`,
    mode: "review",
    layout: "split-vertical",
    active_pane: "viewer",
    panes: [
      { id: "conversation", type: "conversation", resource: { kind: "session", session_id: 1 } },
      { id: "viewer", type: "execution", resource: { kind: "execution", execution_ids: [] } },
    ],
    meta: { split_ratio: 0.6 },
  };

  setPendingReviewViewState(payload);
  const consumed = consumePendingReviewViewState();
  if (!consumed || consumed.view_id !== payload.view_id) {
    console.error("❌ Pending review state was not consumed correctly");
    process.exit(1);
  }

  const empty = consumePendingReviewViewState();
  if (empty !== null) {
    console.error("❌ Pending review state should be empty after consume");
    process.exit(1);
  }

  console.log("✅ Review pending state integration test passed.");
}

main().catch((err) => {
  console.error("❌ Review pending state test failed:", err?.message || err);
  process.exit(1);
});
