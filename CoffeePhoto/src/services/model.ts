// Documento de CoffeePhoto: creación, lectura/escritura (.cph) y composición
// de las capas en una sola imagen.

import type { AdjustLayer, Adjustment, Layer, PhotoDoc, RasterLayer, TextLayer, TextStyle } from "../types";
import { ctx2d, fromCanvas, fromDataUrl, getCanvas, newCanvas, toDataUrl } from "./pixels";
import { applyAdjustment } from "./adjust";
import { newId } from "../studio/color";

export { newId };

export function blankRaster(width: number, height: number, fill?: string): string {
  const c = newCanvas(width, height);
  if (fill) {
    const g = ctx2d(c);
    g.fillStyle = fill;
    g.fillRect(0, 0, width, height);
  }
  return fromCanvas(c);
}

export function rasterLayer(name: string, data: string, extra: Partial<RasterLayer> = {}): RasterLayer {
  return { id: newId("ly"), kind: "raster", name, data, visible: true, locked: false, opacity: 1, blend: "source-over", ...extra };
}

export const DEFAULT_TEXT: TextStyle = {
  text: "Texto",
  font: "Hanken Grotesk",
  size: 72,
  color: "#ffffff",
  bold: true,
  italic: false,
  align: "left",
  lineHeight: 1.15,
  letterSpacing: 0,
  shadow: false,
  stroke: 0,
  strokeColor: "#000000",
};

export function textLayer(x: number, y: number, style: Partial<TextStyle> = {}): TextLayer {
  const ts = { ...DEFAULT_TEXT, ...style };
  return { id: newId("ly"), kind: "text", name: ts.text.slice(0, 24) || "Texto", x, y, width: 0, rotation: 0, textStyle: ts, visible: true, locked: false, opacity: 1, blend: "source-over" };
}

export function adjustLayer(name: string, adjust: Adjustment): AdjustLayer {
  return { id: newId("ly"), kind: "adjust", name, adjust, visible: true, locked: false, opacity: 1, blend: "source-over" };
}

export function newDocument(width = 1920, height = 1080, background: string | null = "#ffffff"): PhotoDoc {
  const bg = rasterLayer(background ? "Fondo" : "Capa 1", blankRaster(width, height, background || undefined));
  return { version: 1, width, height, dpi: 72, layers: [bg], activeId: bg.id };
}

export function docFromCanvas(canvas: HTMLCanvasElement, name = "Fondo"): PhotoDoc {
  const layer = rasterLayer(name, fromCanvas(canvas));
  return { version: 1, width: canvas.width, height: canvas.height, dpi: 72, layers: [layer], activeId: layer.id };
}

// ---------------------------------------------------------------------------
// Archivo .cph (JSON con las capas en PNG)
// ---------------------------------------------------------------------------

export function serializeDocument(doc: PhotoDoc): string {
  const layers = doc.layers.map((l) => {
    const out: Record<string, unknown> = { ...l };
    if (l.kind === "raster") out.data = toDataUrl(l.data);
    if (l.mask) out.mask = toDataUrl(l.mask);
    return out;
  });
  return JSON.stringify({ app: "CoffeePhoto", ...doc, layers });
}

export function parseDocument(text: string): PhotoDoc {
  const raw = JSON.parse(text);
  const width = Math.max(1, Math.round(raw.width || 1920));
  const height = Math.max(1, Math.round(raw.height || 1080));
  const layers: Layer[] = (raw.layers || []).map((l: Record<string, unknown>) => {
    const base = {
      id: (l.id as string) || newId("ly"),
      name: (l.name as string) || "Capa",
      visible: l.visible !== false,
      locked: !!l.locked,
      opacity: typeof l.opacity === "number" ? l.opacity : 1,
      blend: (l.blend as Layer["blend"]) || "source-over",
      style: l.style as Layer["style"],
      maskEnabled: l.maskEnabled !== false,
      mask: typeof l.mask === "string" && l.mask.startsWith("data:") ? fromDataUrl(l.mask, width, height) : null,
    };
    if (l.kind === "text") return { ...base, kind: "text", x: Number(l.x) || 0, y: Number(l.y) || 0, width: Number(l.width) || 0, rotation: Number(l.rotation) || 0, textStyle: { ...DEFAULT_TEXT, ...(l.textStyle as object) } } as TextLayer;
    if (l.kind === "adjust") return { ...base, kind: "adjust", adjust: l.adjust as Adjustment } as AdjustLayer;
    // Capa de píxeles: imagen, color de relleno (plantillas) o vacía
    const data = typeof l.data === "string" && l.data.startsWith("data:") ? fromDataUrl(l.data, width, height) : blankRaster(width, height, (l.fill as string) || undefined);
    return { ...base, kind: "raster", data } as RasterLayer;
  });
  if (!layers.length) layers.push(rasterLayer("Fondo", blankRaster(width, height, "#ffffff")));
  const activeId = layers.some((l) => l.id === raw.activeId) ? raw.activeId : layers[layers.length - 1].id;
  return { version: 1, width, height, dpi: raw.dpi || 72, layers, activeId, guides: raw.guides };
}

export const tokensOf = (doc: PhotoDoc) => doc.layers.flatMap((l) => [l.kind === "raster" ? l.data : null, l.mask || null]).filter(Boolean) as string[];

export const activeLayer = (doc: PhotoDoc) => doc.layers.find((l) => l.id === doc.activeId) || doc.layers[doc.layers.length - 1];

export const updateLayer = (doc: PhotoDoc, id: string, patch: Partial<Layer>): PhotoDoc => ({
  ...doc,
  layers: doc.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
});

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export const fontCss = (s: TextStyle) => `${s.italic ? "italic " : ""}${s.bold ? "700 " : "400 "}${s.size}px "${s.font}", "Hanken Grotesk", sans-serif`;

/** Líneas del texto (con ajuste si la capa tiene ancho). */
export function textLines(g: CanvasRenderingContext2D, layer: TextLayer): string[] {
  const s = layer.textStyle;
  g.font = fontCss(s);
  (g as unknown as { letterSpacing: string }).letterSpacing = `${s.letterSpacing}px`;
  const out: string[] = [];
  for (const para of s.text.split("\n")) {
    if (!layer.width) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line && g.measureText(next).width > layer.width) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export function textBounds(layer: TextLayer): { x: number; y: number; w: number; h: number } {
  const g = ctx2d(measureCanvas());
  const lines = textLines(g, layer);
  const w = layer.width || Math.max(1, ...lines.map((l) => g.measureText(l).width));
  const h = lines.length * layer.textStyle.size * layer.textStyle.lineHeight;
  return { x: layer.x, y: layer.y, w, h };
}

let measureC: HTMLCanvasElement | null = null;
const measureCanvas = () => (measureC ||= newCanvas(4, 4));

export function drawText(g: CanvasRenderingContext2D, layer: TextLayer) {
  const s = layer.textStyle;
  const lines = textLines(g, layer);
  const b = textBounds(layer);
  g.save();
  g.translate(layer.x + b.w / 2, layer.y + b.h / 2);
  g.rotate((layer.rotation * Math.PI) / 180);
  g.translate(-b.w / 2, -b.h / 2);
  g.font = fontCss(s);
  (g as unknown as { letterSpacing: string }).letterSpacing = `${s.letterSpacing}px`;
  g.textBaseline = "top";
  g.textAlign = s.align;
  const ax = s.align === "left" ? 0 : s.align === "center" ? b.w / 2 : b.w;
  if (s.shadow) {
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowBlur = s.size * 0.12;
    g.shadowOffsetX = s.size * 0.04;
    g.shadowOffsetY = s.size * 0.06;
  }
  lines.forEach((line, i) => {
    const y = i * s.size * s.lineHeight + (s.size * (s.lineHeight - 1)) / 2;
    if (s.stroke > 0) {
      g.lineJoin = "round";
      g.lineWidth = s.stroke * 2;
      g.strokeStyle = s.strokeColor;
      g.strokeText(line, ax, y);
    }
    g.fillStyle = s.color;
    g.fillText(line, ax, y);
  });
  g.restore();
}

// ---------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------

const alphaMasks = new Map<string, HTMLCanvasElement>();

/** Máscara (gris) convertida en canal alfa. */
export function maskAlpha(token: string): HTMLCanvasElement | null {
  const cached = alphaMasks.get(token);
  if (cached) return cached;
  const src = getCanvas(token);
  if (!src) return null;
  const c = newCanvas(src.width, src.height);
  const g = ctx2d(c);
  const data = ctx2d(src).getImageData(0, 0, src.width, src.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = d[i];
    d[i] = d[i + 1] = d[i + 2] = 0;
  }
  g.putImageData(data, 0, 0);
  if (alphaMasks.size > 40) alphaMasks.clear();
  alphaMasks.set(token, c);
  return c;
}

export interface ComposeOptions {
  /** Lienzo que sustituye al de una capa (trazo en curso, transformación…). */
  override?: { id: string; canvas: HTMLCanvasElement };
  /** Capas que no se dibujan (p. ej., el texto que se está editando). */
  hide?: Set<string>;
  /** Componer solo hasta esta capa (incluida). */
  upTo?: string;
  scratch?: HTMLCanvasElement;
}

/** Contenido de una capa (con máscara y estilo) en un lienzo del tamaño del documento. */
export function layerCanvas(doc: PhotoDoc, layer: Layer, override?: HTMLCanvasElement): HTMLCanvasElement | null {
  let src: HTMLCanvasElement | null = null;
  if (layer.kind === "raster") src = override || getCanvas(layer.data);
  else if (layer.kind === "text") {
    src = newCanvas(doc.width, doc.height);
    drawText(ctx2d(src), layer);
  }
  if (!src) return null;
  const needsMask = layer.mask && layer.maskEnabled !== false;
  const style = layer.style;
  if (!needsMask && !style?.dropShadow && !style?.stroke && !style?.outerGlow) return src;
  const out = newCanvas(doc.width, doc.height);
  const g = ctx2d(out);
  let body = src;
  if (needsMask) {
    const m = maskAlpha(layer.mask!);
    if (m) {
      body = newCanvas(doc.width, doc.height);
      const bg = ctx2d(body);
      bg.drawImage(src, 0, 0);
      bg.globalCompositeOperation = "destination-in";
      bg.drawImage(m, 0, 0);
    }
  }
  if (style?.outerGlow) {
    g.save();
    g.shadowColor = hexA(style.outerGlow.color, style.outerGlow.opacity);
    g.shadowBlur = style.outerGlow.size;
    g.drawImage(body, 0, 0);
    g.restore();
    g.globalCompositeOperation = "destination-out";
    g.drawImage(body, 0, 0);
    g.globalCompositeOperation = "source-over";
  }
  if (style?.dropShadow) {
    const s = style.dropShadow;
    const a = (s.angle * Math.PI) / 180;
    const sil = silhouette(body, s.color);
    g.save();
    g.globalAlpha = s.opacity;
    g.filter = s.blur ? `blur(${s.blur / 2}px)` : "none";
    g.drawImage(sil, -Math.cos(a) * s.distance, Math.sin(a) * s.distance);
    g.restore();
  }
  if (style?.stroke && style.stroke.size > 0) {
    const sil = silhouette(body, style.stroke.color);
    const r = style.stroke.size;
    const steps = Math.max(12, Math.round(r * 4));
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      g.drawImage(sil, Math.cos(t) * r, Math.sin(t) * r);
    }
  }
  g.drawImage(body, 0, 0);
  return out;
}

function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = newCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Imagen final del documento (o hasta una capa). */
export function compose(doc: PhotoDoc, opts: ComposeOptions = {}): HTMLCanvasElement {
  const out = opts.scratch && opts.scratch.width === doc.width && opts.scratch.height === doc.height ? opts.scratch : newCanvas(doc.width, doc.height);
  const g = ctx2d(out);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.clearRect(0, 0, doc.width, doc.height);
  for (const layer of doc.layers) {
    if (layer.visible && !opts.hide?.has(layer.id)) {
      if (layer.kind === "adjust") applyAdjustLayer(doc, g, layer);
      else {
        const c = layerCanvas(doc, layer, opts.override?.id === layer.id ? opts.override.canvas : undefined);
        if (c) {
          g.globalAlpha = layer.opacity;
          g.globalCompositeOperation = layer.blend;
          g.drawImage(c, 0, 0);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
        }
      }
    }
    if (opts.upTo === layer.id) break;
  }
  return out;
}

function applyAdjustLayer(doc: PhotoDoc, g: CanvasRenderingContext2D, layer: AdjustLayer) {
  const before = g.getImageData(0, 0, doc.width, doc.height);
  const after = new ImageData(new Uint8ClampedArray(before.data), doc.width, doc.height);
  applyAdjustment(after, layer.adjust);
  const mask = layer.mask && layer.maskEnabled !== false ? getCanvas(layer.mask) : null;
  const m = mask ? ctx2d(mask).getImageData(0, 0, doc.width, doc.height).data : null;
  const a = before.data;
  const b = after.data;
  const k = layer.opacity;
  if (k < 1 || m) {
    for (let i = 0; i < b.length; i += 4) {
      const t = k * (m ? m[i] / 255 : 1);
      b[i] = a[i] + (b[i] - a[i]) * t;
      b[i + 1] = a[i + 1] + (b[i + 1] - a[i + 1]) * t;
      b[i + 2] = a[i + 2] + (b[i + 2] - a[i + 2]) * t;
    }
  }
  g.putImageData(after, 0, 0);
}

/** Miniatura de una capa (para el panel de capas). */
export function thumbnail(doc: PhotoDoc, layer: Layer, size = 40): string {
  const scale = size / Math.max(doc.width, doc.height);
  const c = newCanvas(Math.max(1, doc.width * scale), Math.max(1, doc.height * scale));
  const g = ctx2d(c);
  if (layer.kind !== "adjust") {
    const src = layer.kind === "raster" ? getCanvas(layer.data) : layerCanvas(doc, layer);
    if (src) g.drawImage(src, 0, 0, c.width, c.height);
  }
  return c.toDataURL();
}
