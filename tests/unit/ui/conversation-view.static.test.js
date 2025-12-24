#!/usr/bin/env node
/**
 * Static invariants pour ConversationView (src/ui/components/ConversationView.tsx).
 *
 * On vérifie simplement la présence de l'export ConversationView et quelques
 * éléments clés (utilisation de Static, ChatHistory, LoadingSpinner).
 */

import fs from "fs";
import path from "path";
import process from "process";

const filePath = path.join(process.cwd(), "src", "ui", "components", "ConversationView.tsx");

function fail(msg) {
  console.error("❌ ConversationView static FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  fail("Missing src/ui/components/ConversationView.tsx");
}

const content = fs.readFileSync(filePath, "utf8");

if (!/export\s+const\s+ConversationView/.test(content)) {
  fail("ConversationView export missing");
}
if (!/Static\s+items=/.test(content)) {
  fail("ConversationView should use <Static> for committed history");
}
if (!/<ChatHistory/.test(content)) {
  fail("ConversationView should render <ChatHistory> for active messages");
}
if (!/LoadingSpinner/.test(content)) {
  fail("ConversationView should render LoadingSpinner when showStatus");
}

pass("ConversationView static invariants OK.");

