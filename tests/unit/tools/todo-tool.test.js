#!/usr/bin/env node
/**
 * Static behavior tests for TodoTool (src/tools/todo-tool.ts).
 *
 * On ne modifie pas le code source; on vérifie la logique en important
 * la version compilée si disponible.
 */

import fs from "fs";
import path from "path";
import process from "process";

const distPath = path.join(process.cwd(), "dist", "tools", "todo-tool.js");

function fail(msg) {
  console.error("❌ TodoTool test FAILED:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("✅", msg);
  process.exit(0);
}

if (!fs.existsSync(distPath)) {
  console.warn("⚠️  dist/tools/todo-tool.js not found, skipping TodoTool tests (build first with `npm run build`).");
  process.exit(0);
}

function pathToFileUrl(p) {
  const url = new URL("file://");
  url.pathname = path.resolve(p).replace(/\\/g, "/");
  return url;
}

const { TodoTool } = await import(pathToFileUrl(distPath).href);

async function main() {
  const tool = new TodoTool();

  // 1) createTodoList with valid todos
  const todos = [
    { id: "1", content: "First task", status: "pending", priority: "high" },
    { id: "2", content: "Second task", status: "in_progress", priority: "medium" },
    { id: "3", content: "Done task", status: "completed", priority: "low" },
  ];
  const resCreate = await tool.createTodoList(todos);
  if (!resCreate.success) {
    fail("createTodoList failed with valid todos");
  }
  if (!resCreate.output || !resCreate.output.includes("First task")) {
    fail("createTodoList output does not contain todo content");
  }

  // 2) updateTodoList changes status & content
  const resUpdate = await tool.updateTodoList([
    { id: "1", status: "completed", content: "First task done" },
  ]);
  if (!resUpdate.success) {
    fail("updateTodoList failed for existing id");
  }
  if (!resUpdate.output.includes("First task done")) {
    fail("updateTodoList output does not reflect updated content");
  }

  // 3) updateTodoList with unknown id should fail
  const resBad = await tool.updateTodoList([{ id: "999", status: "pending" }]);
  if (resBad.success) {
    fail("updateTodoList should fail for unknown id");
  }

  pass("TodoTool basic behavior OK.");
}

main().catch((err) => fail(err?.message || String(err)));

