# CoffeeWorks

Suite ofimática de escritorio para Windows, de código abierto y sin conexión. Se compone de un **Launcher** que instala y gestiona las aplicaciones y de ocho aplicaciones, en dos categorías (**Office** y **Multimedia**):

| Aplicación | Qué es | Formato propio | Abre | Exporta |
| :--- | :--- | :--- | :--- | :--- |
| **CoffeeDoc** | Procesador de textos | `.cfd` | Word (`.docx`), Markdown, HTML, texto | Word (`.docx`), Markdown, HTML, texto, PDF |
| **CoffeeCalc** | Hoja de cálculo | `.cfs` | Excel (`.xlsx`, `.xls`), CSV | Excel (`.xlsx`) con formato, CSV, PDF |
| **CoffeeView** | Presentaciones | `.csl` | PowerPoint (`.pptx`) | PowerPoint (`.pptx`), HTML, PDF |
| **CoffeePDF** | Editor de PDF | `.pdf` | PDF | PDF, páginas sueltas, PNG |
| **CoffeePage** | Cuaderno de notas | `.cpg` | Cuadernos `.cpg`; imágenes y texto para insertar | HTML, Markdown, PDF (imprimir) |
| **CoffeeDataBase** | Bases de datos | `.cdb` (SQLite) | SQLite (`.db`, `.sqlite`); importa Excel, CSV y `.accdb`/`.mdb` | Excel, CSV, script SQL, informes, Access (`.accdb`/`.mdb`, con complemento) |
| **CoffeeEdit** *(Multimedia)* | Editor de video | `.ccm` | Video (MP4, WebM, MOV, MKV), audio e imágenes | Video MP4/WebM |
| **CoffeeLive** *(Multimedia)* | Grabación y transmisión en directo | `.clv` | Pantalla, cámara, imágenes y videos como fuentes | Grabaciones MP4/WebM, transmisión RTMP/SRT |

Cada aplicación es un ejecutable independiente construido con **Tauri 2** (Rust + WebView2) y **React + TypeScript**.

## Cómo funciona la instalación

1. El instalador (`CoffeeWorks-Setup-2.6.0.exe`, hecho con **Inno Setup**) instala solo el Launcher y deja los paquetes de las ocho aplicaciones en su carpeta `packages`.
2. Dentro del Launcher, en la **Tienda de Apps**, cada aplicación tiene sus botones **Instalar**, **Abrir App** y **Desinstalar**:
   - *Instalar* copia la aplicación a `%LOCALAPPDATA%\CoffeeWorks\Apps\<App>`, crea su acceso directo en el menú Inicio (carpeta *CoffeeWorks*) y asocia su tipo de archivo, de modo que un doble clic sobre un `.cfd`, `.cfs`, `.csl`, `.cpg`, `.cdb`, `.ccm` o `.clv` lo abre. CoffeePDF no reemplaza tu lector de PDF predeterminado: aparece en *Abrir con* del Explorador.
   - *Desinstalar* borra la aplicación, su acceso directo y su asociación. **Los documentos no se tocan.**
3. Los documentos se guardan como archivos normales en `Documentos\CoffeeWorks` y aparecen en *Documentos recientes* del Launcher.
4. Si tenías instalada una versión anterior (cuando la suite se llamaba «CoffeWorks»), al abrir el Launcher por primera vez se migra todo solo: los documentos pasan de `Documentos\CoffeWorks` a `Documentos\CoffeeWorks`, los recientes se conservan y las aplicaciones instaladas se reinstalan con sus nombres nuevos.
5. CoffeeCams (versión 2.5) se dividió en **CoffeeEdit** y **CoffeeLive**: si la tenías instalada, el Launcher instala las dos en su lugar y los proyectos `.ccm` se abren en CoffeeEdit.
6. Al desinstalar CoffeeWorks desde *Aplicaciones* de Windows se quitan también las aplicaciones instaladas; los documentos se conservan.

## Complementos y plantillas

El Launcher tiene dos secciones más en la barra lateral:

- **Complementos**: un mercado de herramientas opcionales para las apps. No vienen en el instalador para que la suite siga siendo ligera; se descargan una sola vez en `%LOCALAPPDATA%\CoffeeWorks\Addons` y se quitan con un clic. Cada app también ofrece instalar el suyo en el momento en que lo necesita.
  - *Compatibilidad con Access* (CoffeeDataBase, ~8 MB): exporta tablas, datos, claves y relaciones a `.accdb` y `.mdb`. Es [Jackcess](https://jackcess.sourceforge.io) compilado a un ejecutable nativo con GraalVM, así que no necesita Java (código en `addons/coffee-accdb`).
  - *Motor de video FFmpeg* (CoffeeLive, ~90 MB): necesario para transmitir en directo.
  - La pestaña *Formatos e integración* resume qué abre y exporta cada app.
- **Plantillas**: 36 plantillas para las ocho apps (actas, cartas, planes de proyecto, trabajos académicos; presupuestos, cronogramas, calificaciones y nómina; clases y sustentaciones; formularios, actas y certificados en PDF; cuadernos de clase, bitácoras y planificadores; bases de tienda, semilleros, biblioteca e inventario; proyectos de video para YouTube, Reels y tutoriales; y escenas para clases, videojuegos y podcasts).

No hacen falta permisos de administrador: todo se instala por usuario. El instalador incluye el motor **WebView2** para los equipos con Windows 10 que aún no lo tengan (Windows 11 lo trae de serie).

## Obtener el instalador

### Opción A: descargarlo ya compilado (GitHub Actions)

Cada vez que se sube código, el flujo **Instalador de Windows** (`.github/workflows/build-windows.yml`) compila la suite en Windows, crea el instalador, lo prueba y lo publica:

1. Abre la pestaña **Actions** del repositorio y entra en la última ejecución de *Instalador de Windows*.
2. En **Artifacts**, descarga `CoffeeWorks-Setup` y descomprímelo: dentro está `CoffeeWorks-Setup-2.6.0.exe`.

Al subir una etiqueta `v*` (por ejemplo `v2.6.0`) el instalador se adjunta además a una *Release*.

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

El script compila las nueve interfaces, los nueve ejecutables y el instalador. El resultado queda en `installer\Output\CoffeeWorks-Setup-2.6.0.exe`.

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

Antes de la primera vez, instala también las dependencias de cada aplicación (`npm install` dentro de `CoffeeDoc`, `CoffeeCalc`, `CoffeeView`, `CoffeePDF`, `CoffeePage`, `CoffeeDataBase`, `CoffeeEdit` y `CoffeeLive`). Los servidores quedan en:

| Aplicación | Launcher | CoffeeDoc | CoffeeCalc | CoffeeView | CoffeePDF | CoffeePage | CoffeeEdit | CoffeeLive | CoffeeDataBase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Puerto | 1420 | 1421 | 1422 | 1423 | 1424 | 1425 | 1426 | 1427 | 1428 |

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
├── CoffeeDataBase/          Bases de datos (src/ + src-tauri/)
├── CoffeeEdit/              Editor de video (src/ + src-tauri/)
├── CoffeeLive/              Grabación y transmisión en directo (src/ + src-tauri/)
├── crates/coffee-core/      Código Rust compartido: bóveda, recientes, archivos, diálogos y complementos
├── addons/coffee-accdb/     Complemento de compatibilidad con Access (Java + GraalVM)
├── installer/CoffeeWorks.iss  Script de Inno Setup
├── scripts/                build.mjs, build-windows.ps1 y dev.mjs
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

**CoffeeDoc** — estilos de párrafo, fuentes y tamaños en puntos, colores y resaltado, listas, tablas editables, imágenes, enlaces, comentarios, pestañas de documento, esquema automático, buscar y reemplazar, copiar formato, corrector ortográfico del sistema, configuración de página (tamaño, orientación, márgenes, columnas, color y marca de agua) y modo de solo lectura.

**CoffeeCalc** — más de 90 funciones en español e inglés (`SUMA`, `SI`, `BUSCARV`, `CONTAR.SI`, `PAGO`…), referencias absolutas y entre hojas, formatos numéricos, moneda y fecha, bordes, celdas combinadas, formato condicional, filtros por columna, ordenar, quitar duplicados, texto en columnas, paneles inmovilizados, tirador de relleno, gráficos de columnas, líneas, áreas y circulares, comentarios y enlaces.

**CoffeeView** — diseños y temas, cuadros de texto, formas, líneas, tablas, imágenes y vídeos que se mueven y redimensionan con el ratón, notas del orador, transiciones, ensayo de intervalos con avance automático, vista de cuadrícula y modo presentación a pantalla completa.

**CoffeePDF** — añadir y editar texto, reemplazar texto existente, resaltar, tachar con corrector blanco, rectángulos, elipses, líneas, flechas, dibujo a mano, imágenes y firmas (dibujadas o escritas); rellenar formularios; buscar texto y resaltar los resultados; reordenar, girar, duplicar, eliminar e insertar páginas; unir otros PDF, extraer páginas, exportar páginas a PNG, imprimir y editar las propiedades del documento.

**CoffeePage** — cuadernos con secciones de colores, páginas y subpáginas; notas que se colocan en cualquier punto de la página y se mueven arrastrándolas; formato de texto, listas, tablas, vínculos y fecha; etiquetas (tarea pendiente, importante, pregunta, idea); dibujo a mano con bolígrafo, marcador y borrador; imágenes pegadas o arrastradas; papel liso, rayado o cuadriculado; búsqueda en todo el cuaderno; guardado automático; exportación a HTML y Markdown e impresión.

**CoffeeDataBase** — bases de datos de escritorio sobre SQLite (archivos `.cdb`, también abre `.db` y `.sqlite`): diseñador de tablas con tipos de campo (autonumérico, texto, números, moneda, fecha, sí/no, binario), clave principal, requeridos, únicos y valores predeterminados; hoja de datos con edición, búsqueda, orden y listas para los campos relacionados; formularios registro a registro; consola SQL con colores, historial y explicación de errores en español; diseñador visual de consultas; diagrama de relaciones (uno a varios, uno a uno y varios a varios con tabla intermedia); asistente con plantillas, datos de prueba y revisión del diseño; importación de Excel, CSV, scripts SQL y bases `.accdb`/`.mdb`; exportación a Excel, CSV, script SQL, informes y Access (con el complemento); ETL de semilleros; tema oscuro, manual de usuario (F1), búsqueda de comandos (Ctrl+K) y copias de seguridad con fecha.

**CoffeeEdit** — editor de video: biblioteca de medios (video, audio, imágenes), línea de tiempo con varias pistas de video, texto y audio, recortar y dividir clips, moverlos entre pistas con ajuste magnético, velocidad (0,25x a 4x), volumen, fundidos, encuadre (escala, posición, rotación, opacidad), filtros y ajustes de color, títulos animados y exportación a MP4 o WebM en horizontal, vertical, cuadrado o 4K. Abre las grabaciones de CoffeeLive.

**CoffeeLive** — grabación de pantalla y transmisión en directo:

- *Escenas y fuentes*: pantalla o ventana, cámara, imágenes, presentaciones de imágenes, videos del disco, textos y colores; se colocan arrastrando en el lienzo, con rotación, volteo, esquinas redondeadas o recorte en círculo.
- *Filtros*: corrección de color, desenfoque, recorte y croma (pantalla verde, azul o del color que elijas).
- *Modo estudio*: vista previa y programa por separado, con transiciones (corte, fundido, deslizar, barrido, zoom).
- *Mezclador*: micrófono con supresión de ruido, cancelación de eco, ganancia, compresor y puerta de ruido; audio del escritorio y de los videos; vúmetros, silencio y escucha.
- *Grabación*: MP4 o WebM con la calidad, carpeta y nombre de archivo que elijas, con pausa y capturas PNG.
- *Transmisión*: Twitch, YouTube, Facebook, Kick o cualquier servidor RTMP/SRT; codificación por hardware (NVIDIA, Intel, AMD) o x264, CBR/VBR, intervalo de fotogramas clave, preajuste y perfil; resolución base y de salida, FPS y filtro de escalado; reconexión automática y grabación simultánea. Usa el complemento *Motor de video FFmpeg* (unos 90 MB), que se instala desde Complementos o la primera vez que transmites; si ya tienes ffmpeg en el PATH, lo usa.
- *Atajos globales* configurables (también con la ventana minimizada): grabar, pausar, transmitir, silenciar, pulsar para hablar, transición, cambiar de escena y captura.
- *Estadísticas*: FPS, tiempo de render, fotogramas perdidos, tasa de bits y tamaño de la grabación.

En CoffeeDoc, CoffeeCalc y CoffeeView: autoguardado, *Guardar como*, deshacer y rehacer, impresión y PDF, buscador de menús (`Alt+/`) y documentos fijados en el Launcher.
