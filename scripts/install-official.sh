#!/usr/bin/env bash
set -e

# ==============================================================================
# Script de Instalación Oficial de CPAMC (CLIProxyAPI)
# Descarga directa y legítima desde: https://github.com/router-for-me/CLIProxyAPI
# ==============================================================================

REPO="router-for-me/CLIProxyAPI"
INSTALL_DIR="$HOME/.cli-proxy-api"

echo "=========================================================="
echo " Puente Oficial de Descarga: CPAMC (CLIProxyAPI)"
echo " Repositorio Oficial: https://github.com/$REPO"
echo "=========================================================="

mkdir -p "$INSTALL_DIR"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64|amd64)
    ARCH_TAG="amd64"
    ;;
  aarch64|arm64)
    ARCH_TAG="aarch64"
    ;;
  *)
    echo "Arquitectura no soportada: $ARCH"
    exit 1
    ;;
esac

case "$OS" in
  linux*)
    OS_TAG="linux"
    ;;
  darwin*)
    OS_TAG="darwin"
    ;;
  msys*|mingw*|cygwin*)
    OS_TAG="windows"
    ;;
  *)
    echo "Sistema operativo no soportado: $OS"
    exit 1
    ;;
esac

echo "✓ Sistema detectado: $OS_TAG ($ARCH_TAG)"
echo "⏳ Consultando última versión oficial en GitHub..."

LATEST_RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")
TAG=$(echo "$LATEST_RELEASE_JSON" | grep '"tag_name":' | head -n 1 | cut -d '"' -f 4)

echo "✓ Última versión oficial encontrada: $TAG"

DOWNLOAD_URL=$(echo "$LATEST_RELEASE_JSON" | grep "browser_download_url" | grep "$OS_TAG" | grep "$ARCH_TAG" | grep -v "no-plugin" | head -n 1 | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
  # Fallback sin filtrar no-plugin
  DOWNLOAD_URL=$(echo "$LATEST_RELEASE_JSON" | grep "browser_download_url" | grep "$OS_TAG" | grep "$ARCH_TAG" | head -n 1 | cut -d '"' -f 4)
fi

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: No se encontró un binario oficial compatible en los releases de $REPO."
  exit 1
fi

FILE_NAME=$(basename "$DOWNLOAD_URL")
ARCHIVE_PATH="$INSTALL_DIR/$FILE_NAME"

echo "⬇️  Descargando directamente desde GitHub:"
echo "   $DOWNLOAD_URL"

curl -fSL "$DOWNLOAD_URL" -o "$ARCHIVE_PATH"

echo "📦 Descomprimiendo en $INSTALL_DIR..."
if [[ "$FILE_NAME" == *.zip ]]; then
  unzip -o -q "$ARCHIVE_PATH" -d "$INSTALL_DIR"
else
  tar -xzf "$ARCHIVE_PATH" -C "$INSTALL_DIR"
fi

# Asignar permisos ejecutables
chmod +x "$INSTALL_DIR"/CLIProxyAPI* 2>/dev/null || true

echo "=========================================================="
echo "🎉 ¡CPAMC Oficial instalado exitosamente en $INSTALL_DIR!"
echo ""
echo "Para iniciar el servicio:"
echo "  $INSTALL_DIR/CLIProxyAPI"
echo ""
echo "O desde Gentle Shell:"
echo "  /cpamc start"
echo ""
echo "Consola de administración oficial: http://127.0.0.1:8317/management.html"
echo "💬 Discord de Apoyo y Comunidad: https://bit.ly/48zTJUo"
echo "=========================================================="
