import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync, spawn } from "node:child_process";
import { UPSTREAM_RELEASES_API, DEFAULT_CPAMC_URL } from "./types.js";
import { fetchLatestReleaseAssets, detectCurrentSystem, getLocalBinaryPath } from "./downloader.js";
import { loadCpamcConfig } from "./config.js";

const BRIDGE_RELEASES_API = "https://api.github.com/repos/WiloxDev/bridge-cpamc-oficial/releases/latest";

export interface VersionStatus {
  currentCpamcTag: string | null;
  latestCpamcTag: string | null;
  cpamcUpdateAvailable: boolean;
  currentBridgeVersion: string;
  latestBridgeVersion: string | null;
  bridgeUpdateAvailable: boolean;
}

function getVersionFilePath(): string {
  return join(homedir(), ".cli-proxy-api", "version.json");
}

export function getLocalCpamcVersion(): string | null {
  const p = getVersionFilePath();
  if (existsSync(p)) {
    try {
      const data = JSON.parse(readFileSync(p, "utf-8"));
      return data.tag || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function saveLocalCpamcVersion(tag: string): void {
  const p = getVersionFilePath();
  try {
    writeFileSync(p, JSON.stringify({ tag, updatedAt: Date.now() }, null, 2), "utf-8");
  } catch {
    // Ignorar si falla escritura
  }
}

/**
 * Consulta y compara las versiones remotas contra las locales de forma desacoplada.
 */
export async function checkAllUpdates(currentBridgeVersion: string): Promise<VersionStatus> {
  let latestCpamcTag: string | null = null;
  let latestBridgeVersion: string | null = null;

  // 1. Upstream CPAMC (router-for-me)
  try {
    const res = await fetch(UPSTREAM_RELEASES_API, {
      headers: { "User-Agent": "Gentle-CPAMC-Bridge-Updater" },
      signal: AbortSignal.timeout(2500)
    });
    if (res.ok) {
      const data: any = await res.json();
      latestCpamcTag = data.tag_name || null;
    }
  } catch {
    // Corte de red o rate-limit
  }

  // 2. Extensión Bridge (WiloxDev)
  try {
    const res = await fetch(BRIDGE_RELEASES_API, {
      headers: { "User-Agent": "Gentle-CPAMC-Bridge-Updater" },
      signal: AbortSignal.timeout(2500)
    });
    if (res.ok) {
      const data: any = await res.json();
      latestBridgeVersion = data.tag_name ? data.tag_name.replace(/^v/, "") : null;
    }
  } catch {
    // Corte de red
  }

  const currentCpamcTag = getLocalCpamcVersion();
  const cpamcUpdateAvailable = !!(latestCpamcTag && currentCpamcTag && latestCpamcTag !== currentCpamcTag);
  const bridgeUpdateAvailable = !!(latestBridgeVersion && currentBridgeVersion && latestBridgeVersion !== currentBridgeVersion);

  return {
    currentCpamcTag,
    latestCpamcTag,
    cpamcUpdateAvailable,
    currentBridgeVersion,
    latestBridgeVersion,
    bridgeUpdateAvailable
  };
}

/**
 * Actualiza atómicamente el binario de CPAMC oficial sin tocar credenciales ni config.yaml.
 */
export async function executeAtomicCpamcUpdate(onProgress?: (msg: string) => void): Promise<{ success: boolean; newTag: string }> {
  const sys = detectCurrentSystem();
  onProgress?.(`Consultando última versión oficial de router-for-me/CLIProxyAPI para ${sys.os} (${sys.arch})...`);

  const { tag, assets } = await fetchLatestReleaseAssets();
  const matchingAsset = assets.find(a => a.os === sys.os && a.arch === sys.arch && !a.name.includes("no-plugin")) 
    || assets.find(a => a.os === sys.os && a.arch === sys.arch);

  if (!matchingAsset) {
    throw new Error(`No se encontró un binario oficial compatible para ${sys.os} ${sys.arch} en la release ${tag}`);
  }

  const targetDir = join(homedir(), ".cli-proxy-api");
  const tempArchive = join(targetDir, `download-${Date.now()}-${matchingAsset.name}`);

  onProgress?.(`Descargando actualización oficial ${tag}...`);
  const downloadRes = await fetch(matchingAsset.downloadUrl, {
    headers: { "User-Agent": "Gentle-CPAMC-Bridge-Updater" }
  });

  if (!downloadRes.ok || !downloadRes.body) {
    throw new Error(`Error en la descarga de actualización: HTTP ${downloadRes.status}`);
  }

  const { pipeline } = await import("node:stream/promises");
  const { Readable } = await import("node:stream");
  const { createWriteStream } = await import("node:fs");

  await pipeline(Readable.fromWeb(downloadRes.body as any), createWriteStream(tempArchive));

  onProgress?.("Descomprimiendo actualización oficial...");
  const tempExtractDir = join(targetDir, `extract-${Date.now()}`);
  const isWindows = process.platform === "win32";

  if (tempArchive.endsWith(".zip")) {
    if (isWindows) {
      execSync(`powershell.exe -NoProfile -Command "Expand-Archive -Path '${tempArchive}' -DestinationPath '${tempExtractDir}' -Force"`, { stdio: "ignore" });
    } else {
      execSync(`unzip -o -q "${tempArchive}" -d "${tempExtractDir}"`, { stdio: "ignore" });
    }
  } else {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(tempExtractDir, { recursive: true });
    execSync(`tar -xzf "${tempArchive}" -C "${tempExtractDir}"`, { stdio: "ignore" });
  }

  // Localizar el binario descomprimido
  const expectedBinName = isWindows ? "CLIProxyAPI.exe" : "CLIProxyAPI";
  const extractedBin = join(tempExtractDir, expectedBinName);

  if (!existsSync(extractedBin)) {
    throw new Error(`El archivo descargado no contiene el ejecutable ${expectedBinName}`);
  }

  // Reemplazo atómico
  const activeBinPath = getLocalBinaryPath();
  const backupPath = join(targetDir, `${expectedBinName}.bak`);

  onProgress?.("Aplicando reemplazo atómico de binario (Preservando auths y config)...");

  // Detener proceso anterior si es POSIX (en Windows se reemplaza en próximo reinicio o si está libre)
  try {
    if (!isWindows) {
      execSync("pkill -f CLIProxyAPI 2>/dev/null || true");
    }
  } catch {
    // Ignorar si no corría
  }

  if (existsSync(activeBinPath)) {
    try {
      renameSync(activeBinPath, backupPath);
    } catch {
      // Si el archivo está bloqueado en Windows
    }
  }

  renameSync(extractedBin, activeBinPath);

  if (!isWindows) {
    const { chmodSync } = await import("node:fs");
    chmodSync(activeBinPath, 0o755);
  }

  // Limpiar temporales
  try {
    unlinkSync(tempArchive);
    if (!isWindows) {
      execSync(`rm -rf "${tempExtractDir}" 2>/dev/null || true`);
      if (existsSync(backupPath)) unlinkSync(backupPath);
    }
  } catch {
    // Ignorar limpieza
  }

  saveLocalCpamcVersion(tag);

  // Reiniciar servicio en segundo plano
  const config = loadCpamcConfig();
  if (config.autoStart && config.deploymentType === "local_binary") {
    onProgress?.("Reiniciando servicio oficial CPAMC en caliente...");
    try {
      const child = spawn(activeBinPath, [], { detached: true, stdio: "ignore" });
      child.unref();
    } catch {
      // Ignorar si no reinicia auto
    }
  }

  onProgress?.(`✓ CPAMC actualizado exitosamente a ${tag} manteniendo intactas tus cuentas y configuraciones.`);
  return { success: true, newTag: tag };
}
