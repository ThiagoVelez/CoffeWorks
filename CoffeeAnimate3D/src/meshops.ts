// Operaciones de edición de mallas (complemento «Modelado libre»). Todas son puras:
// devuelven una malla nueva y válida, o lanzan un error en español que se muestra tal cual.
// Si la malla está desplegada, las caras nuevas reciben UV interpoladas.

import { MIRROR_EPS, add3, cross3, dot3, edgeFaces, edgeKey, faceCenter, faceNormal, len3, norm3, scale3, sub3, validateMesh } from "./mesh";
import { mirrorMesh, subdivideOnce } from "./meshgeo";
import { neighbors, selectedEdges, selectedFaces } from "./meshsel";
import { rotateVec, type Quat } from "./rotation";
import { MAX_MESH_FACES, type MeshData, type SelectMode, type Vec3 } from "./types";

type UV = [number, number];
const LIMIT = "La malla superaría 20 000 caras";

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lerp2 = (a: UV, b: UV, t: number): UV => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp01 = (x: number) => Math.min(1, Math.max(0, Math.round(x * 1e6) / 1e6));
const r6 = (v: Vec3): Vec3 => v.map((x) => Math.round(x * 1e6) / 1e6 + 0) as Vec3;

/** Malla de trabajo: vértices, caras y UV por esquina (null si no está desplegada). */
interface Work {
  v: Vec3[];
  f: number[][];
  uv: UV[][] | null;
}

const work = (m: MeshData): Work => ({ v: m.vertices.map((p) => [...p] as Vec3), f: m.faces.map((f) => [...f]), uv: m.uvs.length ? m.uvs.map((u) => u.map((p) => [...p] as UV)) : null });

const cornerUv = (w: Work, fi: number, vi: number): UV => {
  if (!w.uv) return [0, 0];
  const k = w.f[fi].indexOf(vi);
  return k >= 0 ? [...w.uv[fi][k]] : [0, 0];
};

/**
 * Cierra una operación: quita vértices sueltos, comprueba el límite y la validez.
 * `remap[i]` es el índice nuevo del vértice i (o −1 si desaparece).
 */
function build(m: MeshData, w: Work, prefix = ""): { mesh: MeshData; remap: number[] } {
  if (w.f.length > MAX_MESH_FACES) throw new Error(LIMIT);
  const used = new Array(w.v.length).fill(false);
  for (const f of w.f) for (const i of f) used[i] = true;
  const remap: number[] = [];
  const vertices: Vec3[] = [];
  w.v.forEach((p, i) => {
    remap.push(used[i] ? vertices.length : -1);
    if (used[i]) vertices.push(r6(p));
  });
  const mesh: MeshData = {
    ...m,
    vertices,
    faces: w.f.map((f) => f.map((i) => remap[i])),
    uvs: w.uv ? w.uv.map((u) => u.map((p) => [clamp01(p[0]), clamp01(p[1])] as UV)) : [],
    texture: { ...m.texture },
  };
  if (m.weights) mesh.weights = m.weights.filter((_, i) => i < remap.length && used[i]);
  if (mesh.weights && mesh.weights.length !== vertices.length) delete mesh.weights;
  const issues = validateMesh(mesh);
  if (issues.length) throw new Error(prefix + issues[0]);
  return { mesh, remap };
}

const isCenter = (p: Vec3) => Math.abs(p[0]) < MIRROR_EPS;

/** Con simetría: los vértices del centro siguen en x = 0 y nadie pasa a x < 0. */
function clampMirror(m: MeshData, before: Vec3[], after: Vec3[]): Vec3[] {
  if (!m.mirrorX) return after;
  return after.map((p, i) => [i < before.length && isCenter(before[i]) ? 0 : Math.max(0, p[0]), p[1], p[2]] as Vec3);
}

// ---------- Transformar ----------

function transform(m: MeshData, w: Map<number, number>, fn: (p: Vec3) => Vec3): MeshData {
  const after = m.vertices.map((p, i) => {
    const k = w.get(i) ?? 0;
    return k ? r6(lerp3(p, fn(p), k)) : ([...p] as Vec3);
  });
  return { ...m, vertices: clampMirror(m, m.vertices, after) };
}

export function moveVertices(m: MeshData, w: Map<number, number>, delta: Vec3): MeshData {
  return transform(m, w, (p) => add3(p, delta));
}

export function rotateVertices(m: MeshData, w: Map<number, number>, quat: Quat, center: Vec3): MeshData {
  return transform(m, w, (p) => add3(center, rotateVec(quat, sub3(p, center))));
}

export function scaleVertices(m: MeshData, w: Map<number, number>, factor: Vec3, center: Vec3): MeshData {
  return transform(m, w, (p) => [center[0] + (p[0] - center[0]) * factor[0], center[1] + (p[1] - center[1]) * factor[1], center[2] + (p[2] - center[2]) * factor[2]]);
}

// ---------- Extruir e insertar ----------

/** Lado de la simetría: una arista de borde apoyada en x = 0 no se extruye. */
const seamEdge = (m: MeshData, w: Work, a: number, b: number, faces: number) => m.mirrorX && faces === 1 && isCenter(w.v[a]) && isCenter(w.v[b]);

/** Duplica una región de caras y la une con caras laterales. Devuelve el mapa viejo → nuevo. */
function extrudeRegion(m: MeshData, w: Work, region: number[], offset: Vec3): Map<number, number> {
  const inRegion = new Set(region);
  const ef = edgeFaces(w.f);
  const dup = new Map<number, number>();
  for (const fi of region)
    for (const v of w.f[fi])
      if (!dup.has(v)) {
        dup.set(v, w.v.length);
        w.v.push(add3(w.v[v], offset));
      }
  const sides: { face: number[]; uv: UV[] }[] = [];
  for (const fi of region) {
    const f = w.f[fi];
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const list = ef.get(edgeKey(a, b))!;
      if (list.some((x) => x.face !== fi && inRegion.has(x.face))) continue;
      if (seamEdge(m, w, a, b, list.length)) continue;
      const ua = cornerUv(w, fi, a);
      const ub = cornerUv(w, fi, b);
      sides.push({ face: [a, b, dup.get(b)!, dup.get(a)!], uv: [ua, ub, ub, ua] });
    }
  }
  for (const fi of region) w.f[fi] = w.f[fi].map((v) => dup.get(v)!);
  for (const s of sides) {
    w.f.push(s.face);
    if (w.uv) w.uv.push(s.uv);
  }
  return dup;
}

function averageNormal(w: Work, faces: number[]): Vec3 {
  let n: Vec3 = [0, 0, 0];
  for (const fi of faces) n = add3(n, norm3(faceNormal(w.v, w.f[fi])));
  return norm3(n);
}

export function extrude(m: MeshData, verts: number[], distance = 4): { mesh: MeshData; verts: number[] } {
  const w = work(m);
  const faces = selectedFaces(m, verts);
  let created: number[];
  if (faces.length) {
    const dup = extrudeRegion(m, w, faces, scale3(averageNormal(w, faces), distance));
    created = [...dup.values()];
    // Los vértices nuevos del centro siguen en el centro.
    if (m.mirrorX) for (const [old, nw] of dup) w.v[nw] = [isCenter(w.v[old]) ? 0 : Math.max(0, w.v[nw][0]), w.v[nw][1], w.v[nw][2]];
  } else {
    const ef = edgeFaces(m.faces);
    const edges = selectedEdges(m, verts).filter(([a, b]) => ef.get(edgeKey(a, b))!.length === 1 && !seamEdge(m, w, a, b, 1));
    if (!edges.length) throw new Error("Extruir: selecciona caras o aristas de borde");
    const dir = new Map<number, Vec3>();
    const oriented = edges.map(([x, y]) => ef.get(edgeKey(x, y))![0]);
    for (const e of oriented) {
      const out = norm3(cross3(sub3(w.v[e.to], w.v[e.from]), faceNormal(w.v, w.f[e.face])));
      for (const v of [e.from, e.to]) dir.set(v, add3(dir.get(v) ?? [0, 0, 0], out));
    }
    const dup = new Map<number, number>();
    for (const [v, d] of dir) {
      dup.set(v, w.v.length);
      const p = add3(w.v[v], scale3(norm3(d), distance));
      w.v.push(m.mirrorX ? [isCenter(w.v[v]) ? 0 : Math.max(0, p[0]), p[1], p[2]] : p);
    }
    for (const e of oriented) {
      w.f.push([e.to, e.from, dup.get(e.from)!, dup.get(e.to)!]);
      if (w.uv) {
        const ua = cornerUv(w, e.face, e.from);
        const ub = cornerUv(w, e.face, e.to);
        w.uv.push([ub, ua, ua, ub]);
      }
    }
    created = [...dup.values()];
  }
  const { mesh, remap } = build(m, w);
  return { mesh, verts: created.map((i) => remap[i]).filter((i) => i >= 0) };
}

/** Grupos de caras conectadas por aristas. */
function regions(faces: number[][], sel: number[]): number[][] {
  const set = new Set(sel);
  const ef = edgeFaces(faces);
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const s of sel) {
    if (seen.has(s)) continue;
    const group: number[] = [];
    const stack = [s];
    seen.add(s);
    while (stack.length) {
      const fi = stack.pop()!;
      group.push(fi);
      const f = faces[fi];
      for (let i = 0; i < f.length; i++)
        for (const x of ef.get(edgeKey(f[i], f[(i + 1) % f.length]))!) if (set.has(x.face) && !seen.has(x.face)) (seen.add(x.face), stack.push(x.face));
    }
    out.push(group);
  }
  return out;
}

export function inset(m: MeshData, verts: number[], amount = 2): { mesh: MeshData; verts: number[] } {
  const faces = selectedFaces(m, verts);
  if (!faces.length) throw new Error("Insertar cara: selecciona caras");
  const w = work(m);
  const created: number[] = [];
  for (const region of regions(w.f, faces)) {
    const set = new Set(region);
    const ef = edgeFaces(w.f);
    // Aristas del borde de la región (con su cara y sentido), antes de duplicar.
    const border: { from: number; to: number; face: number }[] = [];
    for (const fi of region) {
      const f = w.f[fi];
      for (let i = 0; i < f.length; i++) {
        const a = f[i];
        const b = f[(i + 1) % f.length];
        const list = ef.get(edgeKey(a, b))!;
        if (!list.some((x) => x.face !== fi && set.has(x.face)) && !seamEdge(m, w, a, b, list.length)) border.push({ from: a, to: b, face: fi });
      }
    }
    const inward = new Map<number, Vec3[]>();
    for (const e of border) {
      const d = norm3(cross3(faceNormal(w.v, w.f[e.face]), sub3(w.v[e.to], w.v[e.from])));
      for (const v of [e.from, e.to]) inward.set(v, [...(inward.get(v) ?? []), d]);
    }
    const dup = extrudeRegion(m, w, region, [0, 0, 0]);
    for (const [old, dirs] of inward) {
      // Inglete: la distancia a cada arista es `amount`.
      const d = norm3(dirs.reduce(add3, [0, 0, 0] as Vec3));
      const k = Math.max(0.2, Math.min(...dirs.map((x) => dot3(x, d))));
      const nw = dup.get(old)!;
      const p = add3(w.v[old], scale3(d, amount / k));
      w.v[nw] = m.mirrorX && isCenter(w.v[old]) ? [0, p[1], p[2]] : p;
    }
    created.push(...dup.values());
  }
  const { mesh, remap } = build(m, w);
  return { mesh, verts: created.map((i) => remap[i]).filter((i) => i >= 0) };
}

// ---------- Corte en bucle ----------

/** Gira una cara para que empiece en la posición `k`. */
const rot = <T>(a: T[], k: number): T[] => [...a.slice(k), ...a.slice(0, k)];

export function loopCut(m: MeshData, a: number, b: number, t = 0.5): { mesh: MeshData; verts: number[] } {
  const w = work(m);
  const ef = edgeFaces(w.f);
  const start = ef.get(edgeKey(a, b));
  if (!start) throw new Error("Corte en bucle: elige una arista de la malla");
  // Arista cortada → vértice del lado A (el parámetro t se mide desde ahí).
  const cut = new Map<string, { from: number; to: number }>();
  const crossed = new Map<number, [string, string]>();
  const walk = (face: number, from: number, to: number) => {
    for (let guard = 0; guard < w.f.length + 1; guard++) {
      const f = w.f[face];
      if (f.length !== 4 || crossed.has(face)) return;
      const i = f.indexOf(from);
      const j = f.indexOf(to);
      // c0..c3 con (c0, c1) la arista de entrada en el orden de la cara.
      const k = (i + 1) % 4 === j ? i : j;
      const c = rot(f, k);
      const sideA0 = c[0] === from;
      const nextFrom = sideA0 ? c[3] : c[2];
      const nextTo = sideA0 ? c[2] : c[3];
      crossed.set(face, [edgeKey(c[0], c[1]), edgeKey(c[2], c[3])]);
      const key = edgeKey(nextFrom, nextTo);
      if (!cut.has(key)) cut.set(key, { from: nextFrom, to: nextTo });
      const other = ef.get(key)!.find((x) => x.face !== face);
      if (!other) return;
      face = other.face;
      from = nextFrom;
      to = nextTo;
    }
  };
  cut.set(edgeKey(a, b), { from: a, to: b });
  for (const s of start) walk(s.face, a, b);
  if (!crossed.size) throw new Error("Corte en bucle: la arista no está entre cuadriláteros");
  const newVert = new Map<string, number>();
  for (const [key, e] of cut) {
    newVert.set(key, w.v.length);
    w.v.push(lerp3(w.v[e.from], w.v[e.to], t));
  }
  const at = (fi: number, x: number, y: number): UV => {
    const e = cut.get(edgeKey(x, y))!;
    return lerp2(cornerUv(w, fi, e.from), cornerUv(w, fi, e.to), t);
  };
  const faces: number[][] = [];
  const uvs: UV[][] = [];
  w.f.forEach((f, fi) => {
    const pair = crossed.get(fi);
    if (pair) {
      const k = f.findIndex((_, i) => edgeKey(f[i], f[(i + 1) % 4]) === pair[0]);
      const c = rot(f, k);
      const m01 = newVert.get(edgeKey(c[0], c[1]))!;
      const m23 = newVert.get(edgeKey(c[2], c[3]))!;
      faces.push([c[0], m01, m23, c[3]], [m01, c[1], c[2], m23]);
      if (w.uv) {
        const u = c.map((v) => cornerUv(w, fi, v));
        const u01 = at(fi, c[0], c[1]);
        const u23 = at(fi, c[2], c[3]);
        uvs.push([u[0], u01, u23, u[3]], [u01, u[1], u[2], u23]);
      }
      return;
    }
    // Caras de los extremos (no cuadriláteros o fuera del anillo): se les inserta el vértice.
    const nf: number[] = [];
    const nu: UV[] = [];
    f.forEach((v, i) => {
      const nx = f[(i + 1) % f.length];
      nf.push(v);
      if (w.uv) nu.push(cornerUv(w, fi, v));
      const key = edgeKey(v, nx);
      if (newVert.has(key)) {
        nf.push(newVert.get(key)!);
        if (w.uv) nu.push(at(fi, v, nx));
      }
    });
    faces.push(nf);
    if (w.uv) uvs.push(nu);
  });
  w.f = faces;
  if (w.uv) w.uv = uvs;
  const { mesh, remap } = build(m, w);
  return { mesh, verts: [...newVert.values()].map((i) => remap[i]) };
}

// ---------- Biselar ----------

const BEVEL_CHAIN = "Biselar: selecciona aristas en hilera (cadenas o bucles)";

/** Abanico ordenado de caras alrededor de v: cara f_i y su arista de salida (v, q_i). */
function fan(w: Work, ef: ReturnType<typeof edgeFaces>, v: number): { face: number; q: number }[] | null {
  const first = w.f.findIndex((f) => f.includes(v));
  if (first < 0) return null;
  const out: { face: number; q: number }[] = [];
  let face = first;
  for (let guard = 0; guard <= w.f.length; guard++) {
    const f = w.f[face];
    const q = f[(f.indexOf(v) + 1) % f.length];
    out.push({ face, q });
    const other = ef.get(edgeKey(v, q))!.find((x) => x.face !== face);
    if (!other) return null;
    if (other.face === first) return out;
    face = other.face;
  }
  return null;
}

export function bevel(m: MeshData, verts: number[], width = 2): { mesh: MeshData; verts: number[] } {
  const w = work(m);
  const ef = edgeFaces(w.f);
  const edges = selectedEdges(m, verts);
  if (!edges.length) throw new Error(BEVEL_CHAIN);
  const count = new Map<number, number>();
  for (const [a, b] of edges) for (const v of [a, b]) count.set(v, (count.get(v) ?? 0) + 1);
  if ([...count.values()].some((c) => c > 2)) throw new Error(BEVEL_CHAIN);
  if (edges.some(([a, b]) => ef.get(edgeKey(a, b))!.length !== 2)) throw new Error("Biselar: solo aristas entre dos caras");
  const sel = new Set(edges.map(([a, b]) => edgeKey(a, b)));
  /** `${cara}:${vértice}` → vértices nuevos que lo sustituyen en esa cara. */
  const repl = new Map<string, number[]>();
  const created: number[] = [];
  const add = (p: Vec3) => {
    w.v.push(p);
    created.push(w.v.length - 1);
    return w.v.length - 1;
  };
  const toward = (v: number, qs: number[], face: number): Vec3 => {
    const d = qs.length ? norm3(qs.map((q) => norm3(sub3(w.v[q], w.v[v]))).reduce(add3, [0, 0, 0] as Vec3)) : norm3(sub3(faceCenter(w.v, w.f[face]), w.v[v]));
    const p = add3(w.v[v], scale3(d, width));
    return m.mirrorX && isCenter(w.v[v]) ? [0, p[1], p[2]] : p;
  };
  for (const v of count.keys()) {
    const fv = fan(w, ef, v);
    if (!fv || fv.length < 3) throw new Error("Biselar: solo aristas entre dos caras");
    const k = fv.length;
    const selIdx = fv.flatMap((e, i) => (sel.has(edgeKey(v, e.q)) ? [i] : []));
    if (selIdx.length === 2) {
      for (let s = 0; s < 2; s++) {
        // Segmento: caras desde la siguiente a un corte hasta el otro corte (incluido).
        const from = (selIdx[s] + 1) % k;
        const to = selIdx[(s + 1) % 2];
        const segment: number[] = [];
        for (let i = from; ; i = (i + 1) % k) {
          segment.push(i);
          if (i === to) break;
        }
        const qs = segment.slice(0, -1).map((i) => fv[i].q);
        const nv = add(toward(v, qs, fv[segment[0]].face));
        for (const i of segment) repl.set(`${fv[i].face}:${v}`, [nv]);
      }
    } else {
      const s = selIdx[0];
      const f1 = (s + 1) % k; // cara al otro lado de la arista elegida
      const vA = add(toward(v, [fv[f1].q], fv[f1].face));
      const vB = add(toward(v, [fv[(s + k - 1) % k].q], fv[s].face));
      repl.set(`${fv[f1].face}:${v}`, [vA]);
      repl.set(`${fv[(f1 + 1) % k].face}:${v}`, [vA, vB]);
      for (let i = (f1 + 2) % k; i !== f1; i = (i + 1) % k) repl.set(`${fv[i].face}:${v}`, [vB]);
    }
  }
  const one = (fi: number, v: number) => repl.get(`${fi}:${v}`)?.[0] ?? v;
  const last = (fi: number, v: number) => {
    const r = repl.get(`${fi}:${v}`);
    return r ? r[r.length - 1] : v;
  };
  const strips: { face: number[]; uv: UV[] }[] = [];
  for (const [a, b] of edges) {
    const [x, y] = ef.get(edgeKey(a, b))!;
    const F1 = x.from === a ? x : y; // recorre a → b
    const F2 = x.from === a ? y : x; // recorre b → a
    // En F1, a va justo antes de b: a toma su último sustituto y b el primero.
    strips.push({
      face: [one(F1.face, b), last(F1.face, a), one(F2.face, a), last(F2.face, b)],
      uv: [cornerUv(w, F1.face, b), cornerUv(w, F1.face, a), cornerUv(w, F2.face, a), cornerUv(w, F2.face, b)],
    });
  }
  const faces: number[][] = [];
  const uvs: UV[][] = [];
  w.f.forEach((f, fi) => {
    const nf: number[] = [];
    const nu: UV[] = [];
    for (const v of f) {
      const r = repl.get(`${fi}:${v}`) ?? [v];
      for (const x of r) {
        nf.push(x);
        nu.push(cornerUv(w, fi, v));
      }
    }
    faces.push(nf);
    uvs.push(nu);
  });
  for (const s of strips) {
    faces.push(s.face);
    uvs.push(s.uv);
  }
  w.f = faces;
  if (w.uv) w.uv = uvs;
  const { mesh, remap } = build(m, w, "Biselar: ");
  return { mesh, verts: created.map((i) => remap[i]).filter((i) => i >= 0) };
}

// ---------- Unir, borrar, crear cara, subdividir, relajar ----------

/** Quita de cada cara los vértices repetidos seguidos y las caras que quedan con menos de 3. */
function collapse(w: Work) {
  const faces: number[][] = [];
  const uvs: UV[][] = [];
  const seen = new Map<string, number>();
  w.f.forEach((f, fi) => {
    const nf: number[] = [];
    const nu: UV[] = [];
    f.forEach((v, i) => {
      if (nf.length && nf[nf.length - 1] === v) return;
      nf.push(v);
      if (w.uv) nu.push(w.uv[fi][i]);
    });
    while (nf.length > 1 && nf[0] === nf[nf.length - 1]) {
      nf.pop();
      nu.pop();
    }
    if (new Set(nf).size < 3 || new Set(nf).size !== nf.length) return;
    const key = [...nf].sort((a, b) => a - b).join(",");
    // Dos caras que acaban con los mismos vértices se anulan entre sí.
    if (seen.has(key)) {
      faces[seen.get(key)!] = [];
      return;
    }
    seen.set(key, faces.length);
    faces.push(nf);
    uvs.push(nu);
  });
  const keep = faces.map((f) => f.length > 0);
  w.f = faces.filter((_, i) => keep[i]);
  if (w.uv) w.uv = uvs.filter((_, i) => keep[i]);
}

export function mergeVertices(m: MeshData, verts: number[], how: "center" | "distance", dist = 0.5): MeshData {
  if (verts.length < 2) return m;
  const w = work(m);
  const parent = new Map<number, number>(verts.map((v) => [v, v]));
  const find = (x: number): number => (parent.get(x) === x ? x : find(parent.get(x)!));
  if (how === "center") for (const v of verts) parent.set(find(v), find(verts[0]));
  else
    for (let i = 0; i < verts.length; i++)
      for (let j = i + 1; j < verts.length; j++) if (len3(sub3(w.v[verts[i]], w.v[verts[j]])) <= dist) parent.set(find(verts[i]), find(verts[j]));
  const groups = new Map<number, number[]>();
  for (const v of verts) groups.set(find(v), [...(groups.get(find(v)) ?? []), v]);
  const target = new Map<number, number>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const keep = Math.min(...g);
    let c: Vec3 = [0, 0, 0];
    for (const v of g) c = add3(c, scale3(w.v[v], 1 / g.length));
    if (m.mirrorX && g.some((v) => isCenter(w.v[v]))) c[0] = 0;
    w.v[keep] = c;
    for (const v of g) target.set(v, keep);
  }
  w.f = w.f.map((f) => f.map((v) => target.get(v) ?? v));
  collapse(w);
  return build(m, w, "Unir: ").mesh;
}

export function deleteSelection(m: MeshData, verts: number[], what: SelectMode): MeshData {
  const s = new Set(verts);
  const gone = (f: number[]) => {
    if (what === "face") return f.every((v) => s.has(v));
    if (what === "vertex") return f.some((v) => s.has(v));
    return f.some((v, i) => s.has(v) && s.has(f[(i + 1) % f.length]));
  };
  const w = work(m);
  const keep = w.f.map((f) => !gone(f));
  w.f = w.f.filter((_, i) => keep[i]);
  if (w.uv) w.uv = w.uv.filter((_, i) => keep[i]);
  return build(m, w).mesh;
}

export function fillFace(m: MeshData, verts: number[]): MeshData {
  const FILL = "Crear cara: selecciona 3 o 4 vértices o un borde cerrado";
  const sel = [...new Set(verts)];
  if (sel.length < 3) throw new Error(FILL);
  const w = work(m);
  const ef = edgeFaces(w.f);
  const s = new Set(sel);
  // ¿Forman un borde cerrado? La cara nueva recorre las aristas al revés que su vecina.
  const next = new Map<number, number>();
  let boundaryOk = true;
  for (const [key, list] of ef) {
    const [a, b] = key.split(",").map(Number);
    if (list.length === 1 && s.has(a) && s.has(b)) {
      if (next.has(list[0].to)) boundaryOk = false;
      next.set(list[0].to, list[0].from);
    }
  }
  let face: number[] | null = null;
  if (boundaryOk && next.size === sel.length) {
    const cyc = [sel[0]];
    while (cyc.length <= sel.length) {
      const n = next.get(cyc[cyc.length - 1]);
      if (n === undefined || n === cyc[0]) break;
      cyc.push(n);
    }
    if (cyc.length === sel.length && next.get(cyc[cyc.length - 1]) === cyc[0]) face = cyc;
  }
  if (!face) {
    if (sel.length > 4) throw new Error(FILL);
    const orders = sel.length === 3 ? [sel] : [[sel[0], sel[1], sel[2], sel[3]], [sel[0], sel[2], sel[1], sel[3]], [sel[0], sel[1], sel[3], sel[2]]];
    face = orders.reduce((best, o) => (len3(faceNormal(w.v, o)) > len3(faceNormal(w.v, best)) ? o : best));
    const sameWay = face.some((v, i) => (ef.get(edgeKey(v, face![(i + 1) % face!.length])) ?? []).some((e) => e.from === v));
    const usesEdge = face.some((v, i) => ef.has(edgeKey(v, face![(i + 1) % face!.length])));
    if (sameWay) face = [...face].reverse();
    else if (!usesEdge && w.v.length) {
      let c: Vec3 = [0, 0, 0];
      for (const p of w.v) c = add3(c, scale3(p, 1 / w.v.length));
      if (dot3(faceNormal(w.v, face), sub3(faceCenter(w.v, face), c)) < 0) face = [...face].reverse();
    }
  }
  w.f.push(face);
  if (w.uv) {
    const uvOf = (v: number): UV => {
      const fi = w.f.findIndex((f, i) => i < w.f.length - 1 && f.includes(v));
      return fi >= 0 ? cornerUv(w, fi, v) : [0, 0];
    };
    w.uv.push(face.map(uvOf));
  }
  return build(m, w, "Crear cara: ").mesh;
}

export function subdivideFaces(m: MeshData, verts: number[]): MeshData {
  const sel = selectedFaces(m, verts);
  if (!sel.length) return m;
  const extra = sel.reduce((s, fi) => s + m.faces[fi].length - 1, 0);
  if (m.faces.length + extra > MAX_MESH_FACES) throw new Error(LIMIT);
  const w = work(m);
  const set = new Set(sel);
  const mid = new Map<string, number>();
  for (const fi of sel) {
    const f = w.f[fi];
    f.forEach((v, i) => {
      const n = f[(i + 1) % f.length];
      const k = edgeKey(v, n);
      if (!mid.has(k)) {
        mid.set(k, w.v.length);
        w.v.push(lerp3(w.v[v], w.v[n], 0.5));
      }
    });
  }
  const faces: number[][] = [];
  const uvs: UV[][] = [];
  w.f.forEach((f, fi) => {
    const L = f.length;
    const u = f.map((v) => cornerUv(w, fi, v));
    if (set.has(fi)) {
      const c = w.v.length;
      w.v.push(faceCenter(w.v, f));
      const cu: UV = [u.reduce((s, p) => s + p[0], 0) / L, u.reduce((s, p) => s + p[1], 0) / L];
      for (let i = 0; i < L; i++) {
        const nx = (i + 1) % L;
        const pv = (i + L - 1) % L;
        faces.push([f[i], mid.get(edgeKey(f[i], f[nx]))!, c, mid.get(edgeKey(f[pv], f[i]))!]);
        uvs.push([u[i], lerp2(u[i], u[nx], 0.5), cu, lerp2(u[pv], u[i], 0.5)]);
      }
      return;
    }
    const nf: number[] = [];
    const nu: UV[] = [];
    f.forEach((v, i) => {
      const nx = (i + 1) % L;
      nf.push(v);
      nu.push(u[i]);
      const k = mid.get(edgeKey(v, f[nx]));
      if (k !== undefined) {
        nf.push(k);
        nu.push(lerp2(u[i], u[nx], 0.5));
      }
    });
    faces.push(nf);
    uvs.push(nu);
  });
  w.f = faces;
  if (w.uv) w.uv = uvs;
  return build(m, w).mesh;
}

export function relax(m: MeshData, verts: number[], strength = 0.5): MeshData {
  const nb = neighbors(m);
  const ef = edgeFaces(m.faces);
  const onBorder = new Set<number>();
  for (const [k, list] of ef) if (list.length === 1) for (const v of k.split(",").map(Number)) onBorder.add(v);
  const vertices = m.vertices.map((p, i) => {
    if (!verts.includes(i) || onBorder.has(i) || !nb[i].size || (m.mirrorX && isCenter(p))) return [...p] as Vec3;
    let avg: Vec3 = [0, 0, 0];
    for (const j of nb[i]) avg = add3(avg, scale3(m.vertices[j], 1 / nb[i].size));
    return r6(lerp3(p, avg, strength));
  });
  return { ...m, vertices: clampMirror(m, m.vertices, vertices) };
}

// ---------- Normales ----------

/** Voltea las caras elegidas junto con toda su parte conectada (voltear solo unas dejaría la malla incoherente). */
export function flipFaces(m: MeshData, verts: number[]): MeshData {
  const chosen = selectedFaces(m, verts);
  const all = m.faces.map((_, i) => i);
  const sel = new Set(regions(m.faces, all).filter((g) => g.some((f) => chosen.includes(f))).flat());
  return {
    ...m,
    faces: m.faces.map((f, i) => (sel.has(i) ? [...f].reverse() : [...f])),
    uvs: m.uvs.map((u, i) => (sel.has(i) ? [...u].reverse() : [...u])),
  };
}

export function recalcNormals(m: MeshData): MeshData {
  const faces = m.faces.map((f) => [...f]);
  const uvs = m.uvs.map((u) => [...u]);
  const flip = (i: number) => {
    faces[i].reverse();
    if (uvs.length) uvs[i].reverse();
  };
  const done = new Array(faces.length).fill(false);
  for (let s = 0; s < faces.length; s++) {
    if (done[s]) continue;
    const comp: number[] = [];
    const queue = [s];
    done[s] = true;
    while (queue.length) {
      const fi = queue.shift()!;
      comp.push(fi);
      const ef = edgeFaces(faces);
      const f = faces[fi];
      for (let i = 0; i < f.length; i++) {
        const a = f[i];
        const b = f[(i + 1) % f.length];
        for (const x of ef.get(edgeKey(a, b))!) {
          if (x.face === fi || done[x.face]) continue;
          if (x.from === a) flip(x.face);
          done[x.face] = true;
          queue.push(x.face);
        }
      }
    }
    // Hacia fuera: volumen con signo (con simetría, el origen en x = 0 vale para la mitad).
    const c = m.mirrorX ? ([0, 0, 0] as Vec3) : comp.reduce<Vec3>((acc, fi) => add3(acc, scale3(faceCenter(m.vertices, faces[fi]), 1 / comp.length)), [0, 0, 0]);
    let vol = 0;
    for (const fi of comp) {
      const f = faces[fi];
      for (let k = 1; k + 1 < f.length; k++) vol += dot3(sub3(m.vertices[f[0]], c), cross3(sub3(m.vertices[f[k]], c), sub3(m.vertices[f[k + 1]], c)));
    }
    if (vol < 0) for (const fi of comp) flip(fi);
  }
  return { ...m, faces, uvs };
}

// ---------- Aplicar modificadores ----------

export function applyMirror(m: MeshData): MeshData {
  if (!m.mirrorX) return m;
  const r = mirrorMesh(m);
  const out: MeshData = { ...m, vertices: r.vertices.map(r6), faces: r.faces, uvs: m.uvs.length ? r.uvs : [], mirrorX: false, texture: { ...m.texture } };
  if (m.weights) out.weights = r.source.map((i) => m.weights![i].map((x) => ({ ...x })));
  return build(out, work(out)).mesh;
}

export function applySubdivision(m: MeshData): MeshData {
  if (!m.subdivision) return m;
  const r = mirrorMesh(m);
  let v = r.vertices;
  let f = r.faces;
  let uv = r.uvs;
  // Índice de cara tras la simetría: las primeras `m.faces.length` son las de la mitad modelada.
  let origin = r.faces.map((_, i) => i);
  for (let l = 0; l < m.subdivision; l++) {
    const s = subdivideOnce(v, f, uv);
    origin = s.faceSource.map((i) => origin[i]);
    v = s.vertices;
    f = s.faces;
    uv = s.uvs;
  }
  const keep = f.map((_, i) => origin[i] < m.faces.length);
  const faces = f.filter((_, i) => keep[i]);
  if (faces.length > MAX_MESH_FACES) throw new Error(LIMIT);
  const vertices = v.map((p) => [Math.abs(p[0]) < 1e-6 ? 0 : p[0], p[1], p[2]] as Vec3);
  const w: Work = { v: vertices, f: faces, uv: m.uvs.length ? uv.filter((_, i) => keep[i]) : null };
  const base: MeshData = { ...m, subdivision: 0 };
  delete base.weights;
  return build(base, w).mesh;
}
