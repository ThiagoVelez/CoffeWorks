// Texto original del PDF para el complemento «Revisión del PDF original».
//
// Las páginas con texto digital se leen con pdf.js; las escaneadas (sin texto)
// se reconocen con Tesseract, que trae el complemento. Cada fragmento lleva su
// recuadro en puntos sobre la página tal como se ve, para dibujar una capa de
// texto invisible encima del lienzo (ahí se subrayan las faltas) y para tapar
// y reescribir una palabra al corregirla.

import { invoke } from "@tauri-apps/api/core";
import type { Annotation, FontFamily, PageItem, TextAnnotation } from "../types";
import type { SourcePdf } from "./pdfEngine";
import { renderPage } from "./pdfEngine";
import { FONT_CSS, LINE_HEIGHT, TEXT_PADDING, newId, totalRotation } from "./geometry";
import { bytesToBase64, isTauri } from "./desktop";

export const ADDON_ID = "pdfcheck";

export interface OriginalItem {
  /** Clave para el corrector: `orig:<página>:<n>`. */
  key: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  font: FontFamily;
  /** Escala horizontal para que el texto invisible ocupe lo mismo que el original. */
  scaleX: number;
  /** Viene del OCR. */
  ocr: boolean;
}

export interface PageOriginal {
  items: OriginalItem[];
  /** La página no tiene texto digital (escaneada). */
  scanned: boolean;
}

let measureContext: CanvasRenderingContext2D | null = null;
function measure(text: string, font: FontFamily, size: number): number {
  if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * size * 0.5;
  measureContext.font = `${size}px ${FONT_CSS[font]}`;
  return measureContext.measureText(text).width;
}

const familyOf = (family: string | undefined, fontName: string): FontFamily => {
  const name = `${family || ""} ${fontName}`.toLowerCase();
  if (/mono|courier/.test(name)) return "Courier";
  if (/serif/.test(name) && !/sans/.test(name)) return "Times";
  if (/times|georgia|garamond|cambria|book/.test(name)) return "Times";
  return "Helvetica";
};

function makeItem(key: string, text: string, x: number, y: number, w: number, h: number, font: FontFamily, ocr: boolean): OriginalItem {
  const fontSize = Math.max(3, h / 1.15);
  const natural = measure(text, font, fontSize) || w;
  return { key, text, x, y, w, h, fontSize, font, scaleX: natural > 0 ? w / natural : 1, ocr };
}

const cache = new Map<string, PageOriginal>();
const cacheKey = (item: PageItem) => `${item.source}:${item.index}:${totalRotation(item)}`;

/** Texto digital de la página (vacío si es escaneada). */
async function digitalText(source: SourcePdf, item: PageItem): Promise<OriginalItem[]> {
  const page = await source.proxy.getPage(item.index + 1);
  const viewport = page.getViewport({ scale: 1, rotation: totalRotation(item) });
  const content = await page.getTextContent();
  const styles = (content as unknown as { styles?: Record<string, { fontFamily?: string }> }).styles || {};
  const out: OriginalItem[] = [];
  content.items.forEach((raw, n) => {
    if (!("str" in raw) || !raw.str.trim()) return;
    const [a, b, c, d, e, f] = raw.transform as number[];
    const fontHeight = Math.hypot(c, d) || raw.height || 10;
    const len = Math.hypot(a, b) || 1;
    const dirX = a / len;
    const dirY = b / len;
    const width = raw.width || raw.str.length * fontHeight * 0.5;
    const [x0, y0] = viewport.convertToViewportPoint(e, f);
    const [x1, y1] = viewport.convertToViewportPoint(e + dirX * width, f + dirY * width);
    // Solo texto horizontal de izquierda a derecha
    if (x1 - x0 <= 0 || Math.abs(y1 - y0) > (x1 - x0) * 0.2) return;
    const [, top] = viewport.convertToViewportPoint(e - dirY * fontHeight, f + dirX * fontHeight);
    const h = Math.abs(y0 - top) * 1.15;
    const font = familyOf(styles[raw.fontName]?.fontFamily, raw.fontName);
    out.push(makeItem(`orig:${item.id}:${n}`, raw.str, x0, y0 - Math.abs(y0 - top) * 0.92, x1 - x0, h, font, false));
  });
  return out;
}

/** Reconoce el texto de una página escaneada con el OCR del complemento. */
async function ocrText(sources: SourcePdf[], item: PageItem): Promise<OriginalItem[]> {
  const scale = 3; // ~216 ppp
  const canvas = document.createElement("canvas");
  await renderPage(sources, item, canvas, scale).promise;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return [];
  const data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  const tsv = await invoke<string>("core_addon_run_file", {
    id: ADDON_ID,
    args: ["{input}", "stdout", "-l", "spa+eng", "--psm", "3", "tsv"],
    data,
    extension: "png",
  });
  // Palabras agrupadas por línea para estimar el tamaño de letra
  const words: Array<{ line: string; left: number; top: number; width: number; height: number; text: string }> = [];
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const cols = row.split("\t");
    if (cols.length < 12 || cols[0] !== "5") continue;
    const text = cols.slice(11).join("\t").trim();
    const conf = Number(cols[10]);
    if (!text || conf < 0) continue;
    words.push({ line: `${cols[2]}.${cols[3]}.${cols[4]}`, left: +cols[6], top: +cols[7], width: +cols[8], height: +cols[9], text });
  }
  const lineHeight = new Map<string, number>();
  for (const w of words) lineHeight.set(w.line, Math.max(lineHeight.get(w.line) || 0, w.height));
  return words.map((w, n) => {
    const h = (lineHeight.get(w.line) || w.height) / scale;
    const y = w.top / scale + w.height / scale - h;
    return makeItem(`orig:${item.id}:ocr${n}`, w.text, w.left / scale, y, w.width / scale, h * 1.1, "Helvetica", true);
  });
}

/** Lee (o reconoce) el texto original de una página. */
export async function readOriginal(sources: SourcePdf[], item: PageItem, allowOcr: boolean): Promise<PageOriginal> {
  if (item.source === null) return { items: [], scanned: false };
  const key = cacheKey(item);
  const cached = cache.get(key);
  // Las claves dependen del id de la página
  const rekey = (p: PageOriginal): PageOriginal => ({
    ...p,
    items: p.items.map((it) => ({ ...it, key: it.key.replace(/^orig:[^:]+:/, `orig:${item.id}:`) })),
  });
  if (cached && (!cached.scanned || cached.items.length || !allowOcr)) return rekey(cached);
  const source = sources[item.source];
  let items = await digitalText(source, item);
  const scanned = items.reduce((n, it) => n + it.text.trim().length, 0) < 20;
  if (scanned && allowOcr && isTauri) {
    const recognized = await ocrText(sources, item);
    if (recognized.length) items = recognized;
  }
  const result = { items, scanned };
  cache.set(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Palabras, faltas y corrección
// ---------------------------------------------------------------------------

/** Recuadro de una parte del fragmento (proporcional a los caracteres). */
export function wordBox(item: OriginalItem, start: number, end: number) {
  const total = measure(item.text, item.font, item.fontSize) || 1;
  const before = measure(item.text.slice(0, start), item.font, item.fontSize);
  const word = measure(item.text.slice(start, end), item.font, item.fontSize);
  const k = item.w / total;
  return { x: item.x + before * k, y: item.y, w: word * k, h: item.h };
}

const covered = (box: { x: number; y: number; w: number; h: number }, annotations: Annotation[]) => {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return annotations.some((a) => a.type === "whiteout" && cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h);
};

/**
 * Texto que se revisa: las palabras tapadas con el corrector (o ya
 * corregidas) se cambian por espacios para no contarlas otra vez.
 */
export function visibleText(item: OriginalItem, annotations: Annotation[]): string {
  if (!annotations.some((a) => a.type === "whiteout")) return item.text;
  return item.text.replace(/[\p{L}\p{M}'’]+/gu, (word, offset: number) =>
    covered(wordBox(item, offset, offset + word.length), annotations) ? " ".repeat(word.length) : word
  );
}

/** Tapa una palabra del original y escribe la corrección encima. */
export function correctionAnnotations(item: OriginalItem, start: number, end: number, replacement: string): Annotation[] {
  const box = wordBox(item, start, end);
  // Tamaño con el que la fuente ocupa lo mismo que el original (el OCR solo da el recuadro)
  const fit = Math.min(1.6, Math.max(0.7, item.scaleX));
  const fontSize = Math.round(item.fontSize * fit * 10) / 10;
  const textWidth = measure(replacement, item.font, fontSize);
  const pad = Math.max(0.6, fontSize * 0.06);
  const lineBox = fontSize * LINE_HEIGHT;
  const baselineTop = box.y + box.h / 2 - lineBox / 2;
  const cover: Annotation = {
    id: newId("ann"),
    type: "whiteout",
    x: box.x - pad,
    y: box.y - pad * 0.5,
    w: Math.max(box.w, textWidth) + pad * 2,
    h: box.h + pad,
    color: "#ffffff",
    fill: "#ffffff",
    strokeWidth: 0,
  };
  const text: TextAnnotation = {
    id: newId("ann"),
    type: "text",
    x: box.x - TEXT_PADDING,
    y: baselineTop - TEXT_PADDING,
    w: textWidth + TEXT_PADDING * 2 + 2,
    h: lineBox + TEXT_PADDING * 2,
    text: replacement,
    fontSize,
    font: item.font,
    bold: false,
    italic: false,
    color: "#000000",
    align: "left",
  };
  return [cover, text];
}
