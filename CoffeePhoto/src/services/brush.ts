// Motor de pinceles: cada trazo acumula una máscara (alfa) estampando la
// punta del pincel a lo largo del recorrido. Según la herramienta, la máscara
// pinta un color, borra, o descubre una versión procesada de la capa
// (tampón de clonar, sobreexponer, subexponer, desenfocar).

import type { BrushSettings } from "../types";
import { ctx2d, newCanvas } from "./pixels";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

const tipCache = new Map<string, HTMLCanvasElement>();

/** Punta redonda blanca con la dureza indicada (0-100). */
export function brushTip(size: number, hardness: number, hard = false): HTMLCanvasElement {
  const d = Math.max(1, Math.round(size));
  const key = `${d}:${Math.round(hardness)}:${hard}`;
  const cached = tipCache.get(key);
  if (cached) return cached;
  const c = newCanvas(d + 2, d + 2);
  const g = ctx2d(c);
  const r = d / 2;
  const cx = c.width / 2;
  if (hard) {
    g.fillStyle = "#fff";
    if (d <= 2) g.fillRect(cx - r, cx - r, d, d);
    else {
      g.beginPath();
      g.arc(cx, cx, r, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    const grad = g.createRadialGradient(cx, cx, 0, cx, cx, r);
    const h = Math.min(0.99, Math.max(0, hardness / 100));
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(h, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cx, r, 0, Math.PI * 2);
    g.fill();
  }
  if (tipCache.size > 64) tipCache.clear();
  tipCache.set(key, c);
  return c;
}

export class Stroke {
  readonly mask: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private last: StrokePoint | null = null;
  private residue = 0;

  constructor(
    width: number,
    height: number,
    private settings: BrushSettings,
    private hard = false
  ) {
    this.mask = newCanvas(width, height);
    this.g = ctx2d(this.mask);
  }

  private stamp(p: StrokePoint) {
    const s = this.settings;
    const size = Math.max(1, s.pressure ? s.size * (0.2 + 0.8 * p.pressure) : s.size);
    const tip = brushTip(size, s.hardness, this.hard);
    this.g.globalAlpha = Math.max(0.01, s.flow / 100);
    this.g.drawImage(tip, p.x - tip.width / 2, p.y - tip.height / 2);
  }

  add(p: StrokePoint) {
    if (!this.last) {
      this.stamp(p);
      this.last = p;
      return;
    }
    const a = this.last;
    const dist = Math.hypot(p.x - a.x, p.y - a.y);
    const spacing = Math.max(0.5, this.settings.size * (this.hard ? 0.08 : 0.12));
    let t = spacing - this.residue;
    while (t <= dist) {
      const k = t / dist;
      this.stamp({ x: a.x + (p.x - a.x) * k, y: a.y + (p.y - a.y) * k, pressure: a.pressure + (p.pressure - a.pressure) * k });
      t += spacing;
    }
    this.residue = dist - (t - spacing);
    this.last = p;
  }
}

/** Resultado de aplicar la máscara del trazo sobre la capa. */
export function applyStroke(
  base: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  mode: { kind: "paint"; color: string } | { kind: "erase" } | { kind: "reveal"; source: HTMLCanvasElement },
  opacity: number,
  selection: HTMLCanvasElement | null
): HTMLCanvasElement {
  const w = base.width;
  const h = base.height;
  let m = mask;
  if (selection) {
    m = newCanvas(w, h);
    const mg = ctx2d(m);
    mg.drawImage(mask, 0, 0);
    mg.globalCompositeOperation = "destination-in";
    mg.drawImage(selection, 0, 0);
  }
  const out = newCanvas(w, h);
  const g = ctx2d(out);
  g.drawImage(base, 0, 0);
  if (mode.kind === "erase") {
    g.globalAlpha = opacity;
    g.globalCompositeOperation = "destination-out";
    g.drawImage(m, 0, 0);
    return out;
  }
  const paint = newCanvas(w, h);
  const pg = ctx2d(paint);
  if (mode.kind === "paint") {
    pg.drawImage(m, 0, 0);
    pg.globalCompositeOperation = "source-in";
    pg.fillStyle = mode.color;
    pg.fillRect(0, 0, w, h);
  } else {
    pg.drawImage(mode.source, 0, 0);
    pg.globalCompositeOperation = "destination-in";
    pg.drawImage(m, 0, 0);
    // Lo descubierto sustituye a la capa: base · (1 − m) + origen · m
    g.globalAlpha = opacity;
    g.globalCompositeOperation = "destination-out";
    g.drawImage(m, 0, 0);
    g.globalCompositeOperation = "lighter";
    g.drawImage(paint, 0, 0);
    return out;
  }
  g.globalAlpha = opacity;
  g.globalCompositeOperation = "source-over";
  g.drawImage(paint, 0, 0);
  return out;
}

/** Versión procesada de la capa para las herramientas de retoque. */
export function toneSource(src: HTMLCanvasElement, kind: "dodge" | "burn", range: "shadows" | "midtones" | "highlights", strength: number): HTMLCanvasElement {
  const img = ctx2d(src).getImageData(0, 0, src.width, src.height);
  const d = img.data;
  const k = strength / 100;
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const wgt = range === "shadows" ? 1 - l : range === "highlights" ? l : 1 - Math.abs(l - 0.5) * 2;
    const f = kind === "dodge" ? 1 + 0.6 * k * wgt : 1 - 0.5 * k * wgt;
    d[i] = Math.min(255, d[i] * f);
    d[i + 1] = Math.min(255, d[i + 1] * f);
    d[i + 2] = Math.min(255, d[i + 2] * f);
  }
  const c = newCanvas(src.width, src.height);
  ctx2d(c).putImageData(img, 0, 0);
  return c;
}

/** Copia desplazada (tampón de clonar). */
export function shiftedSource(src: HTMLCanvasElement, dx: number, dy: number): HTMLCanvasElement {
  const c = newCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, dx, dy);
  return c;
}

/** Relleno de degradado lineal o radial. */
export function gradientFill(
  w: number,
  h: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  type: "linear" | "radial",
  c0: string,
  c1: string
): HTMLCanvasElement {
  const c = newCanvas(w, h);
  const g = ctx2d(c);
  const grad = type === "linear" ? g.createLinearGradient(from.x, from.y, to.x, to.y) : g.createRadialGradient(from.x, from.y, 0, from.x, from.y, Math.hypot(to.x - from.x, to.y - from.y) || 1);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  return c;
}
