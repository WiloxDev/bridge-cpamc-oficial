import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { DEFAULT_CPAMC_URL, type CpamcConfig } from "./types.js";

export function getConfigFilePath(): string {
  // Preferir ~/.gentle-shell/agent/, fallback a ~/.pi/agent/
  const gentleDir = join(homedir(), ".gentle-shell", "agent");
  if (existsSync(gentleDir)) {
    return join(gentleDir, "cpamc.json");
  }
  const piDir = join(homedir(), ".pi", "agent");
  if (existsSync(piDir)) {
    return join(piDir, "cpamc.json");
  }
  // Por defecto crear en .gentle-shell
  mkdirSync(gentleDir, { recursive: true });
  return join(gentleDir, "cpamc.json");
}

export function loadCpamcConfig(): CpamcConfig {
  const envUrl = process.env.CPAMC_BASE_URL || process.env.CLIPROXYAPI_BASE_URL;
  const envKey = process.env.CPAMC_API_KEY || process.env.CLIPROXYAPI_API_KEY;

  const defaults: CpamcConfig = {
    baseUrl: envUrl || DEFAULT_CPAMC_URL,
    apiKey: envKey || undefined,
    autoStart: true,
    deploymentType: "local_binary"
  };

  const path = getConfigFilePath();
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        baseUrl: envUrl || parsed.baseUrl || defaults.baseUrl,
        apiKey: envKey || parsed.apiKey || defaults.apiKey
      };
    } catch {
      // Ignorar error de parsing
    }
  }

  return defaults;
}

export function saveCpamcConfig(partial: Partial<CpamcConfig>): CpamcConfig {
  const current = loadCpamcConfig();
  const updated: CpamcConfig = { ...current, ...partial };
  const path = getConfigFilePath();
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
