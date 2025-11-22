import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
// Minimal TOML-like parser for simple key/value and [section] headers
function parseTomlSimple(raw) {
    const result = {};
    let current = result;
    const sectionStack = [];
    const getOrCreatePath = (obj, path) => {
        let node = obj;
        for (const key of path) {
            if (!node[key] || typeof node[key] !== "object")
                node[key] = {};
            node = node[key];
        }
        return node;
    };
    const lines = raw.split(/\r?\n/);
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("#"))
            continue;
        if (line.startsWith("[") && line.endsWith("]")) {
            const section = line.slice(1, -1).trim();
            const parts = section.split(".").map((s) => s.trim()).filter(Boolean);
            sectionStack.length = 0;
            sectionStack.push(...parts);
            current = getOrCreatePath(result, sectionStack);
            continue;
        }
        const eq = line.indexOf("=");
        if (eq === -1)
            continue;
        const k = line.slice(0, eq).trim();
        let v = line.slice(eq + 1).trim();
        // strip comments at end
        const hash = v.indexOf(" #");
        if (hash !== -1)
            v = v.slice(0, hash).trim();
        // remove quotes if present
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        else if (v === "true") {
            v = true;
        }
        else if (v === "false") {
            v = false;
        }
        else if (!isNaN(Number(v))) {
            v = Number(v);
        }
        const target = getOrCreatePath(result, sectionStack);
        target[k] = v;
    }
    return result;
}
function getConfigPath() {
    const dir = path.join(os.homedir(), ".grok");
    return path.join(dir, "config.toml");
}
export function loadTomlConfig() {
    const p = getConfigPath();
    if (!fs.existsSync(p))
        return null;
    try {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = parseTomlSimple(raw);
        return parsed || null;
    }
    catch {
        return null;
    }
}
// Supports dot notation: a.b.c=value
export function applyKeyValue(overrides, key, value) {
    const parts = key.split(".");
    let cursor = overrides;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!cursor[k] || typeof cursor[k] !== "object")
            cursor[k] = {};
        cursor = cursor[k];
    }
    // Best-effort type coercion
    const leaf = parts[parts.length - 1];
    let coerced = value;
    if (value === "true")
        coerced = true;
    else if (value === "false")
        coerced = false;
    else if (!isNaN(Number(value)))
        coerced = Number(value);
    cursor[leaf] = coerced;
}
export function resolveEffectiveConfig(cliOverrides, tomlConfig) {
    const cfg = {};
    const merged = { ...(tomlConfig || {}) };
    // Apply CLI overrides (highest precedence)
    if (cliOverrides) {
        const deepMerge = (target, src) => {
            for (const k of Object.keys(src)) {
                if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
                    if (!target[k] || typeof target[k] !== "object")
                        target[k] = {};
                    deepMerge(target[k], src[k]);
                }
                else {
                    target[k] = src[k];
                }
            }
            return target;
        };
        deepMerge(merged, cliOverrides);
    }
    cfg.model = merged.model;
    cfg.features = merged.features || {};
    const providerId = merged.model_provider;
    if (providerId && merged.model_providers && merged.model_providers[providerId]) {
        const pc = merged.model_providers[providerId];
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
//# sourceMappingURL=config.js.map