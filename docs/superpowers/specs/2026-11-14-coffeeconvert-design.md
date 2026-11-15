# CoffeeConvert — diseño

Fecha: 2026-11-14 · Estado: aprobado por el usuario (con «más formatos a PDF»)

## Para qué

Una app de Office (junto a CoffeeDoc, CoffeeCalc, CoffeeView y CoffeePDF) para **convertir
y organizar documentos**, como iLovePDF pero en el equipo y sin conexión. CoffeePDF sigue
siendo el editor de PDF; CoffeeConvert es la caja de herramientas de conversión.

Éxito: el usuario elige una herramienta, suelta uno o varios archivos, pulsa «Convertir» y
guarda el resultado (o todos juntos en un ZIP), sin subir nada a internet.

## Herramientas

**Desde PDF**
- PDF → imagen (PNG o JPG por página; ZIP si son varias).
- PDF → PowerPoint: *editable* (cajas de texto en su sitio, letra escalada a la diapositiva)
  o *fiel* (cada página como imagen).
- PDF → Word (`.docx`): texto en párrafos, en orden de lectura, con títulos por tamaño.
- PDF → Excel (`.xlsx`): el texto se reparte en filas y columnas por su posición (tablas
  sencillas).
- PDF → texto (`.txt`).

**Hacia PDF**
- Imágenes (PNG, JPG, WebP, GIF, BMP, SVG) → PDF, una por página (ajuste a A4 o al tamaño
  de la imagen).
- Texto (`.txt`), Markdown (`.md`), HTML (`.html`) y CSV (`.csv`) → PDF, maquetados por la
  app (títulos, párrafos, listas, tablas simples).
- Word, Excel, PowerPoint, OpenDocument (`.odt/.ods/.odp`), RTF y EPUB → PDF con el
  complemento **Motor de conversión (LibreOffice)**: en Linux se instala con apt; en Windows
  se usa LibreOffice instalado en el equipo (el Launcher explica cómo).

**Organizar PDF**
- Unir, dividir (cada página o por rangos «1-3, 5, 8-»), rotar, quitar y reordenar páginas.
- Comprimir: *básica* (sin perder calidad, reescribe el PDF) y *fuerte* (convierte las
  páginas en imágenes JPEG; el texto deja de ser seleccionable — se avisa).
- Numerar páginas y marca de agua de texto.

**OCR**: PDF escaneado → texto, con el complemento de Tesseract que ya existe (`pdfcheck`).

## No objetivos

Proteger o quitar contraseñas, firmar, editar el contenido del PDF (eso es CoffeePDF),
conversiones en la nube.

## Diseño

- App Tauri nueva `CoffeeConvert/` (puerto 1442), categoría Office, color verde azulado
  `#0f8b8d`, icono propio (dos flechas que se cruzan sobre una hoja). Registra `.pdf` sin
  reclamarlo (aparece en «Abrir con»; CoffeePDF sigue siendo quien los abre por defecto).
  Abierta con un PDF, va directa a las herramientas «Desde PDF» con el archivo cargado.
- Pantalla de inicio: tarjetas de herramientas por grupo; cada herramienta: zona para soltar
  archivos (o «Elegir archivos»), opciones, «Convertir», lista de resultados con «Guardar»
  y «Guardar todo (.zip)». Sin documento propio ni historial.
- Lógica pura y probada en `src/convert/` (rangos, maquetado de texto, líneas y columnas,
  Markdown/HTML/CSV a bloques); pdf-lib, pdf.js, `docx`, `xlsx-js-style` y `pptxgenjs`
  hacen el trabajo pesado.
- Office → PDF: comando nativo `office_to_pdf` que ejecuta `soffice --headless --convert-to
  pdf` del complemento `officeconv`.
- Integración en la suite como las demás apps (catálogo, iconos, instalador, CI, README).
