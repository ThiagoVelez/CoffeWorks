// Operaciones del editor de CoffeeAnimate sobre líneas de tiempo y claves.

import { newId } from "./studio/color";
import type { ALayer, AnimDoc, El, Keyframe, SymbolDef, Timeline } from "./types";
import { runtime } from "./runtime";

const COLORS = ["#e8433f", "#f59f00", "#4dabf7", "#40c057", "#ae3ec9", "#ff922b", "#20c997", "#868e96"];
let colorIx = 0;

export const newKey = (frame: number, elements: El[] = []): Keyframe => ({ frame, elements, tween: "none", ease: 0, spin: 0 });

export function newLayer(name: string): ALayer {
  return { id: newId("lay"), name, visible: true, locked: false, outline: false, color: COLORS[colorIx++ % COLORS.length], keyframes: [newKey(0)] };
}

export function newDoc(width = 1280, height = 720, fps = 24): AnimDoc {
  return { version: 1, width, height, fps, background: "#ffffff", main: { layers: [newLayer("Capa 1")], length: 24 }, symbols: [], images: [], onion: { before: 2, after: 2 } };
}

export const keyIndexAt = (l: ALayer, frame: number) => {
  let i = -1;
  l.keyframes.forEach((k, j) => k.frame <= frame && (i = j));
  return i;
};

export const isKeyAt = (l: ALayer, frame: number) => l.keyframes.some((k) => k.frame === frame);

/** Clave en la que se edita el fotograma: si cae en medio de una interpolación se crea una. */
export function editableKey(l: ALayer, frame: number): { layer: ALayer; index: number } {
  const i = keyIndexAt(l, frame);
  if (i < 0) {
    const keyframes = [newKey(frame), ...l.keyframes];
    return { layer: { ...l, keyframes }, index: 0 };
  }
  const k = l.keyframes[i];
  if (k.frame === frame || k.tween !== "classic" || !l.keyframes[i + 1]) return { layer: l, index: i };
  // Clave automática con los valores interpolados
  const els = runtime.frameElements(l.keyframes, frame).map((e) => structuredClone(e));
  const nk: Keyframe = { ...newKey(frame, els), tween: "classic", ease: k.ease };
  const keyframes = [...l.keyframes.slice(0, i + 1), nk, ...l.keyframes.slice(i + 1)];
  return { layer: { ...l, keyframes }, index: i + 1 };
}

export function insertKeyframe(l: ALayer, frame: number, blank: boolean): ALayer {
  if (isKeyAt(l, frame)) return l;
  const els = blank ? [] : runtime.frameElements(l.keyframes, frame).map((e) => structuredClone(e));
  const prev = l.keyframes[keyIndexAt(l, frame)];
  const nk: Keyframe = { ...newKey(frame, els), tween: !blank && prev?.tween === "classic" ? "classic" : "none" };
  return { ...l, keyframes: [...l.keyframes, nk].sort((a, b) => a.frame - b.frame) };
}

export function clearKeyframe(l: ALayer, frame: number): ALayer {
  if (frame === 0 || !isKeyAt(l, frame)) return l;
  return { ...l, keyframes: l.keyframes.filter((k) => k.frame !== frame) };
}

/** F5: inserta un fotograma (empuja las claves posteriores). */
export function insertFrame(tl: Timeline, layerId: string, frame: number): Timeline {
  return {
    length: tl.length + 1,
    layers: tl.layers.map((l) => (l.id === layerId ? { ...l, keyframes: l.keyframes.map((k) => (k.frame > frame ? { ...k, frame: k.frame + 1 } : k)) } : l)),
  };
}

/** Mayús+F5: quita un fotograma. */
export function removeFrame(tl: Timeline, layerId: string, frame: number): Timeline {
  if (tl.length <= 1) return tl;
  return {
    length: tl.length - 1,
    layers: tl.layers.map((l) => {
      if (l.id !== layerId) return l;
      const kept = l.keyframes.filter((k) => k.frame !== frame || k.frame === 0);
      return { ...l, keyframes: kept.map((k) => (k.frame > frame ? { ...k, frame: k.frame - 1 } : k)).filter((k, i, a) => a.findIndex((x) => x.frame === k.frame) === i) };
    }),
  };
}

/** Prepara una interpolación clásica entre la clave actual y la siguiente. */
export function createTween(l: ALayer, frame: number, tl: Timeline): { layer: ALayer; length: number } {
  const i = keyIndexAt(l, frame);
  if (i < 0) return { layer: l, length: tl.length };
  const k = l.keyframes[i];
  let keyframes = l.keyframes.slice();
  let length = tl.length;
  if (!keyframes[i + 1]) {
    // Sin clave final: se crea 12 fotogramas después con el mismo contenido
    const end = Math.max(k.frame + 12, Math.min(length - 1, k.frame + 24));
    keyframes.push(newKey(end, k.elements.map((e) => structuredClone(e))));
    length = Math.max(length, end + 1);
  }
  keyframes = keyframes.map((x, j) => (j === i ? { ...x, tween: "classic" as const } : x));
  return { layer: { ...l, keyframes }, length };
}

/** Convierte elementos en un símbolo y devuelve la instancia que los sustituye. */
export function makeSymbol(doc: AnimDoc, els: El[], name: string, type: SymbolDef["type"]): { symbol: SymbolDef; instance: El } {
  const bounds = els.map((e) => {
    const b = runtime.elementBounds(doc, e);
    const m = runtime.matrixOf(e.t);
    return [m.transformPoint(new DOMPoint(b.x, b.y)), m.transformPoint(new DOMPoint(b.x + b.w, b.y + b.h))];
  });
  const cx = bounds.reduce((s, [a, b]) => s + (a.x + b.x) / 2, 0) / Math.max(1, bounds.length);
  const cy = bounds.reduce((s, [a, b]) => s + (a.y + b.y) / 2, 0) / Math.max(1, bounds.length);
  const inner = els.map((e) => ({ ...structuredClone(e), t: { ...e.t, x: e.t.x - cx, y: e.t.y - cy } }));
  const layer = newLayer("Capa 1");
  let timeline: Timeline;
  if (type === "button") {
    const over = inner.map((e) => ({ ...structuredClone(e), tint: { color: "#ffffff", amount: 0.25 } }));
    const down = inner.map((e) => ({ ...structuredClone(e), t: { ...e.t, sx: e.t.sx * 0.95, sy: e.t.sy * 0.95 }, tint: { color: "#000000", amount: 0.15 } }));
    layer.keyframes = [
      { ...newKey(0, inner), label: "Reposo" },
      { ...newKey(1, over), label: "Sobre" },
      { ...newKey(2, down), label: "Presionado" },
      { ...newKey(3, inner.map((e) => structuredClone(e))), label: "Zona activa" },
    ];
    timeline = { layers: [layer], length: 4 };
  } else {
    layer.keyframes = [newKey(0, inner)];
    timeline = { layers: [layer], length: 1 };
  }
  const symbol: SymbolDef = { id: newId("sym"), name, type, timeline };
  const instance: El = { id: newId("el"), kind: "instance", t: { x: cx, y: cy, sx: 1, sy: 1, rot: 0 }, alpha: 1, symbolId: symbol.id, loop: "loop", firstFrame: 0, action: null };
  return { symbol, instance };
}

/** Línea de tiempo que se está editando (principal o de un símbolo). */
export const timelineOf = (doc: AnimDoc, symbolId: string | null): Timeline => (symbolId ? doc.symbols.find((s) => s.id === symbolId)?.timeline || doc.main : doc.main);

export function withTimeline(doc: AnimDoc, symbolId: string | null, tl: Timeline): AnimDoc {
  if (!symbolId) return { ...doc, main: tl };
  return { ...doc, symbols: doc.symbols.map((s) => (s.id === symbolId ? { ...s, timeline: tl } : s)) };
}

/** Simplifica un trazo a mano alzada (Ramer–Douglas–Peucker). */
export function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0;
  let dmax = 0;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 1; i < pts.length - 1; i++) {
    // Trazo cerrado (inicio = final): distancia al punto de inicio
    const d = L < 1e-6 ? Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L;
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax <= eps) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

export const serializeDoc = (d: AnimDoc) => JSON.stringify({ app: "CoffeeAnimate", ...d });
export function parseDoc(text: string): AnimDoc {
  const raw = JSON.parse(text);
  const base = newDoc();
  return { ...base, ...raw, version: 1, main: raw.main?.layers?.length ? raw.main : base.main, symbols: raw.symbols || [], images: raw.images || [], onion: raw.onion || base.onion };
}

/** Ejemplo: pelota que rebota con interpolación y un botón «Repetir». */
export function sampleDoc(): AnimDoc {
  const d = newDoc(1280, 720, 24);
  d.background = "#fff4e6";
  const ball: El = { id: newId("el"), kind: "ellipse", t: { x: 640, y: 120, sx: 1, sy: 1, rot: 0 }, alpha: 1, w: 120, h: 120, fill: "#e8433f", stroke: "#a61e4d", strokeWidth: 4 };
  const down = { ...structuredClone(ball), t: { ...ball.t, y: 580, sx: 1.25, sy: 0.8 } };
  const up = { ...structuredClone(ball) };
  const lay = d.main.layers[0];
  lay.name = "Pelota";
  lay.keyframes = [
    { ...newKey(0, [ball]), tween: "classic", ease: -80 },
    { ...newKey(12, [down]), tween: "classic", ease: 80 },
    { ...newKey(24, [up]), tween: "none" },
  ];
  const floor = newLayer("Suelo");
  floor.keyframes = [newKey(0, [{ id: newId("el"), kind: "rect", t: { x: 640, y: 660, sx: 1, sy: 1, rot: 0 }, alpha: 1, w: 1280, h: 40, fill: "#ffa94d", stroke: null as unknown as string, strokeWidth: 0 }])];
  d.main = { layers: [lay, floor], length: 25 };
  return d;
}
