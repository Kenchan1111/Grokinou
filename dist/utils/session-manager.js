import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
function getProjectGrokDir() {
    return path.join(process.cwd(), ".grok");
}
function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
}
function getSessionFiles() {
    const dir = getProjectGrokDir();
    const sessionLines = path.join(dir, "session.jsonl");
    const stateFile = path.join(dir, "session.state.json");
    return { dir, sessionLines, stateFile };
}
function serializeEntry(entry) {
    // Convert Date to ISO
    const plain = {
        ...entry,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
        // Ensure undefined fields don't get dropped in an inconsistent way
        toolCalls: entry.toolCalls || undefined,
        toolCall: entry.toolCall || undefined,
        toolResult: entry.toolResult || undefined,
        isStreaming: false,
    };
    return JSON.stringify(plain);
}
function deserializeEntry(line) {
    try {
        const obj = JSON.parse(line);
        return {
            type: obj.type,
            content: obj.content,
            timestamp: obj.timestamp ? new Date(obj.timestamp) : new Date(),
            toolCalls: obj.toolCalls,
            toolCall: obj.toolCall,
            toolResult: obj.toolResult,
            isStreaming: false,
        };
    }
    catch {
        return null;
    }
}
export async function appendChatEntry(entry) {
    const { dir, sessionLines } = getSessionFiles();
    ensureDirSync(dir);
    const payload = serializeEntry(entry) + "\n";
    await fsp.appendFile(sessionLines, payload, { encoding: "utf-8" });
}
export async function loadChatHistory() {
    const { sessionLines } = getSessionFiles();
    try {
        const data = await fsp.readFile(sessionLines, "utf-8");
        const lines = data.split("\n").filter(Boolean);
        const entries = [];
        for (const line of lines) {
            const e = deserializeEntry(line);
            if (e)
                entries.push(e);
        }
        return entries;
    }
    catch (e) {
        if (e && e.code === "ENOENT")
            return [];
        // Corruption: return empty history
        return [];
    }
}
export async function saveState(state) {
    const { dir, stateFile } = getSessionFiles();
    ensureDirSync(dir);
    const payload = JSON.stringify(state, null, 2);
    await fsp.writeFile(stateFile, payload, { encoding: "utf-8", mode: 0o600 });
}
export async function loadState() {
    const { stateFile } = getSessionFiles();
    try {
        const data = await fsp.readFile(stateFile, "utf-8");
        return JSON.parse(data);
    }
    catch (e) {
        return null;
    }
}
export async function clearSession() {
    const { sessionLines, stateFile } = getSessionFiles();
    try {
        await fsp.unlink(sessionLines);
    }
    catch { }
    try {
        await fsp.unlink(stateFile);
    }
    catch { }
}
//# sourceMappingURL=session-manager.js.map