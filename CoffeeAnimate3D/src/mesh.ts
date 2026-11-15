// Mallas libres (complemento «Modelado libre»): formas de partida, validación y ayudas
// de topología compartidas por la geometría, la selección y las operaciones.

import { MAX_MESH_FACES, type MeshData, type MeshPrimitive, type Vec3 } from "./types";

export const DEFAULT_MESH_COLOR = "#c8a27a";
/** Vértices con |x| menor que esto están en el plano de simetría. */
export const MIRROR_EPS = 1e-3;

export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a: Vec3): Vec3 => {
  const l = len3(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
};

/** Normal (Newell) sin normalizar de un polígono. */
export function faceNormal(v: Vec3[], f: number[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < f.length; i++) {
    const a = v[f[i]];
    const b = v[f[(i + 1) % f.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

export function faceCenter(v: Vec3[], f: number[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const i of f) for (let k = 0; k < 3; k++) c[k] += v[i][k] / f.length;
  return c;
}

export const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);

/** Aristas → caras que las usan (con el sentido en que la cara la recorre). */
export function edgeFaces(faces: number[][]): Map<string, { face: number; from: number; to: number }[]> {
  const map = new Map<string, { face: number; from: number; to: number }[]>();
  faces.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const k = edgeKey(a, b);
      const list = map.get(k);
      if (list) list.push({ face: fi, from: a, to: b });
      else map.set(k, [{ face: fi, from: a, to: b }]);
    }
  });
  return map;
}

export function meshEdges(m: Pick<MeshData, "faces">): [number, number][] {
  return [...edgeFaces(m.faces).keys()]
    .map((k) => k.split(",").map(Number) as [number, number])
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

export function cloneMesh(m: MeshData): MeshData {
  return JSON.parse(JSON.stringify(m)) as MeshData;
}

export function emptyMesh(): MeshData {
  return { vertices: [], faces: [], uvs: [], texture: { size: 64, color: DEFAULT_MESH_COLOR }, mirrorX: false, subdivision: 0, smooth: false };
}

export function validateMesh(m: MeshData): string[] {
  const out: string[] = [];
  const n = m.vertices.length;
  if (m.faces.length > MAX_MESH_FACES) out.push("La malla tiene más de 20 000 caras");
  if (m.vertices.some((v) => !Array.isArray(v) || v.length !== 3 || v.some((x) => !Number.isFinite(x)))) out.push("Hay vértices con coordenadas no válidas");
  let badFace = false;
  m.faces.forEach((f, i) => {
    if (badFace) return;
    if (!Array.isArray(f) || f.length < 3) {
      out.push(`La cara ${i} tiene menos de 3 vértices`);
      badFace = true;
    } else if (f.some((x) => !Number.isInteger(x) || x < 0 || x >= n)) {
      out.push(`La cara ${i} usa un vértice que no existe`);
      badFace = true;
    } else if (new Set(f).size !== f.length) {
      out.push(`La cara ${i} repite un vértice`);
      badFace = true;
    }
  });
  if (m.uvs.length) {
    if (m.uvs.length !== m.faces.length || m.uvs.some((u, i) => !Array.isArray(u) || u.length !== m.faces[i]?.length)) out.push("Las UV no coinciden con las caras");
    else if (m.uvs.some((u) => u.some((p) => !(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1)))) out.push("Hay UV fuera de [0, 1]");
  }
  if (!badFace) {
    let over = false;
    let flipped = false;
    for (const list of edgeFaces(m.faces).values()) {
      if (list.length > 2) over = true;
      else if (list.length === 2 && list[0].from === list[1].from) flipped = true;
    }
    if (over) out.push("Hay aristas usadas por más de 2 caras");
    if (flipped) out.push("Hay caras vecinas con orientación opuesta");
  }
  if (m.mirrorX && m.vertices.some((v) => v[0] < -MIRROR_EPS)) out.push("Con simetría, ningún vértice puede estar en x < 0");
  return out;
}

// ---------- Formas de partida ----------

/** Rejilla n×n en cada cara de un cubo de lado `size`, con vértices compartidos. */
function gridCube(n: number, size: number): { vertices: Vec3[]; faces: number[][] } {
  const h = size / 2;
  const vertices: Vec3[] = [];
  const index = new Map<string, number>();
  const at = (p: Vec3) => {
    const k = p.map((x) => Math.round(x * 1e6)).join(",");
    let i = index.get(k);
    if (i === undefined) {
      i = vertices.length;
      vertices.push(p);
      index.set(k, i);
    }
    return i;
  };
  // Normal y dos ejes con U × V = normal.
  const sides: [Vec3, Vec3, Vec3][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const faces: number[][] = [];
  for (const [nrm, u, v] of sides) {
    const pt = (i: number, j: number): Vec3 => {
      const a = -h + (size * i) / n;
      const b = -h + (size * j) / n;
      return [nrm[0] * h + u[0] * a + v[0] * b, nrm[1] * h + u[1] * a + v[1] * b, nrm[2] * h + u[2] * a + v[2] * b];
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) faces.push([at(pt(i, j)), at(pt(i + 1, j)), at(pt(i + 1, j + 1)), at(pt(i, j + 1))]);
  }
  return { vertices, faces };
}

/** Pone cada cara mirando hacia fuera del origen (solo para formas convexas centradas). */
function orientOutward(vertices: Vec3[], faces: number[][]): number[][] {
  return faces.map((f) => (dot3(faceNormal(vertices, f), faceCenter(vertices, f)) < 0 ? [...f].reverse() : f));
}

export function primitiveMesh(kind: MeshPrimitive, size = 16): MeshData {
  const m = emptyMesh();
  const h = size / 2;
  if (kind === "cube" || kind === "sphere") {
    const g = gridCube(kind === "cube" ? 2 : 4, size);
    m.vertices = kind === "cube" ? g.vertices : g.vertices.map((p) => scale3(norm3(p), h));
    m.faces = g.faces;
  } else if (kind === "cylinder") {
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * i) / N;
      m.vertices.push([h * Math.cos(a), -h, h * Math.sin(a)]);
    }
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * i) / N;
      m.vertices.push([h * Math.cos(a), h, h * Math.sin(a)]);
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      m.faces.push([i, j, N + j, N + i]);
    }
    m.faces.push(Array.from({ length: N }, (_, i) => i));
    m.faces.push(Array.from({ length: N }, (_, i) => N + i));
    m.faces = orientOutward(m.vertices, m.faces);
  } else {
    const n = 4;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) m.vertices.push([-h + (size * i) / n, 0, -h + (size * j) / n]);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i;
        // (i,j) → (i,j+1) → (i+1,j+1) → (i+1,j): normal +Y.
        m.faces.push([a, a + n + 1, a + n + 2, a + 1]);
      }
  }
  m.vertices = m.vertices.map((p) => p.map((x) => Math.round(x * 1e6) / 1e6 + 0) as Vec3);
  return m;
}
