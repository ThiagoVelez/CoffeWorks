// Ajustes de imagen (capas de ajuste y menú Imagen › Ajustes) y filtros.
// Trabajan sobre ImageData en RGBA de 8 bits.

import type { AdjustKind, Adjustment } from "../types";
import { hexToRgb, hslToRgb, rgbToHsl } from "../studio/color";
import { ctx2d, newCanvas } from "./pixels";

export const ADJUST_LABELS: Record<AdjustKind, string> = {
  brightness: "Brillo/Contraste",
  levels: "Niveles",
  curves: "Curvas",
  hsl: "Tono/Saturación",
  colorBalance: "Equilibrio de color",
  exposure: "Exposición",
  vibrance: "Intensidad",
  blackWhite: "Blanco y negro",
  photoFilter: "Filtro de fotografía",
  invert: "Invertir",
  threshold: "Umbral",
  posterize: "Posterizar",
  gradientMap: "Mapa de degradado",
};

export function defaultAdjustment(kind: AdjustKind): Adjustment {
  const params: Record<AdjustKind, Adjustment["params"]> = {
    brightness: { brightness: 0, contrast: 0 },
    levels: { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 },
    curves: { rgb: [0, 0, 255, 255], r: [0, 0, 255, 255], g: [0, 0, 255, 255], b: [0, 0, 255, 255] },
    hsl: { hue: 0, saturation: 0, lightness: 0, colorize: 0 },
    colorBalance: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
    exposure: { exposure: 0, offset: 0, gamma: 1 },
    vibrance: { vibrance: 0, saturation: 0 },
    blackWhite: { reds: 40, greens: 40, blues: 20, tint: 0, tintColor: "#e1b77c" },
    photoFilter: { color: "#ec8a00", density: 25 },
    invert: {},
    threshold: { level: 128 },
    posterize: { levels: 4 },
    gradientMap: { from: "#1a1033", to: "#ffd27a" },
  };
  return { kind, params: params[kind] };
}

const n = (p: Adjustment["params"], k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Interpolación suave (monótona) de los puntos de una curva → tabla de 256 valores. */
export function curveLut(points: number[]): Uint8ClampedArray {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < points.length; i += 2) pts.push([points[i], points[i + 1]]);
  pts.sort((a, b) => a[0] - b[0]);
  const lut = new Uint8ClampedArray(256);
  if (pts.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  const k = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < k - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0] || 1);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < k - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[k - 2]);
  for (let i = 0; i < k - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }
  for (let x = 0; x < 256; x++) {
    if (x <= pts[0][0]) {
      lut[x] = pts[0][1];
      continue;
    }
    if (x >= pts[k - 1][0]) {
      lut[x] = pts[k - 1][1];
      continue;
    }
    let i = 0;
    while (i < k - 2 && x > pts[i + 1][0]) i++;
    const h = dx[i];
    const u = (x - pts[i][0]) / h;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    lut[x] = h00 * pts[i][1] + h10 * h * t[i] + h01 * pts[i + 1][1] + h11 * h * t[i + 1];
  }
  return lut;
}

/** Tabla por canal (r, g, b) para los ajustes que no mezclan canales. */
function channelLuts(adj: Adjustment): [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray] | null {
  const p = adj.params;
  const make = (fn: (v: number) => number) => {
    const l = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) l[i] = clamp(fn(i));
    return l;
  };
  switch (adj.kind) {
    case "brightness": {
      const b = n(p, "brightness");
      const c = n(p, "contrast");
      const f = c >= 0 ? 1 + c / 50 : 1 + c / 100;
      const l = make((v) => (v + b * 0.75 - 127.5) * f + 127.5);
      return [l, l, l];
    }
    case "levels": {
      const ib = n(p, "inBlack");
      const iw = Math.max(ib + 1, n(p, "inWhite", 255));
      const gm = Math.max(0.01, n(p, "gamma", 1));
      const ob = n(p, "outBlack");
      const ow = n(p, "outWhite", 255);
      const l = make((v) => ob + (ow - ob) * Math.pow(Math.min(1, Math.max(0, (v - ib) / (iw - ib))), 1 / gm));
      return [l, l, l];
    }
    case "curves": {
      const master = curveLut((p.rgb as number[]) || [0, 0, 255, 255]);
      const ch = (k: string) => {
        const lc = curveLut((p[k] as number[]) || [0, 0, 255, 255]);
        return make((v) => master[lc[v]]);
      };
      return [ch("r"), ch("g"), ch("b")];
    }
    case "exposure": {
      const e = Math.pow(2, n(p, "exposure"));
      const o = n(p, "offset");
      const gm = Math.max(0.01, n(p, "gamma", 1));
      const l = make((v) => 255 * Math.pow(Math.max(0, (v / 255) * e + o), 1 / gm));
      return [l, l, l];
    }
    case "colorBalance": {
      const cr = n(p, "cyanRed") * 0.6;
      const mg = n(p, "magentaGreen") * 0.6;
      const yb = n(p, "yellowBlue") * 0.6;
      // Afecta sobre todo a los tonos medios
      const mid = (v: number, d: number) => v + d * (1 - Math.abs(v - 127.5) / 127.5);
      return [make((v) => mid(v, cr)), make((v) => mid(v, mg)), make((v) => mid(v, yb))];
    }
    case "invert": {
      const l = make((v) => 255 - v);
      return [l, l, l];
    }
    case "posterize": {
      const lv = Math.max(2, Math.round(n(p, "levels", 4)));
      const l = make((v) => Math.round(Math.round((v / 255) * (lv - 1)) * (255 / (lv - 1))));
      return [l, l, l];
    }
    default:
      return null;
  }
}

export function applyAdjustment(img: ImageData, adj: Adjustment) {
  const d = img.data;
  const luts = channelLuts(adj);
  if (luts) {
    const [lr, lg, lb] = luts;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lr[d[i]];
      d[i + 1] = lg[d[i + 1]];
      d[i + 2] = lb[d[i + 2]];
    }
    return;
  }
  const p = adj.params;
  switch (adj.kind) {
    case "hsl": {
      const dh = n(p, "hue");
      const ds = n(p, "saturation") / 100;
      const dl = n(p, "lightness") / 100;
      const colorize = n(p, "colorize") > 0;
      for (let i = 0; i < d.length; i += 4) {
        let [h, s, l] = rgbToHsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
        if (colorize) {
          h = (dh + 360) % 360;
          s = Math.max(0, Math.min(1, 0.25 + ds));
        } else {
          h = (h + dh + 360) % 360;
          s = Math.max(0, Math.min(1, ds >= 0 ? s + (1 - s) * ds * s : s * (1 + ds)));
        }
        l = dl >= 0 ? l + (1 - l) * dl : l * (1 + dl);
        const [r, g, b] = hslToRgb(h, s, l);
        d[i] = r * 255;
        d[i + 1] = g * 255;
        d[i + 2] = b * 255;
      }
      return;
    }
    case "vibrance": {
      const vb = n(p, "vibrance") / 100;
      const sat = n(p, "saturation") / 100;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const mx = Math.max(r, g, b);
        const avg = (r + g + b) / 3;
        // Más efecto en los colores poco saturados
        const amt = (vb * (1 - (mx - Math.min(r, g, b)) / 255) + sat) * 1.2;
        d[i] = clamp(r + (r - avg) * amt);
        d[i + 1] = clamp(g + (g - avg) * amt);
        d[i + 2] = clamp(b + (b - avg) * amt);
      }
      return;
    }
    case "blackWhite": {
      const wr = n(p, "reds", 40) / 100;
      const wg = n(p, "greens", 40) / 100;
      const wb = n(p, "blues", 20) / 100;
      const sum = wr + wg + wb || 1;
      const tint = n(p, "tint") > 0;
      const tc = hexToRgb((p.tintColor as string) || "#e1b77c");
      for (let i = 0; i < d.length; i += 4) {
        const y = clamp((d[i] * wr + d[i + 1] * wg + d[i + 2] * wb) / sum);
        if (tint) {
          const t = y / 255;
          d[i] = clamp(y * 0.6 + tc.r * t * 0.4);
          d[i + 1] = clamp(y * 0.6 + tc.g * t * 0.4);
          d[i + 2] = clamp(y * 0.6 + tc.b * t * 0.4);
        } else d[i] = d[i + 1] = d[i + 2] = y;
      }
      return;
    }
    case "photoFilter": {
      const c = hexToRgb((p.color as string) || "#ec8a00");
      const k = n(p, "density", 25) / 100;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const r = d[i] * (1 - k) + ((c.r * d[i]) / 255) * k;
        const g = d[i + 1] * (1 - k) + ((c.g * d[i + 1]) / 255) * k;
        const b = d[i + 2] * (1 - k) + ((c.b * d[i + 2]) / 255) * k;
        // Conserva la luminosidad
        const nl = 0.299 * r + 0.587 * g + 0.114 * b || 1;
        const f = lum / nl;
        d[i] = clamp(r * f);
        d[i + 1] = clamp(g * f);
        d[i + 2] = clamp(b * f);
      }
      return;
    }
    case "threshold": {
      const t = n(p, "level", 128);
      for (let i = 0; i < d.length; i += 4) {
        const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] >= t ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      return;
    }
    case "gradientMap": {
      const a = hexToRgb((p.from as string) || "#000000");
      const b = hexToRgb((p.to as string) || "#ffffff");
      for (let i = 0; i < d.length; i += 4) {
        const t = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        d[i] = a.r + (b.r - a.r) * t;
        d[i + 1] = a.g + (b.g - a.g) * t;
        d[i + 2] = a.b + (b.b - a.b) * t;
      }
      return;
    }
  }
}

/** Histograma de luminosidad (256 valores) de una imagen. */
export function histogram(img: ImageData): Uint32Array {
  const h = new Uint32Array(256);
  const d = img.data;
  const step = Math.max(4, Math.floor(d.length / 4 / 200000) * 4);
  for (let i = 0; i < d.length; i += step) if (d[i + 3] > 0) h[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
  return h;
}

// ---------------------------------------------------------------------------
// Filtros (devuelven un lienzo nuevo)
// ---------------------------------------------------------------------------

export type FilterKind = "gaussian" | "motion" | "sharpen" | "unsharp" | "noise" | "denoise" | "pixelate" | "emboss" | "edges" | "vignette" | "oil";

export const FILTER_LABELS: Record<FilterKind, string> = {
  gaussian: "Desenfoque gaussiano…",
  motion: "Desenfoque de movimiento…",
  sharpen: "Enfocar",
  unsharp: "Máscara de enfoque…",
  noise: "Añadir ruido…",
  denoise: "Reducir ruido…",
  pixelate: "Pixelar…",
  emboss: "Relieve",
  edges: "Hallar bordes",
  vignette: "Viñeta…",
  oil: "Pintura al óleo…",
};

export interface FilterParams {
  radius?: number;
  amount?: number;
  angle?: number;
  distance?: number;
  threshold?: number;
  mono?: boolean;
  size?: number;
}

export const FILTER_DEFAULTS: Partial<Record<FilterKind, FilterParams>> = {
  gaussian: { radius: 6 },
  motion: { angle: 0, distance: 20 },
  unsharp: { amount: 80, radius: 2, threshold: 0 },
  noise: { amount: 12, mono: true },
  denoise: { radius: 1 },
  pixelate: { size: 12 },
  vignette: { amount: 60, size: 60 },
  oil: { radius: 3, size: 20 },
};

/** Desenfoque gaussiano que repite los bordes (no se cuela transparencia por los lados). */
export const blurCanvas = (src: HTMLCanvasElement, radius: number) => {
  const w = src.width;
  const h = src.height;
  const p = Math.ceil(radius * 3) + 1;
  const pad = newCanvas(w + p * 2, h + p * 2);
  const pg = ctx2d(pad);
  pg.drawImage(src, p, p);
  // Bordes y esquinas estirados
  pg.drawImage(src, 0, 0, 1, h, 0, p, p, h);
  pg.drawImage(src, w - 1, 0, 1, h, p + w, p, p, h);
  pg.drawImage(src, 0, 0, w, 1, p, 0, w, p);
  pg.drawImage(src, 0, h - 1, w, 1, p, p + h, w, p);
  pg.drawImage(src, 0, 0, 1, 1, 0, 0, p, p);
  pg.drawImage(src, w - 1, 0, 1, 1, p + w, 0, p, p);
  pg.drawImage(src, 0, h - 1, 1, 1, 0, p + h, p, p);
  pg.drawImage(src, w - 1, h - 1, 1, 1, p + w, p + h, p, p);
  const c = newCanvas(w, h);
  const g = ctx2d(c);
  g.filter = `blur(${radius}px)`;
  g.drawImage(pad, -p, -p);
  return c;
};

export function applyFilter(src: HTMLCanvasElement, kind: FilterKind, p: FilterParams = {}): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  switch (kind) {
    case "gaussian":
      return blurCanvas(src, p.radius ?? 6);
    case "motion": {
      const c = newCanvas(w, h);
      const g = ctx2d(c);
      const dist = p.distance ?? 20;
      const a = ((p.angle ?? 0) * Math.PI) / 180;
      const steps = Math.max(2, Math.round(dist / 2));
      g.globalAlpha = 1 / steps;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1) - 0.5;
        g.globalAlpha = 1 / (i + 1);
        g.drawImage(src, Math.cos(a) * dist * t, Math.sin(a) * dist * t);
      }
      return c;
    }
    case "sharpen":
    case "unsharp": {
      const amount = (kind === "sharpen" ? 60 : p.amount ?? 80) / 100;
      const radius = kind === "sharpen" ? 1 : p.radius ?? 2;
      const thr = kind === "sharpen" ? 0 : p.threshold ?? 0;
      const blurred = ctx2d(blurCanvas(src, radius)).getImageData(0, 0, w, h).data;
      const img = ctx2d(src).getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          const diff = d[i + k] - blurred[i + k];
          if (Math.abs(diff) >= thr) d[i + k] = clamp(d[i + k] + diff * amount);
        }
      }
      return fromImage(img);
    }
    case "noise": {
      const img = ctx2d(src).getImageData(0, 0, w, h);
      const d = img.data;
      const amt = (p.amount ?? 12) * 2.55;
      for (let i = 0; i < d.length; i += 4) {
        if (p.mono !== false) {
          const r = (Math.random() - 0.5) * amt;
          d[i] = clamp(d[i] + r);
          d[i + 1] = clamp(d[i + 1] + r);
          d[i + 2] = clamp(d[i + 2] + r);
        } else for (let k = 0; k < 3; k++) d[i + k] = clamp(d[i + k] + (Math.random() - 0.5) * amt);
      }
      return fromImage(img);
    }
    case "denoise": {
      // Mediana por canal
      const r = Math.max(1, Math.min(3, Math.round(p.radius ?? 1)));
      const img = ctx2d(src).getImageData(0, 0, w, h);
      const s = new Uint8ClampedArray(img.data);
      const d = img.data;
      const win: number[] = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          for (let k = 0; k < 3; k++) {
            win.length = 0;
            for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++)
              for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) win.push(s[(yy * w + xx) * 4 + k]);
            win.sort((a, b) => a - b);
            d[o + k] = win[win.length >> 1];
          }
        }
      return fromImage(img);
    }
    case "pixelate": {
      const size = Math.max(2, Math.round(p.size ?? 12));
      const small = newCanvas(Math.ceil(w / size), Math.ceil(h / size));
      ctx2d(small).drawImage(src, 0, 0, small.width, small.height);
      const c = newCanvas(w, h);
      const g = ctx2d(c);
      g.imageSmoothingEnabled = false;
      g.drawImage(small, 0, 0, small.width * size, small.height * size);
      return c;
    }
    case "emboss":
    case "edges": {
      const kernel = kind === "emboss" ? [-2, -1, 0, -1, 1, 1, 0, 1, 2] : [-1, -1, -1, -1, 8, -1, -1, -1, -1];
      return convolve(src, kernel, kind === "emboss" ? 0 : 0);
    }
    case "vignette": {
      const c = newCanvas(w, h);
      const g = ctx2d(c);
      g.drawImage(src, 0, 0);
      const amount = (p.amount ?? 60) / 100;
      const size = (p.size ?? 60) / 100;
      const r = Math.hypot(w, h) / 2;
      const grad = g.createRadialGradient(w / 2, h / 2, r * size * 0.6, w / 2, h / 2, r);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${amount})`);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      return c;
    }
    case "oil": {
      // Filtro de Kuwahara simplificado: el color más frecuente del entorno
      const radius = Math.max(1, Math.round(p.radius ?? 3));
      const levels = Math.max(4, Math.round(p.size ?? 20));
      const img = ctx2d(src).getImageData(0, 0, w, h);
      const s = new Uint8ClampedArray(img.data);
      const d = img.data;
      const count = new Uint32Array(levels);
      const sr = new Float64Array(levels);
      const sg = new Float64Array(levels);
      const sb = new Float64Array(levels);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          count.fill(0);
          sr.fill(0);
          sg.fill(0);
          sb.fill(0);
          for (let yy = Math.max(0, y - radius); yy <= Math.min(h - 1, y + radius); yy++)
            for (let xx = Math.max(0, x - radius); xx <= Math.min(w - 1, x + radius); xx++) {
              const o = (yy * w + xx) * 4;
              const lv = Math.min(levels - 1, Math.floor(((s[o] + s[o + 1] + s[o + 2]) / 765) * levels));
              count[lv]++;
              sr[lv] += s[o];
              sg[lv] += s[o + 1];
              sb[lv] += s[o + 2];
            }
          let best = 0;
          for (let k = 1; k < levels; k++) if (count[k] > count[best]) best = k;
          const o = (y * w + x) * 4;
          d[o] = sr[best] / count[best];
          d[o + 1] = sg[best] / count[best];
          d[o + 2] = sb[best] / count[best];
        }
      return fromImage(img);
    }
  }
}

function convolve(src: HTMLCanvasElement, k: number[], bias: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const img = ctx2d(src).getImageData(0, 0, w, h);
  const s = new Uint8ClampedArray(img.data);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = bias;
        let ki = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            sum += s[(yy * w + xx) * 4 + c] * k[ki++];
          }
        d[o + c] = clamp(sum);
      }
    }
  return fromImage(img);
}

function fromImage(img: ImageData): HTMLCanvasElement {
  const c = newCanvas(img.width, img.height);
  ctx2d(c).putImageData(img, 0, 0);
  return c;
}

/** Aplica un ajuste a un lienzo y devuelve uno nuevo. */
export function adjustCanvas(src: HTMLCanvasElement, adj: Adjustment): HTMLCanvasElement {
  const img = ctx2d(src).getImageData(0, 0, src.width, src.height);
  applyAdjustment(img, adj);
  return fromImage(img);
}
