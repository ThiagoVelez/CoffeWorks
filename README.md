# CoffeeWorks

Suite ofimática de escritorio para Windows, de código abierto y sin conexión. Se compone de un **Launcher** que instala y gestiona las aplicaciones y de seis aplicaciones, en dos categorías (**Office** y **Multimedia**):

| Aplicación | Qué es | Formato propio | Abre | Exporta |
| :--- | :--- | :--- | :--- | :--- |
| **CoffeeDoc** | Procesador de textos | `.cfd` | Word (`.docx`), Markdown, HTML, texto | Word (`.docx`), Markdown, HTML, texto, PDF |
| **CoffeeCalc** | Hoja de cálculo | `.cfs` | Excel (`.xlsx`, `.xls`), CSV | Excel (`.xlsx`) con formato, CSV, PDF |
| **CoffeeView** | Presentaciones | `.csl` | PowerPoint (`.pptx`) | PowerPoint (`.pptx`), HTML, PDF |
| **CoffeePDF** | Editor de PDF | `.pdf` | PDF | PDF, páginas sueltas, PNG |
| **CoffeePage** | Cuaderno de notas | `.cpg` | Cuadernos `.cpg`; imágenes y texto para insertar | HTML, Markdown, PDF (imprimir) |
| **CoffeeCams** *(Multimedia)* | Editor de video, grabación y streaming | `.ccm` | Video (MP4, WebM, MOV, MKV), audio e imágenes | Video MP4/WebM, grabaciones, transmisión RTMP |

Cada aplicación es un ejecutable independiente construido con **Tauri 2** (Rust + WebView2) y **React + TypeScript**.

## Cómo funciona la instalación

1. El instalador (`CoffeeWorks-Setup-2.5.0.exe`, hecho con **Inno Setup**) instala solo el Launcher y deja los paquetes de las seis aplicaciones en su carpeta `packages`.
2. Dentro del Launcher, en la **Tienda de Apps**, cada aplicación tiene sus botones **Instalar**, **Abrir App** y **Desinstalar**:
   - *Instalar* copia la aplicación a `%LOCALAPPDATA%\CoffeeWorks\Apps\<App>`, crea su acceso directo en el menú Inicio (carpeta *CoffeeWorks*) y asocia su tipo de archivo, de modo que un doble clic sobre un `.cfd`, `.cfs`, `.csl`, `.cpg` o `.ccm` lo abre. CoffeePDF no reemplaza tu lector de PDF predeterminado: aparece en *Abrir con* del Explorador.
   - *Desinstalar* borra la aplicación, su acceso directo y su asociación. **Los documentos no se tocan.**
3. Los documentos se guardan como archivos normales en `Documentos\CoffeeWorks` y aparecen en *Documentos recientes* del Launcher.
4. Si tenías instalada una versión anterior (cuando la suite se llamaba «CoffeWorks»), al abrir el Launcher por primera vez se migra todo solo: los documentos pasan de `Documentos\CoffeWorks` a `Documentos\CoffeeWorks`, los recientes se conservan y las aplicaciones instaladas se reinstalan con sus nombres nuevos.
5. Al desinstalar CoffeeWorks desde *Aplicaciones* de Windows se quitan también las aplicaciones instaladas; los documentos se conservan.

No hacen falta permisos de administrador: todo se instala por usuario. El instalador incluye el motor **WebView2** para los equipos con Windows 10 que aún no lo tengan (Windows 11 lo trae de serie).

## Obtener el instalador

### Opción A: descargarlo ya compilado (GitHub Actions)

Cada vez que se sube código, el flujo **Instalador de Windows** (`.github/workflows/build-windows.yml`) compila la suite en Windows, crea el instalador, lo prueba y lo publica:

1. Abre la pestaña **Actions** del repositorio y entra en la última ejecución de *Instalador de Windows*.
2. En **Artifacts**, descarga `CoffeeWorks-Setup` y descomprímelo: dentro está `CoffeeWorks-Setup-2.5.0.exe`.

Al subir una etiqueta `v*` (por ejemplo `v2.5.0`) el instalador se adjunta además a una *Release*.

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

El script compila las siete interfaces, los siete ejecutables y el instalador. El resultado queda en `installer\Output\CoffeeWorks-Setup-2.5.0.exe`.

Si prefieres hacerlo paso a paso:

```powershell
node scripts/build.mjs
```

```powershell
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" installer\CoffeeWorks.iss
```

El primer comando deja los ejecutables en `installer\build` (`CoffeeWorks.exe` y `packages\CoffeeDoc.exe`, `CoffeeCalc.exe`, `CoffeeView.exe`, `CoffeePDF.exe`, `CoffeePage.exe`, `CoffeeCams.exe`); el segundo los empaqueta. También puedes abrir `installer\CoffeeWorks.iss` con el editor de Inno Setup y pulsar **Compile** (Ctrl+F9).

## Desarrollo

Modo web (cada aplicación en el navegador, con recarga en caliente):

```bash
npm install
```

```bash
npm run dev:all
```

Antes de la primera vez, instala también las dependencias de cada aplicación (`npm install` dentro de `CoffeeDoc`, `CoffeeCalc`, `CoffeeView`, `CoffeePDF`, `CoffeePage` y `CoffeeCams`). Los servidores quedan en:

| Launcher | CoffeeDoc | CoffeeCalc | CoffeeView | CoffeePDF | CoffeePage | CoffeeCams |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| <http://localhost:1420> | <http://localhost:1421> | <http://localhost:1422> | <http://localhost:1423> | <http://localhost:1424> | <http://localhost:1425> | <http://localhost:1426> |

En el navegador los documentos se guardan en `localStorage` y el Launcher abre las aplicaciones en pestañas; en el ejecutable se usan archivos reales y ventanas nativas.

Modo escritorio de una aplicación concreta (ventana nativa con recarga en caliente):

```bash
npm run tauri dev
```

Ese comando, en la raíz, abre el Launcher; para un editor, ejecútalo con `npx tauri dev` dentro de su carpeta (por ejemplo `CoffeeDoc`).

## Estructura del repositorio

```
CoffeeWorks/
├── src/                    Interfaz del Launcher (React)
├── src-tauri/              Launcher nativo: instalar, desinstalar y abrir apps
├── CoffeeDoc/               Procesador de textos (src/ + src-tauri/)
├── CoffeeCalc/              Hoja de cálculo (src/ + src-tauri/)
├── CoffeeView/              Presentaciones (src/ + src-tauri/)
├── CoffeePDF/               Editor de PDF (src/ + src-tauri/)
├── CoffeePage/              Cuaderno de notas (src/ + src-tauri/)
├── CoffeeCams/              Video: editor, grabación y streaming (src/ + src-tauri/)
├── crates/coffee-core/      Código Rust compartido: bóveda, recientes, archivos y diálogos
├── installer/CoffeeWorks.iss  Script de Inno Setup
├── scripts/                build.mjs, build-windows.ps1 y dev.mjs
└── .github/workflows/      Compilación y prueba automática del instalador
```

El Launcher admite además un modo de línea de comandos, que usan el instalador y las pruebas:

```powershell
CoffeeWorks.exe --list
```

```powershell
CoffeeWorks.exe --install coffeedoc
```

```powershell
CoffeeWorks.exe --uninstall coffeedoc
```

También existen `--install-all` y `--uninstall-all`.

## Qué incluye cada aplicación

**CoffeeDoc** — estilos de párrafo, fuentes y tamaños en puntos, colores y resaltado, listas, tablas editables, imágenes, enlaces, comentarios, pestañas de documento, esquema automático, buscar y reemplazar, copiar formato, corrector ortográfico del sistema, configuración de página (tamaño, orientación, márgenes, columnas, color y marca de agua) y modo de solo lectura.

**CoffeeCalc** — más de 90 funciones en español e inglés (`SUMA`, `SI`, `BUSCARV`, `CONTAR.SI`, `PAGO`…), referencias absolutas y entre hojas, formatos numéricos, moneda y fecha, bordes, celdas combinadas, formato condicional, filtros por columna, ordenar, quitar duplicados, texto en columnas, paneles inmovilizados, tirador de relleno, gráficos de columnas, líneas, áreas y circulares, comentarios y enlaces.

**CoffeeView** — diseños y temas, cuadros de texto, formas, líneas, tablas, imágenes y vídeos que se mueven y redimensionan con el ratón, notas del orador, transiciones, ensayo de intervalos con avance automático, vista de cuadrícula y modo presentación a pantalla completa.

**CoffeePDF** — añadir y editar texto, reemplazar texto existente, resaltar, tachar con corrector blanco, rectángulos, elipses, líneas, flechas, dibujo a mano, imágenes y firmas (dibujadas o escritas); rellenar formularios; buscar texto y resaltar los resultados; reordenar, girar, duplicar, eliminar e insertar páginas; unir otros PDF, extraer páginas, exportar páginas a PNG, imprimir y editar las propiedades del documento.

**CoffeePage** — cuadernos con secciones de colores, páginas y subpáginas; notas que se colocan en cualquier punto de la página y se mueven arrastrándolas; formato de texto, listas, tablas, vínculos y fecha; etiquetas (tarea pendiente, importante, pregunta, idea); dibujo a mano con bolígrafo, marcador y borrador; imágenes pegadas o arrastradas; papel liso, rayado o cuadriculado; búsqueda en todo el cuaderno; guardado automático; exportación a HTML y Markdown e impresión.

**CoffeeCams** — tres herramientas en una:

- *Editor de video*: biblioteca de medios (video, audio, imágenes), línea de tiempo con varias pistas de video, texto y audio, recortar y dividir clips, moverlos entre pistas con ajuste magnético, velocidad (0,25x a 4x), volumen, fundidos, encuadre (escala, posición, rotación, opacidad), filtros y ajustes de color, títulos animados (fundido, deslizar, rebote, máquina de escribir) y exportación a MP4 o WebM en 720p, 1080p, vertical, cuadrado o 4K.
- *Grabador*: escenas con captura de pantalla o ventana, cámara (también en círculo), imágenes, textos y fondos de color; mezclador con micrófono y audio del escritorio con vúmetros; grabación en MP4 en `Videos\CoffeeWorks`, con pausa. Las grabaciones aparecen solas en el editor.
- *Transmisión en directo*: emite la escena a Twitch, YouTube, Facebook o cualquier servidor RTMP. Usa ffmpeg, que CoffeeCams descarga la primera vez que transmites (unos 90 MB) en su propia carpeta; si ya tienes ffmpeg en el PATH, lo usa.

En CoffeeDoc, CoffeeCalc y CoffeeView: autoguardado, *Guardar como*, deshacer y rehacer, impresión y PDF, buscador de menús (`Alt+/`) y documentos fijados en el Launcher.
