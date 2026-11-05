import { existsSync } from "node:fs";
import { UPSTREAM_REPO_URL, type DoctorCheckItem, type DoctorReport } from "./types.js";
import { getLocalBinaryPath } from "./downloader.js";
import { loadCpamcConfig } from "./config.js";

export async function runCpamcDoctor(): Promise<DoctorReport> {
  const checks: DoctorCheckItem[] = [];
  const config = loadCpamcConfig();
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  // 1. Verificación del modo de despliegue y binario (si aplica)
  if (config.deploymentType === "local_binary") {
    const binPath = getLocalBinaryPath();
    const binInstalled = existsSync(binPath);

    if (binInstalled) {
      checks.push({
        title: "Binario Oficial de CPAMC (Local)",
        ok: true,
        details: `Instalado en ${binPath}`
      });
    } else {
      checks.push({
        title: "Binario Oficial de CPAMC (Local)",
        ok: false,
        details: "No se encontró el binario oficial en el sistema.",
        suggestion: "Ejecuta '/cpamc install' o '/cpamc wizard' para descargarlo de router-for-me/CLIProxyAPI."
      });
    }
  } else {
    checks.push({
      title: `Modo de Despliegue (${config.deploymentType.toUpperCase()})`,
      ok: true,
      details: `Configurado hacia ${baseUrl}`
    });
  }

  // 2. Verificación del endpoint del servicio
  let serviceOnline = false;
  let modelCount = 0;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const headers: Record<string, string> = {};
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const res = await fetch(`${baseUrl}/v1/models`, { headers, signal: controller.signal });
    clearTimeout(timeout);
    
    if (res.ok) {
      serviceOnline = true;
      const data: any = await res.json();
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      modelCount = list.length;
    }
  } catch {
    serviceOnline = false;
  }

  if (serviceOnline) {
    checks.push({
      title: "Servidor CPAMC Activo",
      ok: true,
      details: `Respondiendo en ${baseUrl} (${modelCount} modelos disponibles en el catálogo)`
    });
  } else {
    checks.push({
      title: "Servidor CPAMC Activo",
      ok: false,
      details: `No se pudo conectar a ${baseUrl}`,
      suggestion: config.deploymentType === "local_binary"
        ? "Ejecuta '/cpamc start' para levantarlo en segundo plano."
        : "Verifica que el contenedor Docker o VPS esté corriendo y accesible."
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
      : "No se pudo consultar GitHub Releases (posible corte de internet o rate-limit anónimo)."
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
  lines.push("\n🩺 DIAGNÓSTICO UNIVERSAL DE BRIDGE CPAMC");
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
    ? "🎉 Todo en orden. CPAMC está operando y enlazado con Gentle Shell." 
    : "⚠️ Revisa las sugerencias para corregir la conexión."
  );

  return lines.join("\n");
}
