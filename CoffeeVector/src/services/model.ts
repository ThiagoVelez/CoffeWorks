// Documento de CoffeeVector: creación, archivo .cvc, formas y operaciones
// sobre el árbol de objetos.

import type { Artboard, GroupObj, Paint, PathNode, PathObj, Pt, StrokeStyle, TextObj, VDoc, VObject } from "../types";
import { newId } from "../studio/color";
import { objectBounds, unionBounds } from "./geom";

export { newId };

export const solid = (color: string, opacity = 1): Paint => ({ type: "solid", color, opacity });
export const strokeOf = (color: string, width = 2): StrokeStyle => ({ color, opacity: 1, width, cap: "round", join: "round", dash: [] });

export function artboard(name: string, x: number, y: number, w: number, h: number): Artboard {
  return { id: newId("ab"), name, x, y, w, h, background: "#ffffff" };
}

export function newDocument(w = 1080, h = 1080): VDoc {
  return { version: 1, artboards: [artboard("Mesa de trabajo 1", 0, 0, w, h)], objects: [], swatches: [] };
}

export function serializeDocument(doc: VDoc): string {
  return JSON.stringify({ app: "CoffeeVector", ...doc });
}

export function parseDocument(text: string): VDoc {
  const raw = JSON.parse(text);
  const fix = (o: Record<string, unknown>): VObject => {
    const base = { id: (o.id as string) || newId("ob"), name: (o.name as string) || "Objeto", visible: o.visible !== false, locked: !!o.locked, opacity: typeof o.opacity === "number" ? o.opacity : 1, blend: (o.blend as string) || "normal" };
    if (o.type === "group") return { ...base, type: "group", clip: !!o.clip, children: ((o.children as Record<string, unknown>[]) || []).map(fix) } as GroupObj;
    if (o.type === "text")
      return { align: "start", letterSpacing: 0, lineHeight: 1.2, rotation: 0, weight: 400, italic: false, font: "Hanken Grotesk", size: 48, fill: solid("#000000"), stroke: null, text: "", x: 0, y: 0, ...o, ...base, type: "text" } as TextObj;
    if (o.type === "image") return { rotation: 0, x: 0, y: 0, w: 100, h: 100, href: "", ...o, ...base, type: "image" } as VObject;
    return { fill: null, stroke: null, fillRule: "nonzero", subpaths: [], ...o, ...base, type: "path" } as PathObj;
  };
  const artboards: Artboard[] = (raw.artboards || []).map((a: Partial<Artboard>, i: number) => ({ x: 0, y: 0, w: 1080, h: 1080, ...a, background: a.background === undefined ? "#ffffff" : a.background, name: a.name || `Mesa de trabajo ${i + 1}`, id: a.id || newId("ab") }));
  return { version: 1, artboards: artboards.length ? artboards : [artboard("Mesa de trabajo 1", 0, 0, 1080, 1080)], objects: (raw.objects || []).map(fix), swatches: raw.swatches || [] };
}

// ---------------------------------------------------------------------------
// Formas
// ---------------------------------------------------------------------------

const K = 0.5522847498;

export function pathObj(name: string, nodes: PathNode[], closed: boolean, fill: Paint | null, stroke: StrokeStyle | null): PathObj {
  return { id: newId("ob"), type: "path", name, visible: true, locked: false, opacity: 1, blend: "normal", subpaths: [{ nodes, closed }], fill, stroke, fillRule: "nonzero" };
}

export function rectNodes(x: number, y: number, w: number, h: number, r = 0): PathNode[] {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  if (!r) return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  const k = r * K;
  return [
    { x: x + r, y, hin: { x: x + r - k, y } },
    { x: x + w - r, y, hout: { x: x + w - r + k, y } },
    { x: x + w, y: y + r, hin: { x: x + w, y: y + r - k } },
    { x: x + w, y: y + h - r, hout: { x: x + w, y: y + h - r + k } },
    { x: x + w - r, y: y + h, hin: { x: x + w - r + k, y: y + h } },
    { x: x + r, y: y + h, hout: { x: x + r - k, y: y + h } },
    { x, y: y + h - r, hin: { x, y: y + h - r + k } },
    { x, y: y + r, hout: { x, y: y + r - k } },
  ];
}

export function ellipseNodes(cx: number, cy: number, rx: number, ry: number): PathNode[] {
  const kx = rx * K;
  const ky = ry * K;
  return [
    { x: cx, y: cy - ry, hin: { x: cx - kx, y: cy - ry }, hout: { x: cx + kx, y: cy - ry } },
    { x: cx + rx, y: cy, hin: { x: cx + rx, y: cy - ky }, hout: { x: cx + rx, y: cy + ky } },
    { x: cx, y: cy + ry, hin: { x: cx + kx, y: cy + ry }, hout: { x: cx - kx, y: cy + ry } },
    { x: cx - rx, y: cy, hin: { x: cx - rx, y: cy + ky }, hout: { x: cx - rx, y: cy - ky } },
  ];
}

export function polygonNodes(cx: number, cy: number, r: number, sides: number, start = -90): PathNode[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((start + (360 / sides) * i) * Math.PI) / 180;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

export function starNodes(cx: number, cy: number, r: number, points: number, inner = 0.45): PathNode[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = ((-90 + (180 / points) * i) * Math.PI) / 180;
    const rr = i % 2 ? r * inner : r;
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
  });
}

export function textObj(x: number, y: number, text = "Texto", fill: Paint | null = solid("#1f1f1f")): TextObj {
  return { id: newId("ob"), type: "text", name: text.slice(0, 24), visible: true, locked: false, opacity: 1, blend: "normal", x, y, text, font: "Hanken Grotesk", size: 64, weight: 700, italic: false, align: "start", letterSpacing: 0, lineHeight: 1.2, rotation: 0, fill, stroke: null };
}

// ---------------------------------------------------------------------------
// Árbol de objetos
// ---------------------------------------------------------------------------

/** Busca un objeto en cualquier nivel. */
export function findObject(list: VObject[], id: string): VObject | null {
  for (const o of list) {
    if (o.id === id) return o;
    if (o.type === "group") {
      const f = findObject(o.children, id);
      if (f) return f;
    }
  }
  return null;
}

/** Sustituye objetos (en cualquier nivel). */
export function mapObjects(list: VObject[], fn: (o: VObject) => VObject | null): VObject[] {
  const out: VObject[] = [];
  for (const o of list) {
    const r = fn(o);
    if (!r) continue;
    out.push(r.type === "group" && r === o ? { ...r, children: mapObjects(r.children, fn) } : r);
  }
  return out;
}

export const replaceObjects = (doc: VDoc, map: Map<string, VObject>): VDoc => ({ ...doc, objects: mapObjects(doc.objects, (o) => map.get(o.id) ?? o) });
export const removeObjects = (doc: VDoc, ids: Set<string>): VDoc => ({ ...doc, objects: mapObjects(doc.objects, (o) => (ids.has(o.id) ? null : o)) });

/** Objeto de primer nivel que contiene a `id`. */
export function topLevelOf(doc: VDoc, id: string): VObject | null {
  return doc.objects.find((o) => o.id === id || (o.type === "group" && !!findObject(o.children, id))) || null;
}

export function selectionBounds(doc: VDoc, ids: string[]) {
  return unionBounds(ids.map((id) => findObject(doc.objects, id)).filter(Boolean).map((o) => objectBounds(o!)).filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>);
}

export function cloneObject(o: VObject): VObject {
  const c = JSON.parse(JSON.stringify(o)) as VObject;
  const reid = (x: VObject) => {
    x.id = newId("ob");
    if (x.type === "group") x.children.forEach(reid);
  };
  reid(c);
  return c;
}

export function group(doc: VDoc, ids: string[], clip = false): { doc: VDoc; id: string } | null {
  const picked = doc.objects.filter((o) => ids.includes(o.id));
  if (picked.length < (clip ? 2 : 1)) return null;
  const idx = Math.max(...picked.map((o) => doc.objects.indexOf(o)));
  // En la máscara de recorte, el objeto superior recorta a los demás
  const children = clip ? [picked[picked.length - 1], ...picked.slice(0, -1)] : picked;
  const g: GroupObj = { id: newId("ob"), type: "group", name: clip ? "Grupo de recorte" : "Grupo", visible: true, locked: false, opacity: 1, blend: "normal", children, clip };
  const objects = doc.objects.filter((o) => !ids.includes(o.id));
  objects.splice(idx - picked.length + 1, 0, g);
  return { doc: { ...doc, objects }, id: g.id };
}

export function ungroup(doc: VDoc, ids: string[]): { doc: VDoc; ids: string[] } {
  const out: VObject[] = [];
  const selected: string[] = [];
  for (const o of doc.objects) {
    if (o.type === "group" && ids.includes(o.id)) {
      const kids = o.clip ? [...o.children.slice(1), o.children[0]] : o.children;
      out.push(...kids.map((k) => ({ ...k, opacity: k.opacity * o.opacity })));
      selected.push(...kids.map((k) => k.id));
    } else out.push(o);
  }
  return { doc: { ...doc, objects: out }, ids: selected };
}

export function arrange(doc: VDoc, ids: string[], how: "front" | "forward" | "backward" | "back"): VDoc {
  const objects = [...doc.objects];
  const sel = objects.filter((o) => ids.includes(o.id));
  if (!sel.length) return doc;
  if (how === "front" || how === "back") {
    const rest = objects.filter((o) => !ids.includes(o.id));
    return { ...doc, objects: how === "front" ? [...rest, ...sel] : [...sel, ...rest] };
  }
  const step = how === "forward" ? 1 : -1;
  const order = how === "forward" ? [...objects.keys()].reverse() : [...objects.keys()];
  for (const i of order) {
    if (!ids.includes(objects[i].id)) continue;
    const j = i + step;
    if (j < 0 || j >= objects.length || ids.includes(objects[j].id)) continue;
    [objects[i], objects[j]] = [objects[j], objects[i]];
  }
  return { ...doc, objects };
}

export const pt = (x: number, y: number): Pt => ({ x, y });
