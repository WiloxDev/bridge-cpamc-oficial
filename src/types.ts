export const PROVIDER_ID = "cpamc";
export const PROVIDER_NAME = "CPAMC (Official)";
export const UPSTREAM_REPO_URL = "https://github.com/router-for-me/CLIProxyAPI";
export const UPSTREAM_RELEASES_API = "https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest";
export const DEFAULT_CPAMC_URL = "http://127.0.0.1:8317";

export interface CpamcConfig {
  baseUrl: string;
  apiKey?: string;
  binaryPath?: string;
  autoStart: boolean;
}

export interface ReleaseAssetInfo {
  name: string;
  downloadUrl: string;
  size: number;
  os: "linux" | "windows" | "darwin";
  arch: "amd64" | "aarch64";
}

export interface CpamcModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  provider?: string;
}

export interface DoctorCheckItem {
  title: string;
  ok: boolean;
  details: string;
  suggestion?: string;
}

export interface DoctorReport {
  timestamp: number;
  checks: DoctorCheckItem[];
  allPassed: boolean;
}
