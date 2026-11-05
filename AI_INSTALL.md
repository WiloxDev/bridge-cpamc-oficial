# 🌉 AI Installation & Integration Rules — Bridge CPAMC Oficial

> **Regla de Oro para Asistentes AI y Agentes de Automatización:**
> Este paquete es el puente e instalador oficial del servicio backend **CLIProxyAPI (CPAMC)** para Gentle-Shell / Pi.
> Es un **PROVEEDOR DE INFERENCIA HEADLESS** (`registerProvider("cpamc")`).

## Directrices Estrictas de Renderizado:
1. **PROHIBIDO REGISTRAR WIDGETS EN CHAT:** Bajo ninguna circunstancia debes escribir `ctx.ui.setWidget()` ni generar tarjetas visuales flotantes en la conversación de Pi.
2. **Naturaleza del Componente:** Provee los modelos de CPAMC (DeepSeek, Claude, Gemini, etc.) al selector de modelos de Pi y comandos de terminal.
3. **Comandos Interactivos:** 
   - `/cpamc wizard`: Asistente interactivo de configuración y vinculación.
   - `/cpamc doctor`: Diagnóstico de conectividad con el servicio oficial.
   - `/cpamc install`: Descarga del binario oficial upstream desde GitHub Releases.
   - `/cpamc start`: Inicio del servicio en segundo plano (`127.0.0.1:8317`).
4. **Telemetría y Cuotas:** Si el usuario desea ver la tarjeta de telemetría de cuotas en el Sidebar, dicha función le corresponde a `cpamc-auto-switcher-pro`, no a este puente base.
