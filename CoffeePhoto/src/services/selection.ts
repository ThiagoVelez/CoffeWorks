// Selecciones: máscara alfa del tamaño del documento (255 = seleccionado).
// Rectángulo, elipse, lazo, varita mágica, combinar, invertir, calar,
// expandir/contraer y el contorno animado ("hormigas").

import { ctx2d, newCanvas } from "./pixels";

export interface Selection {
  mask: HTMLCanvasElement;
  bounds: { x: number; y: number; w: number; h: number };
}

export type SelectMode = "new" | "add" | "subtract" | "intersect";

export function shapeMask(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, feather = 0): HTMLCanvasElement {
  const c = newCanvas(w, h);
  const g = ctx2d(c);
  g.fillStyle = "#fff";
  if (feather > 0) g.filter = `blur(${feather / 2}px)`;
  draw(g);
  return c;
}

export const rectMask = (w: number, h: number, r: { x: number; y: number; w: number; h: number }, ellipse: boolean, feather = 0) =>
  shapeMask(
    w,
    h,
    (g) => {
      if (ellipse) {
        g.beginPath();
        g.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.abs(r.w / 2), Math.abs(r.h / 2), 0, 0, Math.PI * 2);
        g.fill();
      } else g.fillRect(r.x, r.y, r.w, r.h);
    },
    feather
  );

export const polygonMask = (w: number, h: number, pts: Array<{ x: number; y: number }>, feather = 0) =>
  shapeMask(
    w,
    h,
    (g) => {
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.fill();
    },
    feather
  );

/** Píxeles parecidos al del punto (x, y). */
export function wandMask(img: ImageData, x: number, y: number, tolerance: number, contiguous: boolean): HTMLCanvasElement {
  const { width: w, height: h, data: d } = img;
  const out = new ImageData(w, h);
  const o = out.data;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return newCanvas(w, h);
  const si = (y * w + x) * 4;
  const [r0, g0, b0, a0] = [d[si], d[si + 1], d[si + 2], d[si + 3]];
  const tol = tolerance * 1.0;
  const match = (i: number) => Math.max(Math.abs(d[i] - r0), Math.abs(d[i + 1] - g0), Math.abs(d[i + 2] - b0), Math.abs(d[i + 3] - a0)) <= tol;
  if (!contiguous) {
    for (let i = 0; i < d.length; i += 4) if (match(i)) o[i + 3] = 255;
  } else {
    const seen = new Uint8Array(w * h);
    const stack = [y * w + x];
    seen[y * w + x] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      o[p * 4 + 3] = 255;
      const px = p % w;
      const py = (p / w) | 0;
      const push = (q: number) => {
        if (!seen[q] && match(q * 4)) {
          seen[q] = 1;
          stack.push(q);
        }
      };
      if (px > 0) push(p - 1);
      if (px < w - 1) push(p + 1);
      if (py > 0) push(p - w);
      if (py < h - 1) push(p + w);
    }
  }
  for (let i = 0; i < o.length; i += 4) o[i] = o[i + 1] = o[i + 2] = 255;
  const c = newCanvas(w, h);
  ctx2d(c).putImageData(out, 0, 0);
  return c;
}

export function combine(prev: HTMLCanvasElement | null, next: HTMLCanvasElement, mode: SelectMode): HTMLCanvasElement {
  if (!prev || mode === "new") return next;
  const c = newCanvas(next.width, next.height);
  const g = ctx2d(c);
  g.drawImage(prev, 0, 0);
  g.globalCompositeOperation = mode === "add" ? "source-over" : mode === "subtract" ? "destination-out" : "destination-in";
  g.drawImage(next, 0, 0);
  return c;
}

export function invertMask(mask: HTMLCanvasElement | null, w: number, h: number): HTMLCanvasElement {
  const c = newCanvas(w, h);
  const g = ctx2d(c);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  if (mask) {
    g.globalCompositeOperation = "destination-out";
    g.drawImage(mask, 0, 0);
  }
  return c;
}

export function featherMask(mask: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const c = newCanvas(mask.width, mask.height);
  const g = ctx2d(c);
  g.filter = `blur(${radius / 2}px)`;
  g.drawImage(mask, 0, 0);
  return c;
}

/** Expande (px > 0) o contrae (px < 0) la selección. */
export function growMask(mask: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const blurred = featherMask(mask, Math.abs(px) * 2);
  const img = ctx2d(blurred).getImageData(0, 0, mask.width, mask.height);
  const d = img.data;
  const t = px > 0 ? 8 : 247;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > t ? 255 : 0;
  ctx2d(blurred).putImageData(img, 0, 0);
  return blurred;
}

/** Selección a partir del canal alfa de una capa. */
export function alphaToMask(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = newCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function maskBounds(mask: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const { width: w, height: h } = mask;
  const d = ctx2d(mask).getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function makeSelection(mask: HTMLCanvasElement): Selection | null {
  const b = maskBounds(mask);
  return b ? { mask, bounds: b } : null;
}

/**
 * Contorno de la selección en dos fases (para animar las "hormigas"):
 * píxeles del borde en blanco y negro alternos.
 */
export function antsCanvases(mask: HTMLCanvasElement): [HTMLCanvasElement, HTMLCanvasElement] {
  const { width: w, height: h } = mask;
  const d = ctx2d(mask).getImageData(0, 0, w, h).data;
  const a = new ImageData(w, h);
  const b = new ImageData(w, h);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 127;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
      const i = (y * w + x) * 4;
      const on = (x + y) % 8 < 4;
      for (const [img, white] of [[a, on], [b, !on]] as Array<[ImageData, boolean]>) {
        const v = white ? 255 : 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
  const ca = newCanvas(w, h);
  const cb = newCanvas(w, h);
  ctx2d(ca).putImageData(a, 0, 0);
  ctx2d(cb).putImageData(b, 0, 0);
  return [ca, cb];
}

/** Recorta un lienzo a la selección (lo de fuera queda transparente). */
export function clipToSelection(src: HTMLCanvasElement, sel: Selection | null): HTMLCanvasElement {
  if (!sel) return src;
  const c = newCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(sel.mask, 0, 0);
  return c;
}

/** Sustituye la parte seleccionada de `base` por `edited` (con bordes suaves). */
export function mergeInSelection(base: HTMLCanvasElement, edited: HTMLCanvasElement, sel: Selection | null): HTMLCanvasElement {
  if (!sel) return edited;
  const c = newCanvas(base.width, base.height);
  const g = ctx2d(c);
  g.drawImage(base, 0, 0);
  g.globalCompositeOperation = "destination-out";
  g.drawImage(sel.mask, 0, 0);
  // Suma (no superposición): así el borde suave conserva la opacidad
  g.globalCompositeOperation = "lighter";
  g.drawImage(clipToSelection(edited, sel), 0, 0);
  return c;
}
