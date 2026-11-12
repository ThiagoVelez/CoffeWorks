// Pinceles de CoffeePaint y motor de trazos.
//
// Cada pincel estampa una punta a lo largo del recorrido. La punta se tiñe
// del color, se multiplica por el grano del papel (fijo en el lienzo, como en
// el papel real) y responde a la presión y la inclinación del lápiz. Los
// pinceles "húmedos" (óleo, difuminar) arrastran y mezclan el color que ya hay.

import { ctx2d, newCanvas } from "./pixels";
import type { Symmetry } from "../types";

export interface BrushDef {
  id: string;
  name: string;
  group: "Secos" | "Tinta" | "Húmedos" | "Efectos";
  /** Diámetro por defecto (px). */
  size: number;
  opacity: number;
  /** Cantidad de pintura por estampa (0-1). */
  flow: number;
  hardness: number;
  /** Separación entre estampas (fracción del diámetro). */
  spacing: number;
  /** Grano del papel (0-1). */
  grain: number;
  /** Variación aleatoria de tamaño (0-1). */
  jitter: number;
  pressureSize: boolean;
  pressureOpacity: boolean;
  /** Tamaño mínimo con poca presión (fracción). */
  minSize: number;
  /** Mezcla con el color del lienzo (óleo, difuminar). */
  mix: number;
  /** Modo de composición del trazo. */
  composite: "normal" | "multiply" | "erase";
  /** Bordes húmedos de acuarela al terminar el trazo. */
  wetEdges: boolean;
  /** La punta es plana y gira con la dirección (marcador, caligrafía). */
  flat: number;
  /** Suavizado (estabilizador) por defecto, 0-0.95. */
  smoothing: number;
}

const base: Omit<BrushDef, "id" | "name" | "group"> = {
  size: 12,
  opacity: 1,
  flow: 1,
  hardness: 0.85,
  spacing: 0.08,
  grain: 0,
  jitter: 0,
  pressureSize: true,
  pressureOpacity: false,
  minSize: 0.2,
  mix: 0,
  composite: "normal",
  wetEdges: false,
  flat: 0,
  smoothing: 0.3,
};

export const BRUSHES: BrushDef[] = [
  { ...base, id: "pencil", name: "Lápiz HB", group: "Secos", size: 4, hardness: 0.6, grain: 0.75, pressureSize: false, pressureOpacity: true, opacity: 0.9, flow: 0.55, spacing: 0.15, smoothing: 0.1 },
  { ...base, id: "charcoal", name: "Carboncillo", group: "Secos", size: 26, hardness: 0.4, grain: 0.9, pressureOpacity: true, opacity: 0.85, flow: 0.4, spacing: 0.12, jitter: 0.15 },
  { ...base, id: "pastel", name: "Pastel", group: "Secos", size: 34, hardness: 0.5, grain: 0.65, opacity: 0.9, flow: 0.5, spacing: 0.1, pressureOpacity: true },
  { ...base, id: "ink", name: "Pluma de tinta", group: "Tinta", size: 8, hardness: 1, minSize: 0.15, smoothing: 0.5, spacing: 0.05 },
  { ...base, id: "brushpen", name: "Rotulador pincel", group: "Tinta", size: 18, hardness: 0.95, minSize: 0.05, smoothing: 0.55, spacing: 0.04 },
  { ...base, id: "calligraphy", name: "Caligrafía", group: "Tinta", size: 22, hardness: 1, flat: 0.25, pressureSize: true, minSize: 0.4, smoothing: 0.5, spacing: 0.03 },
  { ...base, id: "marker", name: "Marcador", group: "Tinta", size: 24, hardness: 0.9, flat: 0.55, opacity: 0.55, composite: "multiply", pressureSize: false, spacing: 0.05 },
  { ...base, id: "watercolor", name: "Acuarela", group: "Húmedos", size: 60, hardness: 0.25, opacity: 0.5, flow: 0.12, wetEdges: true, grain: 0.35, spacing: 0.06, minSize: 0.5 },
  { ...base, id: "wash", name: "Aguada", group: "Húmedos", size: 140, hardness: 0.1, opacity: 0.35, flow: 0.08, wetEdges: true, spacing: 0.05, pressureSize: false, pressureOpacity: true },
  { ...base, id: "oil", name: "Óleo", group: "Húmedos", size: 36, hardness: 0.7, mix: 0.55, flow: 0.9, spacing: 0.06, grain: 0.15, minSize: 0.5 },
  { ...base, id: "airbrush", name: "Aerógrafo", group: "Efectos", size: 90, hardness: 0, opacity: 1, flow: 0.06, pressureSize: false, pressureOpacity: true, spacing: 0.05, smoothing: 0.2 },
  { ...base, id: "splatter", name: "Salpicaduras", group: "Efectos", size: 40, hardness: 1, jitter: 1, spacing: 0.9, flow: 1, minSize: 0.05, smoothing: 0 },
];

export const SMUDGE: BrushDef = { ...base, id: "smudge", name: "Difuminar", group: "Efectos", size: 40, hardness: 0.3, mix: 1, flow: 0.8, spacing: 0.05, pressureSize: false, pressureOpacity: true };
export const ERASER: BrushDef = { ...base, id: "eraser", name: "Borrador", group: "Efectos", size: 40, hardness: 0.6, composite: "erase", pressureSize: false, pressureOpacity: true, smoothing: 0.2 };

// ---------------------------------------------------------------------------
// Grano del papel
// ---------------------------------------------------------------------------

let grainCanvas: HTMLCanvasElement | null = null;

/** Textura de grano (256 × 256, se repite) con ruido de varias escalas. */
export function grainTexture(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const N = 256;
  const c = newCanvas(N, N);
  const g = ctx2d(c);
  const img = g.createImageData(N, N);
  // Ruido de valor suavizado en dos escalas + ruido fino
  const rnd = (n: number) => Array.from({ length: n * n }, () => Math.random());
  const coarse = rnd(16);
  const mid = rnd(64);
  const sample = (arr: number[], n: number, x: number, y: number) => {
    const fx = (x / N) * n;
    const fy = (y / N) * n;
    const x0 = Math.floor(fx) % n;
    const y0 = Math.floor(fy) % n;
    const x1 = (x0 + 1) % n;
    const y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const a = arr[y0 * n + x0] * (1 - tx) + arr[y0 * n + x1] * tx;
    const b = arr[y1 * n + x0] * (1 - tx) + arr[y1 * n + x1] * tx;
    return a * (1 - ty) + b * ty;
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = 0.35 * sample(coarse, 16, x, y) + 0.4 * sample(mid, 64, x, y) + 0.25 * Math.random();
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, Math.max(0, (v - 0.25) * 1.9)) * 255);
    }
  g.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

const grainCache = new Map<number, HTMLCanvasElement>();

/** Grano mezclado: alfa = 1 − cantidad + cantidad × ruido. */
function grainFor(amount: number): HTMLCanvasElement {
  const k = Math.round(amount * 20) / 20;
  const cached = grainCache.get(k);
  if (cached) return cached;
  const src = grainTexture();
  const c = newCanvas(src.width, src.height);
  const g = ctx2d(c);
  const img = ctx2d(src).getImageData(0, 0, src.width, src.height);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.round(255 * (1 - k) + img.data[i] * k);
  g.putImageData(img, 0, 0);
  grainCache.set(k, c);
  return c;
}

// ---------------------------------------------------------------------------
// Puntas
// ---------------------------------------------------------------------------

const tipCache = new Map<string, HTMLCanvasElement>();

function roundTip(d: number, hardness: number): HTMLCanvasElement {
  const size = Math.max(1, Math.round(d));
  const key = `${size}:${Math.round(hardness * 20)}`;
  const cached = tipCache.get(key);
  if (cached) return cached;
  const c = newCanvas(size + 2, size + 2);
  const g = ctx2d(c);
  const r = size / 2;
  const cx = c.width / 2;
  const grad = g.createRadialGradient(cx, cx, 0, cx, cx, r);
  const h = Math.min(0.98, Math.max(0, hardness));
  grad.addColorStop(0, "#fff");
  grad.addColorStop(h, "#fff");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.fill();
  if (tipCache.size > 120) tipCache.clear();
  tipCache.set(key, c);
  return c;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface StrokeContext {
  width: number;
  height: number;
  brush: BrushDef;
  size: number;
  opacity: number;
  color: string;
  symmetry: Symmetry;
  radial: number;
  /** Lienzo de la capa (se modifica directamente en los pinceles húmedos). */
  layer: HTMLCanvasElement;
}

/**
 * Trazo en curso. Los pinceles normales acumulan una máscara que luego se
 * tiñe y se compone; los húmedos pintan directamente sobre la capa.
 */
export class PaintStroke {
  readonly mask: HTMLCanvasElement;
  private mg: CanvasRenderingContext2D;
  private last: StrokePoint | null = null;
  private residue = 0;
  private angle = 0;
  private carry: HTMLCanvasElement[] = [];
  private lg: CanvasRenderingContext2D;
  private scratch: HTMLCanvasElement;

  constructor(private c: StrokeContext) {
    this.mask = newCanvas(c.width, c.height);
    this.mg = ctx2d(this.mask);
    this.lg = ctx2d(c.layer);
    this.scratch = newCanvas(4, 4);
  }

  get wet() {
    return this.c.brush.mix > 0;
  }

  /** Puntos simétricos de un punto. */
  private mirrors(x: number, y: number, angle: number): Array<{ x: number; y: number; a: number }> {
    const { width: W, height: H, symmetry, radial } = this.c;
    const out = [{ x, y, a: angle }];
    const cx = W / 2;
    const cy = H / 2;
    if (symmetry === "vertical" || symmetry === "quad") out.push({ x: 2 * cx - x, y, a: Math.PI - angle });
    if (symmetry === "horizontal" || symmetry === "quad") out.push({ x, y: 2 * cy - y, a: -angle });
    if (symmetry === "quad") out.push({ x: 2 * cx - x, y: 2 * cy - y, a: angle + Math.PI });
    if (symmetry === "radial") {
      const n = Math.max(2, radial);
      for (let k = 1; k < n; k++) {
        const t = (k / n) * Math.PI * 2;
        const dx = x - cx;
        const dy = y - cy;
        out.push({ x: cx + dx * Math.cos(t) - dy * Math.sin(t), y: cy + dx * Math.sin(t) + dy * Math.cos(t), a: angle + t });
      }
    }
    return out;
  }

  private stampAt(x: number, y: number, pressure: number, angle: number, index: number) {
    const b = this.c.brush;
    let d = this.c.size * (b.pressureSize ? b.minSize + (1 - b.minSize) * pressure : 1);
    if (b.jitter) d *= 1 - b.jitter * Math.random() * 0.8;
    d = Math.max(0.5, d);
    const alpha = b.flow * (b.pressureOpacity ? 0.15 + 0.85 * pressure : 1);
    if (b.id === "splatter") {
      // Gotas dispersas alrededor del punto
      for (let k = 0; k < 6; k++) {
        const r = Math.random() * this.c.size;
        const t = Math.random() * Math.PI * 2;
        const dd = Math.max(1, this.c.size * 0.18 * Math.random());
        this.mg.globalAlpha = 1;
        this.mg.drawImage(roundTip(dd, 1), x + Math.cos(t) * r - dd / 2, y + Math.sin(t) * r - dd / 2);
      }
      return;
    }
    const tip = roundTip(d, b.hardness);
    if (b.mix > 0) {
      this.wetStamp(x, y, d, tip, alpha, index);
      return;
    }
    const target = this.mg;
    if (b.grain > 0) {
      // Punta × grano del papel (anclado al lienzo)
      const s = this.scratch;
      if (s.width !== tip.width || s.height !== tip.height) {
        s.width = tip.width;
        s.height = tip.height;
      }
      const sg = ctx2d(s);
      sg.globalCompositeOperation = "copy";
      sg.drawImage(tip, 0, 0);
      sg.globalCompositeOperation = "destination-in";
      const pattern = sg.createPattern(grainFor(b.grain), "repeat")!;
      const ox = x - tip.width / 2;
      const oy = y - tip.height / 2;
      pattern.setTransform(new DOMMatrix([1, 0, 0, 1, -ox, -oy]));
      sg.fillStyle = pattern;
      sg.fillRect(0, 0, s.width, s.height);
      target.globalAlpha = Math.min(1, alpha);
      target.drawImage(s, ox, oy);
      return;
    }
    target.globalAlpha = Math.min(1, alpha);
    if (b.flat > 0) {
      target.save();
      target.translate(x, y);
      target.rotate(angle + Math.PI / 4);
      target.scale(1, b.flat);
      target.drawImage(tip, -tip.width / 2, -tip.height / 2);
      target.restore();
    } else target.drawImage(tip, x - tip.width / 2, y - tip.height / 2);
  }

  /** Pincel húmedo: arrastra el color de la capa y lo mezcla con el del pincel. */
  private wetStamp(x: number, y: number, d: number, tip: HTMLCanvasElement, alpha: number, index: number) {
    const b = this.c.brush;
    const w = tip.width;
    const ox = Math.round(x - w / 2);
    const oy = Math.round(y - w / 2);
    let carry = this.carry[index];
    if (!carry || carry.width !== w) {
      carry = newCanvas(w, w);
      ctx2d(carry).drawImage(this.c.layer, -ox, -oy);
      this.carry[index] = carry;
    }
    const cg = ctx2d(carry);
    // Recoge un poco del color que hay debajo
    cg.globalAlpha = 0.35;
    cg.globalCompositeOperation = "source-over";
    cg.drawImage(this.c.layer, -ox, -oy);
    // Carga de pintura del pincel (el difuminado no añade color)
    const load = b.id === "smudge" ? 0 : (1 - b.mix) * 0.6;
    if (load > 0) {
      cg.globalAlpha = load;
      cg.fillStyle = this.c.color;
      cg.fillRect(0, 0, w, w);
    }
    // Pinta lo que lleva el pincel, recortado por la punta
    const s = newCanvas(w, w);
    const sg = ctx2d(s);
    sg.drawImage(carry, 0, 0);
    sg.globalCompositeOperation = "destination-in";
    sg.drawImage(tip, 0, 0);
    this.lg.globalAlpha = Math.min(1, alpha * this.c.opacity);
    this.lg.drawImage(s, ox, oy);
    void d;
  }

  add(p: StrokePoint) {
    if (!this.last) {
      this.mirrors(p.x, p.y, 0).forEach((m, i) => this.stampAt(m.x, m.y, p.pressure, m.a, i));
      this.last = p;
      return;
    }
    const a = this.last;
    const dist = Math.hypot(p.x - a.x, p.y - a.y);
    if (dist < 0.01) return;
    this.angle = Math.atan2(p.y - a.y, p.x - a.x);
    const spacing = Math.max(0.5, this.c.size * this.c.brush.spacing);
    let t = spacing - this.residue;
    while (t <= dist) {
      const k = t / dist;
      const q = { x: a.x + (p.x - a.x) * k, y: a.y + (p.y - a.y) * k, pressure: a.pressure + (p.pressure - a.pressure) * k };
      this.mirrors(q.x, q.y, this.angle).forEach((m, i) => this.stampAt(m.x, m.y, q.pressure, m.a, i));
      t += spacing;
    }
    this.residue = dist - (t - spacing);
    this.last = p;
  }

  /** Capa con el trazo aplicado (vista previa o resultado final). */
  result(base: HTMLCanvasElement, alphaLock: boolean, final: boolean): HTMLCanvasElement {
    const b = this.c.brush;
    if (b.mix > 0) return this.c.layer;
    const { width: W, height: H } = this.c;
    let mask = this.mask;
    if (final && b.wetEdges) mask = wetEdges(mask);
    const out = newCanvas(W, H);
    const g = ctx2d(out);
    g.drawImage(base, 0, 0);
    if (b.composite === "erase") {
      g.globalAlpha = this.c.opacity;
      g.globalCompositeOperation = "destination-out";
      g.drawImage(mask, 0, 0);
      return out;
    }
    const paint = newCanvas(W, H);
    const pg = ctx2d(paint);
    pg.drawImage(mask, 0, 0);
    pg.globalCompositeOperation = "source-in";
    pg.fillStyle = this.c.color;
    pg.fillRect(0, 0, W, H);
    g.globalAlpha = this.c.opacity;
    g.globalCompositeOperation = alphaLock ? "source-atop" : b.composite === "multiply" ? "multiply" : "source-over";
    g.drawImage(paint, 0, 0);
    if (b.composite === "multiply" && !alphaLock) {
      // multiply no deja color sobre zonas transparentes: se completa debajo
      g.globalCompositeOperation = "destination-over";
      g.drawImage(paint, 0, 0);
    }
    return out;
  }
}

/** Bordes húmedos: el pigmento se acumula en el contorno al secarse. */
function wetEdges(mask: HTMLCanvasElement): HTMLCanvasElement {
  const W = mask.width;
  const H = mask.height;
  const blur = newCanvas(W, H);
  const bg = ctx2d(blur);
  bg.filter = "blur(4px)";
  bg.drawImage(mask, 0, 0);
  const a = ctx2d(mask).getImageData(0, 0, W, H);
  const bl = bg.getImageData(0, 0, W, H).data;
  const d = a.data;
  for (let i = 3; i < d.length; i += 4) {
    if (!d[i]) continue;
    const edge = Math.max(0, d[i] - bl[i]);
    d[i] = Math.min(255, d[i] * 0.85 + edge * 2.2);
  }
  const out = newCanvas(W, H);
  const og = ctx2d(out);
  og.putImageData(a, 0, 0);
  // Ligero desenfoque: la acuarela no tiene bordes duros
  const soft = newCanvas(W, H);
  const sg = ctx2d(soft);
  sg.filter = "blur(0.8px)";
  sg.drawImage(out, 0, 0);
  return soft;
}

/** Estabilizador: el punto sigue al puntero con retardo. */
export class Stabilizer {
  private p: StrokePoint | null = null;
  constructor(private amount: number) {}
  next(q: StrokePoint): StrokePoint {
    if (!this.p) {
      this.p = q;
      return q;
    }
    const k = 1 - Math.min(0.95, this.amount);
    this.p = { x: this.p.x + (q.x - this.p.x) * k, y: this.p.y + (q.y - this.p.y) * k, pressure: this.p.pressure + (q.pressure - this.p.pressure) * k };
    return this.p;
  }
}

/** Relleno por color (cubo) con tolerancia. */
export function floodMask(src: HTMLCanvasElement, x: number, y: number, tolerance: number): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const img = ctx2d(src).getImageData(0, 0, w, h);
  const d = img.data;
  const out = new ImageData(w, h);
  const o = out.data;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return newCanvas(w, h);
  const si = (y * w + x) * 4;
  const r0 = d[si],
    g0 = d[si + 1],
    b0 = d[si + 2],
    a0 = d[si + 3];
  const seen = new Uint8Array(w * h);
  const stack = [y * w + x];
  seen[y * w + x] = 1;
  const match = (i: number) => Math.abs(d[i] - r0) <= tolerance && Math.abs(d[i + 1] - g0) <= tolerance && Math.abs(d[i + 2] - b0) <= tolerance && Math.abs(d[i + 3] - a0) <= tolerance;
  while (stack.length) {
    const p = stack.pop()!;
    o[p * 4] = o[p * 4 + 1] = o[p * 4 + 2] = 255;
    o[p * 4 + 3] = 255;
    const px = p % w;
    const py = (p / w) | 0;
    for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]) {
      if (q >= 0 && !seen[q] && match(q * 4)) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  const c = newCanvas(w, h);
  const g = ctx2d(c);
  g.putImageData(out, 0, 0);
  // Se expande un píxel para cubrir el borde antialias de las líneas
  const grow = newCanvas(w, h);
  const gg = ctx2d(grow);
  gg.filter = "blur(1px)";
  gg.drawImage(c, 0, 0);
  gg.filter = "none";
  gg.drawImage(c, 0, 0);
  return grow;
}
