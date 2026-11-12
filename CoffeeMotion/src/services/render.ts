// Motor de render de CoffeeMotion: dibuja una composición en un instante en
// un lienzo (vista previa y exportación usan el mismo código).

import type { Asset, BlendMode, Comp, Effect, Layer, Mask, PathPoint, Project, Prop, ShapeData, TextData, Vec } from "../types";
import { propValue, type ExprContext } from "./anim";

// ---------------------------------------------------------------------------
// Recursos (imágenes y videos)
// ---------------------------------------------------------------------------

export class MediaCache {
  images = new Map<string, HTMLImageElement>();
  videos = new Map<string, HTMLVideoElement>();
  private loading = new Map<string, Promise<void>>();
  onReady: (() => void) | null = null;

  sync(assets: Asset[]) {
    for (const a of assets) {
      if (this.loading.has(a.id)) continue;
      if (a.kind === "image") {
        const img = new Image();
        this.loading.set(
          a.id,
          new Promise((r) => {
            img.onload = () => {
              this.images.set(a.id, img);
              this.onReady?.();
              r();
            };
            img.onerror = () => r();
          })
        );
        img.src = a.data;
      } else if (a.kind === "video") {
        this.loading.set(
          a.id,
          (async () => {
            const blob = await (await fetch(a.data)).blob();
            const v = document.createElement("video");
            v.muted = true;
            v.playsInline = true;
            v.preload = "auto";
            v.src = URL.createObjectURL(blob);
            await new Promise<void>((r) => {
              v.onloadeddata = () => r();
              v.onerror = () => r();
            });
            this.videos.set(a.id, v);
            this.onReady?.();
          })()
        );
      }
    }
  }

  async ready() {
    await Promise.all(this.loading.values());
  }
}

export interface RenderEnv {
  project: Project;
  media: MediaCache;
  /** Calidad de vista previa: 1 = completa. */
  scale: number;
  /** Desactiva el desenfoque de movimiento (vista previa rápida). */
  draft?: boolean;
}

// ---------------------------------------------------------------------------
// Lienzos de trabajo reutilizables
// ---------------------------------------------------------------------------

const pool: HTMLCanvasElement[] = [];
function acquire(w: number, h: number): HTMLCanvasElement {
  const c = pool.pop() || document.createElement("canvas");
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  } else c.getContext("2d")!.clearRect(0, 0, w, h);
  const g = c.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  return c;
}
const release = (...cs: HTMLCanvasElement[]) => {
  for (const c of cs) if (pool.length < 24) pool.push(c);
};

// ---------------------------------------------------------------------------
// Transformaciones
// ---------------------------------------------------------------------------

const ctxFor = (comp: Comp, layer: Layer, prop: string, index: number): ExprContext => ({ seed: `${layer.id}.${prop}`, index, comp: { width: comp.width, height: comp.height, duration: comp.duration, fps: comp.fps } });

export function val<T>(comp: Comp, layer: Layer, prop: string, p: Prop<T>, t: number): T {
  return propValue(p, t, ctxFor(comp, layer, prop, comp.layers.indexOf(layer) + 1));
}

/** Matriz local de la capa (sin padres). */
export function localMatrix(comp: Comp, l: Layer, t: number): DOMMatrix {
  const tr = l.transform;
  const [ax, ay] = val(comp, l, "anchor", tr.anchor, t);
  const [px, py] = val(comp, l, "position", tr.position, t);
  const [sx, sy] = val(comp, l, "scale", tr.scale, t);
  const r = val(comp, l, "rotation", tr.rotation, t);
  return new DOMMatrix().translate(px, py).rotate(r).scale(sx / 100, sy / 100).translate(-ax, -ay);
}

/** Matriz completa (con la cadena de padres) en coordenadas de la composición. */
export function layerMatrix(comp: Comp, l: Layer, t: number, depth = 0): DOMMatrix {
  const m = localMatrix(comp, l, t);
  if (l.parent && depth < 20) {
    const p = comp.layers.find((x) => x.id === l.parent);
    if (p) return layerMatrix(comp, p, t, depth + 1).multiply(m);
  }
  return m;
}

export const isActive = (l: Layer, t: number) => t >= l.inPoint - 1e-6 && t < l.outPoint - 1e-6;

/** Tiempo del contenido (video/precomp) a partir del tiempo de la comp. */
export const contentTime = (l: Layer, t: number) => (t - l.startTime) * ((l.timeStretch || 100) / 100);

// ---------------------------------------------------------------------------
// Formas
// ---------------------------------------------------------------------------

/** Polilínea de la forma (en coordenadas de la capa). */
export function shapePolyline(comp: Comp, l: Layer, s: ShapeData, t: number): Vec[] {
  const [w, h] = val(comp, l, "size", s.size, t);
  const out: Vec[] = [];
  if (s.kind === "rect") {
    const r = Math.min(val(comp, l, "roundness", s.roundness, t), w / 2, h / 2);
    const x0 = -w / 2;
    const y0 = -h / 2;
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    if (r <= 0.01) out.push([x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]);
    else {
      corner(x0 + w - r, y0 + r, -Math.PI / 2);
      corner(x0 + w - r, y0 + h - r, 0);
      corner(x0 + r, y0 + h - r, Math.PI / 2);
      corner(x0 + r, y0 + r, Math.PI);
    }
    // Empieza arriba a la izquierda, como el trazado de un rectángulo
    if (r > 0.01) out.unshift(out.pop()!);
  } else if (s.kind === "ellipse") {
    const n = 96;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      out.push([(Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2]);
    }
  } else if (s.kind === "star" || s.kind === "polygon") {
    const n = Math.max(3, Math.round(s.points));
    const steps = s.kind === "star" ? n * 2 : n;
    for (let i = 0; i < steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
      const k = s.kind === "star" && i % 2 ? s.innerRatio : 1;
      out.push([((Math.cos(a) * w) / 2) * k, ((Math.sin(a) * h) / 2) * k]);
    }
  } else {
    const pts = s.path;
    const seg = (a: PathPoint, b: PathPoint) => {
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        const p0: Vec = [a.x, a.y];
        const p1: Vec = [a.x + a.ox, a.y + a.oy];
        const p2: Vec = [b.x + b.ix, b.y + b.iy];
        const p3: Vec = [b.x, b.y];
        const m = 1 - u;
        if (i || !out.length) out.push([m * m * m * p0[0] + 3 * m * m * u * p1[0] + 3 * m * u * u * p2[0] + u * u * u * p3[0], m * m * m * p0[1] + 3 * m * m * u * p1[1] + 3 * m * u * u * p2[1] + u * u * u * p3[1]]);
      }
    };
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1]);
    if (s.closed && pts.length > 2) seg(pts[pts.length - 1], pts[0]);
    if (pts.length === 1) out.push([pts[0].x, pts[0].y]);
  }
  return out;
}

/** Recorta la polilínea entre dos porcentajes de su longitud. */
function trimPolyline(pts: Vec[], closed: boolean, a: number, b: number): Vec[] {
  const ring = closed ? [...pts, pts[0]] : pts;
  const lens = [0];
  for (let i = 1; i < ring.length; i++) lens.push(lens[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
  const total = lens[lens.length - 1];
  const from = (Math.min(a, b) / 100) * total;
  const to = (Math.max(a, b) / 100) * total;
  const at = (d: number): Vec => {
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const u = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
    return [ring[i - 1][0] + (ring[i][0] - ring[i - 1][0]) * u, ring[i - 1][1] + (ring[i][1] - ring[i - 1][1]) * u];
  };
  const out: Vec[] = [at(from)];
  for (let i = 1; i < ring.length; i++) if (lens[i] > from && lens[i] < to) out.push(ring[i]);
  out.push(at(to));
  return out;
}

function drawShape(g: CanvasRenderingContext2D, comp: Comp, l: Layer, s: ShapeData, t: number) {
  const pts = shapePolyline(comp, l, s, t);
  if (pts.length < 2) return;
  const ts = val(comp, l, "trimStart", s.trimStart, t);
  const te = val(comp, l, "trimEnd", s.trimEnd, t);
  const trimmed = ts > 0.01 || te < 99.99;
  if (trimmed && Math.abs(te - ts) < 0.01) return;
  const line = trimmed ? trimPolyline(pts, s.closed || s.kind !== "path", ts, te) : pts;
  const closed = !trimmed && (s.closed || s.kind !== "path");
  const path = new Path2D();
  path.moveTo(line[0][0], line[0][1]);
  for (let i = 1; i < line.length; i++) path.lineTo(line[i][0], line[i][1]);
  if (closed) path.closePath();
  if (s.fillOn) {
    const [w, h] = val(comp, l, "size", s.size, t);
    const fill = val(comp, l, "fill", s.fill, t);
    if (s.gradient.on) {
      const a = (s.gradient.angle * Math.PI) / 180;
      const span = s.kind === "path" ? 300 : Math.max(w, h) / 2;
      const gr = s.gradient.radial ? g.createRadialGradient(0, 0, 0, 0, 0, span) : g.createLinearGradient(-Math.cos(a) * span, -Math.sin(a) * span, Math.cos(a) * span, Math.sin(a) * span);
      gr.addColorStop(0, fill);
      gr.addColorStop(1, s.gradient.to);
      g.fillStyle = gr;
    } else g.fillStyle = fill;
    g.fill(path);
  }
  if (s.strokeOn) {
    g.strokeStyle = val(comp, l, "stroke", s.stroke, t);
    g.lineWidth = val(comp, l, "strokeWidth", s.strokeWidth, t);
    g.lineJoin = "round";
    g.lineCap = "round";
    g.setLineDash(s.dash > 0 ? [s.dash, s.dash] : []);
    g.stroke(path);
    g.setLineDash([]);
  }
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

const measureCanvas = document.createElement("canvas").getContext("2d")!;

export const fontOf = (d: TextData, size: number) => `${d.italic ? "italic " : ""}${d.weight} ${size}px "${d.font}", "Hanken Grotesk", sans-serif`;

export interface TextLayout {
  lines: { chars: { ch: string; x: number }[]; width: number; y: number }[];
  width: number;
  height: number;
  size: number;
}

export function layoutText(comp: Comp, l: Layer, d: TextData, t: number): TextLayout {
  const size = Math.max(1, val(comp, l, "size", d.size, t));
  const tracking = val(comp, l, "tracking", d.tracking, t);
  const text = String(val(comp, l, "text", d.text, t));
  measureCanvas.font = fontOf(d, size);
  const lh = size * d.lineHeight;
  const raw = text.split("\n");
  const lines = raw.map((line, i) => {
    let x = 0;
    const chars = [...line].map((ch) => {
      const c = { ch, x };
      x += measureCanvas.measureText(ch).width + (tracking * size) / 1000;
      return c;
    });
    return { chars, width: Math.max(0, x - (line.length ? (tracking * size) / 1000 : 0)), y: i * lh };
  });
  const width = Math.max(1, ...lines.map((ln) => ln.width));
  const height = lh * lines.length;
  // Centrado vertical en el origen; horizontal según la alineación
  for (const ln of lines) {
    const dx = d.align === "center" ? -ln.width / 2 : d.align === "right" ? -ln.width : 0;
    ln.chars.forEach((c) => (c.x += dx));
    ln.y = ln.y - height / 2 + size * 0.8;
  }
  return { lines, width, height, size };
}

function drawText(g: CanvasRenderingContext2D, comp: Comp, l: Layer, d: TextData, t: number) {
  const lay = layoutText(comp, l, d, t);
  const color = val(comp, l, "color", d.color, t);
  const progress = val(comp, l, "progress", d.progress, t) / 100;
  g.font = fontOf(d, lay.size);
  g.textBaseline = "alphabetic";
  const total = lay.lines.reduce((n, ln) => n + ln.chars.length, 0) || 1;
  let idx = 0;
  for (const ln of lay.lines)
    for (const c of ln.chars) {
      const i = idx++;
      if (c.ch === " ") continue;
      // Avance de cada letra según el animador (con solape suave)
      const spread = 3 / total;
      const local = d.animator === "none" ? 1 : Math.max(0, Math.min(1, (progress * (1 + spread) - i / total) / spread));
      let alpha = 1;
      let dy = 0;
      let sc = 1;
      let blur = 0;
      switch (d.animator) {
        case "typewriter":
          alpha = i / total < progress ? 1 : 0;
          break;
        case "fadeChars":
          alpha = local;
          break;
        case "slideChars":
          alpha = local;
          dy = (1 - easeOut(local)) * lay.size * 0.6;
          break;
        case "scaleChars":
          sc = easeOut(local);
          alpha = Math.min(1, local * 2);
          break;
        case "blurChars":
          alpha = local;
          blur = (1 - local) * lay.size * 0.15;
          break;
        case "wave":
          dy = Math.sin(t * 5 - i * 0.5) * lay.size * 0.12;
          break;
      }
      if (alpha <= 0.001 || sc <= 0.001) continue;
      g.save();
      g.globalAlpha *= alpha;
      if (blur > 0.3) g.filter = `blur(${blur}px)`;
      const w = measureCanvas.measureText(c.ch).width;
      g.translate(c.x + w / 2, ln.y + dy - lay.size * 0.35);
      g.scale(sc, sc);
      g.translate(-w / 2, lay.size * 0.35);
      if (d.strokeWidth > 0) {
        g.lineWidth = d.strokeWidth * 2;
        g.strokeStyle = d.stroke;
        g.lineJoin = "round";
        g.strokeText(c.ch, 0, 0);
      }
      g.fillStyle = color;
      g.fillText(c.ch, 0, 0);
      g.restore();
    }
}

const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

// ---------------------------------------------------------------------------
// Límites (para seleccionar y dibujar el cuadro de la capa)
// ---------------------------------------------------------------------------

export function layerBounds(env: RenderEnv, comp: Comp, l: Layer, t: number): { x: number; y: number; w: number; h: number } | null {
  switch (l.type) {
    case "solid":
    case "adjustment":
      return { x: 0, y: 0, w: comp.width, h: comp.height };
    case "shape": {
      const pts = shapePolyline(comp, l, l.shape!, t);
      if (!pts.length) return null;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const pad = l.shape!.strokeOn ? val(comp, l, "strokeWidth", l.shape!.strokeWidth, t) / 2 : 0;
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }
    case "text": {
      const lay = layoutText(comp, l, l.text!, t);
      const x0 = l.text!.align === "center" ? -lay.width / 2 : l.text!.align === "right" ? -lay.width : 0;
      return { x: x0, y: -lay.height / 2, w: lay.width, h: lay.height };
    }
    case "image":
    case "video": {
      const a = env.project.assets.find((x) => x.id === l.assetId);
      return a ? { x: 0, y: 0, w: a.width, h: a.height } : null;
    }
    case "precomp": {
      const c = env.project.comps.find((x) => x.id === l.compId);
      return c ? { x: 0, y: 0, w: c.width, h: c.height } : null;
    }
    case "null":
      return { x: -20, y: -20, w: 40, h: 40 };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Efectos
// ---------------------------------------------------------------------------

const num = (comp: Comp, l: Layer, fx: Effect, key: string, t: number) => Number(val(comp, l, `fx.${fx.id}.${key}`, fx.params[key] as Prop<number>, t));
const col = (comp: Comp, l: Layer, fx: Effect, key: string, t: number) => String(val(comp, l, `fx.${fx.id}.${key}`, fx.params[key] as Prop<string>, t));

/** Silueta de `src` rellena de un color. */
function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = acquire(src.width, src.height);
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

let noiseSeed = 1;
function applyEffect(src: HTMLCanvasElement, comp: Comp, l: Layer, fx: Effect, t: number, k: number): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const out = acquire(W, H);
  const g = out.getContext("2d")!;
  switch (fx.kind) {
    case "blur": {
      g.filter = `blur(${num(comp, l, fx, "amount", t) * k}px)`;
      g.drawImage(src, 0, 0);
      break;
    }
    case "directionalBlur": {
      const a = (num(comp, l, fx, "angle", t) * Math.PI) / 180;
      const len = num(comp, l, fx, "length", t) * k;
      const n = Math.max(2, Math.min(24, Math.round(len / 3)));
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) - 0.5;
        g.globalAlpha = 1 / (i + 1);
        g.drawImage(src, Math.cos(a) * len * u, Math.sin(a) * len * u);
      }
      break;
    }
    case "glow": {
      const s = silhouette(src, col(comp, l, fx, "color", t));
      const intensity = num(comp, l, fx, "intensity", t) / 100;
      g.filter = `blur(${num(comp, l, fx, "radius", t) * k}px)`;
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < Math.ceil(intensity); i++) {
        g.globalAlpha = Math.min(1, intensity - i);
        g.drawImage(s, 0, 0);
      }
      g.filter = "none";
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.drawImage(src, 0, 0);
      release(s);
      break;
    }
    case "shadow": {
      const a = (num(comp, l, fx, "angle", t) * Math.PI) / 180;
      const d = num(comp, l, fx, "distance", t) * k;
      const s = silhouette(src, col(comp, l, fx, "color", t));
      g.filter = `blur(${num(comp, l, fx, "softness", t) * k * 0.5}px)`;
      g.globalAlpha = num(comp, l, fx, "opacity", t) / 100;
      g.drawImage(s, Math.cos(a) * d, Math.sin(a) * d);
      g.filter = "none";
      g.globalAlpha = 1;
      g.drawImage(src, 0, 0);
      release(s);
      break;
    }
    case "stroke": {
      const w = num(comp, l, fx, "width", t) * k;
      const s = silhouette(src, col(comp, l, fx, "color", t));
      const n = 16;
      for (let i = 0; i < n; i++) g.drawImage(s, Math.cos((i / n) * Math.PI * 2) * w, Math.sin((i / n) * Math.PI * 2) * w);
      g.drawImage(src, 0, 0);
      release(s);
      break;
    }
    case "brightness": {
      const b = num(comp, l, fx, "brightness", t);
      const c = num(comp, l, fx, "contrast", t);
      g.filter = `brightness(${1 + b / 100}) contrast(${1 + c / 100})`;
      g.drawImage(src, 0, 0);
      break;
    }
    case "hueSat": {
      g.filter = `hue-rotate(${num(comp, l, fx, "hue", t)}deg) saturate(${1 + num(comp, l, fx, "saturation", t) / 100})`;
      g.drawImage(src, 0, 0);
      break;
    }
    case "tint": {
      const amount = num(comp, l, fx, "amount", t) / 100;
      const tinted = acquire(W, H);
      const tg = tinted.getContext("2d")!;
      tg.filter = "grayscale(1)";
      tg.drawImage(src, 0, 0);
      tg.filter = "none";
      tg.globalCompositeOperation = "multiply";
      tg.fillStyle = col(comp, l, fx, "color", t);
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = "destination-in";
      tg.drawImage(src, 0, 0);
      g.drawImage(src, 0, 0);
      g.globalAlpha = amount;
      g.drawImage(tinted, 0, 0);
      release(tinted);
      break;
    }
    case "fill": {
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = "source-atop";
      g.globalAlpha = num(comp, l, fx, "opacity", t) / 100;
      g.fillStyle = col(comp, l, fx, "color", t);
      g.fillRect(0, 0, W, H);
      break;
    }
    case "invert": {
      g.filter = `invert(${num(comp, l, fx, "amount", t) / 100})`;
      g.drawImage(src, 0, 0);
      break;
    }
    case "noise": {
      g.drawImage(src, 0, 0);
      const amount = num(comp, l, fx, "amount", t) / 100;
      const nw = Math.max(1, Math.ceil(W / 2));
      const nh = Math.max(1, Math.ceil(H / 2));
      const n = acquire(nw, nh);
      const ng = n.getContext("2d")!;
      const img = ng.createImageData(nw, nh);
      let s = (Math.floor(t * comp.fps) * 7919 + noiseSeed) >>> 0;
      for (let i = 0; i < img.data.length; i += 4) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const v = s >>> 24;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ng.putImageData(img, 0, 0);
      g.globalCompositeOperation = "overlay";
      g.globalAlpha = amount;
      g.drawImage(n, 0, 0, W, H);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "destination-in";
      g.drawImage(src, 0, 0);
      release(n);
      noiseSeed++;
      break;
    }
    case "vignette": {
      g.drawImage(src, 0, 0);
      const amount = num(comp, l, fx, "amount", t) / 100;
      const size = num(comp, l, fx, "size", t) / 100;
      const r = Math.hypot(W, H) / 2;
      const gr = g.createRadialGradient(W / 2, H / 2, r * size * 0.5, W / 2, H / 2, r * Math.max(0.2, size));
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, `rgba(0,0,0,${amount})`);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      break;
    }
    case "mosaic": {
      const cell = Math.max(2, num(comp, l, fx, "cells", t) * k);
      const sw = Math.max(1, Math.round(W / cell));
      const sh = Math.max(1, Math.round(H / cell));
      const small = acquire(sw, sh);
      small.getContext("2d")!.drawImage(src, 0, 0, sw, sh);
      g.imageSmoothingEnabled = false;
      g.drawImage(small, 0, 0, W, H);
      g.imageSmoothingEnabled = true;
      release(small);
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Máscaras
// ---------------------------------------------------------------------------

function maskPath(comp: Comp, l: Layer, m: Mask, t: number): Path2D {
  const p = new Path2D();
  if (m.kind === "path") {
    const pts = m.path;
    if (!pts.length) return p;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i % pts.length];
      p.bezierCurveTo(a.x + a.ox, a.y + a.oy, b.x + b.ix, b.y + b.iy, b.x, b.y);
    }
    p.closePath();
    return p;
  }
  const [x, y, w, h] = val(comp, l, `mask.${m.id}.rect`, m.rect, t);
  const e = val(comp, l, `mask.${m.id}.exp`, m.expansion, t);
  if (m.kind === "rect") p.rect(x - e, y - e, w + e * 2, h + e * 2);
  else p.ellipse(x + w / 2, y + h / 2, Math.max(0.1, w / 2 + e), Math.max(0.1, h / 2 + e), 0, 0, Math.PI * 2);
  return p;
}

function applyMasks(src: HTMLCanvasElement, comp: Comp, l: Layer, t: number, m: DOMMatrix, k: number) {
  const W = src.width;
  const H = src.height;
  const mask = acquire(W, H);
  const g = mask.getContext("2d")!;
  l.masks.forEach((mk, i) => {
    const one = acquire(W, H);
    const og = one.getContext("2d")!;
    og.setTransform(m);
    og.fillStyle = "#fff";
    og.globalAlpha = val(comp, l, `mask.${mk.id}.op`, mk.opacity, t) / 100;
    if (mk.inverted) {
      og.save();
      og.setTransform(1, 0, 0, 1, 0, 0);
      og.fillRect(0, 0, W, H);
      og.restore();
      og.globalCompositeOperation = "destination-out";
      og.globalAlpha = 1;
    }
    og.fill(maskPath(comp, l, mk, t));
    const feather = val(comp, l, `mask.${mk.id}.feather`, mk.feather, t) * k;
    g.filter = feather > 0.3 ? `blur(${feather / 2}px)` : "none";
    g.globalCompositeOperation = i === 0 && mk.mode !== "subtract" ? "source-over" : mk.mode === "add" ? "source-over" : mk.mode === "subtract" ? "destination-out" : "destination-in";
    if (i === 0 && mk.mode === "subtract") {
      g.fillStyle = "#fff";
      g.filter = "none";
      g.fillRect(0, 0, W, H);
      g.filter = feather > 0.3 ? `blur(${feather / 2}px)` : "none";
      g.globalCompositeOperation = "destination-out";
    }
    g.drawImage(one, 0, 0);
    release(one);
  });
  const sg = src.getContext("2d")!;
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.globalCompositeOperation = "destination-in";
  sg.drawImage(mask, 0, 0);
  sg.globalCompositeOperation = "source-over";
  release(mask);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const BLEND: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
  add: "lighter",
};

/** Busca videos (también dentro de composiciones anidadas) y los coloca en su fotograma. */
export async function seekMedia(env: RenderEnv, comp: Comp, t: number, depth = 0): Promise<void> {
  if (depth > 8) return;
  const waits: Promise<void>[] = [];
  for (const l of comp.layers) {
    if (!isActive(l, t) || !l.visible) continue;
    if (l.type === "video" && l.assetId) {
      const v = env.media.videos.get(l.assetId);
      if (!v) continue;
      const target = Math.max(0, Math.min(v.duration - 0.001, contentTime(l, t)));
      if (Math.abs(v.currentTime - target) > 0.5 / comp.fps)
        waits.push(
          new Promise((r) => {
            const done = () => {
              v.removeEventListener("seeked", done);
              r();
            };
            v.addEventListener("seeked", done);
            v.currentTime = target;
            window.setTimeout(done, 1500);
          })
        );
    } else if (l.type === "precomp" && l.compId) {
      const inner = env.project.comps.find((c) => c.id === l.compId);
      if (inner) waits.push(seekMedia(env, inner, contentTime(l, t), depth + 1));
    }
  }
  await Promise.all(waits);
}

/** Dibuja el contenido de la capa (sin efectos ni máscaras) con la matriz dada. */
function drawContent(env: RenderEnv, comp: Comp, l: Layer, t: number, g: CanvasRenderingContext2D, m: DOMMatrix, depth: number) {
  g.setTransform(m);
  switch (l.type) {
    case "solid":
      g.fillStyle = val(comp, l, "color", l.color!, t);
      g.fillRect(0, 0, comp.width, comp.height);
      break;
    case "shape":
      drawShape(g, comp, l, l.shape!, t);
      break;
    case "text":
      drawText(g, comp, l, l.text!, t);
      break;
    case "image": {
      const img = env.media.images.get(l.assetId || "");
      if (img) g.drawImage(img, 0, 0);
      break;
    }
    case "video": {
      const v = env.media.videos.get(l.assetId || "");
      if (v && v.readyState >= 2) g.drawImage(v, 0, 0);
      break;
    }
    case "precomp": {
      const inner = env.project.comps.find((c) => c.id === l.compId);
      if (!inner || depth > 8) break;
      const k = Math.abs(m.a) + Math.abs(m.b) > 0 ? Math.max(0.1, Math.min(4, Math.hypot(m.a, m.b))) : 1;
      const c = renderComp(env, inner, contentTime(l, t), k, depth + 1, true);
      g.setTransform(m.scale(1 / k, 1 / k));
      g.drawImage(c, 0, 0);
      release(c);
      break;
    }
  }
}

/** Dibuja la capa entera (con desenfoque de movimiento) en un lienzo del tamaño de la comp. */
function renderLayer(env: RenderEnv, comp: Comp, l: Layer, t: number, k: number, W: number, H: number, depth: number): HTMLCanvasElement {
  const base = new DOMMatrix().scale(k, k);
  const samples = !env.draft && comp.motionBlurOn && l.motionBlur ? 7 : 1;
  const shutter = (comp.shutterAngle / 360) / comp.fps;
  let out = acquire(W, H);
  const og = out.getContext("2d")!;
  for (let s = 0; s < samples; s++) {
    const ts = samples > 1 ? t + (s / (samples - 1) - 0.5) * shutter : t;
    const tmp = samples > 1 ? acquire(W, H) : out;
    const g = tmp.getContext("2d")!;
    const m = base.multiply(layerMatrix(comp, l, ts));
    drawContent(env, comp, l, ts, g, m, depth);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (samples > 1) {
      og.globalAlpha = 1 / (s + 1);
      og.drawImage(tmp, 0, 0);
      release(tmp);
    }
  }
  og.globalAlpha = 1;
  // Máscaras
  if (l.masks.length) applyMasks(out, comp, l, t, base.multiply(layerMatrix(comp, l, t)), k);
  // Efectos
  for (const fx of l.effects) {
    if (!fx.enabled) continue;
    const next = applyEffect(out, comp, l, fx, t, k);
    release(out);
    out = next;
  }
  return out;
}

/**
 * Renderiza la composición en el instante `t`. `k` es la escala de salida
 * (1 = tamaño real). Con `transparent` no se pinta el fondo.
 */
export function renderComp(env: RenderEnv, comp: Comp, t: number, k = env.scale, depth = 0, transparent = false): HTMLCanvasElement {
  const W = Math.max(1, Math.round(comp.width * k));
  const H = Math.max(1, Math.round(comp.height * k));
  const out = acquire(W, H);
  const g = out.getContext("2d")!;
  if (!transparent && !/^#[0-9a-f]{6}00$/i.test(comp.background)) {
    g.fillStyle = comp.background;
    g.fillRect(0, 0, W, H);
  }
  const anySolo = comp.layers.some((l) => l.solo);
  const usedAsMatte = new Set<string>();
  comp.layers.forEach((l, i) => {
    if (l.matte !== "none" && i > 0) usedAsMatte.add(comp.layers[i - 1].id);
  });
  for (let i = comp.layers.length - 1; i >= 0; i--) {
    const l = comp.layers[i];
    if (!l.visible || usedAsMatte.has(l.id) || !isActive(l, t) || (anySolo && !l.solo)) continue;
    if (l.type === "audio" || l.type === "null") continue;
    const opacity = Math.max(0, Math.min(100, val(comp, l, "opacity", l.transform.opacity, t))) / 100;
    if (opacity <= 0) continue;
    if (l.type === "adjustment") {
      // Aplica sus efectos a todo lo que hay debajo (limitado por sus máscaras)
      let below = acquire(W, H);
      below.getContext("2d")!.drawImage(out, 0, 0);
      for (const fx of l.effects) {
        if (!fx.enabled) continue;
        const next = applyEffect(below, comp, l, fx, t, k);
        release(below);
        below = next;
      }
      if (l.masks.length) applyMasks(below, comp, l, t, new DOMMatrix().scale(k, k).multiply(layerMatrix(comp, l, t)), k);
      g.globalAlpha = opacity;
      g.drawImage(below, 0, 0);
      g.globalAlpha = 1;
      release(below);
      continue;
    }
    const lc = renderLayer(env, comp, l, t, k, W, H, depth);
    // Mate de seguimiento: la capa de encima recorta a esta
    if (l.matte !== "none" && i > 0) {
      const src = comp.layers[i - 1];
      if (isActive(src, t)) {
        let mc = renderLayer(env, comp, src, t, k, W, H, depth);
        const mOpacity = val(comp, src, "opacity", src.transform.opacity, t) / 100;
        if (l.matte === "luma" || l.matte === "lumaInverted") {
          // Luminancia → alfa
          const mg = mc.getContext("2d")!;
          const img = mg.getImageData(0, 0, W, H);
          const d = img.data;
          for (let p = 0; p < d.length; p += 4) {
            const lum = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
            const a = (d[p + 3] / 255) * lum;
            d[p] = d[p + 1] = d[p + 2] = 255;
            d[p + 3] = Math.round((l.matte === "lumaInverted" ? 1 - a : a) * 255);
          }
          mg.putImageData(img, 0, 0);
        } else if (l.matte === "alphaInverted") {
          const inv = acquire(W, H);
          const ig = inv.getContext("2d")!;
          ig.fillStyle = "#fff";
          ig.fillRect(0, 0, W, H);
          ig.globalCompositeOperation = "destination-out";
          ig.drawImage(mc, 0, 0);
          release(mc);
          mc = inv;
        }
        const lg = lc.getContext("2d")!;
        lg.globalCompositeOperation = "destination-in";
        lg.globalAlpha = mOpacity;
        lg.drawImage(mc, 0, 0);
        lg.globalCompositeOperation = "source-over";
        lg.globalAlpha = 1;
        release(mc);
      } else {
        release(lc);
        continue;
      }
    }
    g.globalCompositeOperation = BLEND[l.blend] || "source-over";
    g.globalAlpha = opacity;
    g.drawImage(lc, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    release(lc);
  }
  return out;
}

/** Copia el resultado a un lienzo propio (los del render se reutilizan). */
export function snapshot(c: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = c.width;
  out.height = c.height;
  out.getContext("2d")!.drawImage(c, 0, 0);
  return out;
}

export { release as releaseCanvas };
