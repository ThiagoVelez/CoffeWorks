// Documento de CoffeePaint: creación, archivo .cpt, papel y composición.

import type { PaintDoc, PaintLayer, Paper } from "../types";
import { ctx2d, fromCanvas, fromDataUrl, getCanvas, newCanvas, toDataUrl } from "./pixels";
import { grainTexture } from "./brushes";
import { newId } from "../studio/color";

export { newId };

export function blankLayer(width: number, height: number, name: string): PaintLayer {
  return { id: newId("ly"), name, data: fromCanvas(newCanvas(width, height)), visible: true, opacity: 1, blend: "source-over", locked: false, alphaLock: false };
}

export function newDocument(width = 2048, height = 1536, paper: Paper = "sketch", paperColor = "#fbf8f2"): PaintDoc {
  const l = blankLayer(width, height, "Capa 1");
  return { version: 1, width, height, paper, paperColor, layers: [l], activeId: l.id };
}

export function serializeDocument(doc: PaintDoc): string {
  return JSON.stringify({ app: "CoffeePaint", ...doc, layers: doc.layers.map((l) => ({ ...l, data: toDataUrl(l.data) })) });
}

export function parseDocument(text: string): PaintDoc {
  const raw = JSON.parse(text);
  const width = Math.max(1, Math.round(raw.width || 2048));
  const height = Math.max(1, Math.round(raw.height || 1536));
  const layers: PaintLayer[] = (raw.layers || []).map((l: Record<string, unknown>, i: number) => ({
    id: (l.id as string) || newId("ly"),
    name: (l.name as string) || `Capa ${i + 1}`,
    data: typeof l.data === "string" && l.data.startsWith("data:") ? fromDataUrl(l.data, width, height) : fromCanvas(newCanvas(width, height)),
    visible: l.visible !== false,
    opacity: typeof l.opacity === "number" ? l.opacity : 1,
    blend: (l.blend as PaintLayer["blend"]) || "source-over",
    locked: !!l.locked,
    alphaLock: !!l.alphaLock,
  }));
  if (!layers.length) layers.push(blankLayer(width, height, "Capa 1"));
  return {
    version: 1,
    width,
    height,
    paper: raw.paper || "sketch",
    paperColor: raw.paperColor || "#fbf8f2",
    layers,
    activeId: layers.some((l) => l.id === raw.activeId) ? raw.activeId : layers[layers.length - 1].id,
  };
}

export const tokensOf = (doc: PaintDoc) => doc.layers.map((l) => l.data);
export const activeLayer = (doc: PaintDoc) => doc.layers.find((l) => l.id === doc.activeId) || doc.layers[doc.layers.length - 1];
export const updateLayer = (doc: PaintDoc, id: string, patch: Partial<PaintLayer>): PaintDoc => ({ ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

// ---------------------------------------------------------------------------
// Papel
// ---------------------------------------------------------------------------

const paperCache = new Map<string, HTMLCanvasElement>();

export function paperCanvas(doc: PaintDoc): HTMLCanvasElement {
  const key = `${doc.width}x${doc.height}:${doc.paper}:${doc.paperColor}`;
  const cached = paperCache.get(key);
  if (cached) return cached;
  const c = newCanvas(doc.width, doc.height);
  const g = ctx2d(c);
  g.fillStyle = doc.paperColor;
  g.fillRect(0, 0, doc.width, doc.height);
  if (doc.paper !== "smooth") {
    // Relieve del papel: sombras suaves según la textura
    const tex = grainTexture();
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = doc.paper === "watercolor" ? 0.14 : doc.paper === "sketch" ? 0.07 : 0.1;
    const shade = newCanvas(tex.width, tex.height);
    const sg = ctx2d(shade);
    sg.fillStyle = "#6b5a48";
    sg.fillRect(0, 0, shade.width, shade.height);
    sg.globalCompositeOperation = "destination-in";
    sg.drawImage(tex, 0, 0);
    const sp = g.createPattern(shade, "repeat")!;
    if (doc.paper === "watercolor") sp.setTransform(new DOMMatrix([2.2, 0, 0, 2.2, 0, 0]));
    g.fillStyle = sp;
    g.fillRect(0, 0, doc.width, doc.height);
    if (doc.paper === "canvas") {
      // Trama de lienzo
      g.globalAlpha = 0.06;
      g.strokeStyle = "#5b4a3a";
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x < doc.width; x += 4) {
        g.moveTo(x + 0.5, 0);
        g.lineTo(x + 0.5, doc.height);
      }
      for (let y = 0; y < doc.height; y += 4) {
        g.moveTo(0, y + 0.5);
        g.lineTo(doc.width, y + 0.5);
      }
      g.stroke();
    }
  }
  if (paperCache.size > 6) paperCache.clear();
  paperCache.set(key, c);
  return c;
}

export interface ComposeOptions {
  override?: { id: string; canvas: HTMLCanvasElement };
  paper?: boolean;
  scratch?: HTMLCanvasElement;
}

export function compose(doc: PaintDoc, opts: ComposeOptions = {}): HTMLCanvasElement {
  const out = opts.scratch && opts.scratch.width === doc.width && opts.scratch.height === doc.height ? opts.scratch : newCanvas(doc.width, doc.height);
  const g = ctx2d(out);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, doc.width, doc.height);
  if (opts.paper !== false) g.drawImage(paperCanvas(doc), 0, 0);
  for (const l of doc.layers) {
    if (!l.visible) continue;
    const c = opts.override?.id === l.id ? opts.override.canvas : getCanvas(l.data);
    if (!c) continue;
    g.globalAlpha = l.opacity;
    g.globalCompositeOperation = l.blend;
    g.drawImage(c, 0, 0);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  return out;
}

export function thumbnail(doc: PaintDoc, l: PaintLayer, size = 40): string {
  const k = size / Math.max(doc.width, doc.height);
  const c = newCanvas(Math.max(1, doc.width * k), Math.max(1, doc.height * k));
  const src = getCanvas(l.data);
  if (src) ctx2d(c).drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL();
}

export function docFromImage(img: HTMLCanvasElement): PaintDoc {
  const doc = newDocument(img.width, img.height, "smooth", "#ffffff");
  const l = { ...doc.layers[0], name: "Imagen", data: fromCanvas(img) };
  const sketch = blankLayer(img.width, img.height, "Capa 1");
  return { ...doc, layers: [l, sketch], activeId: sketch.id };
}
