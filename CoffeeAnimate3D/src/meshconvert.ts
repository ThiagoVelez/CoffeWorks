// Convertir piezas (cubo, cilindro, esfera, rampa, plano) en mallas conservando su pintura,
// e importar mallas ajenas (.obj / .glb) como mallas editables (solo geometría).

import { cross3, dot3, edgeKey, emptyMesh, faceNormal, len3, norm3, sub3, validateMesh } from "./mesh";
import { recalcNormals } from "./meshops";
import { shapeGeometry } from "./geometry";
import { encodeRgba, facePixels, findPart, hexToRgb } from "./model";
import type { RefMesh } from "./objfile";
import { FACES, MAX_MESH_FACES, TEX, type Box, type MeshData, type Model3D, type Vec3 } from "./types";

const LIMIT = "La malla superaría 20 000 caras";
const CELL = TEX;
const CONVERT_SIZE = 128;

/** ¿El polígono es convexo (todas las esquinas giran hacia el mismo lado que la normal)? */
function convex(v: Vec3[], f: number[]): boolean {
  const n = faceNormal(v, f);
  for (let i = 0; i < f.length; i++) {
    const a = v[f[i]];
    const b = v[f[(i + 1) % f.length]];
    const c = v[f[(i + 2) % f.length]];
    if (dot3(cross3(sub3(b, a), sub3(c, b)), n) <= 1e-12) return false;
  }
  return true;
}

/**
 * Une parejas de triángulos casi coplanares que forman un cuadrilátero convexo.
 * `groups` (opcional) impide unir triángulos de grupos distintos (p. ej. caras de un cubo).
 */
export function joinTriangles(v: Vec3[], tris: number[][], maxAngleDeg = 1, groups?: number[], outGroups?: number[]): number[][] {
  const cosMax = Math.cos((maxAngleDeg * Math.PI) / 180);
  const edgeTris = new Map<string, number[]>();
  tris.forEach((t, i) => t.forEach((a, k) => {
    const key = edgeKey(a, t[(k + 1) % 3]);
    edgeTris.set(key, [...(edgeTris.get(key) ?? []), i]);
  }));
  const used = new Array(tris.length).fill(false);
  const out: number[][] = [];
  tris.forEach((t, i) => {
    if (used[i]) return;
    const n1 = norm3(faceNormal(v, t));
    for (let k = 0; k < 3 && !used[i]; k++) {
      const x = t[k];
      const y = t[(k + 1) % 3];
      const p = t[(k + 2) % 3];
      for (const j of edgeTris.get(edgeKey(x, y)) ?? []) {
        if (j === i || used[j] || (groups && groups[i] !== groups[j])) continue;
        const u = tris[j];
        const ky = u.indexOf(y);
        if (u[(ky + 1) % 3] !== x) continue; // tiene que recorrer la arista al revés
        const q = u[(ky + 2) % 3];
        if (dot3(n1, norm3(faceNormal(v, u))) < cosMax) continue;
        const quad = [x, q, y, p];
        if (!convex(v, quad)) continue;
        used[i] = used[j] = true;
        out.push(quad);
        outGroups?.push(groups?.[i] ?? 0);
        break;
      }
    }
    if (!used[i]) {
      used[i] = true;
      out.push([...t]);
      outGroups?.push(groups?.[i] ?? 0);
    }
  });
  return out;
}

/** Suelda posiciones iguales (con tolerancia) y devuelve los índices nuevos. */
function weld(positions: number[], tol: number): { vertices: Vec3[]; map: number[] } {
  const vertices: Vec3[] = [];
  const map: number[] = [];
  const grid = new Map<string, number[]>();
  const cell = Math.max(tol * 4, 1e-9);
  for (let i = 0; i < positions.length; i += 3) {
    const p: Vec3 = [positions[i], positions[i + 1], positions[i + 2]];
    const key = p.map((x) => Math.round(x / cell)).join(",");
    let found = -1;
    const [gx, gy, gz] = p.map((x) => Math.round(x / cell));
    for (let dx = -1; dx <= 1 && found < 0; dx++)
      for (let dy = -1; dy <= 1 && found < 0; dy++)
        for (let dz = -1; dz <= 1 && found < 0; dz++)
          for (const c of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) if (len3(sub3(vertices[c], p)) <= tol) { found = c; break; }
    if (found < 0) {
      found = vertices.length;
      vertices.push(p);
      grid.set(key, [...(grid.get(key) ?? []), found]);
    }
    map.push(found);
  }
  return { vertices, map };
}

/** Malla con la forma de una pieza; la pintura de cada cara pasa a su celda de 32×32 en una textura de 128. */
export function boxToMesh(box: Box): MeshData {
  const g = shapeGeometry(box);
  const faceOfVertex: number[] = new Array(g.positions.length / 3).fill(0);
  for (const grp of g.groups) for (let k = grp.start; k < grp.start + grp.count; k++) faceOfVertex[g.indices[k]] = FACES.indexOf(grp.face);
  const { vertices, map } = weld(g.positions, 1e-6);
  const tris: number[][] = [];
  const triGroup: number[] = [];
  const uvOf = new Map<string, [number, number]>();
  for (let k = 0; k < g.indices.length; k += 3) {
    const corner = [g.indices[k], g.indices[k + 1], g.indices[k + 2]];
    const fi = faceOfVertex[corner[0]];
    tris.push(corner.map((c) => map[c]));
    triGroup.push(fi);
    for (const c of corner) {
      const cx = (fi % 4) * CELL;
      const cy = Math.floor(fi / 4) * CELL;
      uvOf.set(`${fi}:${map[c]}`, [(cx + g.uvs[c * 2] * CELL) / CONVERT_SIZE, (cy + g.uvs[c * 2 + 1] * CELL) / CONVERT_SIZE]);
    }
  }
  // Une triángulos de la misma cara del cubo y recuerda a qué cara pertenece cada polígono.
  const groupOf: number[] = [];
  const faces = joinTriangles(vertices, tris, 1, triGroup, groupOf);
  const mesh = emptyMesh();
  mesh.vertices = vertices.map((p) => p.map((x) => Math.round(x * 1e6) / 1e6 + 0) as Vec3);
  mesh.faces = faces;
  mesh.uvs = faces.map((f, i) => f.map((x) => uvOf.get(`${groupOf[i]}:${x}`) ?? [0, 0]));
  const base = box.faces[FACES[0]].color;
  const px = new Uint8Array(CONVERT_SIZE * CONVERT_SIZE * 4);
  const [r, gg, b] = hexToRgb(base);
  for (let i = 0; i < px.length; i += 4) (px[i] = r), (px[i + 1] = gg), (px[i + 2] = b), (px[i + 3] = 255);
  FACES.forEach((f, fi) => {
    const src = facePixels(box.faces[f]);
    const cx = (fi % 4) * CELL;
    const cy = Math.floor(fi / 4) * CELL;
    for (let row = 0; row < CELL; row++) px.set(src.subarray(row * CELL * 4, (row + 1) * CELL * 4), ((cy + row) * CONVERT_SIZE + cx) * 4);
  });
  mesh.texture = { size: CONVERT_SIZE, color: base, pixels: encodeRgba(px) };
  const issues = validateMesh(mesh);
  if (issues.length) throw new Error(issues[0]);
  return mesh;
}

/** La pieza pierde la caja y gana una malla con la misma forma y pintura. */
export function convertPartToMesh(m: Model3D, id: string): Model3D {
  const p = findPart(m, id);
  if (p.mesh) throw new Error(`«${p.name}» ya es una malla`);
  if (!p.box) throw new Error(`«${p.name}» no tiene caja que convertir`);
  const mesh = boxToMesh(p.box);
  return { ...m, parts: m.parts.map((x) => (x.id === id ? { ...x, box: null, mesh } : x)) };
}

/** Malla editable a partir de una malla ajena (posiciones y triángulos): suelda, junta y orienta. */
export function refToMesh(ref: RefMesh): MeshData {
  if (ref.indices.length / 3 > MAX_MESH_FACES * 2) throw new Error(LIMIT);
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < ref.positions.length; i += 3)
    for (let k = 0; k < 3; k++) (min[k] = Math.min(min[k], ref.positions[i + k])), (max[k] = Math.max(max[k], ref.positions[i + k]));
  const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const { vertices, map } = weld(ref.positions, Math.min(diag * 1e-4, 1e-3));
  const tris: number[][] = [];
  for (let k = 0; k < ref.indices.length; k += 3) {
    const t = [map[ref.indices[k]], map[ref.indices[k + 1]], map[ref.indices[k + 2]]];
    if (new Set(t).size === 3) tris.push(t);
  }
  const faces = joinTriangles(vertices, tris);
  if (faces.length > MAX_MESH_FACES) throw new Error(LIMIT);
  const mesh = emptyMesh();
  mesh.vertices = vertices.map((p) => p.map((x) => Math.round(x * 1e6) / 1e6 + 0) as Vec3);
  mesh.faces = faces;
  const out = recalcNormals(mesh);
  const issues = validateMesh(out);
  if (issues.length) throw new Error(`No se puede editar esta malla: ${issues[0].toLowerCase()}`);
  return out;
}
