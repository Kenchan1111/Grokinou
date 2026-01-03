import OpenAI from "openai";
import crypto from "crypto";
import { getSettingsManager } from "./settings-manager.js";
import { providerManager } from "./provider-manager.js";

export interface EmbeddingConfig {
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

export function resolveEmbeddingConfig(): EmbeddingConfig | null {
  const settings = getSettingsManager();
  const provider =
    process.env.GROKINOU_EMBEDDING_PROVIDER ||
    providerManager.detectProvider(process.env.GROKINOU_EMBEDDING_MODEL || "grok");
  const model = process.env.GROKINOU_EMBEDDING_MODEL || "text-embedding-3-small";
  const providerCfg = providerManager.getProvider(provider);
  const baseURL = process.env.GROKINOU_EMBEDDING_BASE_URL || providerCfg?.baseURL || settings.getBaseURL();
  const apiKey =
    process.env.GROKINOU_EMBEDDING_API_KEY ||
    settings.getApiKeyForProvider(provider) ||
    settings.getApiKey();

  if (!apiKey) return null;
  return { provider, apiKey, baseURL, model };
}

export class EmbeddingClient {
  private cfg: EmbeddingConfig;
  private client: OpenAI | null;

  constructor(cfg: EmbeddingConfig) {
    this.cfg = cfg;
    this.client = cfg.provider === "mock"
      ? null
      : new OpenAI({
        apiKey: cfg.apiKey,
        baseURL: cfg.baseURL,
      });
  }

  static isAvailable(): boolean {
    return resolveEmbeddingConfig() !== null;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (this.cfg.provider === "mock") {
      return texts.map((text) => {
        const hash = crypto.createHash("sha256").update(text, "utf8").digest();
        const vec = Array.from(hash.slice(0, 8)).map((b) => b / 255);
        return vec;
      });
    }

    if (!this.client) {
      throw new Error("Embedding client not initialized");
    }
    const resp = await this.client.embeddings.create({
      model: this.cfg.model,
      input: texts,
    });
    return resp.data.map((item) => item.embedding as number[]);
  }
}
