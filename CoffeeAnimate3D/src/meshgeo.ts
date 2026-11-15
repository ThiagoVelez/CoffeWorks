// Geometría que se dibuja y se exporta a partir de una malla: simetría en X, subdivisión
// Catmull–Clark y triangulación con normales y UV por esquina. La usan el visor, glTF y OBJ.

import { MIRROR_EPS, add3, edgeFaces, edgeKey, faceNormal, norm3, scale3 } from "./mesh";
import type { MeshData, Vec3 } from "./types";

type UV = [number, number];

export interface MirrorResult {
  vertices: Vec3[];
  faces: number[][];
  uvs: UV[][];
  /** Vértice de la malla base del que sale cada vértice. */
  source: number[];
  /** Cara de la malla base de la que sale cada cara. */
  faceSource: number[];
}

/** Aplica la simetría en X (si está activa): suelda el centro y refleja el resto. */
export function mirrorMesh(mesh: MeshData): MirrorResult {
  const n = mesh.vertices.length;
  const identity = Array.from({ length: n }, (_, i) => i);
  if (!mesh.mirrorX)
    return { vertices: mesh.vertices.map((v) => [...v] as Vec3), faces: mesh.faces.map((f) => [...f]), uvs: mesh.uvs.map((u) => u.map((p) => [...p] as UV)), source: identity, faceSource: mesh.faces.map((_, i) => i) };
  const center = mesh.vertices.map((v) => Math.abs(v[0]) < MIRROR_EPS);
  const vertices: Vec3[] = mesh.vertices.map((v, i) => (center[i] ? [0, v[1], v[2]] : [...v]) as Vec3);
  const source = [...identity];
  const twin = identity.map((i) => {
    if (center[i]) return i;
    vertices.push([-mesh.vertices[i][0], mesh.vertices[i][1], mesh.vertices[i][2]]);
    source.push(i);
    return vertices.length - 1;
  });
  const faces = mesh.faces.map((f) => [...f]);
  const uvs = mesh.uvs.map((u) => u.map((p) => [...p] as UV));
  const faceSource = mesh.faces.map((_, i) => i);
  mesh.faces.forEach((f, fi) => {
    // Una cara apoyada entera en el plano de simetría no se duplica.
    if (f.every((i) => center[i])) return;
    faces.push([...f].reverse().map((i) => twin[i]));
    if (mesh.uvs.length) uvs.push([...mesh.uvs[fi]].reverse().map((p) => [...p] as UV));
    faceSource.push(fi);
  });
  return { vertices, faces, uvs, source, faceSource };
}

/** Un nivel de Catmull–Clark. Devuelve solo cuadriláteros; las UV se interpolan dentro de cada cara. */
export function subdivideOnce(v: Vec3[], f: number[][], uv: UV[][]): { vertices: Vec3[]; faces: number[][]; uvs: UV[][]; faceSource: number[] } {
  const n = v.length;
  const facePt = f.map((face) => {
    let c: Vec3 = [0, 0, 0];
    for (const i of face) c = add3(c, v[i]);
    return scale3(c, 1 / face.length);
  });
  const edges = edgeFaces(f);
  const edgeIndex = new Map<string, number>();
  const vertices: Vec3[] = [];
  // Vecinos y caras por vértice.
  const nbr: Set<number>[] = Array.from({ length: n }, () => new Set());
  const vFaces: number[][] = Array.from({ length: n }, () => []);
  f.forEach((face, fi) => face.forEach((i) => vFaces[i].push(fi)));
  for (const k of edges.keys()) {
    const [a, b] = k.split(",").map(Number);
    nbr[a].add(b);
    nbr[b].add(a);
  }
  const isBoundaryEdge = (a: number, b: number) => edges.get(edgeKey(a, b))!.length === 1;
  for (let i = 0; i < n; i++) {
    const P = v[i];
    const ns = [...nbr[i]];
    if (!ns.length) {
      vertices.push([...P]);
      continue;
    }
    const bnd = ns.filter((j) => isBoundaryEdge(i, j));
    if (bnd.length) {
      // Esquina (una sola cara) o borde raro: no se mueve. Borde normal: (6P + vecinos) / 8.
      if (vFaces[i].length === 1 || bnd.length !== 2) vertices.push([...P]);
      else vertices.push(scale3(add3(scale3(P, 6), add3(v[bnd[0]], v[bnd[1]])), 1 / 8));
      continue;
    }
    const k = ns.length;
    let F: Vec3 = [0, 0, 0];
    for (const fi of vFaces[i]) F = add3(F, facePt[fi]);
    F = scale3(F, 1 / vFaces[i].length);
    let R: Vec3 = [0, 0, 0];
    for (const j of ns) R = add3(R, scale3(add3(P, v[j]), 0.5));
    R = scale3(R, 1 / k);
    vertices.push(scale3(add3(add3(F, scale3(R, 2)), scale3(P, k - 3)), 1 / k));
  }
  for (const [k, list] of edges) {
    const [a, b] = k.split(",").map(Number);
    const mid = scale3(add3(v[a], v[b]), 0.5);
    edgeIndex.set(k, vertices.length);
    vertices.push(list.length === 2 ? scale3(add3(add3(v[a], v[b]), add3(facePt[list[0].face], facePt[list[1].face])), 0.25) : mid);
  }
  const faceBase = vertices.length;
  vertices.push(...facePt);
  const faces: number[][] = [];
  const uvs: UV[][] = [];
  const faceSource: number[] = [];
  const hasUv = uv.length === f.length && f.length > 0;
  f.forEach((face, fi) => {
    const L = face.length;
    const fu = hasUv ? uv[fi] : null;
    const cu: UV = [0, 0];
    if (fu) for (const p of fu) (cu[0] += p[0] / L), (cu[1] += p[1] / L);
    for (let i = 0; i < L; i++) {
      const prev = (i + L - 1) % L;
      const next = (i + 1) % L;
      faces.push([face[i], edgeIndex.get(edgeKey(face[i], face[next]))!, faceBase + fi, edgeIndex.get(edgeKey(face[prev], face[i]))!]);
      faceSource.push(fi);
      if (fu) {
        const mid = (a: UV, b: UV): UV => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        uvs.push([[...fu[i]] as UV, mid(fu[i], fu[next]), [...cu] as UV, mid(fu[prev], fu[i])]);
      }
    }
  });
  return { vertices, faces, uvs, faceSource };
}

export interface MeshGeometry {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  /** Cara de la malla base de la que sale cada triángulo. */
  faceOf: number[];
}

/** Geometría final (simetría → subdivisión → triángulos), por esquinas: posiciones, normales y UV. */
export function meshGeometry(mesh: MeshData, scale = 1, subdivision: number = mesh.subdivision): MeshGeometry {
  const mir = mirrorMesh(mesh);
  let vertices = mir.vertices;
  let faces = mir.faces;
  let uvs = mir.uvs;
  let origin = mir.faceSource;
  for (let l = 0; l < subdivision; l++) {
    const r = subdivideOnce(vertices, faces, uvs);
    origin = r.faceSource.map((i) => origin[i]);
    vertices = r.vertices;
    faces = r.faces;
    uvs = r.uvs;
  }
  const fn = faces.map((f) => norm3(faceNormal(vertices, f)));
  let vn: Vec3[] = [];
  if (mesh.smooth) {
    vn = vertices.map(() => [0, 0, 0] as Vec3);
    faces.forEach((f) => {
      const n = faceNormal(vertices, f);
      for (const i of f) vn[i] = add3(vn[i], n);
    });
    vn = vn.map(norm3);
  }
  const out: MeshGeometry = { positions: [], normals: [], uvs: [], indices: [], faceOf: [] };
  const hasUv = uvs.length === faces.length && faces.length > 0;
  faces.forEach((f, fi) => {
    const base = out.positions.length / 3;
    f.forEach((vi, c) => {
      const p = vertices[vi];
      out.positions.push(p[0] * scale + 0, p[1] * scale + 0, p[2] * scale + 0);
      const nn = mesh.smooth && (vn[vi][0] || vn[vi][1] || vn[vi][2]) ? vn[vi] : fn[fi];
      out.normals.push(nn[0], nn[1], nn[2]);
      const u = hasUv ? uvs[fi][c] : [0, 0];
      out.uvs.push(u[0], u[1]);
    });
    for (let k = 1; k + 1 < f.length; k++) {
      out.indices.push(base, base + k, base + k + 1);
      out.faceOf.push(origin[fi]);
    }
  });
  return out;
}
