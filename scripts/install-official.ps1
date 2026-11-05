# ==============================================================================
# Script Oficial PowerShell: Descarga e Instalación de CPAMC (CLIProxyAPI)
# Repositorio Oficial: https://github.com/router-for-me/CLIProxyAPI
# ==============================================================================

$ErrorActionPreference = "Stop"
$Repo = "router-for-me/CLIProxyAPI"
$InstallDir = Join-Path $HOME ".cli-proxy-api"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Puente Oficial de Descarga: CPAMC (CLIProxyAPI) - Windows" -ForegroundColor Cyan
Write-Host " Repositorio Oficial: https://github.com/$Repo" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$Arch = if ([System.Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
    $Arch = "aarch64"
}

Write-Host "✓ Sistema detectado: Windows ($Arch)" -ForegroundColor Green
Write-Host "⏳ Consultando última versión oficial en GitHub..." -ForegroundColor Yellow

$LatestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "Gentle-CPAMC-Bridge" }
$Tag = $LatestRelease.tag_name
Write-Host "✓ Versión oficial encontrada: $Tag" -ForegroundColor Green

$Asset = $LatestRelease.assets | Where-Object { $_.name -like "*windows*$Arch*.zip" -and $_.name -notlike "*no-plugin*" } | Select-Object -First 1
if (-not $Asset) {
    $Asset = $LatestRelease.assets | Where-Object { $_.name -like "*windows*$Arch*.zip" } | Select-Object -First 1
}

if (-not $Asset) {
    Write-Error "No se encontró un binario oficial compatible de Windows para $Arch en la release $Tag"
    exit 1
}

$ZipPath = Join-Path $InstallDir $Asset.name
Write-Host "⬇️ Descargando binario oficial desde GitHub:" -ForegroundColor Yellow
Write-Host "   $($Asset.browser_download_url)" -ForegroundColor DarkGray

Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $ZipPath

Write-Host "📦 Descomprimiendo en $InstallDir..." -ForegroundColor Yellow
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🎉 ¡CPAMC Oficial instalado exitosamente en $InstallDir!" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar el servicio:" -ForegroundColor White
Write-Host "  $InstallDir\CLIProxyAPI.exe" -ForegroundColor Yellow
Write-Host ""
Write-Host "O desde Gentle Shell:" -ForegroundColor White
Write-Host "  /cpamc start" -ForegroundColor Yellow
Write-Host ""
Write-Host "Consola de administración: http://127.0.0.1:8317/management.html" -ForegroundColor DarkGray
Write-Host "💬 Discord de Apoyo y Comunidad: https://bit.ly/48zTJUo" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
