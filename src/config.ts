import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { DEFAULT_CPAMC_URL, type CpamcConfig } from "./types.js";

export function getConfigFilePath(): string {
  const gentleDir = join(homedir(), ".gentle-shell", "agent");
  if (existsSync(gentleDir)) {
    return join(gentleDir, "cpamc.json");
  }
  const piDir = join(homedir(), ".pi", "agent");
  if (existsSync(piDir)) {
    return join(piDir, "cpamc.json");
  }
  mkdirSync(gentleDir, { recursive: true });
  return join(gentleDir, "cpamc.json");
}

/**
 * Detecta si el proceso corre en un entorno WSL2 (Windows Subsystem for Linux).
 */
export function isWslEnvironment(): boolean {
  if (process.platform !== "linux") return false;
  try {
    if (existsSync("/proc/version")) {
      const version = readFileSync("/proc/version", "utf-8").toLowerCase();
      return version.includes("microsoft") || version.includes("wsl");
    }
  } catch {
    // Ignorar error de acceso
  }
  return false;
}

/**
 * Obtiene la dirección IP de Windows Host desde WSL2 inspeccionando /etc/resolv.conf.
 */
export function getWslHostIp(): string | null {
  try {
    if (existsSync("/etc/resolv.conf")) {
      const content = readFileSync("/etc/resolv.conf", "utf-8");
      const match = content.match(/nameserver\s+([0-9.]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {
    // Ignorar
  }
  return null;
}

/**
 * Resuelve la URL operativa de CPAMC:
 * Si estamos en WSL2 y 127.0.0.1:8317 no responde, comprueba dinámicamente si CPAMC
 * está escuchando en el Host de Windows (puerta de enlace WSL o host.docker.internal).
 */
export async function resolveOperationalCpamcUrl(configuredUrl?: string): Promise<string> {
  const base = (configuredUrl || DEFAULT_CPAMC_URL).replace(/\/$/, "");

  // Si ya apunta a una IP o dominio explícito que no es localhost, devolverla
  if (!base.includes("127.0.0.1") && !base.includes("localhost")) {
    return base;
  }

  // 1. Probar conectividad rápida contra localhost
  try {
    const res = await fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(600) });
    if (res.ok || res.status === 401) {
      return base;
    }
  } catch {
    // Localhost no respondió
  }

  // 2. Si estamos en WSL2, buscar CPAMC en el Host de Windows
  if (isWslEnvironment()) {
    const hostIp = getWslHostIp();
    const candidates = [
      hostIp ? `http://${hostIp}:8317` : null,
      "http://host.docker.internal:8317"
    ].filter(Boolean) as string[];

    for (const cand of candidates) {
      try {
        const res = await fetch(`${cand}/v1/models`, { signal: AbortSignal.timeout(600) });
        if (res.ok || res.status === 401) {
          return cand;
        }
      } catch {
        // Siguiente candidato
      }
    }
  }

  return base;
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
