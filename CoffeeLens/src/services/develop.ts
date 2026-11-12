// Motor de revelado de CoffeeLens: aplica los ajustes a una imagen.
//
// Orden: geometría (girar, voltear, recortar, enderezar) → balance de blancos
// → exposición y tonos → curva → color (intensidad, saturación, HSL,
// virado) → claridad/neblina/textura → detalle → viñeta y grano.

import type { Crop, Edits, Preset } from "../types";
import { hslToRgb, rgbToHsl } from "../studio/color";

export const DEFAULT_EDITS: Edits = {
  temp: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  vibrance: 0,
  saturation: 0,
  curve: [0, 0, 255, 255],
  hslHue: [0, 0, 0, 0, 0, 0, 0, 0],
  hslSat: [0, 0, 0, 0, 0, 0, 0, 0],
  hslLum: [0, 0, 0, 0, 0, 0, 0, 0],
  splitShadowHue: 220,
  splitShadowSat: 0,
  splitHighlightHue: 40,
  splitHighlightSat: 0,
  sharpen: 20,
  noise: 0,
  vignette: 0,
  grain: 0,
  bw: false,
  crop: null,
  rotate: 0,
  flip: false,
};

export const HSL_NAMES = ["Rojo", "Naranja", "Amarillo", "Verde", "Aguamarina", "Azul", "Morado", "Magenta"];
export const HSL_COLORS = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#30d5c8", "#007aff", "#8e44ff", "#ff2d92"];
const HSL_CENTERS = [0, 30, 60, 120, 180, 225, 270, 315];

export const isDefault = (e: Edits) => JSON.stringify(e) === JSON.stringify(DEFAULT_EDITS);

export const BUILTIN_PRESETS: Preset[] = [
  { id: "p-auto", name: "Automático suave", group: "Básicos", edits: { exposure: 0.15, contrast: 10, highlights: -25, shadows: 25, whites: 8, blacks: -6, vibrance: 15 } },
  { id: "p-vivid", name: "Vívido", group: "Color", edits: { contrast: 20, vibrance: 35, saturation: 10, clarity: 15, blacks: -10 } },
  { id: "p-warm", name: "Cálido", group: "Color", edits: { temp: 25, tint: 4, vibrance: 10 } },
  { id: "p-cool", name: "Frío", group: "Color", edits: { temp: -22, tint: -3, contrast: 8 } },
  { id: "p-matte", name: "Mate", group: "Creativos", edits: { contrast: -10, curve: [0, 28, 64, 70, 192, 196, 255, 238], saturation: -10, grain: 15 } },
  { id: "p-film", name: "Película antigua", group: "Creativos", edits: { temp: 15, contrast: -8, curve: [0, 20, 128, 132, 255, 240], saturation: -20, splitShadowHue: 200, splitShadowSat: 20, splitHighlightHue: 40, splitHighlightSat: 25, grain: 30, vignette: -25 } },
  { id: "p-teal", name: "Cine (azul y naranja)", group: "Creativos", edits: { contrast: 15, splitShadowHue: 190, splitShadowSat: 35, splitHighlightHue: 32, splitHighlightSat: 30, hslSat: [10, 15, 0, -30, 10, 10, 0, 0], vignette: -15 } },
  { id: "p-portrait", name: "Retrato suave", group: "Retrato", edits: { exposure: 0.1, clarity: -15, texture: -10, highlights: -15, temp: 6, hslLum: [5, 12, 0, 0, 0, 0, 0, 0], hslSat: [-5, -8, 0, 0, 0, 0, 0, 0] } },
  { id: "p-landscape", name: "Paisaje", group: "Paisaje", edits: { dehaze: 15, clarity: 20, vibrance: 25, highlights: -35, shadows: 20, hslSat: [0, 5, 10, 15, 10, 20, 0, 0], hslLum: [0, 0, 0, 0, 0, -10, 0, 0] } },
  { id: "p-night", name: "Noche", group: "Paisaje", edits: { temp: -15, exposure: 0.25, shadows: 35, noise: 35, contrast: 10 } },
  { id: "p-bw", name: "Blanco y negro", group: "Blanco y negro", edits: { bw: true, contrast: 15 } },
  { id: "p-bwhigh", name: "B/N alto contraste", group: "Blanco y negro", edits: { bw: true, contrast: 45, clarity: 25, blacks: -25, whites: 15, grain: 15 } },
  { id: "p-sepia", name: "Sepia", group: "Blanco y negro", edits: { bw: true, splitShadowHue: 30, splitShadowSat: 30, splitHighlightHue: 40, splitHighlightSat: 25, contrast: 5 } },
];

// ---------------------------------------------------------------------------
// Curva de tonos (interpolación monótona)
// ---------------------------------------------------------------------------

export function curveLut(points: number[]): Float32Array {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < points.length; i += 2) pts.push([points[i], points[i + 1]]);
  pts.sort((a, b) => a[0] - b[0]);
  const lut = new Float32Array(256);
  const k = pts.length;
  if (k < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i / 255;
    return lut;
  }
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < k - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0] || 1);
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < k - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[k - 2]);
  for (let x = 0; x < 256; x++) {
    let v: number;
    if (x <= pts[0][0]) v = pts[0][1];
    else if (x >= pts[k - 1][0]) v = pts[k - 1][1];
    else {
      let i = 0;
      while (i < k - 2 && x > pts[i + 1][0]) i++;
      const h = dx[i];
      const u = (x - pts[i][0]) / h;
      v = (2 * u ** 3 - 3 * u ** 2 + 1) * pts[i][1] + (u ** 3 - 2 * u ** 2 + u) * h * t[i] + (-2 * u ** 3 + 3 * u ** 2) * pts[i + 1][1] + (u ** 3 - u ** 2) * h * t[i + 1];
    }
    lut[x] = Math.min(1, Math.max(0, v / 255));
  }
  return lut;
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

/** Imagen girada/volteada (sin recorte). */
export function orient(src: HTMLCanvasElement | HTMLImageElement, e: Edits): HTMLCanvasElement {
  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  const swap = e.rotate === 90 || e.rotate === 270;
  const c = document.createElement("canvas");
  c.width = swap ? h : w;
  c.height = swap ? w : h;
  const g = c.getContext("2d")!;
  g.translate(c.width / 2, c.height / 2);
  g.rotate((e.rotate * Math.PI) / 180);
  if (e.flip) g.scale(-1, 1);
  g.drawImage(src, -w / 2, -h / 2);
  return c;
}

/** Recorta y endereza. `scale` permite trabajar con vistas reducidas. */
export function cropped(src: HTMLCanvasElement, crop: Crop | null): HTMLCanvasElement {
  if (!crop) return src;
  const W = src.width;
  const H = src.height;
  const cw = Math.max(1, Math.round(crop.w * W));
  const ch = Math.max(1, Math.round(crop.h * H));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.translate(cw / 2, ch / 2);
  g.rotate((crop.angle * Math.PI) / 180);
  g.translate(-(crop.x * W + cw / 2), -(crop.y * H + ch / 2));
  g.drawImage(src, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Píxeles
// ---------------------------------------------------------------------------

/** Copia desenfocada (con los bordes repetidos para no oscurecer los lados). */
function blurred(src: HTMLCanvasElement, r: number): Uint8ClampedArray {
  const W = src.width;
  const H = src.height;
  const p = Math.ceil(r * 3) + 1;
  const pad = document.createElement("canvas");
  pad.width = W + p * 2;
  pad.height = H + p * 2;
  const pg = pad.getContext("2d")!;
  pg.drawImage(src, p, p);
  pg.drawImage(src, 0, 0, 1, H, 0, p, p, H);
  pg.drawImage(src, W - 1, 0, 1, H, p + W, p, p, H);
  pg.drawImage(src, 0, 0, W, 1, p, 0, W, p);
  pg.drawImage(src, 0, H - 1, W, 1, p, p + H, W, p);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const og = out.getContext("2d", { willReadFrequently: true })!;
  og.filter = `blur(${r}px)`;
  og.drawImage(pad, -p, -p);
  return og.getImageData(0, 0, W, H).data;
}

const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Aplica los ajustes de color y tono a un lienzo (ya orientado y recortado). */
export function develop(src: HTMLCanvasElement, e: Edits, scale = 1): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d", { willReadFrequently: true })!;
  const img = src.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, W, H);
  const d = img.data;
  const curve = curveLut(e.curve);
  // Ajustes locales: copia desenfocada (claridad, neblina, textura, enfoque)
  const needBlur = e.clarity || e.dehaze || e.texture;
  const big = needBlur ? blurred(src, Math.max(2, 18 * scale)) : null;
  const fine = e.sharpen || e.texture || e.noise ? blurred(src, Math.max(0.6, 1.2 * scale)) : null;
  const wbR = 1 + e.temp / 250 + e.tint / 600;
  const wbG = 1 - e.tint / 300;
  const wbB = 1 - e.temp / 250 + e.tint / 600;
  const expo = Math.pow(2, e.exposure);
  const contrast = e.contrast / 100;
  const hi = e.highlights / 100;
  const sh = e.shadows / 100;
  const wh = e.whites / 100;
  const bl = e.blacks / 100;
  const vib = e.vibrance / 100;
  const sat = e.saturation / 100;
  const hasHsl = e.hslHue.some(Boolean) || e.hslSat.some(Boolean) || e.hslLum.some(Boolean);
  const split = e.splitShadowSat || e.splitHighlightSat;
  const [sR, sG, sB] = hslToRgb(e.splitShadowHue, 1, 0.5);
  const [hR, hG, hB] = hslToRgb(e.splitHighlightHue, 1, 0.5);
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r = d[i] / 255;
      let gg = d[i + 1] / 255;
      let b = d[i + 2] / 255;
      // Detalle (sobre el original): enfoque y reducción de ruido
      if (fine) {
        const fr = fine[i] / 255;
        const fg = fine[i + 1] / 255;
        const fb = fine[i + 2] / 255;
        if (e.noise) {
          const k = (e.noise / 100) * 0.8;
          r += (fr - r) * k;
          gg += (fg - gg) * k;
          b += (fb - b) * k;
        }
        const s = (e.sharpen / 100) * 1.4 + (e.texture / 100) * 0.8;
        if (s) {
          r += (r - fr) * s;
          gg += (gg - fg) * s;
          b += (b - fb) * s;
        }
      }
      // Balance de blancos y exposición
      r *= wbR * expo;
      gg *= wbG * expo;
      b *= wbB * expo;
      let l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      // Claridad y neblina (contraste local respecto al entorno desenfocado)
      if (big) {
        const bL = (0.2126 * big[i] + 0.7152 * big[i + 1] + 0.0722 * big[i + 2]) / 255;
        const local = (l - bL) * ((e.clarity / 100) * 1.2 + (e.dehaze / 100) * 0.6);
        const f = l > 0.001 ? (l + local) / l : 1;
        r *= f;
        gg *= f;
        b *= f;
        if (e.dehaze) {
          const k = e.dehaze / 100;
          r = (r - 0.04 * k) / (1 - 0.04 * k);
          gg = (gg - 0.04 * k) / (1 - 0.04 * k);
          b = (b - 0.04 * k) / (1 - 0.04 * k);
        }
        l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      }
      // Tonos: altas luces, sombras, blancos, negros y contraste sobre la luminancia
      let nl = l;
      if (hi) nl += hi * 0.45 * smooth(0.3, 0.95, nl) * (hi < 0 ? nl : 1 - nl);
      if (sh) nl += sh * 0.45 * (1 - smooth(0.05, 0.6, nl)) * (sh > 0 ? 1 - nl : nl);
      if (wh) nl += wh * 0.25 * nl * nl;
      if (bl) nl += bl * 0.25 * (1 - nl) * (1 - nl);
      if (contrast) {
        const c = clamp01(nl);
        const sCurve = c < 0.5 ? 2 * c * c : 1 - 2 * (1 - c) * (1 - c);
        nl = c + (contrast > 0 ? (sCurve - c) * contrast * 1.4 : (0.5 - c) * -contrast * 0.6);
      }
      const ratio = l > 0.0005 ? nl / l : 1;
      r *= ratio;
      gg *= ratio;
      b *= ratio;
      if (l <= 0.0005 && nl > 0) r = gg = b = nl;
      // Curva
      r = curve[Math.round(clamp01(r) * 255)];
      gg = curve[Math.round(clamp01(gg) * 255)];
      b = curve[Math.round(clamp01(b) * 255)];
      // Color
      if (vib || sat || hasHsl || e.bw || split) {
        let [h, s, ll] = rgbToHsl(r, gg, b);
        if (hasHsl && s > 0.02) {
          let dh = 0;
          let ds = 0;
          let dl = 0;
          for (let k = 0; k < 8; k++) {
            let dist = Math.abs(h - HSL_CENTERS[k]);
            if (dist > 180) dist = 360 - dist;
            const w = Math.max(0, 1 - dist / 40);
            if (!w) continue;
            dh += (e.hslHue[k] / 100) * 30 * w;
            ds += (e.hslSat[k] / 100) * w;
            dl += (e.hslLum[k] / 100) * 0.3 * w * s;
          }
          h = (h + dh + 360) % 360;
          s = clamp01(s * (1 + ds));
          ll = clamp01(ll + dl);
        }
        if (vib) s = clamp01(s + vib * (1 - s) * (vib > 0 ? 0.6 : 1) * (vib > 0 ? 1 - s : s));
        if (sat) s = clamp01(s * (1 + sat));
        if (e.bw) s = 0;
        [r, gg, b] = hslToRgb(h, s, ll);
        if (split) {
          const lum = ll;
          const ks = (e.splitShadowSat / 100) * (1 - lum) * 0.35;
          const kh = (e.splitHighlightSat / 100) * lum * 0.35;
          r = r * (1 - ks - kh) + (sR * lum * 2) * ks + (hR * lum * 1.2) * kh;
          gg = gg * (1 - ks - kh) + (sG * lum * 2) * ks + (hG * lum * 1.2) * kh;
          b = b * (1 - ks - kh) + (sB * lum * 2) * ks + (hB * lum * 1.2) * kh;
        }
      }
      // Viñeta y grano
      if (e.vignette) {
        const dd = Math.hypot(x - cx, y - cy) / maxR;
        const k = Math.max(0, dd - 0.35) / 0.65;
        const v = e.vignette / 100;
        const f = v < 0 ? 1 + v * k * k : 1;
        r = r * f + (v > 0 ? v * k * k * (1 - r) : 0);
        gg = gg * f + (v > 0 ? v * k * k * (1 - gg) : 0);
        b = b * f + (v > 0 ? v * k * k * (1 - b) : 0);
      }
      if (e.grain) {
        const n = (Math.random() - 0.5) * (e.grain / 100) * 0.25;
        r += n;
        gg += n;
        b += n;
      }
      d[i] = clamp01(r) * 255;
      d[i + 1] = clamp01(gg) * 255;
      d[i + 2] = clamp01(b) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

/** Revelado completo de una imagen original. */
export function renderEdits(original: HTMLCanvasElement | HTMLImageElement, e: Edits, maxSide = 0): HTMLCanvasElement {
  let src = orient(original, e);
  src = cropped(src, e.crop);
  let scale = 1;
  if (maxSide && Math.max(src.width, src.height) > maxSide) {
    scale = maxSide / Math.max(src.width, src.height);
    const c = document.createElement("canvas");
    c.width = Math.round(src.width * scale);
    c.height = Math.round(src.height * scale);
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, c.width, c.height);
    src = c;
  }
  return develop(src, e, scale);
}

export function histogram(c: HTMLCanvasElement): { r: Uint32Array; g: Uint32Array; b: Uint32Array; l: Uint32Array } {
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  const step = Math.max(4, Math.floor(d.length / 4 / 150000) * 4);
  for (let i = 0; i < d.length; i += step) {
    r[d[i]]++;
    g[d[i + 1]]++;
    b[d[i + 2]]++;
    l[Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])]++;
  }
  return { r, g, b, l };
}

/** Ajuste automático a partir del histograma (exposición, blancos, negros). */
export function autoTone(c: HTMLCanvasElement): Partial<Edits> {
  const { l } = histogram(c);
  const total = l.reduce((s, v) => s + v, 0) || 1;
  let acc = 0;
  let lo = 0;
  let hiV = 255;
  let mean = 0;
  for (let i = 0; i < 256; i++) mean += i * l[i];
  mean /= total;
  for (let i = 0; i < 256; i++) {
    acc += l[i];
    if (acc / total < 0.005) lo = i;
    if (acc / total < 0.995) hiV = i;
  }
  return {
    exposure: Math.max(-1.5, Math.min(1.5, Math.log2(118 / Math.max(10, mean)) * 0.7)),
    blacks: Math.max(-40, Math.min(40, -lo * 0.8)),
    whites: Math.max(-40, Math.min(40, (255 - hiV) * 0.8)),
    contrast: 8,
    highlights: hiV > 245 ? -30 : -10,
    shadows: lo < 10 ? 25 : 10,
    vibrance: 12,
  };
}
