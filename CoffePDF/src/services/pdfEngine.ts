// Motor de CoffePDF: lectura y dibujo de páginas con pdf.js, búsqueda de
// texto, lectura de formularios y escritura del PDF final con pdf-lib.

import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  BlendMode,
  LineCapStyle,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type {
  DocumentInfo,
  DocumentModel,
  FieldKind,
  FontFamily,
  FormField,
  PageItem,
  ViewBox,
} from "../types";
import { A4 } from "../types";
import { LINE_HEIGHT, TEXT_PADDING, displaySize, displayToPdf, newId, totalRotation } from "./geometry";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** PDF de origen abierto en el editor. */
export interface SourcePdf {
  name: string;
  bytes: Uint8Array;
  proxy: PDFDocumentProxy;
}

export class ProtectedPdfError extends Error {}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** Abre un PDF y devuelve el documento y la lista de sus páginas. */
export async function loadSource(bytes: Uint8Array, name: string): Promise<{ source: SourcePdf; pages: Omit<PageItem, "source">[] }> {
  // pdf-lib solo puede modificar PDF sin cifrar: se comprueba antes de nada
  try {
    await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (err instanceof Error && /encrypt/i.test(err.message)) {
      throw new ProtectedPdfError(
        "Este PDF está protegido con contraseña o tiene restricciones de edición, y CoffePDF no puede modificarlo."
      );
    }
    throw new Error("El archivo no es un PDF válido o está dañado.");
  }

  // pdf.js recibe una copia porque transfiere el buffer a su worker
  const proxy = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const pages: Omit<PageItem, "source">[] = [];
  for (let i = 0; i < proxy.numPages; i++) {
    const page = await proxy.getPage(i + 1);
    pages.push({
      id: newId("page"),
      index: i,
      view: page.view.slice(0, 4) as ViewBox,
      baseRotation: page.rotate || 0,
      rotation: 0,
      annotations: [],
    });
  }
  return { source: { name, bytes, proxy }, pages };
}

/** Página en blanco (A4 vertical o con las medidas indicadas). */
export function blankPage(view: ViewBox = A4): PageItem {
  return { id: newId("page"), source: null, index: 0, view, baseRotation: 0, rotation: 0, annotations: [] };
}

/** Información del documento (título, autor...). */
export async function readInfo(bytes: Uint8Array): Promise<DocumentInfo> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return {
    title: doc.getTitle() || "",
    author: doc.getAuthor() || "",
    subject: doc.getSubject() || "",
    keywords: doc.getKeywords() || "",
  };
}

/** Campos de formulario de un PDF de origen. */
export async function readFormFields(bytes: Uint8Array, sourceIndex: number): Promise<FormField[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const fields: FormField[] = [];
  for (const field of doc.getForm().getFields()) {
    const name = field.getName();
    let kind: FieldKind | null = null;
    let options: string[] = [];
    let initial: string | boolean = "";
    if (field instanceof PDFTextField) {
      kind = "text";
      initial = field.getText() || "";
    } else if (field instanceof PDFCheckBox) {
      kind = "checkbox";
      initial = field.isChecked();
    } else if (field instanceof PDFDropdown) {
      kind = "dropdown";
      options = field.getOptions();
      initial = field.getSelected()[0] || "";
    } else if (field instanceof PDFOptionList) {
      kind = "optionlist";
      options = field.getOptions();
      initial = field.getSelected()[0] || "";
    } else if (field instanceof PDFRadioGroup) {
      kind = "radio";
      options = field.getOptions();
      initial = field.getSelected() || "";
    }
    if (kind) {
      fields.push({ key: `${sourceIndex}:${name}`, source: sourceIndex, name, kind, options, initial, readOnly: field.isReadOnly() });
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

/**
 * Dibuja una página en un lienzo. `scale` es píxeles por punto. Devuelve la
 * tarea de pdf.js para poder cancelarla si la página deja de verse.
 */
export function renderPage(
  sources: SourcePdf[],
  item: PageItem,
  canvas: HTMLCanvasElement,
  scale: number
): { promise: Promise<void>; cancel: () => void } {
  const size = displaySize(item);
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return { promise: Promise.resolve(), cancel: () => undefined };

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (item.source === null) return { promise: Promise.resolve(), cancel: () => undefined };

  let task: RenderTask | null = null;
  let cancelled = false;
  const promise = (async () => {
    const page: PDFPageProxy = await sources[item.source as number].proxy.getPage(item.index + 1);
    if (cancelled) return;
    const viewport = page.getViewport({ scale, rotation: totalRotation(item) });
    task = page.render({ canvasContext: context, viewport });
    try {
      await task.promise;
    } catch (err) {
      if (!(err instanceof Error && err.name === "RenderingCancelledException")) throw err;
    }
  })();
  return {
    promise,
    cancel: () => {
      cancelled = true;
      task?.cancel();
    },
  };
}

// ---------------------------------------------------------------------------
// Búsqueda de texto
// ---------------------------------------------------------------------------

export interface TextMatch {
  pageId: string;
  pageNumber: number;
  snippet: string;
  /** Recuadros (en puntos de la página vista) que ocupa la coincidencia. */
  boxes: Array<{ x: number; y: number; w: number; h: number }>;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

const textCache = new WeakMap<PDFDocumentProxy, Map<number, TextItemLike[]>>();

async function pageText(source: SourcePdf, index: number): Promise<TextItemLike[]> {
  let cache = textCache.get(source.proxy);
  if (!cache) {
    cache = new Map();
    textCache.set(source.proxy, cache);
  }
  const cached = cache.get(index);
  if (cached) return cached;
  const page = await source.proxy.getPage(index + 1);
  const content = await page.getTextContent();
  const items: TextItemLike[] = [];
  for (const item of content.items) {
    if ("str" in item && typeof item.str === "string") items.push(item);
  }
  cache.set(index, items);
  return items;
}

const fold = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Busca un texto en todas las páginas (sin distinguir mayúsculas ni acentos). */
export async function searchText(sources: SourcePdf[], pages: PageItem[], query: string): Promise<TextMatch[]> {
  const needle = fold(query.trim());
  if (!needle) return [];
  const matches: TextMatch[] = [];

  for (let p = 0; p < pages.length; p++) {
    const item = pages[p];
    if (item.source === null) continue;
    const source = sources[item.source];
    const items = await pageText(source, item.index);
    const page = await source.proxy.getPage(item.index + 1);
    const viewport = page.getViewport({ scale: 1, rotation: totalRotation(item) });

    for (const text of items) {
      const haystack = fold(text.str);
      let at = haystack.indexOf(needle);
      while (at !== -1) {
        const [a, b, c, d, e, f] = text.transform;
        const fontHeight = Math.hypot(c, d) || text.height || 10;
        const length = text.str.length || 1;
        // Parte proporcional del fragmento que ocupa la coincidencia
        const start = (at / length) * text.width;
        const end = ((at + needle.length) / length) * text.width;
        const dirX = Math.hypot(a, b) ? a / Math.hypot(a, b) : 1;
        const dirY = Math.hypot(a, b) ? b / Math.hypot(a, b) : 0;
        const corners = [
          [e + dirX * start, f + dirY * start - fontHeight * 0.2],
          [e + dirX * end, f + dirY * end - fontHeight * 0.2],
          [e + dirX * start - dirY * fontHeight, f + dirY * start + dirX * fontHeight],
          [e + dirX * end - dirY * fontHeight, f + dirY * end + dirX * fontHeight],
        ].map(([x, y]) => viewport.convertToViewportPoint(x, y));
        const xs = corners.map(([x]) => x);
        const ys = corners.map(([, y]) => y);
        const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };

        const original = text.str;
        const snippet = `${at > 20 ? "…" : ""}${original.slice(Math.max(0, at - 20), at + needle.length + 30)}`;
        matches.push({ pageId: item.id, pageNumber: p + 1, snippet, boxes: [box] });
        at = haystack.indexOf(needle, at + needle.length);
      }
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Escritura del PDF final
// ---------------------------------------------------------------------------

function hexToRgb(color: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  const value = match ? parseInt(match[1], 16) : 0;
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const [header, data] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] || "image/png";
  const binary = atob(data || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}

const FONT_NAMES: Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  Helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  Times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  Courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

/** Ascendente y descendente (en em) de Arial, Times New Roman y Courier New. */
const SCREEN_METRICS: Record<FontFamily, [number, number]> = {
  Helvetica: [0.905, 0.212],
  Times: [0.891, 0.216],
  Courier: [0.833, 0.3],
};

/** Las fuentes estándar de PDF solo admiten el juego WinAnsi (sí incluye tildes y ñ). */
function encodable(font: PDFFont, text: string): string {
  let out = "";
  for (const char of text) {
    try {
      font.widthOfTextAtSize(char, 10);
      out += char;
    } catch {
      out += char === "’" || char === "‘" ? "'" : char === "“" || char === "”" ? '"' : "?";
    }
  }
  return out;
}

/** Reparte el texto en líneas que caben en `width` (como hace el editor). */
function wrapText(font: PDFFont, size: number, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/(\s+)/);
    let line = "";
    for (const word of words) {
      const candidate = line + word;
      if (line && font.widthOfTextAtSize(candidate.trimEnd(), size) > width && word.trim()) {
        lines.push(line.trimEnd());
        line = word.trimStart();
        // Palabras más largas que la línea: se cortan por caracteres
        while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        line = candidate;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

interface DrawContext {
  fonts: Map<string, PDFFont>;
  images: Map<string, PDFImage>;
  doc: PDFDocument;
}

async function fontFor(ctx: DrawContext, family: FontFamily, bold: boolean, italic: boolean): Promise<PDFFont> {
  const name = FONT_NAMES[family][(bold ? 1 : 0) + (italic ? 2 : 0)];
  let font = ctx.fonts.get(name);
  if (!font) {
    font = await ctx.doc.embedFont(name);
    ctx.fonts.set(name, font);
  }
  return font;
}

async function imageFor(ctx: DrawContext, dataUrl: string): Promise<PDFImage> {
  let image = ctx.images.get(dataUrl);
  if (!image) {
    const { bytes, mime } = dataUrlToBytes(dataUrl);
    image = mime === "image/jpeg" || mime === "image/jpg" ? await ctx.doc.embedJpg(bytes) : await ctx.doc.embedPng(bytes);
    ctx.images.set(dataUrl, image);
  }
  return image;
}

/** Dibuja las anotaciones de una página sobre su contenido. */
async function drawAnnotations(ctx: DrawContext, target: PDFPage, item: PageItem): Promise<void> {
  const rotation = totalRotation(item);
  const angle = degrees(rotation);
  const toPdf = (x: number, y: number) => displayToPdf(item.view, rotation, x, y);

  for (const annotation of item.annotations) {
    switch (annotation.type) {
      case "highlight":
      case "whiteout":
      case "rect": {
        const [x, y] = toPdf(annotation.x, annotation.y + annotation.h);
        const common = { x, y, width: annotation.w, height: annotation.h, rotate: angle };
        if (annotation.type === "highlight") {
          target.drawRectangle({ ...common, color: hexToRgb(annotation.color), opacity: 0.4, blendMode: BlendMode.Multiply });
        } else if (annotation.type === "whiteout") {
          target.drawRectangle({ ...common, color: hexToRgb(annotation.fill || "#ffffff") });
        } else {
          target.drawRectangle({
            ...common,
            color: annotation.fill ? hexToRgb(annotation.fill) : undefined,
            borderColor: hexToRgb(annotation.color),
            borderWidth: annotation.strokeWidth,
          });
        }
        break;
      }
      case "ellipse": {
        const [x, y] = toPdf(annotation.x + annotation.w / 2, annotation.y + annotation.h / 2);
        target.drawEllipse({
          x,
          y,
          xScale: annotation.w / 2,
          yScale: annotation.h / 2,
          rotate: angle,
          color: annotation.fill ? hexToRgb(annotation.fill) : undefined,
          borderColor: hexToRgb(annotation.color),
          borderWidth: annotation.strokeWidth,
        });
        break;
      }
      case "line":
      case "arrow": {
        const segments: Array<[number, number, number, number]> = [[annotation.x1, annotation.y1, annotation.x2, annotation.y2]];
        if (annotation.type === "arrow") {
          const angleRad = Math.atan2(annotation.y2 - annotation.y1, annotation.x2 - annotation.x1);
          const head = Math.max(8, annotation.strokeWidth * 4);
          for (const offset of [Math.PI * 0.82, -Math.PI * 0.82]) {
            segments.push([
              annotation.x2,
              annotation.y2,
              annotation.x2 + head * Math.cos(angleRad + offset),
              annotation.y2 + head * Math.sin(angleRad + offset),
            ]);
          }
        }
        for (const [ax, ay, bx, by] of segments) {
          const [sx, sy] = toPdf(ax, ay);
          const [ex, ey] = toPdf(bx, by);
          target.drawLine({
            start: { x: sx, y: sy },
            end: { x: ex, y: ey },
            thickness: annotation.strokeWidth,
            color: hexToRgb(annotation.color),
            lineCap: LineCapStyle.Round,
          });
        }
        break;
      }
      case "ink": {
        const points = annotation.points;
        for (let i = 2; i < points.length; i += 2) {
          const [sx, sy] = toPdf(points[i - 2], points[i - 1]);
          const [ex, ey] = toPdf(points[i], points[i + 1]);
          target.drawLine({
            start: { x: sx, y: sy },
            end: { x: ex, y: ey },
            thickness: annotation.strokeWidth,
            color: hexToRgb(annotation.color),
            lineCap: LineCapStyle.Round,
          });
        }
        break;
      }
      case "image": {
        const image = await imageFor(ctx, annotation.dataUrl);
        const [x, y] = toPdf(annotation.x, annotation.y + annotation.h);
        target.drawImage(image, { x, y, width: annotation.w, height: annotation.h, rotate: angle });
        break;
      }
      case "text": {
        if (!annotation.text.trim()) break;
        const font = await fontFor(ctx, annotation.font, annotation.bold, annotation.italic);
        const size = annotation.fontSize;
        const innerWidth = Math.max(4, annotation.w - TEXT_PADDING * 2);
        const lineHeight = size * LINE_HEIGHT;
        // Línea base igual que la calcula el navegador con las fuentes de pantalla
        const [ascent, descent] = SCREEN_METRICS[annotation.font];
        const baselineOffset = (lineHeight - (ascent + descent) * size) / 2 + ascent * size;
        const lines = wrapText(font, size, encodable(font, annotation.text), innerWidth);
        lines.forEach((line, index) => {
          if (!line) return;
          const lineWidth = font.widthOfTextAtSize(line, size);
          const offsetX =
            annotation.align === "center" ? (innerWidth - lineWidth) / 2 : annotation.align === "right" ? innerWidth - lineWidth : 0;
          const [x, y] = toPdf(
            annotation.x + TEXT_PADDING + offsetX,
            annotation.y + TEXT_PADDING + index * lineHeight + baselineOffset
          );
          target.drawText(line, { x, y, size, font, color: hexToRgb(annotation.color), rotate: angle });
        });
        break;
      }
    }
  }
}

/** Rellena (y opcionalmente aplana) los campos de formulario de un PDF. */
function applyFormValues(doc: PDFDocument, sourceIndex: number, model: DocumentModel, flatten: boolean): void {
  const form = doc.getForm();
  for (const field of form.getFields()) {
    const value = model.formValues[`${sourceIndex}:${field.getName()}`];
    if (value === undefined) continue;
    try {
      if (field instanceof PDFTextField) field.setText(String(value));
      else if (field instanceof PDFCheckBox) (value ? field.check() : field.uncheck());
      else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (value) field.select(String(value));
        else field.clear();
      } else if (field instanceof PDFRadioGroup) {
        if (value) field.select(String(value));
        else field.clear();
      }
    } catch (err) {
      console.warn(`No se pudo rellenar el campo ${field.getName()}:`, err);
    }
  }
  if (flatten && form.getFields().length > 0) {
    try {
      form.flatten();
    } catch (err) {
      console.warn("No se pudo aplanar el formulario:", err);
    }
  }
}

/**
 * Genera el PDF final con el orden de páginas, los giros, las anotaciones y
 * los valores de formulario del modelo. Si todas las páginas proceden de un
 * mismo PDF se modifica ese documento (conservando formularios, marcadores y
 * enlaces); si se combinan varios, se compone uno nuevo.
 */
export async function buildPdf(
  sources: SourcePdf[],
  model: DocumentModel,
  info: DocumentInfo,
  onlyPages?: Set<string>
): Promise<Uint8Array> {
  const pages = onlyPages ? model.pages.filter((page) => onlyPages.has(page.id)) : model.pages;
  if (pages.length === 0) throw new Error("No hay páginas que guardar.");

  const usedSources = new Set(pages.filter((p) => p.source !== null).map((p) => p.source as number));
  const singleSource = usedSources.size <= 1 && !onlyPages ? [...usedSources][0] : undefined;

  let doc: PDFDocument;
  const targetPages: PDFPage[] = [];

  if (singleSource !== undefined) {
    doc = await PDFDocument.load(sources[singleSource].bytes, { updateMetadata: false });
    applyFormValues(doc, singleSource, model, model.flattenForms);
    const originals = doc.getPages();
    const used = new Set<number>();
    // Las páginas repetidas se copian antes de reordenar
    const planned: Array<PDFPage | null> = [];
    for (const item of pages) {
      if (item.source === null) {
        planned.push(null);
      } else if (!used.has(item.index)) {
        used.add(item.index);
        planned.push(originals[item.index]);
      } else {
        const [copy] = await doc.copyPages(doc, [item.index]);
        planned.push(copy);
      }
    }
    for (let i = doc.getPageCount() - 1; i >= 0; i--) doc.removePage(i);
    planned.forEach((page, i) => {
      const item = pages[i];
      targetPages.push(page ? doc.addPage(page) : doc.addPage([item.view[2] - item.view[0], item.view[3] - item.view[1]]));
    });
  } else {
    doc = await PDFDocument.create();
    const loaded = new Map<number, PDFDocument>();
    for (const index of usedSources) {
      const sourceDoc = await PDFDocument.load(sources[index].bytes, { updateMetadata: false });
      // Al combinar PDF los formularios se aplanan para no perder lo rellenado
      applyFormValues(sourceDoc, index, model, true);
      loaded.set(index, sourceDoc);
    }
    for (const item of pages) {
      if (item.source === null) {
        targetPages.push(doc.addPage([item.view[2] - item.view[0], item.view[3] - item.view[1]]));
      } else {
        const [copy] = await doc.copyPages(loaded.get(item.source) as PDFDocument, [item.index]);
        targetPages.push(doc.addPage(copy));
      }
    }
  }

  const ctx: DrawContext = { doc, fonts: new Map(), images: new Map() };
  for (let i = 0; i < pages.length; i++) {
    const item = pages[i];
    const target = targetPages[i];
    target.setRotation(degrees(totalRotation(item)));
    await drawAnnotations(ctx, target, item);
  }

  if (info.title) doc.setTitle(info.title);
  if (info.author) doc.setAuthor(info.author);
  if (info.subject) doc.setSubject(info.subject);
  if (info.keywords) doc.setKeywords(info.keywords.split(",").map((k) => k.trim()).filter(Boolean));
  doc.setProducer("CoffePDF (CoffeWorks)");
  doc.setModificationDate(new Date());
  return doc.save({ useObjectStreams: true });
}

/** Crea un PDF vacío de una página A4 (para "Nuevo PDF"). */
export async function emptyPdfBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([A4[2], A4[3]]);
  doc.setProducer("CoffePDF (CoffeWorks)");
  return doc.save();
}

/** Abre unos bytes de PDF ya generados en pdf.js (vista de impresión). */
export async function openForPreview(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
}

/** Comprime una imagen a PNG o JPEG (los formatos que admite PDF). */
export async function normalizeImage(dataUrl: string, maxSide = 2400): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  let width = image.naturalWidth || 400;
  let height = image.naturalHeight || 300;
  const isJpeg = /^data:image\/jpe?g/i.test(dataUrl);
  const isPng = /^data:image\/png/i.test(dataUrl);
  if ((isJpeg || isPng) && Math.max(width, height) <= maxSide) return { dataUrl, width, height };

  const factor = Math.min(1, maxSide / Math.max(width, height));
  width = Math.round(width * factor);
  height = Math.round(height * factor);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL(isJpeg ? "image/jpeg" : "image/png", 0.92), width, height };
}
