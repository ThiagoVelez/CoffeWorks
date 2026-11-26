// Separa la foto de una hoja en renglones (cajas). Binariza con el umbral local de Bradley
// (aguanta sombras y luz desigual de una foto con el celular) y busca franjas horizontales con
// tinta; las franjas muy juntas (exponentes, fracciones) se unen en un mismo renglón.

import type { Gris } from "./imagen";

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Máscara de tinta (1) con umbral local: más oscuro que el 85 % de la media de su vecindad. */
export function binarizar(img: Gris): Uint8Array {
  const { ancho: W, alto: H, datos } = img;
  const integral = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let fila = 0;
    for (let x = 0; x < W; x++) {
      fila += datos[y * W + x];
      integral[(y + 1) * (W + 1) + x + 1] = integral[y * (W + 1) + x + 1] + fila;
    }
  }
  const r = Math.max(7, Math.round(Math.min(W, H) / 16));
  const tinta = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const suma = integral[y1 * (W + 1) + x1] - integral[y0 * (W + 1) + x1] - integral[y1 * (W + 1) + x0] + integral[y0 * (W + 1) + x0];
      const media = suma / ((x1 - x0) * (y1 - y0));
      const v = datos[y * W + x];
      if (v < media * 0.85 && v < 200) tinta[y * W + x] = 1;
    }
  }
  return tinta;
}

export function segmentarRenglones(img: Gris): Caja[] {
  const { ancho: W, alto: H } = img;
  if (!W || !H) return [];
  const tinta = binarizar(img);
  const porFila = new Uint32Array(H);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) n += tinta[y * W + x];
    porFila[y] = n;
  }
  const minFila = Math.max(2, Math.round(W * 0.003));
  // Franjas con tinta
  let franjas: { y0: number; y1: number }[] = [];
  for (let y = 0; y < H; ) {
    if (porFila[y] < minFila) { y++; continue; }
    let f = y;
    while (f < H && porFila[f] >= minFila) f++;
    franjas.push({ y0: y, y1: f });
    y = f;
  }
  // Unir franjas muy cercanas (partes de una misma fórmula)
  const unidas: typeof franjas = [];
  for (const fr of franjas) {
    const prev = unidas[unidas.length - 1];
    if (prev) {
      const hueco = fr.y0 - prev.y1;
      const alturaMin = Math.min(prev.y1 - prev.y0, fr.y1 - fr.y0);
      if (hueco < Math.max(6, alturaMin * 0.6)) { prev.y1 = fr.y1; continue; }
    }
    unidas.push({ ...fr });
  }
  franjas = unidas;
  const cajas: Caja[] = [];
  const margen = 4;
  for (const { y0, y1 } of franjas) {
    let x0 = W, x1 = -1, total = 0;
    for (let y = y0; y < y1; y++)
      for (let x = 0; x < W; x++)
        if (tinta[y * W + x]) { total++; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (y1 - y0 < 5 || total < 30 || x1 < 0) continue; // manchas
    const x = Math.max(0, x0 - margen), y = Math.max(0, y0 - margen);
    cajas.push({ x, y, ancho: Math.min(W, x1 + 1 + margen) - x, alto: Math.min(H, y1 + margen) - y });
  }
  return cajas;
}
