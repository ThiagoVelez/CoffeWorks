// Geometría de páginas y anotaciones.

import type { Annotation, PageItem, ViewBox } from "../types";

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Giro total de la página, normalizado a 0, 90, 180 o 270. */
export function totalRotation(page: Pick<PageItem, "baseRotation" | "rotation">): number {
  return (((page.baseRotation + page.rotation) % 360) + 360) % 360;
}

/** Tamaño de la página tal como se ve (ya girada), en puntos. */
export function displaySize(page: Pick<PageItem, "view" | "baseRotation" | "rotation">): { width: number; height: number } {
  const width = page.view[2] - page.view[0];
  const height = page.view[3] - page.view[1];
  return totalRotation(page) % 180 === 0 ? { width, height } : { width: height, height: width };
}

/**
 * Convierte un punto de la página vista en pantalla (origen arriba a la
 * izquierda) a coordenadas PDF de la página (origen abajo a la izquierda).
 * Es la inversa de la transformación que aplica pdf.js al dibujar.
 */
export function displayToPdf(view: ViewBox, rotation: number, x: number, y: number): [number, number] {
  const [x0, y0, x1, y1] = view;
  switch (rotation) {
    case 90:
      return [x0 + y, y0 + x];
    case 180:
      return [x1 - x, y0 + y];
    case 270:
      return [x1 - y, y1 - x];
    default:
      return [x0 + x, y1 - y];
  }
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boundsOf(annotation: Annotation): Bounds {
  switch (annotation.type) {
    case "line":
    case "arrow": {
      const x = Math.min(annotation.x1, annotation.x2);
      const y = Math.min(annotation.y1, annotation.y2);
      return { x, y, w: Math.abs(annotation.x2 - annotation.x1), h: Math.abs(annotation.y2 - annotation.y1) };
    }
    case "ink": {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < annotation.points.length; i += 2) {
        minX = Math.min(minX, annotation.points[i]);
        maxX = Math.max(maxX, annotation.points[i]);
        minY = Math.min(minY, annotation.points[i + 1]);
        maxY = Math.max(maxY, annotation.points[i + 1]);
      }
      if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    default:
      return { x: annotation.x, y: annotation.y, w: annotation.w, h: annotation.h };
  }
}

/** Ajusta una anotación a un nuevo recuadro (mover o cambiar de tamaño). */
export function withBounds(annotation: Annotation, next: Bounds): Annotation {
  const current = boundsOf(annotation);
  const sx = current.w > 0 ? next.w / current.w : 1;
  const sy = current.h > 0 ? next.h / current.h : 1;
  const mapX = (x: number) => next.x + (x - current.x) * sx;
  const mapY = (y: number) => next.y + (y - current.y) * sy;
  switch (annotation.type) {
    case "line":
    case "arrow":
      return { ...annotation, x1: mapX(annotation.x1), y1: mapY(annotation.y1), x2: mapX(annotation.x2), y2: mapY(annotation.y2) };
    case "ink":
      return { ...annotation, points: annotation.points.map((value, i) => (i % 2 === 0 ? mapX(value) : mapY(value))) };
    default:
      return { ...annotation, x: next.x, y: next.y, w: Math.max(1, next.w), h: Math.max(1, next.h) };
  }
}

export function translate(annotation: Annotation, dx: number, dy: number): Annotation {
  const b = boundsOf(annotation);
  return withBounds(annotation, { ...b, x: b.x + dx, y: b.y + dy });
}

/**
 * Recoloca una anotación cuando su página gira 90° en sentido horario (o
 * antihorario). `width` y `height` son las medidas de la página antes de girar.
 * Los textos e imágenes conservan su orientación y solo cambian de sitio.
 */
export function rotateAnnotation(annotation: Annotation, clockwise: boolean, width: number, height: number): Annotation {
  // Punto (x, y) de la página de W×H → página girada de H×W
  const map = (x: number, y: number): [number, number] => (clockwise ? [height - y, x] : [y, width - x]);

  switch (annotation.type) {
    case "line":
    case "arrow": {
      const [x1, y1] = map(annotation.x1, annotation.y1);
      const [x2, y2] = map(annotation.x2, annotation.y2);
      return { ...annotation, x1, y1, x2, y2 };
    }
    case "ink": {
      const points: number[] = [];
      for (let i = 0; i < annotation.points.length; i += 2) {
        points.push(...map(annotation.points[i], annotation.points[i + 1]));
      }
      return { ...annotation, points };
    }
    case "text":
    case "image": {
      const [cx, cy] = map(annotation.x + annotation.w / 2, annotation.y + annotation.h / 2);
      return { ...annotation, x: cx - annotation.w / 2, y: cy - annotation.h / 2 };
    }
    default: {
      const [ax, ay] = map(annotation.x, annotation.y);
      const [bx, by] = map(annotation.x + annotation.w, annotation.y + annotation.h);
      return {
        ...annotation,
        x: Math.min(ax, bx),
        y: Math.min(ay, by),
        w: Math.abs(bx - ax),
        h: Math.abs(by - ay),
      };
    }
  }
}

/** Distancia de un punto a un segmento (para seleccionar líneas finas). */
export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export const FONT_CSS: Record<string, string> = {
  Helvetica: "Helvetica, Arial, 'Liberation Sans', sans-serif",
  Times: "'Times New Roman', Times, 'Liberation Serif', serif",
  Courier: "'Courier New', Courier, 'Liberation Mono', monospace",
};

/** Separación interior y alto de línea de los cuadros de texto (en puntos). */
export const TEXT_PADDING = 2;
export const LINE_HEIGHT = 1.2;
