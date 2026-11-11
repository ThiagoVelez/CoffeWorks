# CoffeWorks

Suite ofimática de escritorio para Windows, de código abierto y sin conexión. Se compone de un **Launcher** que instala y gestiona las aplicaciones y de tres editores:

| Aplicación | Qué es | Formato propio | Abre | Exporta |
| :--- | :--- | :--- | :--- | :--- |
| **CoffeDoc** | Procesador de textos | `.cfd` | Word (`.docx`), Markdown, HTML, texto | Word (`.docx`), Markdown, HTML, texto, PDF |
| **CoffeCalc** | Hoja de cálculo | `.cfs` | Excel (`.xlsx`, `.xls`), CSV | Excel (`.xlsx`) con formato, CSV, PDF |
| **CoffeView** | Presentaciones | `.csl` | PowerPoint (`.pptx`) | PowerPoint (`.pptx`), HTML, PDF |

Cada aplicación es un ejecutable independiente construido con **Tauri 2** (Rust + WebView2) y **React + TypeScript**.

## Cómo funciona la instalación

1. El instalador (`CoffeWorks-Setup-2.4.0.exe`, hecho con **Inno Setup**) instala solo el Launcher y deja los paquetes de las tres aplicaciones en su carpeta `packages`.
2. Dentro del Launcher, en la **Tienda de Apps**, cada aplicación tiene sus botones **Instalar**, **Abrir App** y **Desinstalar**:
   - *Instalar* copia la aplicación a `%LOCALAPPDATA%\CoffeWorks\Apps\<App>`, crea su acceso directo en el menú Inicio (carpeta *CoffeWorks*) y asocia su tipo de archivo, de modo que un doble clic sobre un `.cfd`, `.cfs` o `.csl` lo abre.
   - *Desinstalar* borra la aplicación, su acceso directo y su asociación. **Los documentos no se tocan.**
3. Los documentos se guardan como archivos normales en `Documentos\CoffeWorks` y aparecen en *Documentos recientes* del Launcher.
4. Al desinstalar CoffeWorks desde *Aplicaciones* de Windows se quitan también las aplicaciones instaladas; los documentos se conservan.

No hacen falta permisos de administrador: todo se instala por usuario. El instalador incluye el motor **WebView2** para los equipos con Windows 10 que aún no lo tengan (Windows 11 lo trae de serie).

## Obtener el instalador

### Opción A: descargarlo ya compilado (GitHub Actions)

Cada vez que se sube código, el flujo **Instalador de Windows** (`.github/workflows/build-windows.yml`) compila la suite en Windows, crea el instalador, lo prueba y lo publica:

1. Abre la pestaña **Actions** del repositorio y entra en la última ejecución de *Instalador de Windows*.
2. En **Artifacts**, descarga `CoffeWorks-Setup` y descomprímelo: dentro está `CoffeWorks-Setup-2.4.0.exe`.

Al subir una etiqueta `v*` (por ejemplo `v2.4.0`) el instalador se adjunta además a una *Release*.

### Opción B: compilarlo en tu equipo con Inno Setup

Requisitos (una sola vez):

| Herramienta | Instalación |
| :--- | :--- |
| Node.js 20 o superior | <https://nodejs.org> o `winget install OpenJS.NodeJS.LTS` |
| Rust (toolchain MSVC) | <https://rustup.rs> o `winget install Rustlang.Rustup` |
| Herramientas de compilación de C++ | `winget install Microsoft.VisualStudio.2022.BuildTools` (carga de trabajo *Desarrollo para el escritorio con C++*) |
| Inno Setup 6 | <https://jrsoftware.org/isdl.php> o `winget install JRSoftware.InnoSetup` |

Después, desde la carpeta del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
```

El script compila las cuatro interfaces, los cuatro ejecutables y el instalador. El resultado queda en `installer\Output\CoffeWorks-Setup-2.4.0.exe`.

Si prefieres hacerlo paso a paso:

```powershell
node scripts/build.mjs
```

```powershell
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" installer\CoffeWorks.iss
```

El primer comando deja los ejecutables en `installer\build` (`CoffeWorks.exe` y `packages\CoffeDoc.exe`, `CoffeCalc.exe`, `CoffeView.exe`); el segundo los empaqueta. También puedes abrir `installer\CoffeWorks.iss` con el editor de Inno Setup y pulsar **Compile** (Ctrl+F9).

## Desarrollo

Modo web (cada aplicación en el navegador, con recarga en caliente):

```bash
npm install
```

```bash
npm run dev:all
```

Antes de la primera vez, instala también las dependencias de cada aplicación (`npm install` dentro de `CoffeDoc`, `CoffeCalc` y `CoffeView`). Los servidores quedan en:

| Launcher | CoffeDoc | CoffeCalc | CoffeView |
| :--- | :--- | :--- | :--- |
| <http://localhost:1420> | <http://localhost:1421> | <http://localhost:1422> | <http://localhost:1423> |

En el navegador los documentos se guardan en `localStorage` y el Launcher abre las aplicaciones en pestañas; en el ejecutable se usan archivos reales y ventanas nativas.

Modo escritorio de una aplicación concreta (ventana nativa con recarga en caliente):

```bash
npm run tauri dev
```

Ese comando, en la raíz, abre el Launcher; para un editor, ejecútalo con `npx tauri dev` dentro de su carpeta (por ejemplo `CoffeDoc`).

## Estructura del repositorio

```
CoffeWorks/
├── src/                    Interfaz del Launcher (React)
├── src-tauri/              Launcher nativo: instalar, desinstalar y abrir apps
├── CoffeDoc/               Procesador de textos (src/ + src-tauri/)
├── CoffeCalc/              Hoja de cálculo (src/ + src-tauri/)
├── CoffeView/              Presentaciones (src/ + src-tauri/)
├── crates/coffe-core/      Código Rust compartido: bóveda, recientes, archivos y diálogos
├── installer/CoffeWorks.iss  Script de Inno Setup
├── scripts/                build.mjs, build-windows.ps1 y dev.mjs
└── .github/workflows/      Compilación y prueba automática del instalador
```

El Launcher admite además un modo de línea de comandos, que usan el instalador y las pruebas:

```powershell
CoffeWorks.exe --list
```

```powershell
CoffeWorks.exe --install coffedoc
```

```powershell
CoffeWorks.exe --uninstall coffedoc
```

También existen `--install-all` y `--uninstall-all`.

## Qué incluye cada aplicación

**CoffeDoc** — estilos de párrafo, fuentes y tamaños en puntos, colores y resaltado, listas, tablas editables, imágenes, enlaces, comentarios, pestañas de documento, esquema automático, buscar y reemplazar, copiar formato, corrector ortográfico del sistema, configuración de página (tamaño, orientación, márgenes, columnas, color y marca de agua) y modo de solo lectura.

**CoffeCalc** — más de 90 funciones en español e inglés (`SUMA`, `SI`, `BUSCARV`, `CONTAR.SI`, `PAGO`…), referencias absolutas y entre hojas, formatos numéricos, moneda y fecha, bordes, celdas combinadas, formato condicional, filtros por columna, ordenar, quitar duplicados, texto en columnas, paneles inmovilizados, tirador de relleno, gráficos de columnas, líneas, áreas y circulares, comentarios y enlaces.

**CoffeView** — diseños y temas, cuadros de texto, formas, líneas, tablas, imágenes y vídeos que se mueven y redimensionan con el ratón, notas del orador, transiciones, ensayo de intervalos con avance automático, vista de cuadrícula y modo presentación a pantalla completa.

En las tres: autoguardado, *Guardar como*, deshacer y rehacer, impresión y PDF, buscador de menús (`Alt+/`) y documentos fijados en el Launcher.
