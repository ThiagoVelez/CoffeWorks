// Ayudas para las pruebas de mallas (no es un archivo de pruebas).
import { cross3, dot3, emptyMesh, faceCenter, sub3 } from "./mesh";
import type { MeshData, Vec3 } from "./types";

/** Cada cara mira hacia fuera respecto al centro `c` (normal de los tres primeros vértices). */
export function facesOutward(m: Pick<MeshData, "vertices" | "faces">, c: Vec3 = [0, 0, 0]): boolean {
  return m.faces.every((f) => {
    const [a, b, d] = [m.vertices[f[0]], m.vertices[f[1]], m.vertices[f[2]]];
    return dot3(cross3(sub3(b, a), sub3(d, a)), sub3(faceCenter(m.vertices, f), c)) > 0;
  });
}

/** Cubo de 8 vértices y 6 caras de lado 16 centrado. */
export function cube8(): MeshData {
  const m = emptyMesh();
  m.vertices = [[-8, -8, -8], [8, -8, -8], [8, 8, -8], [-8, 8, -8], [-8, -8, 8], [8, -8, 8], [8, 8, 8], [-8, 8, 8]];
  m.faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
  return m;
}

/** Medio cubo (x ∈ [0, 8]) abierto por la cara x = 0, con simetría activa. */
export function halfCube(): MeshData {
  const m = emptyMesh();
  m.vertices = [[0, -8, -8], [8, -8, -8], [8, 8, -8], [0, 8, -8], [0, -8, 8], [8, -8, 8], [8, 8, 8], [0, 8, 8]];
  m.faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [1, 2, 6, 5]];
  m.mirrorX = true;
  return m;
}

