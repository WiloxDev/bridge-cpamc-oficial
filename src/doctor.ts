import { existsSync } from "node:fs";
import { DEFAULT_CPAMC_URL, UPSTREAM_REPO_URL, type DoctorCheckItem, type DoctorReport } from "./types.js";
import { getLocalBinaryPath } from "./downloader.js";

export async function runCpamcDoctor(): Promise<DoctorReport> {
  const checks: DoctorCheckItem[] = [];

  // 1. Verificación del binario oficial
  const binPath = getLocalBinaryPath();
  const binInstalled = existsSync(binPath);

  if (binInstalled) {
    checks.push({
      title: "Binario Oficial de CPAMC",
      ok: true,
      details: `Instalado en ${binPath}`
    });
  } else {
    checks.push({
      title: "Binario Oficial de CPAMC",
      ok: false,
      details: "No se encontró el binario oficial en ~/.cli-proxy-api/",
      suggestion: "Ejecuta '/cpamc install' para descargarlo automáticamente de router-for-me/CLIProxyAPI."
    });
  }

  // 2. Verificación del servicio en el puerto 8317
  let serviceOnline = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${DEFAULT_CPAMC_URL}/v1/models`, { signal: controller.signal });
    clearTimeout(timeout);
    serviceOnline = res.ok;
  } catch {
    serviceOnline = false;
  }

  if (serviceOnline) {
    checks.push({
      title: "Servidor Local CPAMC (Puerto 8317)",
      ok: true,
      details: `Servicio activo y respondiendo en ${DEFAULT_CPAMC_URL}`
    });
  } else {
    checks.push({
      title: "Servidor Local CPAMC (Puerto 8317)",
      ok: false,
      details: "El servicio no responde en http://127.0.0.1:8317",
      suggestion: binInstalled 
        ? "Ejecuta '/cpamc start' para levantar el servicio oficial en segundo plano."
        : "Ejecuta '/cpamc install' para descargar e iniciar CPAMC."
    });
  }

  // 3. Conectividad con el upstream oficial de GitHub
  let upstreamOk = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("https://api.github.com/repos/router-for-me/CLIProxyAPI", {
      headers: { "User-Agent": "Gentle-CPAMC-Bridge" },
      signal: controller.signal
    });
    clearTimeout(timeout);
    upstreamOk = res.ok;
  } catch {
    upstreamOk = false;
  }

  checks.push({
    title: "Conexión con Upstream Oficial (GitHub)",
    ok: upstreamOk,
    details: upstreamOk 
      ? `Conexión fluida con ${UPSTREAM_REPO_URL}` 
      : "No se pudo consultar el repositorio oficial de router-for-me (posible límite de API de GitHub o sin red)."
  });

  const allPassed = checks.every(c => c.ok);
  return {
    timestamp: Date.now(),
    checks,
    allPassed
  };
}

export function formatCpamcDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push("\n🩺 DIAGNÓSTICO DE BRIDGE CPAMC OFICIAL");
  lines.push("========================================");
  lines.push(`📌 Upstream Oficial: ${UPSTREAM_REPO_URL}\n`);

  for (const c of report.checks) {
    const icon = c.ok ? "✓" : "✗";
    lines.push(`${icon} ${c.title}: ${c.details}`);
    if (c.suggestion) {
      lines.push(`   💡 Sugerencia: ${c.suggestion}`);
    }
  }

  lines.push("========================================");
  lines.push(report.allPassed 
    ? "🎉 Todo listo. CPAMC está conectado y operando con Gentle Shell." 
    : "⚠️ Revisa las sugerencias para completar la conexión."
  );

  return lines.join("\n");
}
