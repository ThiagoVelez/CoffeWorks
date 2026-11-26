// Ruta de un conector: sale del borde de cada elemento y lo sigue cuando se mueve.

import type * as Y from "yjs";
import { obtener, type Conector, type Extremo } from "../board/model";
import type { Caja, Punto } from "./vista";

function cajaExtremo(doc: Y.Doc, e: Extremo): { centro: Punto; caja: Caja | null } {
  if ("id" in e) {
    const el = obtener(doc, e.id);
    if (el) return { centro: { x: el.x + el.w / 2, y: el.y + el.h / 2 }, caja: { x: el.x, y: el.y, w: el.w, h: el.h } };
    return { centro: { x: 0, y: 0 }, caja: null };
  }
  return { centro: { x: e.x, y: e.y }, caja: null };
}

/** Punto donde la recta del centro hacia `hacia` cruza el borde de la caja. */
function borde(caja: Caja, centro: Punto, hacia: Punto): Punto {
  const dx = hacia.x - centro.x, dy = hacia.y - centro.y;
  if (dx === 0 && dy === 0) return centro;
  const tx = dx !== 0 ? caja.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? caja.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty, 1);
  return { x: centro.x + dx * t, y: centro.y + dy * t };
}

export function rutaConector(doc: Y.Doc, c: Conector): { puntos: number[] } {
  const a = cajaExtremo(doc, c.desde), b = cajaExtremo(doc, c.hasta);
  if (c.estilo === "recto") {
    const p = a.caja ? borde(a.caja, a.centro, b.centro) : a.centro;
    const q = b.caja ? borde(b.caja, b.centro, a.centro) : b.centro;
    return { puntos: [p.x, p.y, q.x, q.y] };
  }
  // Codo: sale por el lado que mira al otro extremo y gira a mitad de camino.
  const dx = b.centro.x - a.centro.x, dy = b.centro.y - a.centro.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sx = a.caja ? a.centro.x + Math.sign(dx || 1) * a.caja.w / 2 : a.centro.x;
    const ex = b.caja ? b.centro.x - Math.sign(dx || 1) * b.caja.w / 2 : b.centro.x;
    const mx = (sx + ex) / 2;
    return { puntos: [sx, a.centro.y, mx, a.centro.y, mx, b.centro.y, ex, b.centro.y] };
  }
  const sy = a.caja ? a.centro.y + Math.sign(dy) * a.caja.h / 2 : a.centro.y;
  const ey = b.caja ? b.centro.y - Math.sign(dy) * b.caja.h / 2 : b.centro.y;
  const my = (sy + ey) / 2;
  return { puntos: [a.centro.x, sy, a.centro.x, my, b.centro.x, my, b.centro.x, ey] };
}
