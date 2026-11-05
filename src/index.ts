import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PROVIDER_ID, PROVIDER_NAME, UPSTREAM_REPO_URL, DEFAULT_CPAMC_URL } from "./types.js";
import { fetchCpamcModels } from "./models.js";
import { createCpamcStream } from "./provider.js";
import { downloadAndExtractOfficialBinary, getLocalBinaryPath } from "./downloader.js";
import { runCpamcDoctor, formatCpamcDoctorReport } from "./doctor.js";
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
    description: "Comandos del puente oficial CPAMC: /cpamc install, /cpamc start, /cpamc doctor, /cpamc refresh, /cpamc official",
    handler: async (args: string, ctx: ExtensionContext) => {
      const sub = args.trim().toLowerCase();

      // /cpamc official -> Muestra y enlaza al repositorio oficial
      if (sub === "official" || sub === "repo") {
        ctx.ui?.notify(`📌 Repositorio Oficial Upstream:\n${UPSTREAM_REPO_URL}\n\nCreado y mantenido por el equipo de router-for-me.`, "info");
        return;
      }

      // /cpamc install -> Descarga el binario oficial directamente desde GitHub
      if (sub === "install") {
        ctx.ui?.notify("⏳ Iniciando descarga del binario oficial desde router-for-me/CLIProxyAPI...", "info");
        try {
          const binPath = await downloadAndExtractOfficialBinary((msg) => {
            ctx.ui?.notify(msg, "info");
          });
          ctx.ui?.notify(`🎉 CPAMC instalado en ${binPath}. Ahora puedes ejecutar '/cpamc start' para iniciarlo.`, "info");
        } catch (err: any) {
          ctx.ui?.notify(`✗ Error en la descarga oficial: ${err?.message || err}`, "error");
        }
        return;
      }

      // /cpamc start -> Inicia el binario en segundo plano
      if (sub === "start") {
        const binPath = getLocalBinaryPath();
        if (!existsSync(binPath)) {
          ctx.ui?.notify("El binario oficial de CPAMC no está instalado. Ejecuta primero '/cpamc install'.", "warning");
          return;
        }

        try {
          const child = spawn(binPath, [], {
            detached: true,
            stdio: "ignore"
          });
          child.unref();

          ctx.ui?.notify(`🚀 CPAMC iniciado en segundo plano (PID: ${child.pid}).\nConsola web: ${DEFAULT_CPAMC_URL}/management.html`, "info");
        } catch (err: any) {
          ctx.ui?.notify(`Error al iniciar CPAMC: ${err?.message || err}`, "error");
        }
        return;
      }

      // /cpamc doctor -> Comprobación completa
      if (sub === "doctor" || sub === "status") {
        const report = await runCpamcDoctor();
        const text = formatCpamcDoctorReport(report);
        ctx.ui?.notify(text, report.allPassed ? "info" : "warning");
        return;
      }

      // /cpamc refresh -> Refresca modelos
      if (sub === "refresh") {
        const models = await fetchCpamcModels();
        ctx.ui?.notify(`✓ Catálogo actualizado. ${models.length} modelos detectados desde CPAMC.`, "info");
        return;
      }

      ctx.ui?.notify("Uso: /cpamc install | /cpamc start | /cpamc doctor | /cpamc refresh | /cpamc official", "info");
    }
  });
}
