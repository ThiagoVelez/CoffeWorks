// Lectura de PDF en la app (pdf.js): texto con posiciones y páginas como imagen.

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageText } from "./office";
import type { TextItem } from "./pdftext";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(bytes: Uint8Array) {
  try {
    return await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/password/i.test(msg)) throw new Error("El PDF está protegido con contraseña; quítasela antes de convertirlo.");
    throw new Error("No se pudo leer el PDF (¿está dañado?).");
  }
}

type Doc = Awaited<ReturnType<typeof openPdf>>;

/**
 * Dibuja una página en un lienzo con la escala dada (1 = 72 ppp). Con `hideText` se dibuja
 * todo menos el texto (pdf.js lo pinta con fillText/strokeText): fondo para el PowerPoint
 * editable, donde el texto va encima en cajas.
 */
export async function renderPage(doc: Doc, pageNumber: number, scale: number, hideText = false): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  if (hideText) {
    ctx.fillText = () => undefined;
    ctx.strokeText = () => undefined;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export async function canvasBytes(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality = 0.9): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  if (!blob) throw new Error("No se pudo crear la imagen de la página.");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Texto de cada página con posiciones. `images`: «page» añade la página como imagen
 * (PowerPoint fiel); «background», la página sin texto (PowerPoint editable).
 */
export async function readPages(doc: Doc, images: "none" | "page" | "background" = "none", onProgress?: (f: number) => void): Promise<PageText[]> {
  const out: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const styles = content.styles as Record<string, { fontFamily?: string }>;
    const items: TextItem[] = [];
    const itemByRaw = new Map<number, TextItem>();
    for (const [k, raw] of content.items.entries()) {
      if (!("str" in raw) || !raw.str) continue;
      const [a, b, , d, e, f] = raw.transform as number[];
      // Coordenadas del PDF llevadas a la vista sin girar (las páginas giradas también).
      const [x, y] = vp.convertToViewportPoint(e, f);
      const size = Math.hypot(a, b) || Math.abs(d) || 10;
      const family = `${raw.fontName} ${styles[raw.fontName]?.fontFamily ?? ""}`;
      const item: TextItem = { str: raw.str, x, y: vp.height - y, w: raw.width, size, bold: /bold|black|heavy/i.test(family) };
      items.push(item);
      itemByRaw.set(k, item);
    }
    const pageText: PageText = { width: vp.width, height: vp.height, items };
    if (images === "page") pageText.image = (await renderPage(doc, n, 2)).toDataURL("image/png");
    if (images === "background") {
      // Con y sin texto: el color de cada fragmento es el del píxel que más cambia, y el
      // nombre real de la fuente (ya cargada al dibujar) dice si es negrita o cursiva.
      const scale = 2;
      const full = await renderPage(doc, n, scale);
      const bare = await renderPage(doc, n, scale, true);
      pageText.background = bare.toDataURL("image/png");
      const a = full.getContext("2d")!.getImageData(0, 0, full.width, full.height).data;
      const b = bare.getContext("2d")!.getImageData(0, 0, bare.width, bare.height).data;
      content.items.forEach((raw, k) => {
        if (!("str" in raw)) return;
        const item = items.find((it) => it === itemByRaw.get(k));
        if (!item) return;
        item.color = textColor(a, b, full.width, full.height, item, vp.height, scale);
        const font = fontInfo(page, raw.fontName);
        if (font) {
          item.bold = item.bold || /bold|black|heavy|semibold/i.test(font);
          item.italic = /italic|oblique/i.test(font);
        }
      });
    }
    out.push(pageText);
    page.cleanup();
    onProgress?.(n / doc.numPages);
  }
  return out;
}

/** Nombre real de la fuente de pdf.js (p. ej. «ABCDEF+Arimo-Bold»), si ya está cargada. */
function fontInfo(page: { commonObjs: { has(id: string): boolean; get(id: string): unknown } }, fontName: string): string | null {
  try {
    if (!page.commonObjs.has(fontName)) return null;
    const f = page.commonObjs.get(fontName) as { name?: string; loadedName?: string } | null;
    return f?.name ?? null;
  } catch {
    return null;
  }
}

/** Color del texto: en la caja del fragmento, el píxel que más cambia entre la página con y sin texto. */
function textColor(full: Uint8ClampedArray, bare: Uint8ClampedArray, w: number, h: number, item: TextItem, pageHeight: number, scale: number): string | undefined {
  const x0 = Math.max(0, Math.floor(item.x * scale));
  const x1 = Math.min(w - 1, Math.ceil((item.x + item.w) * scale));
  const top = Math.max(0, Math.floor((pageHeight - item.y - item.size) * scale));
  const bottom = Math.min(h - 1, Math.ceil((pageHeight - item.y + item.size * 0.25) * scale));
  let best = 0;
  let color: string | undefined;
  for (let y = top; y <= bottom; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * w + x) * 4;
      const d = Math.abs(full[i] - bare[i]) + Math.abs(full[i + 1] - bare[i + 1]) + Math.abs(full[i + 2] - bare[i + 2]);
      if (d > best) {
        best = d;
        color = `#${[full[i], full[i + 1], full[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      }
    }
  return best > 60 ? color : undefined;
}
