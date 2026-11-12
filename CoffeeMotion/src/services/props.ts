// Lista de propiedades animables de una capa (para la línea de tiempo).

import type { Effect, Layer, Mask, Prop } from "../types";
import { EFFECTS } from "./model";

export type PropKind = "vec" | "num" | "color" | "text" | "rect";

export interface PropRef {
  path: string;
  label: string;
  group: string;
  kind: PropKind;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  get: (l: Layer) => Prop<unknown>;
  set: (l: Layer, p: Prop<unknown>) => Layer;
}

const T = (key: keyof Layer["transform"], label: string, kind: PropKind, unit?: string, step = 1, min?: number, max?: number): PropRef => ({
  path: `transform.${key}`,
  label,
  group: "Transformar",
  kind,
  unit,
  step,
  min,
  max,
  get: (l) => l.transform[key] as Prop<unknown>,
  set: (l, p) => ({ ...l, transform: { ...l.transform, [key]: p } }),
});

export function layerProps(l: Layer): PropRef[] {
  const out: PropRef[] = [];
  if (l.type !== "audio") {
    out.push(T("anchor", "Punto de anclaje", "vec"), T("position", "Posición", "vec"), T("scale", "Escala", "vec", "%"), T("rotation", "Rotación", "num", "°"), T("opacity", "Opacidad", "num", "%", 1, 0, 100));
  }
  if (l.shape) {
    const S = (key: "size" | "roundness" | "fill" | "stroke" | "strokeWidth" | "trimStart" | "trimEnd", label: string, kind: PropKind, unit?: string, min?: number, max?: number): PropRef => ({
      path: `shape.${key}`,
      label,
      group: "Contenido",
      kind,
      unit,
      min,
      max,
      get: (x) => x.shape![key] as Prop<unknown>,
      set: (x, p) => ({ ...x, shape: { ...x.shape!, [key]: p } }),
    });
    if (l.shape.kind !== "path") out.push(S("size", "Tamaño", "vec"));
    if (l.shape.kind === "rect") out.push(S("roundness", "Redondez", "num", "px", 0));
    out.push(S("fill", "Color de relleno", "color"), S("stroke", "Color del trazo", "color"), S("strokeWidth", "Grosor del trazo", "num", "px", 0), S("trimStart", "Recortar: inicio", "num", "%", 0, 100), S("trimEnd", "Recortar: final", "num", "%", 0, 100));
  }
  if (l.text) {
    const X = (key: "text" | "size" | "color" | "tracking" | "progress", label: string, kind: PropKind, unit?: string, min?: number, max?: number): PropRef => ({
      path: `text.${key}`,
      label,
      group: "Texto",
      kind,
      unit,
      min,
      max,
      get: (x) => x.text![key] as Prop<unknown>,
      set: (x, p) => ({ ...x, text: { ...x.text!, [key]: p } }),
    });
    out.push(X("text", "Texto de origen", "text"), X("size", "Tamaño", "num", "px", 1), X("color", "Color", "color"), X("tracking", "Espaciado", "num"));
    if (l.text.animator !== "none") out.push(X("progress", "Animador: avance", "num", "%", 0, 100));
  }
  if (l.color) out.push({ path: "color", label: "Color del sólido", group: "Contenido", kind: "color", get: (x) => x.color!, set: (x, p) => ({ ...x, color: p as Prop<string> }) });
  if (l.volume) out.push({ path: "volume", label: "Volumen", group: "Audio", kind: "num", unit: "dB", min: -60, max: 12, get: (x) => x.volume!, set: (x, p) => ({ ...x, volume: p as Prop<number> }) });
  l.masks.forEach((m: Mask) => {
    const M = (key: "rect" | "feather" | "opacity" | "expansion", label: string, kind: PropKind, unit?: string, min?: number, max?: number): PropRef => ({
      path: `mask.${m.id}.${key}`,
      label,
      group: m.name,
      kind,
      unit,
      min,
      max,
      get: (x) => x.masks.find((y) => y.id === m.id)![key] as Prop<unknown>,
      set: (x, p) => ({ ...x, masks: x.masks.map((y) => (y.id === m.id ? { ...y, [key]: p } : y)) }),
    });
    if (m.kind !== "path") out.push(M("rect", "Rectángulo", "rect"));
    out.push(M("feather", "Desvanecer", "num", "px", 0), M("opacity", "Opacidad", "num", "%", 0, 100), M("expansion", "Expansión", "num", "px"));
  });
  l.effects.forEach((fx: Effect) => {
    for (const info of EFFECTS[fx.kind].params)
      out.push({
        path: `fx.${fx.id}.${info.key}`,
        label: info.label,
        group: EFFECTS[fx.kind].label,
        kind: info.type === "color" ? "color" : "num",
        unit: info.unit,
        min: info.min,
        max: info.max,
        get: (x) => x.effects.find((e) => e.id === fx.id)!.params[info.key] as Prop<unknown>,
        set: (x, p) => ({ ...x, effects: x.effects.map((e) => (e.id === fx.id ? { ...e, params: { ...e.params, [info.key]: p as Prop<number> } } : e)) }),
      });
  });
  return out;
}

export const findProp = (l: Layer, path: string) => layerProps(l).find((p) => p.path === path) || null;
