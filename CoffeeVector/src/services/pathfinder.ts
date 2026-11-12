// Buscatrazos: unir, restar, intersecar y excluir formas. Los trazados se
// aproximan por polígonos, se combinan y el resultado se vuelve a convertir
// en un trazado (los tramos curvos se suavizan).

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from "polygon-clipping";
import type { PathNode, PathObj, Subpath, VObject } from "../types";
import { flatten, simplify } from "./geom";
import { newId } from "./model";

export type PathfinderOp = "unite" | "minusFront" | "intersect" | "exclude";

export const PATHFINDER_LABELS: Record<PathfinderOp, string> = {
  unite: "Unir",
  minusFront: "Menos frente",
  intersect: "Intersecar",
  exclude: "Excluir superposición",
};

function toMulti(o: PathObj): MultiPolygon {
  const rings: Ring[] = o.subpaths
    .filter((sp) => sp.nodes.length > 2)
    .map((sp) => {
      const pts = flatten({ ...sp, closed: true }, 0.35).map((p) => [p.x, p.y] as [number, number]);
      if (pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) pts.push(pts[0]);
      return pts;
    });
  // Cada subtrazado como polígono; la regla par-impar se resuelve con XOR
  const polys: Polygon[] = rings.map((r) => [r]);
  if (!polys.length) return [];
  return polys.slice(1).reduce<MultiPolygon>((acc, p) => polygonClipping.xor(acc, p), [polys[0]]);
}

function fromMulti(mp: MultiPolygon): Subpath[] {
  const subs: Subpath[] = [];
  for (const poly of mp)
    for (const ring of poly) {
      const pts = simplify(
        ring.slice(0, -1).map(([x, y]) => ({ x, y })),
        0.15
      );
      if (pts.length >= 3) subs.push({ nodes: pts.map((p): PathNode => ({ x: p.x, y: p.y })), closed: true });
    }
  return subs;
}

/** Combina los trazados (de abajo arriba) y devuelve un trazado nuevo con el estilo del inferior. */
export function pathfinder(objs: VObject[], op: PathfinderOp): PathObj | null {
  const paths = objs.filter((o): o is PathObj => o.type === "path");
  if (paths.length < 2) return null;
  const polys = paths.map(toMulti);
  let result: MultiPolygon;
  switch (op) {
    case "unite":
      result = polygonClipping.union(polys[0], ...polys.slice(1));
      break;
    case "minusFront":
      result = polygonClipping.difference(polys[0], ...polys.slice(1));
      break;
    case "intersect":
      result = polygonClipping.intersection(polys[0], ...polys.slice(1));
      break;
    case "exclude":
      result = polygonClipping.xor(polys[0], ...polys.slice(1));
      break;
  }
  const base = op === "minusFront" ? paths[0] : paths[paths.length - 1];
  return { ...base, id: newId("ob"), name: PATHFINDER_LABELS[op], subpaths: fromMulti(result), fillRule: "evenodd" };
}
