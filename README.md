<p align="center">
  <img src="assets/logo.png" width="220" alt="Bridge CPAMC Oficial">
</p>

# Bridge CPAMC Oficial

[![Gentle Hub](https://img.shields.io/badge/Gentle%20Hub-Extension-F095C8?style=for-the-badge)](https://gentlemanprogramming.com/gentle-hub/)
[![Upstream](https://img.shields.io/badge/Upstream-router--for--me%2FCLIProxyAPI-blue?style=for-the-badge&logo=github)](https://github.com/router-for-me/CLIProxyAPI)
[![Discord](https://img.shields.io/badge/Discord-Apoyo-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://bit.ly/48zTJUo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

Puente oficial, instalador automatizado y adaptador de modelos para conectar **Gentle Shell** y **Pi** con el proyecto oficial **CPAMC (CLIProxyAPI)**.

> 📌 **Repositorio Oficial Upstream:** [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)  
> *Este repositorio es la puerta de entrada, instalador y asistente de integración para la comunidad de Gentle Shell y Gentle Hub. Todo el software y binarios descargados provienen directamente y sin alteraciones de los releases oficiales de `router-for-me`.*

> 💬 **Comunidad y Soporte Oficial:** `wilox2` · [Servidor de Discord](https://bit.ly/48zTJUo)

---

## 🌟 ¿Qué resuelve este puente?

1. **Descarga Oficial en 1 Clic:** Se acabó buscar entre decenas de archivos en GitHub. El puente detecta si usas Linux, Windows o Mac y descarga el binario oficial compilado directamente desde los releases oficiales de `router-for-me/CLIProxyAPI`.
2. **Autodescubrimiento en Gentle Shell:** Conecta con el puerto `8317` y expone automáticamente en tu selector `/model` todos los modelos configurados en tu consola CPAMC (Claude Code, Antigravity, DeepSeek, OpenAI, etc.).
3. **Sinergia con Auto Switcher Pro:** Trabaja de forma transparente junto al ecosistema de balanceo y rotación multi-cuenta de WiloxDev para evitar bloqueos por cuotas (429).
4. **Diagnóstico Integrado (`/cpamc doctor`):** Comprueba en 1 segundo que el binario exista, que el servicio esté corriendo en `http://127.0.0.1:8317` y que la conexión esté saludable.

---

## 📦 Instalación Rápida

### Opción A: Desde Gentle Shell (Recomendada)
Instala la extensión en tu terminal:
```bash
gentle-shell install git:github.com/WiloxDev/bridge-cpamc-oficial
```
Y dentro de Gentle Shell ejecuta:
```text
/cpamc install
```
El puente descargará el binario oficial, lo descomprimirá en `~/.cli-proxy-api/` y te dejará todo listo para usar.

---

### Opción B: Script independiente en terminal (Linux / WSL / macOS)
Si prefieres instalar el binario oficial directamente en tu terminal:
```bash
curl -fsSL https://raw.githubusercontent.com/WiloxDev/bridge-cpamc-oficial/main/scripts/install-official.sh | bash
```

---

## 🚀 Comandos en Gentle Shell (`/cpamc`)

- `/cpamc install` — Descarga la última versión oficial directamente desde `router-for-me/CLIProxyAPI/releases`.
- `/cpamc start` — Inicia el servicio oficial en segundo plano en `http://127.0.0.1:8317`.
- `/cpamc doctor` — Diagnóstico completo del estado del servicio, puertos y conectividad.
- `/cpamc refresh` — Refresca y actualiza la lista de modelos de Gentle Shell tras añadir cuentas en la consola web.
- `/cpamc official` — Muestra el enlace y créditos directos al repositorio oficial en GitHub.

---

## 🖥️ Consola de Administración Web

Una vez iniciado CPAMC con `/cpamc start`, accede a la consola web oficial en tu navegador:
👉 **[http://127.0.0.1:8317/management.html](http://127.0.0.1:8317/management.html)**

---

## 🏷️ Etiquetas para Gentle Hub

- `gentle-shell-package`
- `gentle-shell-extension`
- `gentle-hub-project`
- `gentle-shell`
- `cpamc`
- `cliproxyapi`
- `pi-extension`

---

## 📄 Créditos y Licencia

MIT © Wilox. Basado en y para uso con [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). Agradecimientos totales a los creadores de CLIProxyAPI y a la comunidad de Gentle Shell.
