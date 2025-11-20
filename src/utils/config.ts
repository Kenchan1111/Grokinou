import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
// Minimal TOML-like parser for simple key/value and [section] headers
function parseTomlSimple(raw: string): any {
  const result: any = {};
  let current: any = result;
  const sectionStack: string[] = [];
  const getOrCreatePath = (obj: any, path: string[]) => {
    let node = obj;
    for (const key of path) {
      if (!node[key] || typeof node[key] !== "object") node[key] = {};
      node = node[key];
    }
    return node;
  };
  const lines = raw.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      const section = line.slice(1, -1).trim();
      const parts = section.split(".").map((s) => s.trim()).filter(Boolean);
      sectionStack.length = 0;
      sectionStack.push(...parts);
      current = getOrCreatePath(result, sectionStack);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v: any = line.slice(eq + 1).trim();
    // strip comments at end
    const hash = v.indexOf(" #");
    if (hash !== -1) v = v.slice(0, hash).trim();
    // remove quotes if present
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else if (v === "true") {
      v = true;
    } else if (v === "false") {
      v = false;
    } else if (!isNaN(Number(v))) {
      v = Number(v);
    }
    const target = getOrCreatePath(result, sectionStack);
    target[k] = v;
  }
  return result;
}

export interface ProviderConfig {
  name?: string;
  base_url?: string;
  env_key?: string; // environment variable name for API key
  wire_api?: string; // e.g. "chat" or "responses" (informational for now)
  request_max_retries?: number;
  stream_idle_timeout_ms?: number;
}

export interface GrokTomlConfig {
  model?: string;
  model_provider?: string;
  model_providers?: Record<string, ProviderConfig>;
  features?: Record<string, boolean>;
  // additional keys allowed
  [key: string]: any;
}

function getConfigPath(): string {
  const dir = path.join(os.homedir(), ".grok");
  return path.join(dir, "config.toml");
}

export function loadTomlConfig(): GrokTomlConfig | null {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = parseTomlSimple(raw) as GrokTomlConfig;
    return parsed || null;
  } catch {
    return null;
  }
}

export type KeyValueOverrides = Record<string, any>;

// Supports dot notation: a.b.c=value
export function applyKeyValue(overrides: KeyValueOverrides, key: string, value: string) {
  const parts = key.split(".");
  let cursor: any = overrides;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cursor[k] || typeof cursor[k] !== "object") cursor[k] = {};
    cursor = cursor[k];
  }
  // Best-effort type coercion
  const leaf = parts[parts.length - 1];
  let coerced: any = value;
  if (value === "true") coerced = true;
  else if (value === "false") coerced = false;
  else if (!isNaN(Number(value))) coerced = Number(value);
  cursor[leaf] = coerced;
}

export interface ResolvedProvider {
  id: string;
  baseURL?: string;
  apiKey?: string;
  wireAPI?: string;
  requestMaxRetries?: number;
  streamIdleTimeoutMs?: number;
}

export interface EffectiveConfig {
  model?: string;
  provider?: ResolvedProvider;
  features?: Record<string, boolean>;
}

export function resolveEffectiveConfig(
  cliOverrides?: KeyValueOverrides,
  tomlConfig?: GrokTomlConfig | null
): EffectiveConfig {
  const cfg: EffectiveConfig = {};
  const merged: any = { ...(tomlConfig || {}) };

  // Apply CLI overrides (highest precedence)
  if (cliOverrides) {
    const deepMerge = (target: any, src: any) => {
      for (const k of Object.keys(src)) {
        if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
          if (!target[k] || typeof target[k] !== "object") target[k] = {};
          deepMerge(target[k], src[k]);
        } else {
          target[k] = src[k];
        }
      }
      return target;
    };
    deepMerge(merged, cliOverrides);
  }

  cfg.model = merged.model;
  cfg.features = merged.features || {};

  const providerId: string | undefined = merged.model_provider;
  if (providerId && merged.model_providers && merged.model_providers[providerId]) {
    const pc: ProviderConfig = merged.model_providers[providerId];
    const apiKey = pc.env_key ? process.env[pc.env_key] : undefined;
    cfg.provider = {
      id: providerId,
      baseURL: pc.base_url,
      apiKey,
      wireAPI: pc.wire_api,
      requestMaxRetries: pc.request_max_retries,
      streamIdleTimeoutMs: pc.stream_idle_timeout_ms,
    };
  }

  return cfg;
}
