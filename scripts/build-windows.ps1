# Compila CoffeWorks y genera el instalador para Windows.
#
#   powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
#
# Requisitos: Node.js 20+, Rust (rustup, toolchain MSVC) e Inno Setup 6.
# Resultado:  installer\Output\CoffeWorks-Setup-<versión>.exe

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Require-Command($name, $help) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "No se encontró '$name'. $help"
    }
}

Require-Command node  "Instala Node.js 20 o superior desde https://nodejs.org"
Require-Command cargo "Instala Rust desde https://rustup.rs (con las herramientas de compilación de Visual Studio)"

# Localizar el compilador de Inno Setup
$iscc = (Get-Command iscc -ErrorAction SilentlyContinue).Source
if (-not $iscc) {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    )
    $iscc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $iscc) {
    throw "No se encontró Inno Setup 6. Instálalo desde https://jrsoftware.org/isdl.php o con: winget install JRSoftware.InnoSetup"
}

Write-Host "==> Compilando la suite" -ForegroundColor Cyan
node scripts/build.mjs
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación" }

# Instalador del motor WebView2 para equipos que no lo tengan (opcional)
$bootstrapper = Join-Path $root "installer\build\MicrosoftEdgeWebview2Setup.exe"
if (-not (Test-Path $bootstrapper)) {
    Write-Host "==> Descargando el instalador de WebView2" -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $bootstrapper -UseBasicParsing
    } catch {
        Write-Warning "No se pudo descargar WebView2; el instalador se creará sin él (Windows 11 ya lo incluye)."
    }
}

Write-Host "==> Creando el instalador con Inno Setup" -ForegroundColor Cyan
& $iscc (Join-Path $root "installer\CoffeWorks.iss")
if ($LASTEXITCODE -ne 0) { throw "Inno Setup devolvió un error" }

$setup = Get-ChildItem (Join-Path $root "installer\Output\*.exe") | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host ""
Write-Host "Instalador creado: $($setup.FullName)" -ForegroundColor Green
