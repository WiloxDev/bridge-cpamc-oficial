import type { Model } from "@earendil-works/pi-ai";
import { DEFAULT_CPAMC_URL, PROVIDER_ID } from "./types.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ZERO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};

const DEFAULT_FALLBACK_MODELS: Model<any>[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek V3 (via CPAMC)",
    provider: PROVIDER_ID,
    api: "openai-responses",
    baseUrl: `${DEFAULT_CPAMC_URL}/backend-api`,
    cost: ZERO_COST,
    contextWindow: 128_000,
    maxTokens: 8_192,
    reasoning: false,
    input: ["text"]
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1 (via CPAMC)",
    provider: PROVIDER_ID,
    api: "openai-responses",
    baseUrl: `${DEFAULT_CPAMC_URL}/backend-api`,
    cost: ZERO_COST,
    contextWindow: 128_000,
    maxTokens: 8_192,
    reasoning: true,
    input: ["text"]
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet (via CPAMC)",
    provider: PROVIDER_ID,
    api: "openai-responses",
    baseUrl: `${DEFAULT_CPAMC_URL}/backend-api`,
    cost: ZERO_COST,
    contextWindow: 200_000,
    maxTokens: 16_000,
    reasoning: true,
    input: ["text", "image"]
  }
];

function getCachePath(): string {
  const dir = join(homedir(), ".gentle-shell", "agent");
  mkdirSync(dir, { recursive: true });
  return join(dir, "cpamc-models.json");
}

export async function fetchCpamcModels(baseUrl: string = DEFAULT_CPAMC_URL): Promise<Model<any>[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

      if (rawList.length > 0) {
        const mapped: Model<any>[] = rawList.map((m: any) => ({
          id: m.id || m.slug || "unknown-model",
          name: `${m.display_name || m.name || m.id} (CPAMC)`,
          provider: PROVIDER_ID,
          api: "openai-responses",
          baseUrl: `${baseUrl.replace(/\/$/, "")}/backend-api`,
          cost: ZERO_COST,
          contextWindow: m.context_window || 128_000,
          maxTokens: 8_192,
          reasoning: m.id?.includes("r1") || m.id?.includes("reasoner") || false,
          input: ["text", "image"]
        }));

        writeFileSync(getCachePath(), JSON.stringify(mapped, null, 2), "utf-8");
        return mapped;
      }
    }
  } catch {
    // CPAMC apagado o no responde; degradar a caché
  }

  // Leer caché local si existe
  const cacheFile = getCachePath();
  if (existsSync(cacheFile)) {
    try {
      const raw = readFileSync(cacheFile, "utf-8");
      return JSON.parse(raw);
    } catch {
      // Ignorar error de caché
    }
  }

  return DEFAULT_FALLBACK_MODELS;
}
