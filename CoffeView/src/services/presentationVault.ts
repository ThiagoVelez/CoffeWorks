// Almacén de presentaciones de CoffeView: temas, diseños de diapositiva,
// formato nativo .csl, guardado en la bóveda de CoffeWorks y exportación.

import type {
  ExportFormat,
  Presentation,
  Slide,
  SlideElement,
  SlideLayout,
  SlideTheme,
} from "../types";
import { SLIDE_SIZE } from "../types";
import {
  baseName,
  bytesToText,
  extensionOf,
  isTauri,
  readFileBytes,
  registerRecent,
  renameInVault,
  saveFileAs,
  stripExtension,
  vaultPath,
  writeFileText,
  type PickedFile,
} from "./desktop";

export const APP_ID = "coffeview";
export const NATIVE_EXTENSION = "csl";
export const DEFAULT_TITLE = "Presentación sin título";

const WEB_DOC_PREFIX = "coffeview:doc:";
const LAST_KEY = "coffeview:last";
const LEGACY_KEY = "coffeview_active_presentation";

export const OPEN_FILTERS = [
  { name: "Presentaciones", extensions: ["csl", "pptx"] },
  { name: "Presentación de CoffeView", extensions: ["csl"] },
  { name: "Presentación de PowerPoint", extensions: ["pptx"] },
];

export const SLIDE_THEMES: SlideTheme[] = [
  { id: "theme_light", name: "Estándar blanco", slideBg: "#ffffff", titleColor: "#1f1f1f", textColor: "#444746", accentColor: "#1a73e8", fontFamily: "Arial" },
  { id: "theme_paper", name: "Papel minimalista", slideBg: "#f8f9fa", titleColor: "#202124", textColor: "#3c4043", accentColor: "#188038", fontFamily: "Georgia" },
  { id: "theme_latte", name: "Latte moderno", slideBg: "#fef7e0", titleColor: "#3e2723", textColor: "#5d4037", accentColor: "#d35400", fontFamily: "Trebuchet MS" },
  { id: "theme_ocean", name: "Océano", slideBg: "#e8f0fe", titleColor: "#0b3d91", textColor: "#1f3a5f", accentColor: "#0b57d0", fontFamily: "Verdana" },
  { id: "theme_espresso", name: "Espresso ejecutivo", slideBg: "#1e140f", titleColor: "#ffffff", textColor: "#dfd3c7", accentColor: "#e08e45", fontFamily: "Georgia" },
  { id: "theme_corporate", name: "Mocca corporativo", slideBg: "#2b2523", titleColor: "#ffffff", textColor: "#e0d6d1", accentColor: "#e67e22", fontFamily: "Arial" },
  { id: "theme_night", name: "Noche", slideBg: "#202124", titleColor: "#e8eaed", textColor: "#bdc1c6", accentColor: "#8ab4f8", fontFamily: "Arial" },
];

export const themeById = (id: string): SlideTheme => SLIDE_THEMES.find((t) => t.id === id) || SLIDE_THEMES[0];

export interface OpenResult {
  presentation: Presentation;
  /** Ruta del archivo .csl en disco; `null` si aún no tiene archivo. */
  filePath: string | null;
}

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Indica si un color es oscuro (para elegir texto claro encima). */
export function isDarkColor(color: string | undefined): boolean {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color || "");
  if (!match) return false;
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

const textElement = (
  type: SlideElement["type"],
  box: [number, number, number, number],
  options: Partial<SlideElement> = {}
): SlideElement => ({
  id: newId("el"),
  type,
  x: box[0],
  y: box[1],
  width: box[2],
  height: box[3],
  content: "",
  ...options,
});

/** Elementos de partida de cada diseño de diapositiva. */
export function elementsForLayout(layout: SlideLayout): SlideElement[] {
  switch (layout) {
    case "title":
      return [
        textElement("title", [10, 26, 80, 24], { fontSize: 48, fontWeight: "bold", align: "center" }),
        textElement("subtitle", [15, 54, 70, 14], { fontSize: 24, align: "center" }),
      ];
    case "section":
      return [
        textElement("title", [8, 34, 84, 20], { fontSize: 44, fontWeight: "bold", align: "left" }),
        textElement("subtitle", [8, 56, 84, 10], { fontSize: 20, align: "left" }),
      ];
    case "two-columns":
      return [
        textElement("title", [6, 7, 88, 15], { fontSize: 34, fontWeight: "bold", align: "left" }),
        textElement("text", [6, 26, 42, 64], { fontSize: 20, align: "left", valign: "top" }),
        textElement("text", [52, 26, 42, 64], { fontSize: 20, align: "left", valign: "top" }),
      ];
    case "blank":
      return [];
    case "title-content":
    default:
      return [
        textElement("title", [6, 7, 88, 15], { fontSize: 34, fontWeight: "bold", align: "left" }),
        textElement("text", [6, 26, 88, 64], { fontSize: 22, align: "left", valign: "top" }),
      ];
  }
}

export function createSlide(layout: SlideLayout, background?: string): Slide {
  return {
    id: newId("slide"),
    layout,
    background,
    elements: elementsForLayout(layout),
    notes: "",
    transition: "fade",
  };
}

export function createBlankPresentation(title = DEFAULT_TITLE): Presentation {
  const now = new Date().toISOString();
  return {
    metadata: {
      id: newId("pres"),
      title,
      author: "Usuario CoffeWorks",
      createdAt: now,
      updatedAt: now,
      themeId: "theme_light",
      aspectRatio: "16:9",
    },
    slides: [createSlide("title")],
    assets: [],
  };
}

/** Convierte el texto de las tablas antiguas ("a, b\nc, d") en filas. */
function legacyTableRows(content: string): string[][] {
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function normalizeElement(raw: Partial<SlideElement>): SlideElement {
  const element: SlideElement = {
    ...raw,
    id: raw.id || newId("el"),
    type: raw.type || "text",
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    width: Number(raw.width) || 20,
    height: Number(raw.height) || 10,
    content: typeof raw.content === "string" ? raw.content : "",
  };
  if (element.type === "table" && !Array.isArray(element.rows)) {
    element.rows = legacyTableRows(element.content);
    element.content = "";
  }
  return element;
}

/** Interpreta el contenido de un archivo .csl (formato actual o heredado). */
export function parseCsl(text: string, fallbackTitle: string): Presentation {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("El archivo no contiene diapositivas válidas");
  }
  const blank = createBlankPresentation(fallbackTitle);
  const metadata = { ...blank.metadata, ...(parsed.metadata || {}) };
  if (!metadata.title) metadata.title = fallbackTitle;
  if (!SLIDE_THEMES.some((t) => t.id === metadata.themeId)) metadata.themeId = "theme_light";
  if (metadata.aspectRatio !== "4:3") metadata.aspectRatio = "16:9";

  const slides: Slide[] = parsed.slides.map((slide: Partial<Slide>) => ({
    id: slide.id || newId("slide"),
    layout: slide.layout || "blank",
    background: slide.background,
    elements: Array.isArray(slide.elements) ? slide.elements.map(normalizeElement) : [],
    notes: slide.notes || "",
    transition: slide.transition || "none",
    hidden: Boolean(slide.hidden),
    duration: slide.duration,
  }));
  return { metadata, slides, assets: Array.isArray(parsed.assets) ? parsed.assets : [] };
}

export function serializeCsl(presentation: Presentation): string {
  return JSON.stringify({ format: "coffeview", version: 2, ...presentation });
}

/** Convierte un archivo elegido por el usuario en una presentación editable. */
export async function importFile(file: PickedFile): Promise<OpenResult> {
  const extension = extensionOf(file.name);
  const title = stripExtension(file.name) || DEFAULT_TITLE;
  if (extension === "pptx") {
    const { importPptx } = await import("./pptx");
    return { presentation: await importPptx(file.bytes, title), filePath: null };
  }
  if (extension === "ppt") {
    throw new Error("El formato .ppt de PowerPoint 97-2003 no es compatible. Guárdalo como .pptx y vuelve a abrirlo.");
  }
  const presentation = parseCsl(bytesToText(file.bytes), title);
  return { presentation, filePath: extension === NATIVE_EXTENSION ? file.path : null };
}

export async function openPath(path: string): Promise<OpenResult> {
  const bytes = await readFileBytes(path);
  return importFile({ name: baseName(path), path, bytes });
}

export function loadWebPresentation(id: string): Presentation | null {
  try {
    const raw = localStorage.getItem(WEB_DOC_PREFIX + id);
    return raw ? parseCsl(raw, DEFAULT_TITLE) : null;
  } catch {
    return null;
  }
}

/** Presentación guardada por versiones anteriores de CoffeView en el navegador. */
export function loadLegacyPresentation(): Presentation | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const presentation = parseCsl(raw, DEFAULT_TITLE);
    const hasContent = presentation.slides.some((s) => s.elements.some((el) => el.content || el.rows));
    return hasContent ? presentation : null;
  } catch {
    return null;
  }
}

/**
 * Guarda la presentación. En escritorio escribe el archivo .csl (en la bóveda
 * si aún no tiene ubicación) y devuelve su ruta; en el navegador usa localStorage.
 */
export async function persistPresentation(
  presentation: Presentation,
  filePath: string | null
): Promise<string | null> {
  const stamped: Presentation = {
    ...presentation,
    metadata: { ...presentation.metadata, updatedAt: new Date().toISOString() },
  };
  const json = serializeCsl(stamped);
  const title = presentation.metadata.title.trim() || DEFAULT_TITLE;
  const fileName = `${title}.${NATIVE_EXTENSION}`;
  const entry = {
    id: presentation.metadata.id,
    name: fileName,
    app_id: APP_ID,
    category: "Presentación",
    last_modified: "",
    is_pinned: false,
    path: "",
    updated_at: Date.now(),
  };

  if (isTauri) {
    const path = filePath
      ? await renameInVault(filePath, fileName, presentation.metadata.id)
      : await vaultPath(fileName, presentation.metadata.id);
    await writeFileText(path, json);
    await registerRecent({ ...entry, name: baseName(path), path });
    localStorage.setItem(LAST_KEY, path);
    return path;
  }

  localStorage.setItem(WEB_DOC_PREFIX + presentation.metadata.id, json);
  localStorage.setItem(LAST_KEY, presentation.metadata.id);
  await registerRecent({ ...entry, path: `web:${presentation.metadata.id}` });
  return null;
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Página HTML autónoma con todas las diapositivas (navegable con las flechas). */
function presentationToHtml(presentation: Presentation): string {
  const theme = themeById(presentation.metadata.themeId);
  const size = SLIDE_SIZE[presentation.metadata.aspectRatio];
  const slides = presentation.slides
    .filter((slide) => !slide.hidden)
    .map((slide) => {
      const elements = slide.elements
        .map((el) => {
          const box = `left:${el.x}%;top:${el.y}%;width:${el.width}%;height:${el.height}%;`;
          if (el.type === "image") {
            return `<img class="el" style="${box}object-fit:contain;" src="${escapeHtml(el.content)}" alt="">`;
          }
          if (el.type === "video") {
            return `<video class="el" style="${box}" src="${escapeHtml(el.content)}" controls></video>`;
          }
          if (el.type === "line") {
            const y1 = el.flip ? "100%" : "0";
            const y2 = el.flip ? "0" : "100%";
            return `<svg class="el" style="${box}overflow:visible;"><line x1="0" y1="${y1}" x2="100%" y2="${y2}" stroke="${el.color || theme.textColor}" stroke-width="${el.borderWidth || 3}"/></svg>`;
          }
          if (el.type === "table") {
            const rows = (el.rows || [])
              .map((row, r) => `<tr>${row.map((cell) => `<t${r === 0 ? "h" : "d"}>${escapeHtml(cell)}</t${r === 0 ? "h" : "d"}>`).join("")}</tr>`)
              .join("");
            return `<table class="el" style="${box}font-size:${el.fontSize || 16}px;color:${el.color || theme.textColor};">${rows}</table>`;
          }
          const isTitle = el.type === "title";
          const radius = el.shapeType === "circle" ? "50%" : el.shapeType === "rounded" ? "18px" : "0";
          const style =
            box +
            `color:${el.color || (isTitle ? theme.titleColor : theme.textColor)};` +
            `background:${el.bg || (el.type === "shape" ? theme.accentColor : "transparent")};` +
            `font-size:${el.fontSize || (isTitle ? 40 : 20)}px;font-weight:${el.fontWeight || (isTitle ? "bold" : "normal")};` +
            `font-style:${el.fontStyle || "normal"};text-decoration:${el.underline ? "underline" : "none"};` +
            `text-align:${el.align || "center"};font-family:${el.fontFamily || theme.fontFamily},sans-serif;` +
            `justify-content:${el.valign === "top" ? "flex-start" : el.valign === "bottom" ? "flex-end" : "center"};border-radius:${radius};`;
          return `<div class="el text" style="${style}">${escapeHtml(el.content).replace(/\n/g, "<br>")}</div>`;
        })
        .join("");
      return `<section class="slide" style="background:${slide.background || theme.slideBg};">${elements}</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(presentation.metadata.title)}</title>
<style>
body{margin:0;background:#111;font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;gap:28px;padding:28px 0;}
.slide{width:${size.width}px;height:${size.height}px;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5);flex-shrink:0;}
.el{position:absolute;box-sizing:border-box;}
.text{display:flex;flex-direction:column;padding:8px;white-space:pre-wrap;line-height:1.2;}
table{border-collapse:collapse;}th,td{border:1px solid #bdc1c6;padding:4px 8px;text-align:left;}th{background:${theme.accentColor};color:#fff;}
@media print{body{background:#fff;padding:0;gap:0;}.slide{box-shadow:none;page-break-after:always;}}
</style>
</head>
<body>
${slides}
<script>
document.addEventListener("keydown",function(e){var s=[].slice.call(document.querySelectorAll(".slide"));var i=s.findIndex(function(x){return x.getBoundingClientRect().top>-10});if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){e.preventDefault();(s[i+1]||s[i]).scrollIntoView({behavior:"smooth",block:"center"});}if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();(s[Math.max(0,i-1)]).scrollIntoView({behavior:"smooth",block:"center"});}});
</script>
</body>
</html>
`;
}

/**
 * Exporta la presentación mediante el diálogo "Guardar como". Devuelve `false`
 * si el usuario canceló. El PDF se gestiona con la impresión del sistema.
 */
export async function exportPresentation(
  presentation: Presentation,
  format: Exclude<ExportFormat, "pdf">
): Promise<boolean> {
  const title = presentation.metadata.title.trim() || DEFAULT_TITLE;
  let data: Uint8Array | string;
  let filterName: string;

  if (format === "pptx") {
    const { exportPptx } = await import("./pptx");
    data = await exportPptx(presentation);
    filterName = "Presentación de PowerPoint";
  } else if (format === "html") {
    data = presentationToHtml(presentation);
    filterName = "Página web";
  } else {
    data = serializeCsl(presentation);
    filterName = "Presentación de CoffeView";
  }

  const saved = await saveFileAs(
    `${title}.${format}`,
    [{ name: filterName, extensions: [format] }],
    data,
    "Exportar presentación"
  );
  return saved !== null;
}

/** "Guardar como": elige una nueva ubicación para el archivo .csl. */
export async function savePresentationAs(presentation: Presentation): Promise<string | null> {
  const title = presentation.metadata.title.trim() || DEFAULT_TITLE;
  return saveFileAs(
    `${title}.${NATIVE_EXTENSION}`,
    [{ name: "Presentación de CoffeView", extensions: [NATIVE_EXTENSION] }],
    serializeCsl(presentation),
    "Guardar presentación como"
  );
}
