import { UPSTREAM_RELEASES_API, type ReleaseAssetInfo } from "./types.js";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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

  // Descargar archivo oficial desde GitHub
  execSync(`curl -fsSL "${matchingAsset.downloadUrl}" -o "${archivePath}"`, { stdio: "ignore" });

  onProgress?.("Descomprimiendo binario...");
  if (matchingAsset.name.endsWith(".zip")) {
    execSync(`unzip -o "${archivePath}" -d "${targetDir}"`, { stdio: "ignore" });
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${targetDir}"`, { stdio: "ignore" });
  }

  const binaryPath = getLocalBinaryPath();
  if (!existsSync(binaryPath)) {
    // Si se descomprimió con minúsculas o subcarpeta
    execSync(`find "${targetDir}" -name "CLIProxyAPI*" -type f -exec chmod +x {} +`, { stdio: "ignore" });
  } else {
    execSync(`chmod +x "${binaryPath}"`, { stdio: "ignore" });
  }

  onProgress?.(`✓ CPAMC Oficial instalado con éxito en: ${binaryPath}`);
  return binaryPath;
}
