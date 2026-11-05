import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  type Usage
} from "@earendil-works/pi-ai";
import { PROVIDER_ID, UPSTREAM_REPO_URL, DEFAULT_CPAMC_URL } from "./types.js";
import { loadCpamcConfig, resolveOperationalCpamcUrl } from "./config.js";

const EMPTY_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0
  }
};

export function createCpamcStream(
  model: Model<any>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const config = loadCpamcConfig();

  (async () => {
    let activeBaseUrl = config.baseUrl || DEFAULT_CPAMC_URL;
    try {
      activeBaseUrl = await resolveOperationalCpamcUrl(config.baseUrl || DEFAULT_CPAMC_URL);
      const endpoint = `${activeBaseUrl.replace(/\/$/, "")}/v1/chat/completions`;
      const messages = (context.messages || []).map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      }));

      const body = {
        model: model.id,
        messages,
        stream: true
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorText = await res.text();
        const assistantError: AssistantMessage = {
          role: "assistant",
          content: [{
            type: "text",
            text: `[Error CPAMC HTTP ${res.status}]: ${errorText || "Asegúrate de que CPAMC esté iniciado y tenga cuentas configuradas."}\nUpstream oficial: ${UPSTREAM_REPO_URL}`
          }],
          api: "openai-responses",
          provider: PROVIDER_ID,
          model: model.id,
          usage: EMPTY_USAGE,
          stopReason: "error",
          timestamp: Date.now()
        };
        stream.push({
          type: "error",
          reason: "error",
          error: assistantError
        });
        stream.end();
        return;
      }

      if (!res.body) {
        stream.end();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let buffer = "";

      const getPartialAssistant = (): AssistantMessage => ({
        role: "assistant",
        content: [{ type: "text", text: accumulatedText }],
        api: "openai-responses",
        provider: PROVIDER_ID,
        model: model.id,
        usage: EMPTY_USAGE,
        stopReason: "stop",
        timestamp: Date.now()
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                accumulatedText += delta;
                stream.push({
                  type: "text_delta",
                  contentIndex: 0,
                  delta,
                  partial: getPartialAssistant()
                });
              }
            } catch {
              // Ignorar línea no JSON
            }
          }
        }
      }

      stream.end();
    } catch (err: any) {
      const isConnectionRefused = err?.message?.includes("ECONNREFUSED") || err?.cause?.code === "ECONNREFUSED";
      const message = isConnectionRefused
        ? `No se pudo conectar con CPAMC en ${activeBaseUrl}. Ejecuta '/cpamc wizard' o '/cpamc doctor' para diagnosticar.`
        : (err?.message || "Error al conectar con CPAMC.");

      const assistantError: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: `[CPAMC]: ${message}` }],
        api: "openai-responses",
        provider: PROVIDER_ID,
        model: model.id,
        usage: EMPTY_USAGE,
        stopReason: "error",
        timestamp: Date.now()
      };
      stream.push({
        type: "error",
        reason: "error",
        error: assistantError
      });
      stream.end();
    }
  })();

  return stream;
}
