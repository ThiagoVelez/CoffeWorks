# CoffeeWorks

Suite ofimática de escritorio para Windows, de código abierto y sin conexión. Se compone de un **Launcher** que instala y gestiona las aplicaciones y de veintiuna aplicaciones, en cuatro categorías (**Office**, **Multimedia**, **Desarrollador** e **Ilustración**):

| Aplicación | Qué es | Formato propio | Abre | Exporta |
| :--- | :--- | :--- | :--- | :--- |
| **CoffeeDoc** | Procesador de textos | `.cfd` | Word (`.docx`), Markdown, HTML, texto | Word (`.docx`), Markdown, HTML, texto, PDF |
| **CoffeeBooks** *(Office)* | Notas, wikis y bases de datos (tipo Notion) | `.cbk` | Markdown, texto | Markdown, ZIP del espacio y PDF |
| **CoffeeCalc** | Hoja de cálculo | `.cfs` | Excel (`.xlsx`, `.xls`), CSV | Excel (`.xlsx`) con formato, CSV, PDF |
| **CoffeeView** | Presentaciones | `.csl` | PowerPoint (`.pptx`) | PowerPoint (`.pptx`), HTML, PDF |
| **CoffeePDF** | Editor de PDF | `.pdf` | PDF | PDF, páginas sueltas, PNG |
| **CoffeePage** | Cuaderno de notas | `.cpg` | Cuadernos `.cpg`; imágenes y texto para insertar | HTML, Markdown, PDF (imprimir) |
| **CoffeeDataBase** | Bases de datos | `.cdb` (SQLite) | SQLite (`.db`, `.sqlite`); importa Excel, CSV y `.accdb`/`.mdb` | Excel, CSV, script SQL, informes, Access (`.accdb`/`.mdb`, con complemento) |
| **CoffeeEdit** *(Multimedia)* | Editor de video | `.ccm` | Video (MP4, WebM, MOV, MKV), audio e imágenes | Video MP4/WebM |
| **CoffeeLive** *(Multimedia)* | Grabación y transmisión en directo | `.clv` | Pantalla, cámara, imágenes y videos como fuentes | Grabaciones MP4/WebM, transmisión RTMP/SRT |
| **CoffeeUI/UX** *(Desarrollador)* | Diseño de interfaces y prototipos | `.cux` | Diseños; imágenes para insertar | PNG, JPG, SVG, PDF, HTML/CSS |
| **CoffeeUML** *(Desarrollador)* | Modelado UML y diagramas | `.cuml` | Modelos; scripts SQL (`CREATE TABLE`) | PNG, SVG, PDF, Java, C#, TypeScript, Python, SQL, Mermaid, PlantUML |
| **CoffeePhoto** *(Ilustración)* | Edición de imágenes y retoque | `.cph` | PNG, JPG, WebP, BMP, GIF; RAW (con complemento) | PNG, JPG, WebP, PDF, capas en ZIP |
| **CoffeeVector** *(Ilustración)* | Gráficos vectoriales e ilustración | `.cvc` | SVG; PNG/JPG para colocar o calcar | SVG, PDF vectorial, PNG, JPG |
| **CoffeePaint** *(Ilustración)* | Pintura y dibujo digital | `.cpt` | PNG, JPG, WebP | PNG, JPG, capas en ZIP, SVG vectorizado (con complemento) |
| **CoffeeLens** *(Ilustración)* | Revelado y organización de fotos | `.clc` (catálogo) | JPG, PNG, WebP, TIFF; RAW (con complemento) | JPG, PNG, WebP por lotes |
| **CoffeeMotion** *(Ilustración)* | Gráficos en movimiento y efectos visuales | `.cmo` | Imágenes, video y audio | WebM, GIF, secuencia PNG; MP4 y MOV (con FFmpeg) |
| **CoffeeSound** *(Ilustración)* | Edición, mezcla y restauración de audio | `.csn` | WAV, MP3, OGG, FLAC, M4A | WAV 16/24 bits; MP3, OGG y FLAC (con FFmpeg) |
| **CoffeeEncoder** *(Ilustración)* | Conversión de video y audio por lotes | `.cen` (cola) | Casi cualquier video o audio | MP4, MOV, MKV, WebM, GIF, MP3, AAC, WAV, FLAC... (con FFmpeg) |
| **CoffeeAnimate** *(Ilustración)* | Animación 2D interactiva | `.can` | PNG, JPG, SVG | HTML5 interactivo, WebM, GIF, secuencia PNG; MP4 y MOV (con FFmpeg) |
| **CoffeePuppet** *(Ilustración)* | Animación de personajes en tiempo real | `.cpup` | Cámara y micrófono | WebM, GIF; MP4 y MOV (con FFmpeg) |
| **CoffeeAnimate3D** *(Ilustración)* | Modelado y animación 3D por bloques, con Claude por MCP | `.ca3d` | — | glTF (`.glb`), PNG |

Cada aplicación es un ejecutable independiente construido con **Tauri 2** (Rust + WebView2) y **React + TypeScript**.

## Cómo funciona la instalación

1. El instalador de Windows (`CoffeeWorks-Setup-2.12.0.exe`, hecho con **Inno Setup**) instala solo el Launcher y deja los paquetes de las veintiuna aplicaciones en su carpeta `packages`.
2. Dentro del Launcher, en la **Tienda de Apps**, cada aplicación tiene sus botones **Instalar**, **Abrir App** y **Desinstalar**:
   - *Instalar* copia la aplicación a `%LOCALAPPDATA%\CoffeeWorks\Apps\<App>`, crea su acceso directo en el menú Inicio (carpeta *CoffeeWorks*) y asocia su tipo de archivo, de modo que un doble clic sobre un `.cfd`, `.cfs`, `.csl`, `.cpg`, `.cdb`, `.ccm` o `.clv` lo abre. CoffeePDF no reemplaza tu lector de PDF predeterminado: aparece en *Abrir con* del Explorador.
   - *Desinstalar* borra la aplicación, su acceso directo y su asociación. **Los documentos no se tocan.**
3. Los documentos se guardan como archivos normales en `Documentos\CoffeeWorks` y aparecen en *Documentos recientes* del Launcher.
4. Si tenías instalada una versión anterior (cuando la suite se llamaba «CoffeWorks»), al abrir el Launcher por primera vez se migra todo solo: los documentos pasan de `Documentos\CoffeWorks` a `Documentos\CoffeeWorks`, los recientes se conservan y las aplicaciones instaladas se reinstalan con sus nombres nuevos.
5. CoffeeCams (versión 2.5) se dividió en **CoffeeEdit** y **CoffeeLive**: si la tenías instalada, el Launcher instala las dos en su lugar y los proyectos `.ccm` se abren en CoffeeEdit.
6. Al desinstalar CoffeeWorks desde *Aplicaciones* de Windows se quitan también las aplicaciones instaladas; los documentos se conservan.

## Linux (Debian y Ubuntu)

CoffeeWorks también se publica como paquete **`.deb`** para **Ubuntu 22.04 o posterior** y **Debian 12 o posterior** (64 bits), junto al instalador de Windows en cada versión (`coffeeworks_<versión>_amd64.deb`).

```bash
sudo apt install ./coffeeworks_2.12.0_amd64.deb
```

- Se instala en `/opt/coffeeworks`, con el comando `coffeeworks` y su entrada en el menú de aplicaciones. Usa la WebKitGTK del sistema (`libwebkit2gtk-4.1`), así que el paquete pesa pocos MB.
- La primera vez que cada usuario abre el Launcher se le instalan todas las apps en `~/.local/share/CoffeeWorks/Apps`, con su entrada en el menú y sus tipos de archivo (un doble clic en un `.cfd`, `.cbk`, `.cmo`… lo abre con su app). Los documentos van a `~/Documentos/CoffeeWorks` (o `~/Documents/CoffeeWorks`).
- *Complementos*: FFmpeg, la revisión del PDF original (Tesseract), el revelado RAW (LibRaw) y el calco vectorial (Potrace) se instalan desde *Complementos* con los paquetes del sistema; el Launcher pide la contraseña con la ventana del sistema. La compatibilidad con Access solo está disponible en Windows.
- *Actualizaciones*: el Launcher descarga el `.deb` de la versión nueva, comprueba su suma SHA-256 e instala con `apt` al pulsar *Reiniciar y actualizar*.
- Para quitarlo: `sudo apt remove coffeeworks` (tus documentos se conservan).

## Actualizaciones automáticas

CoffeeWorks está en fase **Alpha** (se muestra junto al número de versión en el Launcher).

- **Cómo se actualiza:** el Launcher busca versiones nuevas en las *Releases* de este repositorio al abrirse y cada 6 horas. Si hay una, descarga su instalador en segundo plano y comprueba su suma SHA-256.
- **Cuándo se instala:** en silencio al cerrar el Launcher, o al instante con **Reiniciar y actualizar**.
- **Las apps:** al volver a abrir el Launcher, las apps instaladas se ponen al día con los paquetes nuevos (las que estén abiertas, la vez siguiente). Las desinstaladas no se vuelven a instalar y los documentos no se tocan.
- **Ajustes › Actualizaciones:** permite desactivar la instalación automática (entonces solo se descarga y tú eliges cuándo) o buscar actualizaciones a mano.

**Publicar una actualización:**

```bash
node scripts/version.mjs 2.8.1
```

Después se sube el cambio a `main` (por ejemplo, con una pull request). El flujo *Instalador de Windows* compila y prueba el instalador y, como la etiqueta `v2.7.1` aún no existe, crea la *Release* con el instalador, su `.sha256` y las notas generadas a partir de los cambios. Si la versión no cambia, no se publica nada.

- Mientras la fase sea *alpha* o *beta*, las versiones se marcan como *pre-release*.
- Para cambiar de fase: `node scripts/version.mjs 2.8.0 beta`, o `estable` para la primera versión estable.

## Claude (MCP) en CoffeeAnimate3D

CoffeeAnimate3D incluye un servidor [MCP](https://modelcontextprotocol.io) para que Claude modele y anime en la app abierta. Está **desactivado por defecto**.

- **Activarlo:** Launcher › *Ajustes* › *Claude (MCP)* › *Permitir que Claude use CoffeeAnimate3D*. Con CoffeeAnimate3D abierta, el estado pasa a *Esperando a Claude* y luego a *Claude conectado*.
- **Conectar Claude:** *Copiar configuración para Claude* copia dos cosas: la orden para **Claude Code** (`claude mcp add --transport http …` con la clave) y el bloque para `claude_desktop_config.json` de **Claude Desktop** (lanza `CoffeeAnimate3D --mcp-stdio`, que hace de puente con la app abierta).
- **Seguridad:** el servidor solo escucha en `127.0.0.1:48631`, rechaza peticiones de páginas web de otros orígenes y exige la clave (`Authorization: Bearer`). *Generar una clave nueva* invalida la anterior. La configuración vive en `mcp.json`, en la carpeta de datos locales de CoffeeWorks.
- **Herramientas:** `get_model`, `new_model` (con plantillas), `add_part` y `update_part` (con `shape`: cubo, cilindro, esfera, rampa o plano), `remove_part`, `duplicate_part`, `mirror_part`, `fill_face`, `paint_pixels`, `add_animation`, `set_keyframe`, `remove_keyframe`, `update_animation`, `group_parts`, `ungroup`, `copy_pose`, `paste_pose` (también reflejada), `export_obj`, `preview` (devuelve una imagen de la vista; también desde cualquier dirección con `direction`) y `export_glb` (guarda en `Documentos/CoffeeWorks/Exportaciones`).
- Cada cambio de Claude entra en el historial de la app: se deshace con `Ctrl+Z`.

## Complementos y plantillas

El Launcher tiene dos secciones más en la barra lateral:

- **Complementos**: un mercado de herramientas opcionales para las apps. No vienen en el instalador para que la suite siga siendo ligera; se descargan una sola vez en `%LOCALAPPDATA%\CoffeeWorks\Addons` y se quitan con un clic. Cada app también ofrece instalar el suyo en el momento en que lo necesita.
  - *Compatibilidad con Access* (CoffeeDataBase, ~8 MB): exporta tablas, datos, claves y relaciones a `.accdb` y `.mdb`. Es [Jackcess](https://jackcess.sourceforge.io) compilado a un ejecutable nativo con GraalVM, así que no necesita Java (código en `addons/coffee-accdb`).
  - *Motor de video FFmpeg* (~90 MB): necesario para transmitir en directo con CoffeeLive; motor de CoffeeEncoder y de la exportación a MP4, MOV, MP3, OGG y FLAC en CoffeeMotion, CoffeeAnimate, CoffeePuppet y CoffeeSound.
  - *IA generativa* (CoffeePhoto, sin descarga): relleno generativo de una selección y «Generar imagen» como capa nueva, con un servicio compatible con la API de imágenes de OpenAI y la clave del usuario (se guarda solo en el equipo). Sin el complemento, CoffeePhoto ya trae *Relleno según el contenido*, que funciona sin internet.
  - *Revelado RAW* (CoffeeLens y CoffeePhoto, ~4 MB): abre los RAW de casi cualquier cámara con [LibRaw](https://www.libraw.org) (código en `addons/coffee-raw`).
  - *Calco vectorial* (CoffeeVector y CoffeePaint, ~1 MB): convierte imágenes y dibujos en trazados con [Potrace](https://potrace.sourceforge.net), en blanco y negro o por colores (código en `addons/coffee-potrace`).
  - *Revisión del PDF original* (CoffeePDF, ~36 MB): revisa también la ortografía del texto que ya trae el PDF y, en los escaneados, lo reconoce con OCR ([Tesseract](https://github.com/tesseract-ocr/tesseract), español e inglés). Las faltas se corrigen con clic derecho: la palabra se tapa y la corrección se escribe encima (código en `addons/coffee-pdfcheck`).
  - La pestaña *Formatos e integración* resume qué abre y exporta cada app.
- **Plantillas**: 58 plantillas para catorce apps (actas, cartas, planes de proyecto, trabajos académicos; presupuestos, cronogramas, calificaciones y nómina; clases y sustentaciones; formularios, actas y certificados en PDF; cuadernos de clase, bitácoras y planificadores; bases de tienda, semilleros, biblioteca e inventario; proyectos de video para YouTube, Reels y tutoriales; escenas para clases, videojuegos y podcasts; pantallas de app móvil, web y escritorio; un proyecto UML completo, un modelo entidad-relación y un diagrama de flujo; una publicación de oferta, una miniatura de YouTube y un collage de fotos; un logotipo, una tarjeta de visita y un cartel vectoriales; un boceto con perspectiva, una página de cómic y un mandala en acuarela; y siete espacios de CoffeeBooks: segundo cerebro, gestor de proyectos, wiki del equipo, planificador de estudios, diario y hábitos, CRM y planificador de viajes). CoffeeLens trae en su lugar trece ajustes preestablecidos de revelado.
- **Games**: juegos originales hechos en Rust que se descargan aparte desde el Launcher (Instalar, Jugar, Actualizar y Desinstalar, con verificación SHA-256). El primero es **SurvivalForest**, de supervivencia y construcción en un mundo de bloques procedural ([repositorio](https://github.com/ThiagoVelez/juego-rust)). Cada juego tendrá sus Mods, TexturePacks y Shaders.

No hacen falta permisos de administrador: todo se instala por usuario. El instalador incluye el motor **WebView2** para los equipos con Windows 10 que aún no lo tengan (Windows 11 lo trae de serie).

## Obtener el instalador

### Opción A: descargarlo ya compilado (GitHub Actions)

Cada vez que se sube código, el flujo **Instalador de Windows** (`.github/workflows/build-windows.yml`) compila la suite en Windows, crea el instalador, lo prueba y lo publica:

1. Abre la pestaña **Actions** del repositorio y entra en la última ejecución de *Instalador de Windows*.
2. En **Artifacts**, descarga `CoffeeWorks-Setup` y descomprímelo: dentro está `CoffeeWorks-Setup-2.12.0.exe`.

Cuando llega a `main` una versión que aún no está publicada, el flujo crea su *Release* con el instalador (ver «Actualizaciones automáticas»). Al subir una etiqueta `v*` el instalador también se adjunta a esa *Release*.

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

El script compila las quince interfaces, los quince ejecutables y el instalador. El resultado queda en `installer\Output\CoffeeWorks-Setup-2.12.0.exe`.

Si prefieres hacerlo paso a paso:

```powershell
node scripts/build.mjs
```

```powershell
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" installer\CoffeeWorks.iss
```

El primer comando deja los ejecutables en `installer\build` (`CoffeeWorks.exe` y `packages\CoffeeDoc.exe`, `CoffeeCalc.exe`, `CoffeeView.exe`, `CoffeePDF.exe`, `CoffeePage.exe`, `CoffeeDataBase.exe`, `CoffeeEdit.exe`, `CoffeeLive.exe`); el segundo los empaqueta. También puedes abrir `installer\CoffeeWorks.iss` con el editor de Inno Setup y pulsar **Compile** (Ctrl+F9).

## Desarrollo

Modo web (cada aplicación en el navegador, con recarga en caliente):

```bash
npm install
```

```bash
npm run dev:all
```

Antes de la primera vez, instala también las dependencias de cada aplicación (`npm install` dentro de `CoffeeDoc`, `CoffeeCalc`, `CoffeeView`, `CoffeePDF`, `CoffeePage`, `CoffeeBooks`, `CoffeeDataBase`, `CoffeeEdit`, `CoffeeLive`, `CoffeeUIUX`, `CoffeeUML`, `CoffeePhoto`, `CoffeeVector`, `CoffeePaint`, `CoffeeLens`, `CoffeeMotion`, `CoffeeSound`, `CoffeeEncoder`, `CoffeeAnimate`, `CoffeePuppet` y `CoffeeAnimate3D`). Los servidores quedan en:

| Aplicación | Launcher | CoffeeDoc | CoffeeCalc | CoffeeView | CoffeePDF | CoffeePage | CoffeeEdit | CoffeeLive | CoffeeDataBase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Puerto | 1420 | 1421 | 1422 | 1423 | 1424 | 1425 | 1426 | 1427 | 1428 |

| Aplicación | CoffeeUI/UX | CoffeeUML | CoffeePhoto | CoffeeVector | CoffeePaint | CoffeeLens |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Puerto | 1429 | 1430 | 1431 | 1432 | 1433 | 1434 |

| Aplicación | CoffeeMotion | CoffeeSound | CoffeeEncoder | CoffeeAnimate | CoffeePuppet |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Puerto | 1435 | 1436 | 1437 | 1438 | 1439 |

| Aplicación | CoffeeBooks | CoffeeAnimate3D |
| :--- | :--- | :--- |
| Puerto | 1440 | 1441 |

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
├── CoffeeBooks/             Notas, wikis y bases de datos (src/ + src-tauri/)
├── CoffeeDataBase/          Bases de datos (src/ + src-tauri/)
├── CoffeeEdit/              Editor de video (src/ + src-tauri/)
├── CoffeeLive/              Grabación y transmisión en directo (src/ + src-tauri/)
├── CoffeeUIUX/              Diseño de interfaces y prototipos (src/ + src-tauri/)
├── CoffeeUML/               Modelado UML y diagramas (src/ + src-tauri/)
├── CoffeePhoto/             Edición de imágenes (src/ + src-tauri/)
├── CoffeeVector/            Gráficos vectoriales (src/ + src-tauri/)
├── CoffeePaint/             Pintura digital (src/ + src-tauri/)
├── CoffeeLens/              Revelado y catálogo de fotos (src/ + src-tauri/)
├── CoffeeMotion/            Gráficos en movimiento (src/ + src-tauri/)
├── CoffeeSound/             Edición de audio (src/ + src-tauri/)
├── CoffeeEncoder/           Conversión de video y audio (src/ + src-tauri/)
├── CoffeeAnimate/           Animación 2D (src/ + src-tauri/)
├── CoffeePuppet/            Personajes en tiempo real (src/ + src-tauri/)
├── CoffeeAnimate3D/         Modelado y animación 3D por bloques, con servidor MCP (src/ + src-tauri/)
├── crates/coffee-core/      Código Rust compartido: bóveda, recientes, archivos, diálogos, complementos y diccionarios
├── shared/spell/            Corrector ortográfico compartido (se copia a cada app con scripts/sync-shared.mjs)
├── shared/studio/           Base de las apps de Ilustración: encabezado, controles oscuros, guardado, historial y complementos
├── dictionaries/            Diccionarios Hunspell de español e inglés
├── addons/coffee-accdb/     Complemento de compatibilidad con Access (Java + GraalVM)
├── addons/coffee-pdfcheck/  Complemento de revisión del PDF original (Tesseract OCR)
├── installer/CoffeeWorks.iss  Script de Inno Setup
├── scripts/                build.mjs, build-windows.ps1, dev.mjs, version.mjs y sync-shared.mjs
└── .github/workflows/      Compilación y prueba del instalador y de los complementos
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

**Corrector ortográfico** (CoffeeDoc, CoffeeView, CoffeePDF, CoffeeCalc, CoffeePage y CoffeeDataBase) — en la barra inferior de cada app hay un indicador con el número de faltas; al hacer clic salta a la siguiente falta y la resalta. Las palabras mal escritas se subrayan en rojo y el clic derecho sobre ellas muestra las sugerencias, *Omitir todo*, *Agregar al diccionario* y *Siguiente falta*, como en Word. El menú del indicador permite elegir español, inglés o ambos, desactivar la revisión y editar el diccionario personal. Los diccionarios Hunspell (español con licencia MPL 1.1, inglés con licencia MIT/BSD; ver `dictionaries/`) los instala el instalador una vez en `%LOCALAPPDATA%\CoffeeWorks\Dictionaries` y los comparten todas las apps, igual que el diccionario personal (`%APPDATA%\CoffeeWorks\diccionario-usuario.txt`). La revisión corre en segundo plano (Web Worker), así que no frena la escritura. En CoffeeView revisa las diapositivas y las notas; en CoffeeCalc, las celdas de texto de todas las hojas; en CoffeePDF, los textos que agregas (y, con el complemento *Revisión del PDF original*, también el texto del documento, incluso escaneado); en CoffeePage, la página abierta; y en CoffeeDataBase, los campos de texto de la hoja de datos visible.


**CoffeeDoc** — estilos de párrafo, fuentes y tamaños en puntos, colores y resaltado, listas, tablas editables, imágenes, enlaces, comentarios, pestañas de documento, esquema automático, buscar y reemplazar, copiar formato, corrector ortográfico, configuración de página (tamaño, orientación, márgenes, columnas, color y marca de agua) y modo de solo lectura.

**CoffeeCalc** — más de 90 funciones en español e inglés (`SUMA`, `SI`, `BUSCARV`, `CONTAR.SI`, `PAGO`…), referencias absolutas y entre hojas, formatos numéricos, moneda y fecha, bordes, celdas combinadas, formato condicional, filtros por columna, ordenar, quitar duplicados, texto en columnas, paneles inmovilizados, tirador de relleno, gráficos de columnas, líneas, áreas y circulares, comentarios y enlaces.

**CoffeeView** — diseños y temas, cuadros de texto, formas, líneas, tablas, imágenes y vídeos que se mueven y redimensionan con el ratón, notas del orador, transiciones, ensayo de intervalos con avance automático, vista de cuadrícula y modo presentación a pantalla completa.

**CoffeePDF** — añadir y editar texto, reemplazar texto existente, resaltar, tachar con corrector blanco, rectángulos, elipses, líneas, flechas, dibujo a mano, imágenes y firmas (dibujadas o escritas); rellenar formularios; buscar texto y resaltar los resultados; reordenar, girar, duplicar, eliminar e insertar páginas; unir otros PDF, extraer páginas, exportar páginas a PNG, imprimir y editar las propiedades del documento.

**CoffeePage** — cuadernos con secciones de colores, páginas y subpáginas; notas que se colocan en cualquier punto de la página y se mueven arrastrándolas; formato de texto, listas, tablas, vínculos y fecha; etiquetas (tarea pendiente, importante, pregunta, idea); dibujo a mano con bolígrafo, marcador y borrador; imágenes pegadas o arrastradas; papel liso, rayado o cuadriculado; búsqueda en todo el cuaderno; guardado automático; exportación a HTML y Markdown e impresión.

**CoffeeDataBase** — bases de datos de escritorio sobre SQLite (archivos `.cdb`, también abre `.db` y `.sqlite`): diseñador de tablas con tipos de campo (autonumérico, texto, números, moneda, fecha, sí/no, binario), clave principal, requeridos, únicos y valores predeterminados; hoja de datos con edición, búsqueda, orden y listas para los campos relacionados; formularios registro a registro; consola SQL con colores, historial y explicación de errores en español; diseñador visual de consultas; diagrama de relaciones (uno a varios, uno a uno y varios a varios con tabla intermedia); asistente con plantillas, datos de prueba y revisión del diseño; importación de Excel, CSV, scripts SQL y bases `.accdb`/`.mdb`; exportación a Excel, CSV, script SQL, informes y Access (con el complemento); ETL de semilleros; tema oscuro, manual de usuario (F1), búsqueda de comandos (Ctrl+K) y copias de seguridad con fecha.

**CoffeeBooks** (blanco y negro) — notas, wikis y bases de datos, al estilo de Notion:

- *Páginas* anidadas con icono y portada, favoritos, búsqueda en todo el espacio (`Ctrl+P`), papelera con restauración y ancho completo.
- *Bloques*: texto, títulos, listas, tareas, desplegables, avisos, citas, código, tablas, imágenes, subpáginas y separadores. Se eligen con «/» o con atajos de Markdown (`#`, `-`, `1.`, `[]`, `>`, ```` ``` ````, `---`), se arrastran con el asa ⋮⋮ y se convierten o colorean desde su menú.
- *Bases de datos* con propiedades de texto, número, selección, selección múltiple, fecha, casilla y enlace; vistas de tabla, tablero, lista y calendario, filtros, orden y búsqueda; cada fila se abre como una página.
- Seis *plantillas* (notas de reunión, diario, wiki del equipo, seguimiento de tareas, lista de lectura y plan de proyecto). Importa Markdown y exporta cada página a Markdown, todo el espacio en ZIP o a PDF.

**CoffeeEdit** — editor de video: biblioteca de medios (video, audio, imágenes), línea de tiempo con varias pistas de video, texto y audio, recortar y dividir clips, moverlos entre pistas con ajuste magnético, velocidad (0,25x a 4x), volumen, fundidos, encuadre (escala, posición, rotación, opacidad), filtros y ajustes de color, *corrección de color tipo Lumetri* (exposición, temperatura, matiz, iluminaciones, sombras, blancos, negros, intensidad, nueve looks creativos y viñeta), *transiciones* (disolución cruzada, fundido a negro o a blanco, barrido, deslizar y zoom), *eliminar cerrando el hueco* (Mayús+Supr), *marcadores* (M, con [ y ] para saltar), títulos animados y exportación a MP4 o WebM en horizontal, vertical, cuadrado o 4K. Abre las grabaciones de CoffeeLive.

**CoffeeLive** — grabación de pantalla y transmisión en directo:

- *Escenas y fuentes*: pantalla o ventana, cámara, imágenes, presentaciones de imágenes, videos del disco, textos y colores; se colocan arrastrando en el lienzo, con rotación, volteo, esquinas redondeadas o recorte en círculo.
- *Filtros*: corrección de color, desenfoque, recorte y croma (pantalla verde, azul o del color que elijas).
- *Modo estudio*: vista previa y programa por separado, con transiciones (corte, fundido, deslizar, barrido, zoom).
- *Mezclador*: micrófono con supresión de ruido, cancelación de eco, ganancia, compresor y puerta de ruido; audio del escritorio y de los videos; vúmetros, silencio y escucha.
- *Grabación*: MP4 o WebM con la calidad, carpeta y nombre de archivo que elijas, con pausa y capturas PNG.
- *Transmisión*: Twitch, YouTube, Facebook, Kick o cualquier servidor RTMP/SRT; codificación por hardware (NVIDIA, Intel, AMD) o x264, CBR/VBR, intervalo de fotogramas clave, preajuste y perfil; resolución base y de salida, FPS y filtro de escalado; reconexión automática y grabación simultánea. Usa el complemento *Motor de video FFmpeg* (unos 90 MB), que se instala desde Complementos o la primera vez que transmites; si ya tienes ffmpeg en el PATH, lo usa.
- *Atajos globales* configurables (también con la ventana minimizada): grabar, pausar, transmitir, silenciar, pulsar para hablar, transición, cambiar de escena y captura.
- *Estadísticas*: FPS, tiempo de render, fotogramas perdidos, tasa de bits y tamaño de la grabación.

**CoffeeUI/UX** — diseño de interfaces y prototipos para **móvil, escritorio y web**:

- *Lienzo infinito* con páginas, marcos con tamaños de dispositivo (iPhone, Android, tabletas, ventanas de escritorio y anchos web), zoom y guías inteligentes al mover.
- *Herramientas*: marco, rectángulo, elipse, línea, flecha, polígono, estrella, pluma, lápiz, texto e imágenes (también pegadas o arrastradas).
- *Propiedades*: posición, tamaño, rotación, esquinas, rellenos sólidos y degradados, bordes, sombras (exterior e interior), desenfoque, opacidad y tipografía completa.
- *Capas* en árbol con renombrar, ocultar, bloquear y reordenar arrastrando; agrupar, envolver en marcos y alinear o repartir.
- *Diseño automático* (filas y columnas con espacio, relleno y alineación) y tamaños fijo, ajustar al contenido o rellenar.
- *Componentes e instancias* que se actualizan con el original, con textos propios por instancia.
- *Kits de interfaz*: barras de estado, de navegación y de pestañas, botones, campos, tarjetas, listas, diálogos, barras de título y menús de escritorio, tablas, cabeceras, secciones, precios, formularios y pies de página web.
- *Prototipo*: enlaces entre pantallas con transiciones (disolver, deslizar, empujar) y modo presentación navegable.
- *Exportación* a PNG, JPG (con escala), SVG, PDF y código HTML/CSS (el diseño automático se convierte en Flexbox); panel *Código* con el CSS de cada capa.

**CoffeeUML** (icono verde viridian) — modelado UML y diagramas:

- *Doce tipos de diagrama* en un mismo modelo: clases, objetos, paquetes, componentes, despliegue, casos de uso, secuencia, actividad (con carriles), estados, entidad-relación (pata de gallo y Chen), diagramas de flujo y mapas mentales.
- *Clases completas*: atributos y operaciones con visibilidad, tipos, parámetros, estáticos y abstractos; interfaces y enumeraciones; edición directa en el diagrama («- precio: double»).
- *Relaciones UML*: asociación, dirección, agregación, composición, herencia, realización, dependencia, «include» y «extend», con multiplicidades y roles; mensajes síncronos, asíncronos, de respuesta y de creación que se ordenan arrastrándolos; fragmentos alt/loop/opt.
- *Entidad-relación*: tablas con PK, FK, NOT NULL y UNIQUE, y cardinalidades 1, 0..1, 1..* y 0..*.
- *Generación de código* Java, C#, TypeScript y Python (herencia, interfaces y asociaciones), SQL `CREATE TABLE` con claves foráneas, Mermaid y PlantUML; importación de scripts SQL (por ejemplo, los que exporta CoffeeDataBase).
- Organización automática, alinear y repartir, cuadrícula, copiar y pegar, y exportación a PNG, SVG y PDF (todos los diagramas en un PDF).

### Ilustración

Las nueve apps de Ilustración comparten una interfaz oscura, autoguardado, deshacer y rehacer, buscador de comandos (`Ctrl+K`) y atajos parecidos. Sus iconos usan degradados cálidos (`scripts/make-art-icons.py`).

**CoffeePhoto** (naranja → carmesí) — edición avanzada de imágenes:

- *Capas* de píxeles, texto y ajuste, con modos de fusión, opacidad, bloqueo, máscaras de capa (desde la selección), estilos (sombra paralela, trazo, resplandor), combinar, acoplar y rasterizar.
- *Selecciones*: marco rectangular y elíptico, lazo y lazo poligonal, varita mágica (contigua o no), sumar/restar/intersecar, calar, expandir, contraer, invertir y cargar desde una capa.
- *Herramientas*: mover, transformación libre (escalar y girar), recortar, cuentagotas, pincel y lápiz con presión, tampón de clonar, pincel corrector puntual, borrador, degradado, bote de pintura, desenfocar, sobreexponer, subexponer, texto y formas.
- *Ajustes* (directos o como capa de ajuste): brillo/contraste, niveles, curvas por canal, exposición, intensidad, tono/saturación, equilibrio de color, blanco y negro, filtro de fotografía, invertir, posterizar, umbral y mapa de degradado, con vista previa e histograma.
- *Filtros*: desenfoque gaussiano y de movimiento, enfocar y máscara de enfoque, ruido, reducir ruido, pixelar, relieve, hallar bordes, viñeta y pintura al óleo.
- *Relleno según el contenido* (borra objetos y rellena con lo que hay alrededor, sin internet) y, con el complemento, *relleno generativo* y *generar imagen* con IA.
- Tamaño de imagen y de lienzo, girar y voltear, recortar a la selección, portapapeles del sistema y exportación a PNG, JPG, WebP, PDF y capas en ZIP.

**CoffeeVector** (amarillo → naranja) — gráficos vectoriales e ilustración:

- *Pluma Bézier* (clic para esquinas, arrastrar para curvas, añadir y quitar nodos), *selección directa* de nodos y manejadores, convertir punto de ancla y *lápiz* con suavizado.
- *Formas*: rectángulo, rectángulo redondeado, elipse, polígono, estrella y línea.
- *Apariencia*: relleno sólido o con degradado lineal o radial (varias paradas), trazo con grosor, extremos, esquinas y discontinuo; opacidad y modos de fusión.
- *Buscatrazos* (unir, menos frente, intersecar, excluir), alinear y distribuir, agrupar, máscaras de recorte, unir y simplificar trazados, reflejar y girar.
- *Texto* editable en el lienzo, *mesas de trabajo* múltiples, capas con bloqueo y visibilidad.
- Importa SVG (trazados con arcos, formas, texto, grupos, transformaciones y degradados) y, con el complemento, *calca imágenes* en blanco y negro o por colores. Exporta SVG, PDF vectorial (una página por mesa), PNG y JPG.

**CoffeePaint** (rosa → mandarina) — pintura y dibujo digital:

- *Pinceles* con presión del lápiz y grano del papel: lápiz, carboncillo, pastel, pluma de tinta, rotulador pincel, caligrafía, marcador, acuarela (con bordes húmedos al secarse), aguada, óleo (arrastra y mezcla el color), aerógrafo y salpicaduras; *difuminar* y borrador.
- *Estabilizador* del trazo, *simetría* vertical, horizontal, en cuatro y radial (mandalas).
- *Lienzo* con papel de boceto, acuarela, lienzo o liso; zoom, desplazamiento y *giro de la vista*, también con dos dedos en pantallas táctiles.
- Capas con modos de fusión, bloquear transparencia, combinar y referencias importadas; exporta PNG (con o sin papel), JPG, capas en ZIP y, con el complemento, el dibujo vectorizado en SVG.

**CoffeeLens** (ámbar → terracota) — revelado y organización de fotografías:

- *Biblioteca*: importa varias fotos a la vez (o arrastrándolas), lee los datos EXIF, estrellas, banderas, etiquetas de color, palabras clave, descripción, colecciones y filtros.
- *Revelar* (no destructivo): balance de blancos, exposición, contraste, iluminaciones, sombras, blancos, negros, textura, claridad, eliminar neblina, intensidad y saturación; curva de tonos, mezcla de color HSL por gamas, virado, enfoque, reducción de ruido, viñeta y grano; recorte con proporciones y enderezado, giro y volteo; antes y después e histograma.
- Trece *ajustes preestablecidos* (y los tuyos), copiar y pegar ajustes entre fotos y *exportación por lotes* a JPG, PNG o WebP con cambio de tamaño.
- Con el complemento *Revelado RAW* abre los archivos RAW de las cámaras.

**CoffeeMotion** (magenta → naranja) — gráficos en movimiento y efectos visuales:

- *Composiciones* anidadas (precomponer) con área de trabajo, fotogramas por segundo, fondo transparente y desenfoque de movimiento.
- *Capas* de forma (rectángulo, elipse, estrella, polígono y trazados con pluma), texto, imagen, video, audio, sólido, objeto nulo y capa de ajuste; primarios (una capa sigue a otra), modos de fusión y *mates de seguimiento* (alfa y luminancia).
- *Fotogramas clave* con cronómetro por propiedad, suavizados (incluida una curva Bézier propia, F9 para suavizar) y *expresiones* (`wiggle`, `loopOut`, `time`, `linear`, `ease`...).
- *Animador de texto* por letras (máquina de escribir, aparecer, subir, crecer, desenfoque y ola) y *recortar trazados* para dibujar formas.
- *Efectos* animables: desenfoque gaussiano y direccional, resplandor, sombra paralela, contorno, brillo y contraste, tono/saturación, teñir, relleno, invertir, ruido, viñeta y mosaico; *máscaras* rectangulares y elípticas con desvanecido, expansión e inversión.
- 18 *animaciones predefinidas* y 5 *plantillas de títulos* (rótulo inferior, título cinético, revelado de logotipo, cuenta atrás y cita vertical para redes).
- Exporta fotograma a fotograma a WebM (con el audio), GIF y secuencia PNG; con FFmpeg, también a MP4 y MOV ProRes 4444 con transparencia.

**CoffeeSound** (naranja → rojo) — edición, mezcla y restauración de audio:

- *Editor de forma de onda* y *espectro de frecuencias*: seleccionar, cortar, copiar, pegar, recortar, silenciar, insertar silencio, fundidos, amplificar, normalizar, invertir, cambiar velocidad, mono y estéreo.
- *Efectos* con vista previa: ecualizador, compresor, limitador, reverberación, eco, pasa bajos y pasa altos, ganancia, distorsión y coro; *reducción de ruido* con perfil capturado.
- *Multipista*: pistas con volumen, panorama, silencio, solo y efectos en tiempo real; clips que se mueven entre pistas, se recortan, se dividen y tienen ganancia y fundidos; mezcla final a un archivo nuevo.
- *Grabación* con el micrófono, generador de tonos y ruido, marcadores, y exportación a WAV de 16 o 24 bits (con FFmpeg, también MP3, OGG y FLAC).

**CoffeeEncoder** (rosa → frambuesa) — conversión de video y audio por lotes:

- *Cola* con varios archivos y varias salidas por archivo, arrastrar y soltar, análisis del original (duración, resolución, códecs) y miniaturas.
- 33 *ajustes preestablecidos*: H.264, HEVC, AV1, ProRes, WebM; YouTube 1080p y 4K, Reels/TikTok, Instagram, X, Facebook, WhatsApp; teléfono, tableta y televisor; MP3, AAC, pódcast, WAV, FLAC, OGG, Opus; GIF y miniaturas. Guarda los tuyos en «Mis ajustes».
- *Ajustes de exportación*: contenedor y códec, resolución con encajar/rellenar/estirar, fotogramas, calidad constante o tasa de bits, velocidad, *aceleración por hardware* (NVIDIA, Intel y AMD), audio, normalización de sonoridad (LUFS), giro, desentrelazado, marca de agua y recorte de tiempo, con tamaño estimado.
- Progreso en vivo (porcentaje, tiempo restante y velocidad), cancelar, historial y comando de FFmpeg visible. Usa el complemento FFmpeg; en el navegador convierte a WebM, WAV y fotogramas sin él.

**CoffeeAnimate** (rojo → naranja) — animación 2D interactiva:

- *Dibujo vectorial*: pincel, lápiz, línea, rectángulo, óvalo, texto, bote de pintura, borrador y cuentagotas.
- *Línea de tiempo* con capas, fotogramas clave y vacíos (F5, F6, F7), *papel cebolla*, etiquetas y acción «detener» por fotograma.
- *Interpolación clásica* con suavizado y vueltas, e *interpolación de forma* cuando los trazos tienen los mismos puntos.
- *Símbolos* (F8): gráficos, clips de película y *botones* con estados (Reposo, Sobre, Presionado, Zona activa) y acciones al hacer clic (reproducir, detener, ir a un fotograma, abrir una web).
- *Probar película* y exportación a *HTML5 interactivo* (una página que funciona en cualquier navegador), WebM, GIF y secuencia PNG; con FFmpeg, también MP4 y MOV.

**CoffeePuppet** (rosa → violeta) — animación de personajes en tiempo real:

- *Seguimiento facial con la cámara* (cabeza, ojos, mirada, cejas, boca y parpadeo) incluido en la app y sin Internet; sin cámara, el personaje mira al ratón y parpadea solo.
- *Boca con el micrófono*, 9 *gestos* con el teclado (saludar, saltar, sorpresa, corazones, reír, pulgar arriba, tristeza, enfado, dormir) y desplazamiento por la escena con las flechas.
- Cinco personajes personalizables (taza de café, persona, robot y gato: colores, pelo y accesorios) y escenas con color, degradado o imagen.
- *Tomas* grabadas con la voz, reproducción y exportación a video (WebM con audio, GIF; con FFmpeg, MP4 y MOV).

**CoffeeAnimate3D** (naranja → violeta) — modelado y animación 3D por bloques:

- Modelos hechos de *cubos, cilindros, esferas, rampas y planos* (16 unidades = 1 bloque) organizados en un árbol de *huesos*: cada parte gira sobre su pivote y arrastra a sus hijas.
- *Texturas pixeladas de 32×32* por cara, con lápiz, relleno y cuentagotas, y la paleta del juego SurvivalForest.
- *Animaciones* por fotogramas clave (posición, giro y escala) con suavizado lineal, suave, escalonado, de entrada lenta o de salida lenta, en bucle o de una vez; *vista de curvas* para arrastrar claves, *papel cebolla* y *copiar y pegar poses* (Ctrl+Mayús+C / V; Ctrl+Mayús+B la pega reflejada en el otro lado).
- Plantillas de *cuadrúpedo, bípedo, ave y araña* con animaciones de reposo, andar y volar; duplicar y *reflejar* partes (izquierda ↔ derecha).
- Gizmo para *mover* (G), *girar* (R) y *escalar* (S, desde el pivote), con *ajuste a la cuadrícula* (1 px, 1 u, ½ bloque o 1 bloque) y giro en pasos de 15°; botones −/+ para agrandar o encoger la caja de ½ en ½ bloque.
- *Cubo de vista* en la esquina: clic en una cara, arista o esquina para girar la cámara; la casa vuelve a la vista isométrica.
- *Selección múltiple* (Mayús+clic, rectángulo con Mayús+arrastrar, Ctrl+A), *grupos* (Ctrl+G / Ctrl+Mayús+G) y *medir* distancias en bloques (Mayús+M).
- Exportación a *glTF binario* (`.glb`, con texturas y animaciones; lleva el modelo dentro, así que se vuelve a importar exacto), a *OBJ* (ZIP con `.obj`, `.mtl` y la textura) y captura PNG. *Importar*: un `.glb` de CoffeeAnimate3D vuelve como modelo; cualquier otro `.glb` u `.obj` entra como *referencia* gris para calcar encima.
- **Claude por MCP**: Claude puede crear, pintar y animar modelos en la app abierta (ver *Claude (MCP)* más abajo).

**Modo claro y oscuro**: toda la suite usa el modo claro por defecto. En el Launcher (*Ajustes › Apariencia*), en el menú *Ver* de cada app o en los ajustes de CoffeeLive se cambia al modo oscuro, en negro, y el cambio vale para todas las apps. Los temas se generan a partir de los colores de cada app con `scripts/make-theme.mjs`; la hoja de los documentos, las diapositivas, las páginas PDF y los lienzos de diseño conservan sus colores. Las apps de Ilustración son siempre oscuras.

En CoffeeDoc, CoffeeCalc y CoffeeView: autoguardado, *Guardar como*, deshacer y rehacer, impresión y PDF, buscador de menús (`Alt+/`) y documentos fijados en el Launcher.
