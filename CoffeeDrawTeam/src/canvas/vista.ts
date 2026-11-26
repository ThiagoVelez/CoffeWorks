// Cámara del tablero: desplazamiento y zoom.

export interface Camara { x: number; y: number; zoom: number }
export interface Punto { x: number; y: number }
export interface Caja { x: number; y: number; w: number; h: number }

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;

const limitar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function aPantalla(c: Camara, p: Punto): Punto {
  return { x: (p.x - c.x) * c.zoom, y: (p.y - c.y) * c.zoom };
}

export function aTablero(c: Camara, p: Punto): Punto {
  return { x: p.x / c.zoom + c.x, y: p.y / c.zoom + c.y };
}

/** Cambia el zoom dejando quieto el punto del tablero que está bajo `punto` (en pantalla). */
export function zoomEn(c: Camara, factor: number, punto: Punto): Camara {
  const zoom = limitar(c.zoom * factor);
  const b = aTablero(c, punto);
  return { zoom, x: b.x - punto.x / zoom, y: b.y - punto.y / zoom };
}

export function unirCajas(cajas: Caja[]): Caja | null {
  if (!cajas.length) return null;
  const x0 = Math.min(...cajas.map((k) => k.x)), y0 = Math.min(...cajas.map((k) => k.y));
  const x1 = Math.max(...cajas.map((k) => k.x + k.w)), y1 = Math.max(...cajas.map((k) => k.y + k.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Cámara que muestra todas las cajas con un margen. Sin cajas, el origen al centro. */
export function ajustarTodo(cajas: Caja[], ancho: number, alto: number, margen = 60): Camara {
  const u = unirCajas(cajas);
  if (!u) return { x: -ancho / 2, y: -alto / 2, zoom: 1 };
  const zoom = limitar(Math.min((ancho - 2 * margen) / Math.max(u.w, 1), (alto - 2 * margen) / Math.max(u.h, 1), 2));
  const cx = u.x + u.w / 2, cy = u.y + u.h / 2;
  return { zoom, x: cx - ancho / 2 / zoom, y: cy - alto / 2 / zoom };
}
