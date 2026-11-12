// Geometría de CoffeeVector: curvas Bézier, cajas, transformaciones, cadena
// "d" de SVG, aproximación por polígonos y suavizado de trazos a mano alzada.

import type { Bounds, PathNode, PathObj, Pt, Subpath, TextObj, VObject } from "../types";

export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Segmentos (p0, c1, c2, p3) de un subtrazado. */
export function segments(sp: Subpath): Array<[Pt, Pt, Pt, Pt]> {
  const out: Array<[Pt, Pt, Pt, Pt]> = [];
  const n = sp.nodes.length;
  const count = sp.closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = sp.nodes[i];
    const b = sp.nodes[(i + 1) % n];
    out.push([a, a.hout || a, b.hin || b, b]);
  }
  return out;
}

/** "d" compacta: usa L cuando el segmento es recto. */
export function pathD(subpaths: Subpath[]): string {
  const f = (v: number) => Math.round(v * 100) / 100;
  return subpaths
    .map((sp) => {
      if (!sp.nodes.length) return "";
      let d = `M${f(sp.nodes[0].x)} ${f(sp.nodes[0].y)}`;
      for (const [a, c1, c2, p] of segments(sp)) {
        if (c1 === a && c2 === p) d += ` L${f(p.x)} ${f(p.y)}`;
        else d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p.x)} ${f(p.y)}`;
      }
      return sp.closed ? `${d} Z` : d;
    })
    .join(" ");
}

/** Caja de un segmento cúbico (por muestreo fino). */
function segmentBox(s: [Pt, Pt, Pt, Pt], acc: { x0: number; y0: number; x1: number; y1: number }) {
  const [p0, c1, c2, p3] = s;
  const straight = c1 === p0 && c2 === p3;
  const steps = straight ? 1 : 24;
  for (let i = 0; i <= steps; i++) {
    const q = straight ? (i ? p3 : p0) : cubic(p0, c1, c2, p3, i / steps);
    if (q.x < acc.x0) acc.x0 = q.x;
    if (q.y < acc.y0) acc.y0 = q.y;
    if (q.x > acc.x1) acc.x1 = q.x;
    if (q.y > acc.y1) acc.y1 = q.y;
  }
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(t: TextObj): { w: number; h: number; lines: string[] } {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `${t.italic ? "italic " : ""}${t.weight} ${t.size}px "${t.font}", sans-serif`;
  (measureCtx as unknown as { letterSpacing: string }).letterSpacing = `${t.letterSpacing}px`;
  const lines = t.text.split("\n");
  const w = Math.max(1, ...lines.map((l) => measureCtx!.measureText(l).width));
  return { w, h: lines.length * t.size * t.lineHeight, lines };
}

export function textBox(t: TextObj): Bounds {
  const m = measureText(t);
  const x = t.align === "middle" ? t.x - m.w / 2 : t.align === "end" ? t.x - m.w : t.x;
  // y es la línea base de la primera línea
  return { x, y: t.y - t.size * 0.82, w: m.w, h: m.h };
}

export function objectBounds(o: VObject): Bounds | null {
  if (o.type === "path") {
    const acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const sp of o.subpaths) {
      if (sp.nodes.length === 1) segmentBox([sp.nodes[0], sp.nodes[0], sp.nodes[0], sp.nodes[0]], acc);
      for (const s of segments(sp)) segmentBox(s, acc);
    }
    if (!Number.isFinite(acc.x0)) return null;
    return { x: acc.x0, y: acc.y0, w: acc.x1 - acc.x0, h: acc.y1 - acc.y0 };
  }
  if (o.type === "text") return rotatedBox(textBox(o), o.rotation, { x: o.x, y: o.y });
  if (o.type === "image") return rotatedBox({ x: o.x, y: o.y, w: o.w, h: o.h }, o.rotation, { x: o.x + o.w / 2, y: o.y + o.h / 2 });
  const kids = (o.clip ? [o.children[0]] : o.children).map(objectBounds).filter(Boolean) as Bounds[];
  return unionBounds(kids);
}

function rotatedBox(b: Bounds, deg: number, c: Pt): Bounds {
  if (!deg) return b;
  const pts = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ].map((p) => rotatePt(p, c, deg));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (!list.length) return null;
  const x0 = Math.min(...list.map((b) => b.x));
  const y0 = Math.min(...list.map((b) => b.y));
  const x1 = Math.max(...list.map((b) => b.x + b.w));
  const y1 = Math.max(...list.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const rotatePt = (p: Pt, c: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
};

// ---------------------------------------------------------------------------
// Transformaciones (se aplican a las coordenadas)
// ---------------------------------------------------------------------------

export type PtMap = (p: Pt) => Pt;

const mapNode = (n: PathNode, f: PtMap): PathNode => ({ ...f(n), hin: n.hin ? f(n.hin) : n.hin, hout: n.hout ? f(n.hout) : n.hout });

export function mapObject(o: VObject, f: PtMap, scale = 1, rotate = 0): VObject {
  switch (o.type) {
    case "path":
      return { ...o, subpaths: o.subpaths.map((sp) => ({ ...sp, nodes: sp.nodes.map((n) => mapNode(n, f)) })), stroke: o.stroke ? { ...o.stroke, width: o.stroke.width * Math.sqrt(Math.abs(scale)) } : null };
    case "text": {
      const p = f({ x: o.x, y: o.y });
      return { ...o, x: p.x, y: p.y, size: Math.max(1, o.size * Math.abs(scale)), rotation: o.rotation + rotate };
    }
    case "image": {
      const c = f({ x: o.x + o.w / 2, y: o.y + o.h / 2 });
      const w = o.w * Math.abs(scale);
      const h = o.h * Math.abs(scale);
      return { ...o, x: c.x - w / 2, y: c.y - h / 2, w, h, rotation: o.rotation + rotate };
    }
    case "group":
      return { ...o, children: o.children.map((c) => mapObject(c, f, scale, rotate)) };
  }
}

/** Escala no uniforme de caja a caja (las imágenes y textos usan la media). */
export function scaleObject(o: VObject, from: Bounds, to: Bounds): VObject {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  const f: PtMap = (p) => ({ x: to.x + (p.x - from.x) * sx, y: to.y + (p.y - from.y) * sy });
  if (o.type === "image") {
    return { ...o, x: to.x + (o.x - from.x) * sx, y: to.y + (o.y - from.y) * sy, w: o.w * sx, h: o.h * sy };
  }
  if (o.type === "group") return { ...o, children: o.children.map((c) => scaleObject(c, from, to)) };
  return mapObject(o, f, Math.sqrt(Math.abs(sx * sy)));
}

export const translateObject = (o: VObject, dx: number, dy: number) => mapObject(o, (p) => ({ x: p.x + dx, y: p.y + dy }));
export const rotateObject = (o: VObject, c: Pt, deg: number) => mapObject(o, (p) => rotatePt(p, c, deg), 1, deg);
export const flipObject = (o: VObject, c: Pt, horizontal: boolean) =>
  mapObject(o, (p) => (horizontal ? { x: 2 * c.x - p.x, y: p.y } : { x: p.x, y: 2 * c.y - p.y }));

// ---------------------------------------------------------------------------
// Polígonos (para el buscatrazos y la exportación)
// ---------------------------------------------------------------------------

export function flatten(sp: Subpath, tolerance = 0.5): Pt[] {
  const pts: Pt[] = [];
  if (!sp.nodes.length) return pts;
  pts.push({ x: sp.nodes[0].x, y: sp.nodes[0].y });
  for (const [p0, c1, c2, p3] of segments(sp)) {
    if (c1 === p0 && c2 === p3) {
      pts.push({ x: p3.x, y: p3.y });
      continue;
    }
    const len = dist(p0, c1) + dist(c1, c2) + dist(c2, p3);
    const steps = Math.max(4, Math.min(200, Math.ceil(len / (tolerance * 8))));
    for (let i = 1; i <= steps; i++) pts.push(cubic(p0, c1, c2, p3, i / steps));
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Puntos cercanos y división de segmentos (pluma: añadir nodos)
// ---------------------------------------------------------------------------

export function nearestOnPath(o: PathObj, p: Pt): { sub: number; seg: number; t: number; d: number; pt: Pt } | null {
  let best: { sub: number; seg: number; t: number; d: number; pt: Pt } | null = null;
  o.subpaths.forEach((sp, si) =>
    segments(sp).forEach(([p0, c1, c2, p3], gi) => {
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const q = cubic(p0, c1, c2, p3, t);
        const d = dist(q, p);
        if (!best || d < best.d) best = { sub: si, seg: gi, t, d, pt: q };
      }
    })
  );
  return best;
}

/** Divide el segmento `seg` en t (de Casteljau) e inserta un nodo suave. */
export function splitSegment(sp: Subpath, seg: number, t: number): Subpath {
  const n = sp.nodes.length;
  const a = sp.nodes[seg];
  const b = sp.nodes[(seg + 1) % n];
  const p0 = a;
  const p1 = a.hout || a;
  const p2 = b.hin || b;
  const p3 = b;
  const straight = !a.hout && !b.hin;
  const ab = lerp(p0, p1, t);
  const bc = lerp(p1, p2, t);
  const cd = lerp(p2, p3, t);
  const abc = lerp(ab, bc, t);
  const bcd = lerp(bc, cd, t);
  const m = lerp(abc, bcd, t);
  const nodes = sp.nodes.map((x) => ({ ...x }));
  if (!straight) {
    nodes[seg].hout = ab;
    nodes[(seg + 1) % n].hin = cd;
  }
  const mid: PathNode = straight ? { x: m.x, y: m.y } : { x: m.x, y: m.y, hin: abc, hout: bcd };
  nodes.splice(seg + 1, 0, mid);
  return { ...sp, nodes };
}

// ---------------------------------------------------------------------------
// Lápiz: simplificar y suavizar
// ---------------------------------------------------------------------------

export function simplify(points: Pt[], eps: number): Pt[] {
  if (points.length < 3) return points;
  const rdp = (pts: Pt[]): Pt[] => {
    let maxD = 0;
    let idx = 0;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const len = dist(a, b) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((b.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (b.y - a.y)) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps) return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))];
    return [a, b];
  };
  return rdp(points);
}

/** Curva suave que pasa por los puntos (Catmull-Rom convertido a Bézier). */
export function smoothNodes(pts: Pt[], closed: boolean, tension = 1): PathNode[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = ((next.x - prev.x) / 6) * tension;
    const ty = ((next.y - prev.y) / 6) * tension;
    const first = !closed && i === 0;
    const last = !closed && i === n - 1;
    return { x: p.x, y: p.y, hin: first ? null : { x: p.x - tx, y: p.y - ty }, hout: last ? null : { x: p.x + tx, y: p.y + ty } };
  });
}

export const boundsCenter = (b: Bounds): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
