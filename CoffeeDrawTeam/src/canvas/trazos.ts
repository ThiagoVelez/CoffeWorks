// Dibujo a mano: simplificación de trazos y borrador.

import type { Trazo } from "../board/model";
import type { Punto } from "./vista";

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ramer–Douglas–Peucker sobre [x0, y0, x1, y1, …]. */
export function simplificar(puntos: number[], tolerancia: number): number[] {
  const n = puntos.length / 2;
  if (n <= 2) return puntos.slice();
  const guardar = new Uint8Array(n);
  guardar[0] = guardar[n - 1] = 1;
  const pila: [number, number][] = [[0, n - 1]];
  while (pila.length) {
    const [i, j] = pila.pop()!;
    let max = 0, k = -1;
    for (let m = i + 1; m < j; m++) {
      const d = distSeg(puntos[2 * m], puntos[2 * m + 1], puntos[2 * i], puntos[2 * i + 1], puntos[2 * j], puntos[2 * j + 1]);
      if (d > max) { max = d; k = m; }
    }
    if (k >= 0 && max > tolerancia) {
      guardar[k] = 1;
      pila.push([i, k], [k, j]);
    }
  }
  const out: number[] = [];
  for (let m = 0; m < n; m++) if (guardar[m]) out.push(puntos[2 * m], puntos[2 * m + 1]);
  return out;
}

export function trazoTocado(t: Trazo, p: Punto, radio: number): boolean {
  const lim = radio + t.grosor / 2;
  const q = t.puntos;
  if (q.length === 2) return Math.hypot(p.x - t.x - q[0], p.y - t.y - q[1]) <= lim;
  for (let i = 0; i + 3 < q.length; i += 2)
    if (distSeg(p.x, p.y, t.x + q[i], t.y + q[i + 1], t.x + q[i + 2], t.y + q[i + 3]) <= lim) return true;
  return false;
}
