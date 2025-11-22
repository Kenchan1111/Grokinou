export interface ProviderConfig {
    name?: string;
    base_url?: string;
    env_key?: string;
    wire_api?: string;
    request_max_retries?: number;
    stream_idle_timeout_ms?: number;
}
export interface GrokTomlConfig {
    model?: string;
    model_provider?: string;
    model_providers?: Record<string, ProviderConfig>;
    features?: Record<string, boolean>;
    [key: string]: any;
}
export declare function loadTomlConfig(): GrokTomlConfig | null;
export type KeyValueOverrides = Record<string, any>;
export declare function applyKeyValue(overrides: KeyValueOverrides, key: string, value: string): void;
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
export declare function resolveEffectiveConfig(cliOverrides?: KeyValueOverrides, tomlConfig?: GrokTomlConfig | null): EffectiveConfig;
