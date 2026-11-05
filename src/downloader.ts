import { UPSTREAM_RELEASES_API, type ReleaseAssetInfo } from "./types.js";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, chmodSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function fetchLatestReleaseAssets(): Promise<{ tag: string; assets: ReleaseAssetInfo[] }> {
  const res = await fetch(UPSTREAM_RELEASES_API, {
    headers: {
      "User-Agent": "Gentle-CPAMC-Bridge-Installer"
    }
  });

  if (!res.ok) {
    throw new Error(`Error al consultar GitHub Releases de router-for-me/CLIProxyAPI: HTTP ${res.status}`);
  }

  const data: any = await res.json();
  const tag = data.tag_name || "latest";
  const rawAssets = data.assets || [];

  const assets: ReleaseAssetInfo[] = rawAssets
    .filter((a: any) => typeof a.name === "string" && !a.name.endsWith(".txt"))
    .map((a: any) => {
      let os: "linux" | "windows" | "darwin" = "linux";
      if (a.name.includes("windows")) os = "windows";
      if (a.name.includes("darwin")) os = "darwin";

      const arch: "amd64" | "aarch64" = a.name.includes("aarch64") || a.name.includes("arm64") ? "aarch64" : "amd64";

      return {
        name: a.name,
        downloadUrl: a.browser_download_url,
        size: a.size || 0,
        os,
        arch
      };
    });

  return { tag, assets };
}

export function detectCurrentSystem(): { os: "linux" | "windows" | "darwin"; arch: "amd64" | "aarch64" } {
  const p = process.platform;
  let os: "linux" | "windows" | "darwin" = "linux";
  if (p === "win32") os = "windows";
  if (p === "darwin") os = "darwin";

  const a = process.arch;
  const arch: "amd64" | "aarch64" = a === "arm64" ? "aarch64" : "amd64";

  return { os, arch };
}

export function getLocalBinaryPath(): string {
  const isWin = process.platform === "win32";
  const binName = isWin ? "CLIProxyAPI.exe" : "CLIProxyAPI";
  return join(homedir(), ".cli-proxy-api", binName);
}

/**
 * Búsqueda recursiva nativa en Node.js de un archivo ejecutable,
 * eliminando cualquier dependencia del comando 'find' de Unix.
 */
function findBinaryRecursively(dir: string, targetName: string): string | null {
  if (!existsSync(dir)) return null;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findBinaryRecursively(fullPath, targetName);
      if (nested) return nested;
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower === targetName.toLowerCase() || lower.startsWith("cliproxyapi")) {
        return fullPath;
      }
    }
  }
  return null;
}

export async function downloadAndExtractOfficialBinary(onProgress?: (msg: string) => void): Promise<string> {
  const targetDir = join(homedir(), ".cli-proxy-api");
  mkdirSync(targetDir, { recursive: true });

  const sys = detectCurrentSystem();
  onProgress?.(`Detectando sistema: ${sys.os} (${sys.arch}). Consultando releases oficiales de router-for-me...`);

  const { tag, assets } = await fetchLatestReleaseAssets();
  const matchingAsset = assets.find(a => a.os === sys.os && a.arch === sys.arch && !a.name.includes("no-plugin")) 
    || assets.find(a => a.os === sys.os && a.arch === sys.arch);

  if (!matchingAsset) {
    throw new Error(`No se encontró un binario oficial compatible para ${sys.os} ${sys.arch} en la release ${tag}`);
  }

  onProgress?.(`Descargando binario oficial ${tag}: ${matchingAsset.name}...`);
  const archivePath = join(targetDir, matchingAsset.name);

  // Descarga nativa vía Node.js fetch (independiente de curl de SO)
  const downloadRes = await fetch(matchingAsset.downloadUrl, {
    headers: { "User-Agent": "Gentle-CPAMC-Bridge-Installer" }
  });

  if (!downloadRes.ok || !downloadRes.body) {
    throw new Error(`Error al descargar binario desde GitHub: HTTP ${downloadRes.status}`);
  }

  const fileStream = createWriteStream(archivePath);
  await pipeline(Readable.fromWeb(downloadRes.body as any), fileStream);

  onProgress?.("Descomprimiendo binario...");
  const isWindows = process.platform === "win32";

  if (archivePath.endsWith(".zip")) {
    if (isWindows) {
      // Usar PowerShell nativo en Windows para descomprimir ZIP
      execSync(`powershell.exe -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${targetDir}' -Force"`, { stdio: "ignore" });
    } else {
      execSync(`unzip -o -q "${archivePath}" -d "${targetDir}"`, { stdio: "ignore" });
    }
  } else {
    // Archivos .tar.gz (Linux / macOS)
    execSync(`tar -xzf "${archivePath}" -C "${targetDir}"`, { stdio: "ignore" });
  }

  const expectedBinName = isWindows ? "CLIProxyAPI.exe" : "CLIProxyAPI";
  let finalBinaryPath = join(targetDir, expectedBinName);

  if (!existsSync(finalBinaryPath)) {
    // Búsqueda nativa recursiva sin 'find'
    const discovered = findBinaryRecursively(targetDir, expectedBinName);
    if (discovered) {
      finalBinaryPath = discovered;
    }
  }

  // Asignar permisos de ejecución en plataformas POSIX
  if (!isWindows && existsSync(finalBinaryPath)) {
    try {
      chmodSync(finalBinaryPath, 0o755);
    } catch {
      // Ignorar fallo de chmod si no hay permisos
    }
  }

  onProgress?.(`✓ CPAMC Oficial instalado con éxito en: ${finalBinaryPath}`);
  return finalBinaryPath;
}
