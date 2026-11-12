// Relleno según el contenido: rellena la zona seleccionada con texturas
// tomadas de alrededor (completado de imagen multiescala con PatchMatch).
//
// 1. Se recorta la zona de trabajo (el agujero y un margen).
// 2. Se construye una pirámide de escalas; en la más pequeña el agujero se
//    rellena por difusión.
// 3. En cada escala, de menor a mayor, se alterna: buscar para cada parche el
//    parche más parecido fuera del agujero (PatchMatch) y recomponer los
//    píxeles del agujero con la media de los parches que los cubren.

import { ctx2d, newCanvas } from "./pixels";

const P = 3; // radio del parche (7 × 7)

interface Level {
  w: number;
  h: number;
  img: Float32Array; // RGB
  hole: Uint8Array; // 1 = desconocido
}

function downsample(l: Level): Level {
  const w = Math.max(1, l.w >> 1);
  const h = Math.max(1, l.h >> 1);
  const img = new Float32Array(w * h * 3);
  const hole = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        n = 0,
        holes = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(l.w - 1, x * 2 + dx);
          const sy = Math.min(l.h - 1, y * 2 + dy);
          const i = sy * l.w + sx;
          if (l.hole[i]) holes++;
          else {
            r += l.img[i * 3];
            g += l.img[i * 3 + 1];
            b += l.img[i * 3 + 2];
            n++;
          }
        }
      const o = y * w + x;
      if (n) {
        img[o * 3] = r / n;
        img[o * 3 + 1] = g / n;
        img[o * 3 + 2] = b / n;
      }
      hole[o] = holes > 0 ? 1 : 0;
    }
  return { w, h, img, hole };
}

/** Rellena el agujero por difusión desde el borde hacia dentro. */
function diffuse(l: Level) {
  const known = new Uint8Array(l.w * l.h);
  for (let i = 0; i < known.length; i++) known[i] = l.hole[i] ? 0 : 1;
  let remaining = known.reduce((s, v) => s + (v ? 0 : 1), 0);
  let guard = 0;
  while (remaining > 0 && guard++ < 4000) {
    const next: number[] = [];
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const i = y * l.w + x;
        if (known[i]) continue;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= l.w || yy >= l.h) continue;
            const j = yy * l.w + xx;
            if (!known[j]) continue;
            r += l.img[j * 3];
            g += l.img[j * 3 + 1];
            b += l.img[j * 3 + 2];
            n++;
          }
        if (n) {
          l.img[i * 3] = r / n;
          l.img[i * 3 + 1] = g / n;
          l.img[i * 3 + 2] = b / n;
          next.push(i);
        }
      }
    if (!next.length) break;
    for (const i of next) known[i] = 1;
    remaining -= next.length;
  }
}

function dilate(hole: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!hole[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1;
        }
    }
  return out;
}

function complete(l: Level, init: Int32Array | null, iterations: number): Int32Array {
  const { w, h, img } = l;
  // Parches de origen válidos: completamente fuera del agujero
  const near = dilate(l.hole, w, h, P);
  const sources: number[] = [];
  for (let y = P; y < h - P; y++) for (let x = P; x < w - P; x++) if (!near[y * w + x]) sources.push(y * w + x);
  const targets: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (near[y * w + x]) targets.push(y * w + x);
  const nnf = new Int32Array(w * h).fill(-1);
  if (!sources.length) return nnf;

  const dist = (t: number, s: number, best: number) => {
    const tx = t % w;
    const ty = (t / w) | 0;
    const sx = s % w;
    const sy = (s / w) | 0;
    let d = 0;
    for (let dy = -P; dy <= P; dy++) {
      const ty2 = ty + dy;
      if (ty2 < 0 || ty2 >= h) continue;
      for (let dx = -P; dx <= P; dx++) {
        const tx2 = tx + dx;
        if (tx2 < 0 || tx2 >= w) continue;
        const a = (ty2 * w + tx2) * 3;
        const b = ((sy + dy) * w + sx + dx) * 3;
        const e0 = img[a] - img[b];
        const e1 = img[a + 1] - img[b + 1];
        const e2 = img[a + 2] - img[b + 2];
        d += e0 * e0 + e1 * e1 + e2 * e2;
        if (d >= best) return d;
      }
    }
    return d;
  };
  const isSource = new Uint8Array(w * h);
  for (const s of sources) isSource[s] = 1;
  const cost = new Float64Array(w * h);

  for (const t of targets) {
    let s = init && init[t] >= 0 && isSource[init[t]] ? init[t] : sources[(Math.random() * sources.length) | 0];
    nnf[t] = s;
    cost[t] = dist(t, s, Infinity);
  }

  for (let it = 0; it < iterations; it++) {
    // Búsqueda: propagación y búsqueda aleatoria
    for (let pass = 0; pass < 2; pass++) {
      const order = pass % 2 === 0 ? targets : [...targets].reverse();
      const step = pass % 2 === 0 ? 1 : -1;
      for (const t of order) {
        const tx = t % w;
        const ty = (t / w) | 0;
        for (const [nx, ny] of [
          [tx - step, ty],
          [tx, ty - step],
        ]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nIdx = ny * w + nx;
          const ns = nnf[nIdx];
          if (ns < 0) continue;
          const cand = ns + (tx - nx) + (ty - ny) * w;
          if (cand < 0 || cand >= w * h || !isSource[cand]) continue;
          const d = dist(t, cand, cost[t]);
          if (d < cost[t]) {
            cost[t] = d;
            nnf[t] = cand;
          }
        }
        let radius = Math.max(w, h);
        const bx = nnf[t] % w;
        const by = (nnf[t] / w) | 0;
        while (radius >= 1) {
          const cx = Math.round(bx + (Math.random() * 2 - 1) * radius);
          const cy = Math.round(by + (Math.random() * 2 - 1) * radius);
          if (cx >= P && cy >= P && cx < w - P && cy < h - P) {
            const cand = cy * w + cx;
            if (isSource[cand]) {
              const d = dist(t, cand, cost[t]);
              if (d < cost[t]) {
                cost[t] = d;
                nnf[t] = cand;
              }
            }
          }
          radius >>= 1;
        }
      }
    }
    // Votación: cada píxel del agujero es la media ponderada de los parches que lo cubren
    const acc = new Float64Array(w * h * 4);
    for (const t of targets) {
      const s = nnf[t];
      if (s < 0) continue;
      const wgt = Math.exp(-cost[t] / (2 * 49 * 3 * 400));
      const tx = t % w;
      const ty = (t / w) | 0;
      const sx = s % w;
      const sy = (s / w) | 0;
      for (let dy = -P; dy <= P; dy++)
        for (let dx = -P; dx <= P; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (!l.hole[i]) continue;
          const j = ((sy + dy) * w + sx + dx) * 3;
          acc[i * 4] += img[j] * wgt;
          acc[i * 4 + 1] += img[j + 1] * wgt;
          acc[i * 4 + 2] += img[j + 2] * wgt;
          acc[i * 4 + 3] += wgt;
        }
    }
    for (let i = 0; i < w * h; i++) {
      if (!l.hole[i] || !acc[i * 4 + 3]) continue;
      img[i * 3] = acc[i * 4] / acc[i * 4 + 3];
      img[i * 3 + 1] = acc[i * 4 + 1] / acc[i * 4 + 3];
      img[i * 3 + 2] = acc[i * 4 + 2] / acc[i * 4 + 3];
    }
    // Se recalcula el coste con la imagen nueva
    for (const t of targets) if (nnf[t] >= 0) cost[t] = dist(t, nnf[t], Infinity);
  }
  return nnf;
}

/**
 * Rellena en `src` la zona marcada por `mask` (alfa > 0) y devuelve un lienzo
 * nuevo. Las texturas se toman de un margen alrededor del agujero.
 */
export function contentAwareFill(src: HTMLCanvasElement, mask: HTMLCanvasElement): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const md = ctx2d(mask).getImageData(0, 0, W, H).data;
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (md[(y * W + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const out = newCanvas(W, H);
  ctx2d(out).drawImage(src, 0, 0);
  if (x1 < 0) return out;
  // Zona de trabajo: el agujero con un margen proporcional
  const m = Math.max(24, Math.round(Math.max(x1 - x0, y1 - y0) * 1.2));
  const rx = Math.max(0, x0 - m);
  const ry = Math.max(0, y0 - m);
  const rw = Math.min(W, x1 + m + 1) - rx;
  const rh = Math.min(H, y1 + m + 1) - ry;
  // Si la zona es muy grande, se trabaja a menor resolución
  const scale = Math.min(1, 560 / Math.max(rw, rh));
  const ww = Math.max(8, Math.round(rw * scale));
  const hh = Math.max(8, Math.round(rh * scale));
  const work = newCanvas(ww, hh);
  ctx2d(work).drawImage(src, rx, ry, rw, rh, 0, 0, ww, hh);
  const wm = newCanvas(ww, hh);
  ctx2d(wm).drawImage(mask, rx, ry, rw, rh, 0, 0, ww, hh);
  const pix = ctx2d(work).getImageData(0, 0, ww, hh).data;
  const mpx = ctx2d(wm).getImageData(0, 0, ww, hh).data;
  const base: Level = { w: ww, h: hh, img: new Float32Array(ww * hh * 3), hole: new Uint8Array(ww * hh) };
  for (let i = 0; i < ww * hh; i++) {
    base.img[i * 3] = pix[i * 4];
    base.img[i * 3 + 1] = pix[i * 4 + 1];
    base.img[i * 3 + 2] = pix[i * 4 + 2];
    base.hole[i] = mpx[i * 4 + 3] > 20 ? 1 : 0;
  }
  // Pirámide
  const pyramid: Level[] = [base];
  while (pyramid[pyramid.length - 1].w > 40 && pyramid[pyramid.length - 1].h > 40 && pyramid.length < 6) pyramid.push(downsample(pyramid[pyramid.length - 1]));
  let prevNnf: Int32Array | null = null;
  let prev: Level | null = null;
  for (let li = pyramid.length - 1; li >= 0; li--) {
    const l = pyramid[li];
    if (!prev) diffuse(l);
    else {
      // Sube la estimación de la escala anterior
      for (let y = 0; y < l.h; y++)
        for (let x = 0; x < l.w; x++) {
          const i = y * l.w + x;
          if (!l.hole[i]) continue;
          const px = Math.min(prev.w - 1, x >> 1);
          const py = Math.min(prev.h - 1, y >> 1);
          const j = (py * prev.w + px) * 3;
          l.img[i * 3] = prev.img[j];
          l.img[i * 3 + 1] = prev.img[j + 1];
          l.img[i * 3 + 2] = prev.img[j + 2];
        }
    }
    let init: Int32Array | null = null;
    if (prevNnf && prev) {
      init = new Int32Array(l.w * l.h).fill(-1);
      for (let y = 0; y < l.h; y++)
        for (let x = 0; x < l.w; x++) {
          const s = prevNnf[Math.min(prev.h - 1, y >> 1) * prev.w + Math.min(prev.w - 1, x >> 1)];
          if (s < 0) continue;
          const sx = Math.min(l.w - 1, (s % prev.w) * 2 + (x & 1));
          const sy = Math.min(l.h - 1, ((s / prev.w) | 0) * 2 + (y & 1));
          init[y * l.w + x] = sy * l.w + sx;
        }
    }
    prevNnf = complete(l, init, li === pyramid.length - 1 ? 6 : li === 0 ? 4 : 4);
    prev = l;
  }
  // Resultado: se pega solo dentro del agujero, con el borde suavizado por la máscara
  const res = new ImageData(ww, hh);
  for (let i = 0; i < ww * hh; i++) {
    res.data[i * 4] = base.img[i * 3];
    res.data[i * 4 + 1] = base.img[i * 3 + 1];
    res.data[i * 4 + 2] = base.img[i * 3 + 2];
    res.data[i * 4 + 3] = 255;
  }
  const filled = newCanvas(ww, hh);
  ctx2d(filled).putImageData(res, 0, 0);
  const patch = newCanvas(W, H);
  const pg = ctx2d(patch);
  pg.imageSmoothingQuality = "high";
  pg.drawImage(filled, 0, 0, ww, hh, rx, ry, rw, rh);
  pg.globalCompositeOperation = "destination-in";
  pg.drawImage(mask, 0, 0);
  // base · (1 − m) + relleno · m: se suman las dos partes para que el borde suave no quede translúcido
  const g = ctx2d(out);
  g.globalCompositeOperation = "destination-out";
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = "lighter";
  g.drawImage(patch, 0, 0);
  return out;
}
