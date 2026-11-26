# CoffeeLatex: plan de implementación de la Entrega 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva app CoffeeLatex (Office): editor de LaTeX y Markdown con vista previa, botones de fórmulas, plantillas, corrector y exportación. Incluye los complementos «Motor LaTeX» y «Pandoc» y los apartados «Desde LaTeX» y «Desde Markdown» de CoffeeConvert.

**Architecture:**
- App Tauri `CoffeeLatex/` con React, TS y Vite, como las demás apps de la suite.
- La vista previa es un traductor propio de LaTeX y de Markdown (`marked`) a HTML, con fórmulas de KaTeX.
- Compilar a PDF (Tectonic o xelatex) y convertir con Pandoc va en `coffee-core` (`docconv.rs`), para que CoffeeLatex y CoffeeConvert registren los mismos comandos.

**Tech Stack:** React 19, TS, Vite 6, Tailwind 3, `katex` 0.16, `marked` 15. En Rust: Tauri 2 y coffee-core. Pruebas con `tsx --test`, `cargo test` y Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-coffeelatex-design.md`

## Global Constraints

- **Textos:** en español.
- **Identidad de la app:**
  - categoría **Office**;
  - color **`#0d5e6f`**;
  - puerto **1444**;
  - identificador `com.coffeeworks.coffeelatex`;
  - abre `.tex` y `.md` sin reclamarlos (`claim_default: false`).
- **Complementos:**
  - `latex` («Motor LaTeX»): en Windows, Tectonic en `coffee-latex-win64.zip`; en Linux, apt `texlive-xetex texlive-lang-spanish texlive-science`.
  - `pandoc` («Conversor de documentos (Pandoc)»): en Windows, `coffee-pandoc-win64.zip`; en Linux, apt `pandoc`.
  - Para los dos se busca primero el complemento y después el PATH.
- **Sin complementos** se escribe, se previsualiza y se exporta a HTML, `.tex` y `.md`.
- **Vista previa:** se actualiza unos **300 ms** después de dejar de escribir; lo desconocido se muestra en gris («se verá en el PDF»).
- **Corrector:** nunca marca comandos (`\algo`), argumentos de `\label`/`\ref`/`\cite`/`\begin`/`\end`, ni el contenido de fórmulas.
- **Versión de la suite:** **2.16.0**.

## Review Focus

- **LaTeX roto a medio escribir** (llave sin cerrar, `\begin` sin `\end`, `$` suelto): la vista previa no se rompe y muestra lo que puede. Prueba en Task 2: `latexToHtml tolera código a medio escribir`.
- **Error del compilador:** se muestra en español con la línea correcta del `.tex`. Prueba en Task 5: `texErrors encuentra línea y mensaje`.
- **Nombres de archivo con espacios o tildes** («Caída libre.tex»): compilar y convertir funcionan. Prueba en Task 4: `compila con nombre con espacios y tildes`.
- **Fórmulas con acentos y `\,` o `\mathrm{m/s^2}`:** KaTeX no lanza errores y lo inválido aparece en rojo. Prueba en Task 2: `fórmula inválida no rompe la vista`.
- **Exportar a HTML sin conexión:** el archivo incluye el CSS de KaTeX y las fuentes embebidas. Prueba en Task 7: `exportarHtml no depende de internet`.

---

### Task 1: Estructura de la app

**Files:**
- Create: `CoffeeLatex/`, copiando `CoffeeConvert/` (como se hizo con CoffeeDrawTeam):
  - `package.json` con el nombre `coffeelatex` y el script `test`;
  - `vite.config.ts` con el puerto 1444;
  - `src-tauri/` con el bin `CoffeeLatex` y el identificador del producto.
- Modify:
  - `Cargo.toml`: añadir el miembro;
  - `scripts/sync-shared.mjs`: grupos `theme`, `spell` y `studio`;
  - `scripts/make-theme.mjs`: `CoffeeLatex: "light"`.

- [ ] **Step 1:** Crear la estructura, con dependencias `katex` y `marked`; `App.tsx` mínimo.
- [ ] **Step 2:** Ejecutar `node scripts/sync-shared.mjs`, `node scripts/make-theme.mjs`, `cd CoffeeLatex && npm i && npm run build` y `cargo check -p coffeelatex`. Debe terminar sin errores.
- [ ] **Step 3:** Commit «CoffeeLatex: estructura de la app».

### Task 2: Vista previa de LaTeX

**Files:**
- Create: `CoffeeLatex/src/preview/latex.ts` y `latex.test.ts`.

**Interfaces:**
- Produces:
  - `latexToHtml(src: string): { html: string; titulo?: string }`;
  - `mathHtml(tex: string, display: boolean): string`, que usa KaTeX con `throwOnError: false`.

- [ ] **Step 1: Pruebas.**
  - `secciones numeradas`: `\section{A}\subsection{B}` produce «1 A» y «1.1 B».
  - `ecuación numerada y referencia`: `equation` con `\label{e}` produce «(1)»; `\ref{e}` produce «1».
  - `fórmulas en línea y aparte`: `$x^2$`, `\(x\)`, `\[x\]` y `$$x$$` producen la clase `katex`.
  - `negrita, cursiva y listas`: `\textbf`, `\emph`, `itemize` y `enumerate`.
  - `tabular simple`: produce un `<table>` con 2×2 celdas.
  - `título del documento`: `\title{T}\author{A}\maketitle` produce `titulo === "T"` y el autor visible.
  - `lo desconocido va en gris`: `\foo{x}` produce `class="desconocido"`.
  - `latexToHtml tolera código a medio escribir`: `\section{A` y `\begin{equation}x` no lanzan error y producen HTML.
  - `fórmula inválida no rompe la vista`: `$\frac{1}{$` no lanza error.
  - `escapa HTML`: `<script>` aparece como texto.
- [ ] **Step 2:** Ejecutar `npm test` en `CoffeeLatex`. Debe fallar.
- [ ] **Step 3:** Implementarlo: preámbulo ignorado hasta `\begin{document}`, si existe; analizador de bloques por líneas y entornos; `%` como comentario, salvo `\%`.
- [ ] **Step 4:** Ejecutar `npm test`. Debe pasar.
- [ ] **Step 5:** Commit.

### Task 3: Markdown, botones, plantillas y corrector

**Files:**
- Create:
  - `CoffeeLatex/src/preview/markdown.ts`;
  - `src/editor/insertar.ts`;
  - `src/editor/plantillas.ts`;
  - `src/editor/prosa.ts`;
  - y sus `.test.ts`.

**Interfaces:**
- Produces:
  - `markdownToHtml(md: string): string`: `marked` más las fórmulas `$…$` y `$$…$$` con KaTeX, con las fórmulas protegidas antes de `marked`.
  - `type Modo = "latex" | "markdown"`.
  - `BOTONES: { id: string; etiqueta: string; tex: string; latex: string; markdown?: string }[]`, con los ids `fraccion`, `potencia`, `raiz`, `vector`, `integral`, `suma`, `derivada`, `griegas`, `unidades`, `tabla`, `figura` y `cita`.
  - `insertar(texto: string, ini: number, fin: number, plantilla: string): { texto: string; cursor: number }`: `plantilla` usa `▮` para marcar el cursor y `§` para el texto seleccionado.
  - `PLANTILLAS: { id: "informe" | "taller" | "articulo" | "blanco" | "md-blanco" | "md-notas"; nombre: string; modo: Modo; contenido: string }[]`.
  - `rangosDeProsa(src: string, modo: Modo): { ini: number; fin: number }[]`: zonas donde el corrector puede marcar palabras.

- [ ] **Step 1: Pruebas.**
  - `markdown con fórmulas`: `# T\n\n$E=mc^2$ y $$F=ma$$` produce `<h1>` y 2 `katex`.
  - `los guiones bajos de una fórmula no se vuelven cursiva`: `$a_1 + b_2$`.
  - `insertar fracción con selección`: con «2h» seleccionado, `\frac{§}{▮}` produce `\frac{2h}{}` con el cursor dentro de la segunda llave.
  - `insertar sin selección deja el cursor en ▮`.
  - `cada plantilla LaTeX tiene \begin{document} y \end{document}`.
  - `la plantilla informe tiene secciones de Objetivos, Marco teórico, Procedimiento, Resultados y Conclusiones`.
  - `prosa excluye comandos, fórmulas y argumentos de \label y \cite`: en `Hola \textbf{mundo} $x$ \label{eq:a} fin`, los rangos cubren «Hola», «mundo» y «fin», pero no «textbf», «x» ni «eq:a».
  - `prosa en markdown excluye código y fórmulas`.
- [ ] **Step 2:** Comprobar que las pruebas fallan, implementar y comprobar que pasan.
- [ ] **Step 3:** Commit.

### Task 4: Compilar y convertir (Rust, en coffee-core)

**Files:**
- Create: `crates/coffee-core/src/docconv.rs`.
- Modify:
  - `crates/coffee-core/src/lib.rs` (`pub mod docconv;`);
  - `crates/coffee-core/src/addons.rs` (catálogo: `latex` y `pandoc`, `linux_packages`, y cómo encontrar `tectonic`, `xelatex` y `pandoc`).

**Interfaces:**
- Produces:
  - `pub fn motor_latex() -> Option<(PathBuf, Motor)>`, con `enum Motor { Tectonic, Xelatex }`. Busca `addon_executable("latex")` y después el PATH (`tectonic`, `xelatex`).
  - `pub fn compilar_latex(tex: &str, archivos: &[(String, Vec<u8>)]) -> Result<Vec<u8>, ErrorCompilacion>`. Trabaja en una carpeta temporal con `documento.tex` y sus archivos. Tectonic se ejecuta con `-X compile --keep-logs`; xelatex con `-interaction=nonstopmode -halt-on-error`, dos veces si en el registro aparece «Rerun».
  - `pub struct ErrorCompilacion { pub mensaje: String, pub registro: String }`.
  - `pub fn pandoc() -> Option<PathBuf>`.
  - `pub fn convertir_pandoc(entrada: &[u8], desde: &str, hacia: &str) -> Result<Vec<u8>, String>`. Valores de `desde`: `latex` y `markdown`. Valores de `hacia`: `docx`, `odt`, `html`, `markdown` y `latex`. El HTML se genera con `--standalone --mathml`.
  - Comandos Tauri con `editor_handler!`: `doc_latex_pdf(tex: String, archivos: Vec<(String, String /*b64*/)>) -> Result<String /*b64*/, String /*JSON {mensaje, registro}*/>`, `doc_pandoc(datos_b64, desde, hacia) -> Result<String, String>` y `doc_herramientas() -> { latex: Option<String>, pandoc: bool }`.
  - Complementos en el catálogo:
    - `latex`: `apps: &["coffeelatex","coffeeconvert"]`, `executable: "tectonic"`, descarga `…/addons/coffee-latex-win64.zip`, licencia MIT (Tectonic), «~25 MB (Windows) · ~400 MB (Linux, TeX Live)».
    - `pandoc`: `apps` igual, `executable: "pandoc"`, descarga `…/addons/coffee-pandoc-win64.zip`, licencia GPL-2.0, «~40 MB».
    - En Linux, `addon_executable` también encuentra `xelatex` para `latex` y `pandoc` en el PATH.

- [ ] **Step 1: Pruebas Rust** (`cargo test -p coffee-core docconv`).
  - `convierte_latex_a_markdown_y_docx`: se omite si no hay pandoc. Convierte `\section{Hola} $x^2$`: a Markdown contiene «# Hola»; el `.docx` empieza con `PK`.
  - `compila_un_documento`: se omite si no hay motor. Un PDF mínimo con `\[F=ma\]` empieza con `%PDF`.
  - `compila con nombre con espacios y tildes`: un archivo de imagen `"Caída libre.png"` referenciado con `\includegraphics` compila. Se omite si no hay motor.
  - `error_de_compilacion_trae_registro`: `\undefinedcommand` produce `Err` con un registro que contiene `l.`.
- [ ] **Step 2:** Instalar las herramientas para probar: `apt-get install -y pandoc texlive-xetex texlive-lang-spanish`, si hay espacio en disco; si no, anotar un Ruling. Comprobar que las pruebas fallan, implementar y comprobar que pasan.
- [ ] **Step 3:** En `addons.yml`, añadir los trabajos `latex` y `pandoc` (Windows): descargar Tectonic y Pandoc de sus versiones oficiales en GitHub, comprimir `tectonic.exe` y `pandoc.exe` con `LEEME.md` y licencia, probar `--version` y publicarlos en la versión «addons» como los demás. Crear `addons/coffee-latex/README.md` y `addons/coffee-pandoc/README.md`.
- [ ] **Step 4:** Commit.

### Task 5: Errores del compilador y exportar (TS)

**Files:**
- Create: `CoffeeLatex/src/exportar/errores.ts`, `exportar.ts` y sus pruebas.

**Interfaces:**
- Produces:
  - `texErrors(registro: string): { linea: number | null; mensaje: string }[]`. Traduce: `Undefined control sequence` → «Comando desconocido»; `Missing $ inserted` → «Falta abrir o cerrar una fórmula ($)»; `File … not found` → «No se encuentra el archivo …»; `Emergency stop`/`Fatal error` → «El documento tiene un error y no se pudo terminar»; para cualquier otro caso se deja el texto original.
  - `exportarHtml(titulo: string, cuerpo: string): string`: documento completo, con el CSS de KaTeX en línea y las fuentes en `data:` (importadas con `?inline` de Vite).
  - En `src/native.ts`: `compilarPdf(tex: string, archivos): Promise<Uint8Array>`, `convertir(datos: Uint8Array, desde, hacia): Promise<Uint8Array>` y `herramientas(): Promise<{latex: string|null; pandoc: boolean}>`. Sin Tauri devuelven `{latex:null,pandoc:false}` o lanzan «Instala el complemento …».

- [ ] **Step 1: Pruebas.**
  - `texErrors encuentra línea y mensaje`: en un registro de ejemplo con `! Undefined control sequence.` y `l.12 \foo`, el resultado es `{linea:12, mensaje:"Comando desconocido: \\foo"}`.
  - `traduce Missing $ inserted`.
  - `exportarHtml no depende de internet`: el resultado no contiene `http://` ni `https://` en enlaces a CSS o fuentes, y contiene `@font-face`.
- [ ] **Step 2:** Comprobar que fallan, implementar y comprobar que pasan; commit.

### Task 6: Interfaz de CoffeeLatex

**Files:**
- Create:
  - `CoffeeLatex/src/App.tsx`;
  - `src/editor/Editor.tsx` (`textarea` con capa de colores y subrayado ortográfico);
  - `src/editor/colorear.ts` (con prueba);
  - `src/Inicio.tsx`;
  - `src/Barra.tsx`;
  - `src/almacen.ts` (`createDocStore` de `studio`, con un archivo por documento `.tex` o `.md`).

**Interfaces:**
- Consumes: Tasks 2, 3 y 5; `shared/spell` (`useSpellCheck` y `misspelled`).
- Produces: la pantalla del boceto (barra superior, barra «Insertar», código a la izquierda y hoja a la derecha); clic derecho sobre una palabra subrayada para ver sugerencias; atajos Ctrl+S, Ctrl+B (`\textbf`) y Ctrl+M (fórmula en línea); el botón «Desde foto» muestra «Llega en la próxima versión»; menú «Exportar…» con `.tex`/`.md`, HTML, PDF, Word y Markdown o LaTeX; errores del PDF en un panel con «Ir a la línea».
- `colorear(src: string, modo: Modo): { ini: number; fin: number; clase: "cmd" | "mate" | "coment" | "llave" }[]`.

- [ ] **Step 1: Prueba de `colorear`:** `\section{A} % c` produce un `cmd` en 0–8 y un `coment` desde el `%`; `$x$` produce `mate`.
- [ ] **Step 2:** Implementar; ejecutar `npm run build` sin errores. Con Playwright: escribir `$F=ma$` y comprobar que aparece `.katex` en la vista previa; el botón «Fracción» inserta `\frac{}{}`; una palabra mal escrita queda subrayada.
- [ ] **Step 3:** Commit.

### Task 7: CoffeeConvert «Desde LaTeX» y «Desde Markdown»

**Files:**
- Modify:
  - `CoffeeConvert/src/convert/tools.ts` (los grupos y las herramientas nuevas con `addon?: "latex" | "pandoc"`);
  - `CoffeeConvert/src/convert/native.ts` (`compilarPdf` y `convertir`, con los mismos comandos que la Task 4);
  - `CoffeeConvert/src-tauri/src/main.rs` (registrar `doc_latex_pdf`, `doc_pandoc` y `doc_herramientas`);
  - y la interfaz donde se listan los grupos.
- Test: `CoffeeConvert/src/convert/tools.test.ts` (nuevo o ampliado).

- [ ] **Step 1: Prueba.** `herramientas de LaTeX y Markdown`: existen las herramientas `latex-pdf`, `latex-docx`, `latex-html`, `latex-md`, `md-docx`, `md-html` y `md-latex`, cada una con su `addon` y sus extensiones de entrada (`.tex` y `.md`).
- [ ] **Step 2:** Comprobar que falla, implementar y comprobar que pasa. Ejecutar `npm run build` en CoffeeConvert.
- [ ] **Step 3:** Commit.

### Task 8: Integración en la suite

**Files:**
- Modify: `src-tauri/src/apps.rs`, `src/services/tauriBridge.ts`, `src/components/AppGrid.tsx` (si hace falta un icono nuevo), `vite.config.ts`, `scripts/dev.mjs`, `scripts/build.mjs`, los workflows de Windows y Linux (pruebas de CoffeeLatex y del ejecutable), `installer/CoffeeWorks.iss` y `README.md`.
- Create: `scripts/make-latex-icon.py` (el icono del boceto) y los iconos de la app.

- [ ] **Step 1:** Generar el icono e integrar la app igual que CoffeeConvert. Ejecutar `node scripts/version.mjs 2.16.0 alpha` y `cargo update -w --offline`.
- [ ] **Step 2:** Comprobar:
  - `npm run build` (Launcher);
  - `cd CoffeeLatex && npm test && npm run build`;
  - `cd CoffeeConvert && npm test`;
  - `cargo test -p coffee-core`;
  - `node scripts/sync-shared.mjs --check`;
  - `node scripts/make-theme.mjs --check`.
- [ ] **Step 3:** Commit, push y PR.
