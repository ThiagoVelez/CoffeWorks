// Geometría común de las cajas: esquinas de cada cara en el orden de la textura
// (arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda, vistas desde
// fuera). La usan el visor, el pintado sobre el modelo y la exportación a glTF, así
// que el píxel (x, y) de una cara es el mismo en todos.

import { FACES, TEX, type Box, type FaceName, type Vec3 } from "./types";

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

// ---------------------------------------------------------------------------
// Formas: cada una usa las caras del cubo (y su textura de 32×32)
// ---------------------------------------------------------------------------

export interface ShapeMesh {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  /** Triángulos de cada cara (en el orden de FACES, solo las que usa la forma). */
  groups: { face: FaceName; start: number; count: number }[];
}

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** UV de un punto proyectado sobre el marco de una cara (TL → TR es u, TL → BL es v). */
function projectUV(box: Box, face: FaceName, p: V): [number, number] {
  const [tl, tr, , bl] = faceCorners(box, face) as V[];
  const eu = sub(tr, tl);
  const ev = sub(bl, tl);
  const d = sub(p, tl);
  const c = (n: number) => Math.min(1, Math.max(0, n));
  return [c(dot(d, eu) / dot(eu, eu)), c(dot(d, ev) / dot(ev, ev))];
}

interface Vert {
  p: V;
  n: V;
  uv: [number, number];
}

class Builder {
  private byFace = new Map<FaceName, { verts: Vert[]; tris: number[] }>();
  constructor(private center: V) {}
  private bucket(f: FaceName) {
    let b = this.byFace.get(f);
    if (!b) this.byFace.set(f, (b = { verts: [], tris: [] }));
    return b;
  }
  /** Triángulo; se ordena para que mire hacia `out` (o hacia fuera del centro). */
  tri(face: FaceName, a: Vert, b: Vert, c: Vert, out?: V) {
    const bk = this.bucket(face);
    const n = cross(sub(b.p, a.p), sub(c.p, a.p));
    const hint = out ?? sub([(a.p[0] + b.p[0] + c.p[0]) / 3, (a.p[1] + b.p[1] + c.p[1]) / 3, (a.p[2] + b.p[2] + c.p[2]) / 3], this.center);
    const i = bk.verts.length;
    bk.verts.push(a, b, c);
    if (dot(n, hint) >= 0) bk.tris.push(i, i + 1, i + 2);
    else bk.tris.push(i, i + 2, i + 1);
  }
  quad(face: FaceName, a: Vert, b: Vert, c: Vert, d: Vert, out?: V) {
    this.tri(face, a, b, c, out);
    this.tri(face, a, c, d, out);
  }
  build(scale: number): ShapeMesh {
    const m: ShapeMesh = { positions: [], normals: [], uvs: [], indices: [], groups: [] };
    for (const f of FACES) {
      const bk = this.byFace.get(f);
      if (!bk) continue;
      const base = m.positions.length / 3;
      const start = m.indices.length;
      for (const v of bk.verts) {
        m.positions.push(v.p[0] * scale, v.p[1] * scale, v.p[2] * scale);
        m.normals.push(...v.n);
        m.uvs.push(...v.uv);
      }
      m.indices.push(...bk.tris.map((i) => i + base));
      m.groups.push({ face: f, start, count: m.indices.length - start });
    }
    return m;
  }
}

function boxMesh(box: Box, scale: number): ShapeMesh {
  const m: ShapeMesh = { positions: [], normals: [], uvs: [], indices: [], groups: [] };
  FACES.forEach((f) => {
    const base = m.positions.length / 3;
    faceCorners(box, f, scale).forEach((c, k) => {
      m.positions.push(...c);
      m.normals.push(...FACE_GEOMETRY[f].normal);
      m.uvs.push(...CORNER_UV[k]);
    });
    m.groups.push({ face: f, start: m.indices.length, count: 6 });
    m.indices.push(...QUAD_INDICES.map((q) => q + base));
  });
  return m;
}

/** Cuartos del lateral del cilindro: cara y ángulo inicial (0° = +Z, 90° = +X). */
const CYL_QUARTERS: [FaceName, number][] = [
  ["pz", -45],
  ["px", 45],
  ["nz", 135],
  ["nx", 225],
];
const CYL_STEPS = 4;
const SPHERE_STEPS = 4;

/** Geometría de una pieza según su forma, en coordenadas relativas al pivote (× scale). */
export function shapeGeometry(box: Box, scale = 1): ShapeMesh {
  const shape = box.shape ?? "box";
  if (shape === "box") return boxMesh(box, scale);
  const [x0, y0, z0] = box.from;
  const [sx, sy, sz] = box.size;
  const [x1, y1, z1] = [x0 + sx, y0 + sy, z0 + sz];
  const c: V = [x0 + sx / 2, y0 + sy / 2, z0 + sz / 2];
  const B = new Builder(c);
  const vt = (face: FaceName, p: V, n: V, uv?: [number, number]): Vert => ({ p, n: norm(n), uv: uv ?? projectUV(box, face, p) });

  if (shape === "cylinder") {
    const [rx, rz] = [sx / 2, sz / 2];
    const at = (deg: number, y: number): V => [c[0] + rx * Math.sin((deg * Math.PI) / 180), y, c[2] + rz * Math.cos((deg * Math.PI) / 180)];
    const nAt = (deg: number): V => [Math.sin((deg * Math.PI) / 180) / rx, 0, Math.cos((deg * Math.PI) / 180) / rz];
    const rim: number[] = [];
    for (const [face, a0] of CYL_QUARTERS)
      for (let k = 0; k < CYL_STEPS; k++) {
        const [d0, d1] = [a0 + (90 * k) / CYL_STEPS, a0 + (90 * (k + 1)) / CYL_STEPS];
        const [u0, u1] = [k / CYL_STEPS, (k + 1) / CYL_STEPS];
        B.quad(face, vt(face, at(d0, y1), nAt(d0), [u0, 0]), vt(face, at(d1, y1), nAt(d1), [u1, 0]), vt(face, at(d1, y0), nAt(d1), [u1, 1]), vt(face, at(d0, y0), nAt(d0), [u0, 1]));
        rim.push(d0);
      }
    for (const [face, y, ny] of [["py", y1, 1], ["ny", y0, -1]] as [FaceName, number, number][]) {
      const mid: V = [c[0], y, c[2]];
      rim.forEach((d, i) => {
        const e = rim[(i + 1) % rim.length];
        B.tri(face, vt(face, mid, [0, ny, 0]), vt(face, at(d, y), [0, ny, 0]), vt(face, at(e, y), [0, ny, 0]), [0, ny, 0]);
      });
    }
  } else if (shape === "sphere") {
    const h: V = [sx / 2, sy / 2, sz / 2];
    for (const f of FACES) {
      const corners = FACE_GEOMETRY[f].corners.map((s) => s.map((v) => v * 2 - 1) as V);
      const [tl, tr, , bl] = corners;
      const point = (u: number, v: number): Vert => {
        const q = norm([tl[0] + u * (tr[0] - tl[0]) + v * (bl[0] - tl[0]), tl[1] + u * (tr[1] - tl[1]) + v * (bl[1] - tl[1]), tl[2] + u * (tr[2] - tl[2]) + v * (bl[2] - tl[2])]);
        return { p: [c[0] + q[0] * h[0], c[1] + q[1] * h[1], c[2] + q[2] * h[2]], n: norm([q[0] / h[0], q[1] / h[1], q[2] / h[2]]), uv: [u, v] };
      };
      for (let i = 0; i < SPHERE_STEPS; i++)
        for (let j = 0; j < SPHERE_STEPS; j++) {
          const [u0, u1, v0, v1] = [i / SPHERE_STEPS, (i + 1) / SPHERE_STEPS, j / SPHERE_STEPS, (j + 1) / SPHERE_STEPS];
          B.quad(f, point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1));
        }
    }
  } else if (shape === "ramp") {
    const n = (v: V) => v;
    B.quad("ny", vt("ny", [x0, y0, z0], n([0, -1, 0])), vt("ny", [x1, y0, z0], n([0, -1, 0])), vt("ny", [x1, y0, z1], n([0, -1, 0])), vt("ny", [x0, y0, z1], n([0, -1, 0])), [0, -1, 0]);
    B.quad("nz", vt("nz", [x0, y0, z0], n([0, 0, -1])), vt("nz", [x1, y0, z0], n([0, 0, -1])), vt("nz", [x1, y1, z0], n([0, 0, -1])), vt("nz", [x0, y1, z0], n([0, 0, -1])), [0, 0, -1]);
    const slope: V = [0, sz, sy];
    B.quad("py", vt("py", [x0, y1, z0], slope), vt("py", [x1, y1, z0], slope), vt("py", [x1, y0, z1], slope), vt("py", [x0, y0, z1], slope), slope);
    for (const [face, x, nx] of [["px", x1, 1], ["nx", x0, -1]] as [FaceName, number, number][])
      B.tri(face, vt(face, [x, y0, z0], [nx, 0, 0]), vt(face, [x, y1, z0], [nx, 0, 0]), vt(face, [x, y0, z1], [nx, 0, 0]), [nx, 0, 0]);
  } else {
    // Plano: la cara de arriba, a media altura, visible por los dos lados.
    const y = c[1];
    const pts: V[] = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
    const uv = (p: V): [number, number] => projectUV(box, "py", [p[0], y1, p[2]]);
    for (const s of [1, -1]) {
      const [a, b, cc, d] = pts.map((p) => ({ p, n: [0, s, 0] as V, uv: uv(p) }));
      B.quad("py", a, b, cc, d, [0, s, 0]);
    }
  }
  return B.build(scale);
}
