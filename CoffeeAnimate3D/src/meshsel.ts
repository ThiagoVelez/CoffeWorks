// Selección en mallas. Se guarda por vértices: una cara está seleccionada si lo están
// todos sus vértices, y una arista si lo están sus dos extremos.

import { edgeFaces, edgeKey, len3, meshEdges, sub3 } from "./mesh";
import type { MeshData, Vec3 } from "./types";

export function selectedFaces(m: Pick<MeshData, "faces">, verts: number[]): number[] {
  const s = new Set(verts);
  return m.faces.flatMap((f, i) => (f.every((v) => s.has(v)) ? [i] : []));
}

export function selectedEdges(m: Pick<MeshData, "faces">, verts: number[]): [number, number][] {
  const s = new Set(verts);
  return meshEdges(m).filter(([a, b]) => s.has(a) && s.has(b));
}

/** Vecinos de cada vértice por aristas. */
export function neighbors(m: Pick<MeshData, "faces" | "vertices">): Set<number>[] {
  const out = m.vertices.map(() => new Set<number>());
  for (const [a, b] of meshEdges(m)) {
    out[a].add(b);
    out[b].add(a);
  }
  return out;
}

/** Bucle de aristas que pasa por (a, b): sigue por vértices de 4 aristas; para en polos y bordes. */
export function edgeLoop(m: MeshData, a: number, b: number): number[] {
  const ef = edgeFaces(m.faces);
  if (!ef.has(edgeKey(a, b))) return [a, b];
  const nb = neighbors(m);
  /** Siguiente vértice tras (p → q): la arista de q que no comparte cara con (p, q). */
  const step = (p: number, q: number): number | null => {
    if (nb[q].size !== 4) return null;
    const faces = new Set((ef.get(edgeKey(p, q)) ?? []).map((x) => x.face));
    for (const r of nb[q]) {
      if (r === p) continue;
      const fr = (ef.get(edgeKey(q, r)) ?? []).map((x) => x.face);
      if (!fr.some((f) => faces.has(f))) return r;
    }
    return null;
  };
  const fwd: number[] = [a, b];
  const seen = new Set(fwd);
  let closedLoop = false;
  for (let p = a, q = b; ; ) {
    const r = step(p, q);
    if (r === null) break;
    if (r === a) {
      closedLoop = true;
      break;
    }
    if (seen.has(r)) break;
    fwd.push(r);
    seen.add(r);
    [p, q] = [q, r];
  }
  if (closedLoop) return fwd;
  const back: number[] = [];
  for (let p = b, q = a; ; ) {
    const r = step(p, q);
    if (r === null || seen.has(r)) break;
    back.push(r);
    seen.add(r);
    [p, q] = [q, r];
  }
  return [...back.reverse(), ...fwd];
}

/** Todos los vértices conectados con la selección. */
export function linked(m: MeshData, verts: number[]): number[] {
  const nb = neighbors(m);
  const seen = new Set(verts);
  const stack = [...verts];
  while (stack.length) {
    const v = stack.pop()!;
    for (const w of nb[v]) if (!seen.has(w)) (seen.add(w), stack.push(w));
  }
  return [...seen].sort((x, y) => x - y);
}

export function selectionCenter(m: Pick<MeshData, "vertices">, verts: number[]): Vec3 {
  if (!verts.length) return [0, 0, 0];
  const c: Vec3 = [0, 0, 0];
  for (const i of verts) for (let k = 0; k < 3; k++) c[k] += m.vertices[i][k] / verts.length;
  return c.map((x) => Math.round(x * 1e9) / 1e9 + 0) as Vec3;
}

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Pesos de la edición proporcional: 1 en la selección y caída suave hasta `radius`. */
export function proportional(m: Pick<MeshData, "vertices">, verts: number[], radius: number | null): Map<number, number> {
  const w = new Map<number, number>(verts.map((i) => [i, 1]));
  if (!radius || radius <= 0 || !verts.length) return w;
  m.vertices.forEach((p, i) => {
    if (w.has(i)) return;
    let d = Infinity;
    for (const s of verts) d = Math.min(d, len3(sub3(p, m.vertices[s])));
    if (d < radius) w.set(i, 1 - smoothstep(d / radius));
  });
  return w;
}
