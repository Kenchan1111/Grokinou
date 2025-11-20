import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { ChatEntry } from "../agent/grok-agent.js";

export interface SessionState {
  version: number;
  model?: string;
  autoEditEnabled?: boolean;
  cwd?: string;
}

function getProjectGrokDir(): string {
  return path.join(process.cwd(), ".grok");
}

function ensureDirSync(dir: string) {
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

function serializeEntry(entry: ChatEntry): string {
  // Convert Date to ISO
  const plain = {
    ...entry,
    timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
    // Ensure undefined fields don't get dropped in an inconsistent way
    toolCalls: entry.toolCalls || undefined,
    toolCall: entry.toolCall || undefined,
    toolResult: entry.toolResult || undefined,
    isStreaming: false,
  } as any;
  return JSON.stringify(plain);
}

function deserializeEntry(line: string): ChatEntry | null {
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
    } as ChatEntry;
  } catch {
    return null;
  }
}

export async function appendChatEntry(entry: ChatEntry): Promise<void> {
  const { dir, sessionLines } = getSessionFiles();
  ensureDirSync(dir);
  const payload = serializeEntry(entry) + "\n";
  await fsp.appendFile(sessionLines, payload, { encoding: "utf-8" });
}

export async function loadChatHistory(): Promise<ChatEntry[]> {
  const { sessionLines } = getSessionFiles();
  try {
    const data = await fsp.readFile(sessionLines, "utf-8");
    const lines = data.split("\n").filter(Boolean);
    const entries: ChatEntry[] = [];
    for (const line of lines) {
      const e = deserializeEntry(line);
      if (e) entries.push(e);
    }
    return entries;
  } catch (e: any) {
    if (e && e.code === "ENOENT") return [];
    // Corruption: return empty history
    return [];
  }
}

export async function saveState(state: SessionState): Promise<void> {
  const { dir, stateFile } = getSessionFiles();
  ensureDirSync(dir);
  const payload = JSON.stringify(state, null, 2);
  await fsp.writeFile(stateFile, payload, { encoding: "utf-8", mode: 0o600 });
}

export async function loadState(): Promise<SessionState | null> {
  const { stateFile } = getSessionFiles();
  try {
    const data = await fsp.readFile(stateFile, "utf-8");
    return JSON.parse(data) as SessionState;
  } catch (e: any) {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const { sessionLines, stateFile } = getSessionFiles();
  try { await fsp.unlink(sessionLines); } catch {}
  try { await fsp.unlink(stateFile); } catch {}
}

