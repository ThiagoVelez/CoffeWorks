// Calco vectorial con el complemento «Calco vectorial» (Potrace): convierte
// una imagen en SVG, en blanco y negro o por capas de color.

import { base64ToBytes } from "./desktop";
import { ensureAddon, runAddonFile } from "./addons";

export interface TraceOptions {
  mode: "bw" | "color";
  /** Umbral de 0 a 255 (blanco y negro). */
  threshold: number;
  /** Número de colores (modo color). */
  colors: number;
  /** Manchas más pequeñas que esto se descartan (px²). */
  noise: number;
  /** Suavizado de esquinas (0 = esquinas vivas, 1.3 = muy suave). */
  smooth: number;
}

/** BMP de 24 bits: negro donde `on` es verdadero. */
function bmpFromMask(w: number, h: number, on: (i: number) => boolean): Uint8Array {
  const row = Math.ceil((w * 3) / 4) * 4;
  const size = 54 + row * h;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  buf[0] = 0x42;
  buf[1] = 0x4d;
  dv.setUint32(2, size, true);
  dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  dv.setUint32(34, row * h, true);
  for (let y = 0; y < h; y++) {
    const base = 54 + (h - 1 - y) * row;
    for (let x = 0; x < w; x++) {
      const v = on(y * w + x) ? 0 : 255;
      buf[base + x * 3] = buf[base + x * 3 + 1] = buf[base + x * 3 + 2] = v;
    }
  }
  return buf;
}

async function potrace(bmp: Uint8Array, o: TraceOptions, color: string): Promise<string> {
  const out = await runAddonFile("potrace", ["-s", "--flat", "-t", String(o.noise), "-a", String(o.smooth), "-C", color, "-o", "{output}", "{input}"], bmp, "bmp");
  return new TextDecoder().decode(base64ToBytes(out));
}

/** Colores dominantes (k-medias sencillo sobre una muestra). */
function palette(d: Uint8ClampedArray, k: number): Array<[number, number, number]> {
  const samples: Array<[number, number, number]> = [];
  const step = Math.max(1, Math.floor(d.length / 4 / 6000));
  for (let i = 0; i < d.length / 4; i += step) if (d[i * 4 + 3] > 127) samples.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  if (!samples.length) return [[0, 0, 0]];
  let centers = Array.from({ length: k }, (_, i) => samples[Math.floor((i * samples.length) / k)]);
  for (let it = 0; it < 8; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      let best = 0;
      let bd = Infinity;
      centers.forEach((c, j) => {
        const dd = (c[0] - s[0]) ** 2 + (c[1] - s[1]) ** 2 + (c[2] - s[2]) ** 2;
        if (dd < bd) {
          bd = dd;
          best = j;
        }
      });
      acc[best][0] += s[0];
      acc[best][1] += s[1];
      acc[best][2] += s[2];
      acc[best][3]++;
    }
    centers = centers.map((c, j) => (acc[j][3] ? [acc[j][0] / acc[j][3], acc[j][1] / acc[j][3], acc[j][2] / acc[j][3]] : c));
  }
  return centers;
}

const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Calca la imagen y devuelve los documentos SVG resultantes (uno por color, de claro a oscuro). */
export async function traceImage(img: HTMLCanvasElement, o: TraceOptions, appName: string): Promise<string[] | null> {
  if (!(await ensureAddon("potrace", appName))) return null;
  const w = img.width;
  const h = img.height;
  const d = img.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  if (o.mode === "bw") {
    const bmp = bmpFromMask(w, h, (i) => d[i * 4 + 3] > 127 && 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2] < o.threshold);
    return [await potrace(bmp, o, "#000000")];
  }
  const colors = palette(d, Math.max(2, Math.min(16, o.colors)));
  // Asignación de cada píxel a su color más cercano
  const idx = new Int16Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] <= 127) continue;
    let best = 0;
    let bd = Infinity;
    colors.forEach((c, j) => {
      const dd = (c[0] - d[i * 4]) ** 2 + (c[1] - d[i * 4 + 1]) ** 2 + (c[2] - d[i * 4 + 2]) ** 2;
      if (dd < bd) {
        bd = dd;
        best = j;
      }
    });
    idx[i] = best;
  }
  // Capas apiladas: cada color cubre también a los más oscuros (evita huecos entre capas)
  const order = colors.map((c, j) => ({ j, l: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] })).sort((a, b) => b.l - a.l);
  const out: string[] = [];
  for (let k = 0; k < order.length; k++) {
    const allowed = new Set(order.slice(k).map((x) => x.j));
    const bmp = bmpFromMask(w, h, (i) => idx[i] >= 0 && allowed.has(idx[i]));
    out.push(await potrace(bmp, o, hex(colors[order[k].j])));
  }
  return out;
}
