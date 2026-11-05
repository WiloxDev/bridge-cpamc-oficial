import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PROVIDER_ID, PROVIDER_NAME, UPSTREAM_REPO_URL, DEFAULT_CPAMC_URL } from "./types.js";
import { fetchCpamcModels } from "./models.js";
import { createCpamcStream } from "./provider.js";
import { downloadAndExtractOfficialBinary, getLocalBinaryPath } from "./downloader.js";
import { runCpamcDoctor, formatCpamcDoctorReport } from "./doctor.js";
import { runCpamcWizard } from "./wizard.js";
import { checkAllUpdates, executeAtomicCpamcUpdate } from "./updater.js";
import { loadCpamcConfig, saveCpamcConfig } from "./config.js";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export default async function activate(api: ExtensionAPI): Promise<void> {
  const initialModels = await fetchCpamcModels();

  // 1. Registro del proveedor oficial de CPAMC
  api.registerProvider(PROVIDER_ID, {
    name: PROVIDER_NAME,
    models: initialModels,
    streamSimple: createCpamcStream
  });

  // 2. Registro de comandos interactivos /cpamc
  api.registerCommand("cpamc", {
    description: "Puente oficial CPAMC: /cpamc wizard, /cpamc install, /cpamc start, /cpamc doctor, /cpamc refresh, /cpamc set-url",
    handler: async (args: string, ctx: ExtensionContext) => {
      const parts = args.trim().split(/\s+/);
      const sub = (parts[0] || "").toLowerCase();
      const param = parts.slice(1).join(" ");

      // /cpamc wizard -> Asistente Híbrido Mixto
      if (sub === "wizard" || sub === "setup") {
        await runCpamcWizard(ctx);
        return;
      }

      // /cpamc official -> Enlace y créditos oficiales
      if (sub === "official" || sub === "repo") {
        ctx.ui?.notify(`📌 Repositorio Oficial Upstream:\n${UPSTREAM_REPO_URL}\n\nCreado y mantenido por router-for-me.`, "info");
        return;
      }

      // /cpamc install -> Descarga el binario oficial según la arquitectura
      if (sub === "install") {
        ctx.ui?.notify("⏳ Consultando releases oficiales de router-for-me/CLIProxyAPI...", "info");
        try {
          const binPath = await downloadAndExtractOfficialBinary((msg) => {
            ctx.ui?.notify(msg, "info");
          });
          ctx.ui?.notify(`🎉 CPAMC instalado en ${binPath}. Ejecuta '/cpamc start' o '/cpamc wizard'.`, "info");
        } catch (err: any) {
          ctx.ui?.notify(`✗ Error en la descarga oficial: ${err?.message || err}`, "error");
        }
        return;
      }

      // /cpamc start -> Inicia el binario local en segundo plano
      if (sub === "start") {
        const binPath = getLocalBinaryPath();
        if (!existsSync(binPath)) {
          ctx.ui?.notify("El binario oficial de CPAMC no está instalado. Ejecuta '/cpamc install' o '/cpamc wizard'.", "warning");
          return;
        }

        try {
          const child = spawn(binPath, [], {
            detached: true,
            stdio: "ignore"
          });
          child.unref();

          const config = loadCpamcConfig();
          ctx.ui?.notify(`🚀 CPAMC iniciado (PID: ${child.pid}).\nConsola web: ${config.baseUrl || DEFAULT_CPAMC_URL}/management.html`, "info");
        } catch (err: any) {
          ctx.ui?.notify(`Error al iniciar CPAMC: ${err?.message || err}`, "error");
        }
        return;
      }

      // /cpamc doctor -> Diagnóstico exhaustivo
      if (sub === "doctor" || sub === "status") {
        const report = await runCpamcDoctor();
        const text = formatCpamcDoctorReport(report);
        ctx.ui?.notify(text, report.allPassed ? "info" : "warning");
        return;
      }

      // /cpamc refresh -> Refresca y balancea modelos
      if (sub === "refresh") {
        const models = await fetchCpamcModels();
        ctx.ui?.notify(`✓ Catálogo actualizado. ${models.length} modelos listados orgánicamente en /model.`, "info");
        return;
      }

      // /cpamc set-url <url> -> Para Docker o VPS remoto
      if (sub === "set-url") {
        if (!param) {
          ctx.ui?.notify("Debes indicar una URL. Ejemplo: /cpamc set-url http://192.168.1.50:8317", "warning");
          return;
        }
        const updated = saveCpamcConfig({ baseUrl: param, deploymentType: param.includes("127.0.0.1") || param.includes("localhost") ? "local_binary" : "remote_vps" });
        ctx.ui?.notify(`✓ CPAMC URL configurada a: ${updated.baseUrl}`, "info");
        return;
      }

      // /cpamc set-key <token> -> Para VPS remoto con autenticación
      if (sub === "set-key") {
        if (!param) {
          ctx.ui?.notify("Debes indicar un token. Ejemplo: /cpamc set-key TU_TOKEN", "warning");
          return;
        }
        saveCpamcConfig({ apiKey: param });
        ctx.ui?.notify(`✓ Token de autenticación de CPAMC guardado de forma segura.`, "info");
        return;
      }

      // /cpamc update -> Actualizador Atómico
      if (sub === "update" || sub === "upgrade") {
        ctx.ui?.notify("🔍 Comprobando actualizaciones oficiales...", "info");
        try {
          const status = await checkAllUpdates("1.0.2");
          const lines: string[] = [];
          lines.push(`📦 ESTADO DE ACTUALIZACIONES:`);
          lines.push(`• CPAMC Upstream: Local ${status.currentCpamcTag || "no registrado"} ➔ Última oficial ${status.latestCpamcTag || "indisponible"}`);
          lines.push(`• Bridge Extensión: Versión 1.0.2 ${status.bridgeUpdateAvailable ? `(Disponible v${status.latestBridgeVersion})` : "(Al día)"}`);

          ctx.ui?.notify(lines.join("\n"), "info");

          if (status.cpamcUpdateAvailable || !status.currentCpamcTag) {
            ctx.ui?.notify("⏳ Iniciando actualización atómica del motor oficial de CPAMC...", "info");
            await executeAtomicCpamcUpdate((msg) => ctx.ui?.notify(msg, "info"));
          } else {
            ctx.ui?.notify("✓ Tu motor CPAMC oficial ya se encuentra en la última versión.", "info");
          }
        } catch (err: any) {
          ctx.ui?.notify(`✗ Error en la actualización: ${err?.message || err}`, "error");
        }
        return;
      }

      ctx.ui?.notify("Comandos disponibles:\n/cpamc wizard (Asistente guiado)\n/cpamc install | /cpamc start | /cpamc update\n/cpamc doctor | /cpamc refresh\n/cpamc set-url <url> | /cpamc set-key <token>\n/cpamc official", "info");
    }
  });
}
