import type { Model } from "@earendil-works/pi-ai";
import { DEFAULT_CPAMC_URL, PROVIDER_ID, PROVIDER_API } from "./types.js";
import { loadCpamcConfig, resolveOperationalCpamcUrl } from "./config.js";
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
    api: PROVIDER_API,
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
    api: PROVIDER_API,
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
    api: PROVIDER_API,
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

export async function fetchCpamcModels(customBaseUrl?: string): Promise<Model<any>[]> {
  const config = loadCpamcConfig();
  const rawBaseUrl = customBaseUrl || config.baseUrl || DEFAULT_CPAMC_URL;
  const baseUrl = (await resolveOperationalCpamcUrl(rawBaseUrl)).replace(/\/$/, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const res = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

      if (rawList.length > 0) {
        const mapped: Model<any>[] = rawList.map((m: any) => {
          const modelId = m.id || m.slug || "unknown-model";
          const rawName = m.display_name || m.name || modelId;
          const isReasoning = modelId.includes("r1") || modelId.includes("reasoner") || modelId.includes("o1") || modelId.includes("o3");
          
          let contextWindow = m.context_window || 128_000;
          if (modelId.includes("claude")) contextWindow = 200_000;
          if (modelId.includes("gemini")) contextWindow = 1_000_000;

          // Etiqueta visual para la TUI
          const tagPool = m.has_pool ? " [Pool Auto-Switch]" : "";
          const tagReasoning = isReasoning ? " [Reasoning]" : "";
          const displayName = `${rawName}${tagPool}${tagReasoning} (CPAMC)`;

          return {
            id: modelId,
            name: displayName,
            provider: PROVIDER_ID,
            api: PROVIDER_API,
            baseUrl: `${baseUrl}/backend-api`,
            cost: ZERO_COST,
            contextWindow,
            maxTokens: modelId.includes("claude") ? 16_000 : 8_192,
            reasoning: isReasoning,
            input: ["text", "image"]
          };
        });

        writeFileSync(getCachePath(), JSON.stringify(mapped, null, 2), "utf-8");
        return mapped;
      }
    }
  } catch {
    // Si falla la conexión, degradar a caché
  }

  // Leer caché local si existe
  const cacheFile = getCachePath();
  if (existsSync(cacheFile)) {
    try {
      const raw = readFileSync(cacheFile, "utf-8");
      return JSON.parse(raw);
    } catch {
      // Ignorar error de parsing
    }
  }

  return DEFAULT_FALLBACK_MODELS;
}
