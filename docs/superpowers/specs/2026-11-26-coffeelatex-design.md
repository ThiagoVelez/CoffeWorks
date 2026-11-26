# CoffeeLatex: diseño

Fecha: 2026-11-26 · Estado: aprobado por el usuario en la conversación («Me gusta» a los bocetos; «ya tú construyes la app»; «Empieza»).

## Para qué

App de la categoría **Office**, junto a CoffeeDoc, para **trabajos y documentos científicos y técnicos**: física, física mecánica y otras materias con muchas fórmulas, donde CoffeeDoc se queda corto. Sirve para:

- escribir documentos en **LaTeX** y en **Markdown** (`.md`) y exportarlos;
- **pasar fotos de notas a mano a LaTeX** (texto y fórmulas mezclados), con un corrector que ayude cuando la letra o la saturación de la página confunden al reconocedor.

En **CoffeeConvert** se agregan apartados para convertir **desde LaTeX** y **desde Markdown** a otros formatos.

**Éxito:** el usuario escribe un informe de laboratorio con fórmulas, lo ve terminado al lado mientras escribe, y lo exporta a un PDF con el aspecto de LaTeX. Además, una foto de su cuaderno se convierte en LaTeX editable, y las dudas se corrigen rápido.

## Objetivos

- Editor de LaTeX y Markdown con **vista previa en vivo** y las fórmulas ya dibujadas.
- **Botones para insertar** lo más usado en física: fracción, potencia, raíz, vector, integral, sumatoria, derivada, letras griegas y unidades; además tabla, figura y cita.
- **Plantillas:** informe de laboratorio, taller o ejercicios resueltos, artículo y documento en blanco (para LaTeX y para Markdown).
- **Corrector ortográfico** de español e inglés, el mismo de CoffeeDoc. No revisa los comandos ni las fórmulas.
- Abrir y guardar **`.tex` y `.md`**, sin formato propio, para poder llevarlos a Overleaf u otros programas.
- **Exportar:** a PDF con el complemento «Motor LaTeX», a HTML, y a Word y a otros formatos con el complemento «Pandoc».
- **Desde foto:** foto de una nota a mano → LaTeX editable, con la foto al lado, las dudas resaltadas y sugerencias del diccionario de física y matemáticas.
- **CoffeeConvert:** LaTeX → PDF, Word, HTML y Markdown; Markdown → Word, HTML y LaTeX (Markdown → PDF ya existe).

## No objetivos

- Editar sobre la vista previa como en un editor visual (WYSIWYG): se escribe en el código y la vista previa se actualiza sola.
- Colaboración en tiempo real (eso es CoffeeDrawTeam).
- Reconocimiento en la nube: todo funciona en el equipo, sin cuentas.
- Compilar con bibliografías BibTeX complejas en la vista previa (el PDF final sí, con el Motor LaTeX).

## Anti-objetivos

- Que la vista previa diga una cosa y el PDF otra en lo esencial: las fórmulas deben verse igual.
- Que el reconocimiento de fotos «invente» con seguridad: lo dudoso debe quedar marcado.
- Que la app exija instalar el motor para escribir: sin complementos se escribe, se previsualiza y se exporta a HTML y `.tex`/`.md`.

## Enfoques considerados

**Reconocimiento de fotos** (lo decidió el usuario):

- A. Servicio de IA en internet: el mejor con páginas enteras, pero pide cuenta y clave, se paga por uso y las notas salen del equipo.
- **B. Modelo libre instalado como complemento (elegido)**: sin internet, gratis y privado. Comete más errores con letra desordenada, y eso lo compensa el corrector.
- C. Los dos.

**Motor LaTeX** (decisión de Claude):

- **Windows: Tectonic** (~20 MB). La primera vez descarga de internet los paquetes que usa y después funciona sin conexión.
- **Linux: TeX Live por apt** (`texlive-xetex`, `texlive-lang-spanish`, `texlive-science`), como los demás complementos de Linux. Tectonic no está en apt.
- La app usa el que encuentre: primero `tectonic` y, si no, `xelatex`.

**Conversiones:** Pandoc como complemento (Windows: el ejecutable oficial, empaquetado por el CI de complementos; Linux: apt `pandoc`). Es el conversor libre de referencia y conserva las fórmulas.

## Entregas

1. **Entrega 1, la app y la conversión:** CoffeeLatex (editor, vista previa, botones, plantillas, corrector, archivos y exportar), los complementos «Motor LaTeX» y «Pandoc», los apartados nuevos de CoffeeConvert y la integración en la suite.
2. **Entrega 2, «Desde foto»:** el complemento de reconocimiento, que el CI construye porque necesita descargar el modelo, y la pantalla «Desde foto» con su corrector. Se hace aparte porque el modelo solo se puede descargar y probar en el CI.

## Entrega 1: cómo funciona

### Pantalla

Como en el boceto aprobado:

- **Barra superior:** nombre del archivo, etiqueta LaTeX o Markdown, «Desde foto» (en la entrega 1 lleva a instalar o espera la entrega 2), «Exportar…» y «PDF».
- **Barra «Insertar»:** los botones de fórmulas y de estructura.
- **Izquierda, el código:** con colores (comandos, fórmulas, comentarios), números de línea y palabras mal escritas subrayadas en rojo; clic derecho para ver sugerencias.
- **Derecha, la vista previa:** una hoja blanca que se actualiza unos 300 ms después de dejar de escribir.
- **Pantalla de inicio:** documentos recientes y plantillas.

### Vista previa

- **LaTeX:** un traductor propio de un subconjunto de LaTeX a HTML. Cubre secciones con numeración, párrafos, `\textbf`, `\emph`, `\textit`, listas (`itemize`, `enumerate`), `equation`/`align` con número, `\[ \]`, `\( \)` y `$…$`, `tabular` simple, `figure` con imagen, `\title`/`\author`/`\maketitle`, `\ref`/`\label` y `\cite` (mostrado como [n]). Las fórmulas se dibujan con **KaTeX**. Lo que no reconoce se muestra en gris («se verá en el PDF»), sin romper la vista.
- **Markdown:** `marked` con fórmulas `$…$` y `$$…$$` dibujadas con KaTeX.

### Archivos

- `.tex` y `.md` en la Bóveda, con la misma lista de recientes y guardado automático que las demás apps de Office.
- Abrir desde disco con «Abrir con».
- Las imágenes de una figura se guardan junto al documento, en una carpeta `<nombre>-imagenes/`.

### Exportar

- **PDF:**
  - LaTeX: se compila con el Motor LaTeX (comando nativo `latex_pdf`). Los errores del compilador se muestran traducidos con su línea, y un clic lleva a esa línea.
  - Markdown: se pasa por Pandoc a LaTeX y luego al motor. Si no hay Pandoc, se imprime la vista previa.
- **HTML:** la vista previa con KaTeX incluido, sin complementos.
- **Word (`.docx`), ODT y LaTeX ↔ Markdown:** con Pandoc (comando nativo `pandoc_convert`).
- Sin el complemento necesario, el botón explica qué instalar y lleva al Launcher › Complementos.

### Complementos (catálogo en `coffee-core/src/addons.rs`)

- `latex`, «Motor LaTeX»:
  - Windows: `coffee-latex-win64.zip`, con Tectonic, empaquetado en `addons.yml`.
  - Linux: apt `texlive-xetex texlive-lang-spanish texlive-science`.
  - Lo usan CoffeeLatex y CoffeeConvert.
- `pandoc`, «Conversor de documentos (Pandoc)»:
  - Windows: `coffee-pandoc-win64.zip`.
  - Linux: apt `pandoc`.
  - Lo usan CoffeeLatex y CoffeeConvert.
- Para los dos, la app busca primero el complemento instalado y después el programa en el sistema (PATH), como hace `officeconv`.

### CoffeeConvert

- **Grupo nuevo «Desde LaTeX»:** a PDF (Motor LaTeX), a Word, a HTML y a Markdown (Pandoc).
- **Grupo nuevo «Desde Markdown»:** a Word, a HTML y a LaTeX (Pandoc); a PDF sigue en «Hacia PDF».
- Usan los mismos comandos nativos que CoffeeLatex.

### Integración en la suite

- App Tauri `CoffeeLatex/`, puerto **1444**, categoría **Office**, color **azul petróleo `#0d5e6f`**, con el icono del boceto (hoja con ∫ y F = ma).
- Abre `.tex` y `.md` sin hacerse con ellos: aparece en «Abrir con».
- Catálogo, Launcher, instalador, CI, README, versión **2.16.0**.

## Entrega 2: «Desde foto» (hecha)

Decisiones tomadas al construirla (el usuario pidió «Hazlo» tras fusionar la entrega 1):

- **Modelo de fórmulas:** pix2tex (LaTeX-OCR, MIT) exportado a ONNX por RapidLaTeXOCR (MIT): `image_resizer.onnx`, `encoder.onnx`, `decoder.onnx` y `tokenizer.json` (~165 MB). Es el único modelo libre de fórmulas en ONNX que se puede descargar de una versión de GitHub (Hugging Face no está disponible para el CI de la sesión ni para probar aquí). Lee mejor fórmulas claras que letra muy desordenada; por eso las dudas son la pieza central.
- **Complemento `latexocr`** («Fórmulas desde foto»): el CI de complementos descarga los cuatro archivos, comprueba sus SHA-256, los prueba con fórmulas de muestra y publica `coffee-latexocr.zip` (el mismo en Windows y Linux). La app los pide con `doc_ocr_modelo`, que devuelve binario (sin base64) y solo esos cuatro nombres.
- **Ejecución:** onnxruntime-web (solo wasm, un hilo) dentro de un Web Worker; el reconocedor (`src/foto/latexocr.ts`) reproduce el de la referencia en Python y da el mismo LaTeX con las muestras. Funciona sin internet.
- **Sin modelo de detección:** en lugar de detectar fórmulas con otro modelo, la foto se separa en renglones (umbral local de Bradley, aguanta sombras). Cada renglón es Texto o Fórmula: si está Tesseract (complemento `pdfcheck`) se lee primero como texto y, si parece fórmula, se pasa al reconocedor; la persona puede cambiar el tipo con un clic, quitar renglones o dibujar un recuadro a mano.
- **Corrector:** las piezas con probabilidad < 50 % son dudas (amarillo) con las alternativas del modelo y el diccionario de física y matemáticas (a/α, v/ν, u/μ, w/ω, x/×/χ, 1/l/I, 0/o/θ, t/+/τ, p/ρ, B/β, e/ε, y/γ, s/5, z/2, g/9, d/∂…); en el texto, las palabras con confianza < 60 % y sugerencias ortográficas. Avisos (subrayado naranja) de llaves y paréntesis sin cerrar y comandos que no existen. «Siguiente duda», «Está bien así» y edición libre (las dudas siguen a su texto al editar).
- **Resultado:** texto seguido y cada fórmula aparte (`\[ … \]` en LaTeX, `$$ … $$` en Markdown), con vista previa; «Insertar en el documento» lo pone donde está el cursor.

## Pruebas

- **Lógica pura:**
  - el traductor de LaTeX a HTML (secciones, ecuaciones numeradas, listas, tablas y lo desconocido);
  - los botones (qué insertan y dónde queda el cursor);
  - las plantillas;
  - el tokenizador del corrector, que no marca comandos ni fórmulas;
  - la traducción de errores del compilador;
  - las conversiones de CoffeeConvert (con Pandoc real si está instalado).
- **Rust:** `latex_pdf` compila un documento de ejemplo con `xelatex` si está instalado (en el CI de Linux, con apt); `pandoc_convert` convierte LaTeX ↔ Markdown y a `.docx`.
- **Navegador (Playwright):** escribir, ver la vista previa con fórmulas, usar los botones, corrector y exportar HTML.

## Lo que queda a criterio de quien construye

- El editor de código: una capa de colores sobre un `textarea`, como en las demás apps de la suite, sin dependencias pesadas.
- Los textos de ayuda, los atajos de teclado y el detalle visual dentro del estilo del boceto.
