#!/usr/bin/env node
import { JsonlExporter } from "./jsonl-exporter.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: any = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--db") opts.db = args[++i];
    else if (a === "--session") opts.session = Number(args[++i]);
    else if (a === "--out") opts.out = args[++i];
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const db = opts.db || "conversations";
  if (!["conversations", "timeline"].includes(db)) {
    console.error("❌ --db must be conversations or timeline");
    process.exit(1);
  }
  const exporter = new JsonlExporter({ db: db as any, sessionId: opts.session });
  exporter.export(opts.out);
  console.log(`✅ Exported ${db} to JSONL${opts.out ? ` → ${opts.out}` : ""}${opts.session ? ` (session ${opts.session})` : ""}`);
}

main().catch((e) => {
  console.error("❌ Export failed:", e);
  process.exit(1);
});
