import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { getSettingsManager } from "./settings-manager.js";
function getUserGrokDir() {
    return path.join(os.homedir(), ".grok");
}
function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
}
function getInputHistoryFile() {
    const dir = getUserGrokDir();
    ensureDirSync(dir);
    return path.join(dir, "input-history.jsonl");
}
export async function appendInputHistory(entry) {
    try {
        const manager = getSettingsManager();
        const persist = manager.getUserSetting("persistInputHistory");
        if (persist === false)
            return;
    }
    catch { }
    const file = getInputHistoryFile();
    await fsp.appendFile(file, JSON.stringify({ input: entry, ts: Date.now() }) + "\n", {
        encoding: "utf-8",
        mode: 0o600,
    });
}
export async function loadInputHistory() {
    try {
        const manager = getSettingsManager();
        const persist = manager.getUserSetting("persistInputHistory");
        if (persist === false)
            return [];
    }
    catch { }
    const file = getInputHistoryFile();
    try {
        const data = await fsp.readFile(file, "utf-8");
        const lines = data.split("\n").filter(Boolean);
        const items = [];
        for (const line of lines) {
            try {
                const obj = JSON.parse(line);
                if (typeof obj.input === "string")
                    items.push(obj.input);
            }
            catch { }
        }
        return items;
    }
    catch (e) {
        if (e && e.code === "ENOENT")
            return [];
        return [];
    }
}
//# sourceMappingURL=input-history-manager.js.map