// Datos del cubo de vista: 6 caras, 12 aristas y 8 esquinas, cada una con la
// dirección desde la que mirar el modelo.

import type { Vec3 } from "./types";

export interface CubeRegion {
  id: string;
  kind: "face" | "edge" | "corner";
  dir: Vec3;
  label?: string;
}

const FACE_LABELS: Record<string, string> = {
  "0,0,1": "Frente",
  "0,0,-1": "Detrás",
  "1,0,0": "Der.",
  "-1,0,0": "Izq.",
  "0,1,0": "Arriba",
  "0,-1,0": "Abajo",
};

function build(): CubeRegion[] {
  const out: CubeRegion[] = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1]) {
        const n = Math.abs(x) + Math.abs(y) + Math.abs(z);
        if (n === 0) continue;
        const dir: Vec3 = [x, y, z];
        const kind = n === 1 ? "face" : n === 2 ? "edge" : "corner";
        out.push({ id: `${kind}:${dir.join(",")}`, kind, dir, label: FACE_LABELS[dir.join(",")] });
      }
  return out;
}

export const VIEWCUBE_REGIONS: CubeRegion[] = build();

/**
 * Dirección unitaria para la cámara. Si es vertical (sin «arriba» definido), se inclina
 * un poco hacia el rumbo de la cámara actual (`current`) para no girar la imagen.
 */
export function cameraDir(dir: Vec3, current?: Vec3): Vec3 {
  const d: Vec3 = [dir[0], dir[1], dir[2]];
  if (Math.abs(d[0]) < 1e-6 && Math.abs(d[2]) < 1e-6) {
    const h = current ? Math.hypot(current[0], current[2]) : 0;
    const k = 0.001 * Math.max(1, Math.abs(d[1]));
    if (current && h > 1e-6) {
      d[0] = (current[0] / h) * k;
      d[2] = (current[2] / h) * k;
    } else d[2] = k;
  }
  const len = Math.hypot(...d) || 1;
  return d.map((v) => v / len + 0) as Vec3;
}
