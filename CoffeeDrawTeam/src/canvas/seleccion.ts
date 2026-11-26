// Selección y redimensionado de elementos.

import type { Elemento } from "../board/model";
import { unirCajas, type Caja } from "./vista";

export type Asa = "n" | "s" | "e" | "o" | "ne" | "no" | "se" | "so";
export const TAM_MIN = 20;

function normalizar(r: Caja): Caja {
  return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) };
}

/** Ids de los elementos que quedan enteros dentro del rectángulo. */
export function elementosEnRect(els: Elemento[], rect: Caja): string[] {
  const r = normalizar(rect);
  return els
    .filter((e) => e.kind !== "conector" && e.x >= r.x && e.y >= r.y && e.x + e.w <= r.x + r.w && e.y + e.h <= r.y + r.h)
    .map((e) => e.id);
}

export function cajaDe(els: Elemento[], ids: string[]): Caja | null {
  return unirCajas(els.filter((e) => ids.includes(e.id)).map(({ x, y, w, h }) => ({ x, y, w, h })));
}

export function redimensionar(el: Pick<Elemento, "x" | "y" | "w" | "h">, asa: Asa, d: { dx: number; dy: number }, mantenerProporcion: boolean): Caja {
  let { x, y, w, h } = el;
  const prop = el.w / Math.max(el.h, 1);
  if (asa.includes("e")) w += d.dx;
  if (asa.includes("o")) { w -= d.dx; x += d.dx; }
  if (asa.includes("s")) h += d.dy;
  if (asa === "n" || asa === "ne" || asa === "no") { h -= d.dy; y += d.dy; }
  if (mantenerProporcion) {
    if (asa === "n" || asa === "s") w = h * prop;
    else h = w / prop;
    if (asa.includes("o")) x = el.x + el.w - w;
    if (asa === "n" || asa === "ne" || asa === "no") y = el.y + el.h - h;
  }
  if (w < TAM_MIN) { if (asa.includes("o")) x -= TAM_MIN - w; w = TAM_MIN; }
  if (h < TAM_MIN) { if (asa === "n" || asa === "ne" || asa === "no") y -= TAM_MIN - h; h = TAM_MIN; }
  return { x, y, w, h };
}
