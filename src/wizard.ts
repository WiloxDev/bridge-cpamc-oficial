import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runCpamcDoctor } from "./doctor.js";
import { downloadAndExtractOfficialBinary, getLocalBinaryPath } from "./downloader.js";
import { fetchCpamcModels } from "./models.js";
import { loadCpamcConfig } from "./config.js";
import { DEFAULT_CPAMC_URL } from "./types.js";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export async function runCpamcWizard(ctx: ExtensionContext): Promise<void> {
  const notify = (msg: string, level: "info" | "warning" | "error" = "info") => ctx.ui?.notify(msg, level);

  notify("🧙 [Wizard Mixto] Iniciando asistente híbrido de CPAMC Oficial...", "info");

  // 1. Diagnóstico de salud del servicio y binario
  const report = await runCpamcDoctor();
  const config = loadCpamcConfig();

  // Caso A: Si es binario local y no está instalado
  if (config.deploymentType === "local_binary") {
    const binPath = getLocalBinaryPath();
    if (!existsSync(binPath)) {
      notify("⏳ Paso 1: Binario oficial no encontrado. Descargando de router-for-me/CLIProxyAPI...", "info");
      try {
        await downloadAndExtractOfficialBinary((msg) => notify(msg, "info"));
        notify("✓ Binario oficial descargado y configurado en tu equipo.", "info");
      } catch (err: any) {
        notify(`✗ Fallo al descargar binario oficial: ${err?.message || err}`, "error");
        return;
      }
    }

    // Iniciar si no está corriendo
    if (!report.allPassed) {
      notify("🚀 Paso 2: Iniciando el servicio oficial en segundo plano en http://127.0.0.1:8317...", "info");
      try {
        const child = spawn(binPath, [], { detached: true, stdio: "ignore" });
        child.unref();
      } catch (e: any) {
        notify(`No se pudo arrancar el binario automáticamente: ${e?.message || e}`, "warning");
      }
    }
  }

  // 2. Notificación para vinculación de cuentas
  notify(
    "🌐 Paso 3 (Vinculación de Cuentas):\n" +
    "Abre en tu navegador la consola web oficial para vincular OAuth o Auth Files:\n" +
    `👉 ${config.baseUrl || DEFAULT_CPAMC_URL}/management.html\n\n` +
    "💡 Si tienes 2 cuentas del mismo proveedor (Claude, Antigravity), el plugin Auto Switcher Pro las balanceará automáticamente.",
    "info"
  );

  // 3. Sincronización del catálogo hacia Gentle Shell
  try {
    const models = await fetchCpamcModels();
    notify(
      `🎉 Paso 4 (Completado): ${models.length} modelos sincronizados y balanceados orgánicamente.\n` +
      "Escribe '/model' en tu terminal y selecciona tu modelo favorito para empezar.",
      "info"
    );
  } catch (err: any) {
    notify(`Aviso: Los modelos se sincronizarán en cuanto agregues tu primera cuenta en la consola web.`, "warning");
  }
}
