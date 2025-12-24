#!/usr/bin/env node
/**
 * Static invariants pour les utilitaires restants (clipboard, paste, search-manager, git-rewind, etc.).
 *
 * On lit les fichiers source et vérifie la présence de fonctions/exports clés.
 */

import fs from "fs";
import path from "path";
import process from "process";

function fail(msg) {
  console.error("❌ utils remaining-static FAILED:", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✅", msg);
}

function mustContain(file, pattern, desc) {
  const rel = path.relative(process.cwd(), file);
  if (!fs.existsSync(file)) {
    fail(`Missing source file: ${rel}`);
  }
  const content = fs.readFileSync(file, "utf8");
  if (!pattern.test(content)) {
    fail(`${rel}: missing ${desc}`);
  }
}

const base = path.join(process.cwd(), "src", "utils");

// search-manager.ts
mustContain(
  path.join(base, "search-manager.ts"),
  /export\s+class\s+SearchManager/,
  "SearchManager class"
);
mustContain(
  path.join(base, "search-manager.ts"),
  /export\s+const\s+searchManager\s*=\s*new\s+SearchManager\(\)/,
  "searchManager singleton"
);

// git-rewind.ts: GitRewindManager
mustContain(
  path.join(base, "git-rewind.ts"),
  /export\s+class\s+GitRewindManager/,
  "GitRewindManager class export"
);

// clipboard-manager.ts
mustContain(
  path.join(base, "clipboard-manager.ts"),
  /export\s+class\s+ClipboardManager/,
  "ClipboardManager class"
);

// paste-manager.ts
mustContain(
  path.join(base, "paste-manager.ts"),
  /export\s+const\s+pasteManager/,
  "pasteManager singleton"
);

// paste-burst-detector.ts
mustContain(
  path.join(base, "paste-burst-detector.ts"),
  /export\s+const\s+pasteBurstDetector/,
  "pasteBurstDetector singleton"
);

// image-path-detector.ts
mustContain(
  path.join(base, "image-path-detector.ts"),
  /export\s+const\s+imagePathManager/,
  "imagePathManager singleton"
);

// input-history-manager.ts: appendInputHistory / loadInputHistory
mustContain(
  path.join(base, "input-history-manager.ts"),
  /export\s+async\s+function\s+appendInputHistory/,
  "appendInputHistory() export"
);
mustContain(
  path.join(base, "input-history-manager.ts"),
  /export\s+async\s+function\s+loadInputHistory/,
  "loadInputHistory() export"
);

// exec-async.ts
mustContain(
  path.join(base, "exec-async.ts"),
  /export\s+const\s+execAsync/,
  "execAsync const export"
);

// debug-logger.ts
mustContain(
  path.join(base, "debug-logger.ts"),
  /export\s+const\s+debugLog/,
  "debugLog singleton"
);

// help-formatter.ts
mustContain(
  path.join(base, "help-formatter.ts"),
  /export\s+class\s+HelpFormatter/,
  "HelpFormatter class"
);

// custom-instructions.ts
mustContain(
  path.join(base, "custom-instructions.ts"),
  /export\s+function\s+loadCustomInstructions/,
  "loadCustomInstructions() export"
);

// session-manager-sqlite.ts
mustContain(
  path.join(base, "session-manager-sqlite.ts"),
  /export\s+class\s+SessionManagerSQLite/,
  "SessionManagerSQLite class"
);
mustContain(
  path.join(base, "session-manager-sqlite.ts"),
  /export\s+const\s+sessionManager\s*=\s*SessionManagerSQLite\.getInstance\(\)/,
  "sessionManager singleton"
);

// session-manager.ts
mustContain(
  path.join(base, "session-manager.ts"),
  /export\s+async\s+function\s+loadChatHistory/,
  "legacy session-manager exports"
);

// settings.ts: re-export de getSettingsManager
mustContain(
  path.join(base, "settings.ts"),
  /export\s+{\s*getSettingsManager[^}]*}\s+from\s+'\.\/settings-manager\.js';/,
  "getSettingsManager re-export"
);

// text-utils.ts
mustContain(
  path.join(base, "text-utils.ts"),
  /export\s+function\s+insertText/,
  "insertText() export"
);

ok("utils remaining-static invariants OK.");
process.exit(0);
