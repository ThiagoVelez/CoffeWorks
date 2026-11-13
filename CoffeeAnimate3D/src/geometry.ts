// Geometría común de las cajas: esquinas de cada cara en el orden de la textura
// (arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda, vistas desde
// fuera). La usan el visor, el pintado sobre el modelo y la exportación a glTF, así
// que el píxel (x, y) de una cara es el mismo en todos.

import { TEX, type Box, type FaceName, type Vec3 } from "./types";

type Sel = [0 | 1, 0 | 1, 0 | 1];

export const FACE_GEOMETRY: Record<FaceName, { normal: Vec3; corners: [Sel, Sel, Sel, Sel] }> = {
  px: { normal: [1, 0, 0], corners: [[1, 1, 1], [1, 1, 0], [1, 0, 0], [1, 0, 1]] },
  nx: { normal: [-1, 0, 0], corners: [[0, 1, 0], [0, 1, 1], [0, 0, 1], [0, 0, 0]] },
  py: { normal: [0, 1, 0], corners: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  ny: { normal: [0, -1, 0], corners: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] },
  pz: { normal: [0, 0, 1], corners: [[0, 1, 1], [1, 1, 1], [1, 0, 1], [0, 0, 1]] },
  nz: { normal: [0, 0, -1], corners: [[1, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0]] },
};

/** UV de las esquinas TL, TR, BR, BL (origen arriba a la izquierda, como glTF). */
export const CORNER_UV: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** Dos triángulos por cara, en sentido antihorario visto desde fuera. */
export const QUAD_INDICES = [0, 3, 2, 0, 2, 1];

/** Posiciones (relativas al pivote) de las 4 esquinas de una cara. */
export function faceCorners(box: Box, face: FaceName, scale = 1): Vec3[] {
  return FACE_GEOMETRY[face].corners.map(
    (c) => [0, 1, 2].map((k) => (box.from[k] + c[k] * box.size[k]) * scale) as Vec3,
  );
}

/** Píxel de la textura de una cara a partir de la UV del punto tocado. */
export function uvToPixel(u: number, v: number): [number, number] {
  const clamp = (n: number) => Math.min(TEX - 1, Math.max(0, Math.floor(n * TEX)));
  return [clamp(u), clamp(v)];
}
