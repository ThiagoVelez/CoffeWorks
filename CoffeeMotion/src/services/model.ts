// Creación de proyectos, composiciones y capas; efectos; ajustes de
// animación (presets) y plantillas de títulos.

import { newId } from "../studio/color";
import type { Asset, Color, Comp, Effect, EffectKind, Keyframe, Layer, LayerType, Mask, Project, Prop, ShapeData, ShapeKind, TextData, Vec } from "../types";
import { LABELS } from "../types";
import { keyId, keyedValue } from "./anim";

export const P = <T,>(value: T): Prop<T> => ({ value });

export function newComp(name = "Composición 1", width = 1920, height = 1080, fps = 30, duration = 10): Comp {
  return { id: newId("comp"), name, width, height, fps, duration, background: "#101014", workIn: 0, workOut: duration, layers: [], motionBlurOn: true, shutterAngle: 180 };
}

export function newProject(): Project {
  const c = newComp();
  return { version: 1, assets: [], comps: [c], activeComp: c.id };
}

let labelIx = 0;

export function baseLayer(type: LayerType, name: string, comp: Comp, at = 0): Layer {
  return {
    id: newId("ly"),
    name,
    type,
    inPoint: at,
    outPoint: comp.duration,
    startTime: at,
    visible: true,
    locked: false,
    solo: false,
    expanded: false,
    label: LABELS[labelIx++ % LABELS.length],
    parent: null,
    blend: "normal",
    matte: "none",
    motionBlur: false,
    transform: {
      anchor: P<Vec>([0, 0]),
      position: P<Vec>([comp.width / 2, comp.height / 2]),
      scale: P<Vec>([100, 100]),
      rotation: P(0),
      opacity: P(100),
    },
    effects: [],
    masks: [],
  };
}

export function shapeData(kind: ShapeKind, w: number, h: number, fill: Color): ShapeData {
  return {
    kind,
    size: P<Vec>([w, h]),
    roundness: P(0),
    points: 5,
    innerRatio: 0.45,
    path: [],
    closed: true,
    fill: P(fill),
    fillOn: true,
    stroke: P("#ffffff"),
    strokeWidth: P(6),
    strokeOn: false,
    trimStart: P(0),
    trimEnd: P(100),
    dash: 0,
    gradient: { on: false, to: "#ffd43b", angle: 0, radial: false },
  };
}

export function shapeLayer(comp: Comp, kind: ShapeKind, at: number, fill = "#ff922b", w = 400, h = 400): Layer {
  const names: Record<ShapeKind, string> = { rect: "Rectángulo", ellipse: "Elipse", star: "Estrella", polygon: "Polígono", path: "Forma" };
  const l = baseLayer("shape", names[kind], comp, at);
  l.shape = shapeData(kind, w, h, fill);
  return l;
}

export function textData(text: string, size = 120, color = "#ffffff"): TextData {
  return {
    text: P(text),
    font: "Hanken Grotesk",
    weight: 700,
    italic: false,
    size: P(size),
    color: P(color),
    align: "center",
    tracking: P(0),
    lineHeight: 1.15,
    stroke: "#000000",
    strokeWidth: 0,
    animator: "none",
    progress: P(100),
  };
}

export function textLayer(comp: Comp, text: string, at: number, size = 120): Layer {
  const l = baseLayer("text", text.split("\n")[0].slice(0, 30) || "Texto", comp, at);
  l.text = textData(text, size);
  return l;
}

export function solidLayer(comp: Comp, color: string, at: number, name = "Sólido"): Layer {
  const l = baseLayer("solid", name, comp, at);
  l.color = P(color);
  l.transform.anchor = P<Vec>([comp.width / 2, comp.height / 2]);
  return l;
}

export function nullLayer(comp: Comp, at: number): Layer {
  return baseLayer("null", "Nulo", comp, at);
}

export function adjustmentLayer(comp: Comp, at: number): Layer {
  const l = baseLayer("adjustment", "Capa de ajuste", comp, at);
  l.transform.anchor = P<Vec>([comp.width / 2, comp.height / 2]);
  return l;
}

export function mediaLayer(comp: Comp, asset: Asset, at: number): Layer {
  const type: LayerType = asset.kind === "image" ? "image" : asset.kind === "video" ? "video" : "audio";
  const l = baseLayer(type, asset.name, comp, at);
  l.assetId = asset.id;
  if (asset.kind !== "image") l.outPoint = Math.min(comp.duration, at + (asset.duration || comp.duration));
  if (asset.kind !== "audio") {
    l.transform.anchor = P<Vec>([asset.width / 2, asset.height / 2]);
    // Que quepa en la composición
    const k = Math.min(1, comp.width / asset.width, comp.height / asset.height) * 100;
    l.transform.scale = P<Vec>([Math.round(k * 10) / 10, Math.round(k * 10) / 10]);
  }
  if (asset.kind !== "image") l.volume = P(0);
  l.timeStretch = 100;
  return l;
}

export function precompLayer(comp: Comp, inner: Comp, at: number): Layer {
  const l = baseLayer("precomp", inner.name, comp, at);
  l.compId = inner.id;
  l.transform.anchor = P<Vec>([inner.width / 2, inner.height / 2]);
  l.outPoint = Math.min(comp.duration, at + inner.duration);
  return l;
}

// ---------------------------------------------------------------------------
// Efectos
// ---------------------------------------------------------------------------

export interface EffectParamInfo {
  key: string;
  label: string;
  type: "number" | "color";
  min?: number;
  max?: number;
  step?: number;
  def: number | string;
  unit?: string;
}

export const EFFECTS: Record<EffectKind, { label: string; group: string; params: EffectParamInfo[] }> = {
  blur: { label: "Desenfoque gaussiano", group: "Desenfocar", params: [{ key: "amount", label: "Desenfoque", type: "number", min: 0, max: 200, def: 12, unit: "px" }] },
  directionalBlur: {
    label: "Desenfoque direccional",
    group: "Desenfocar",
    params: [
      { key: "angle", label: "Dirección", type: "number", min: -180, max: 180, def: 0, unit: "°" },
      { key: "length", label: "Longitud", type: "number", min: 0, max: 300, def: 40, unit: "px" },
    ],
  },
  glow: {
    label: "Resplandor",
    group: "Estilizar",
    params: [
      { key: "radius", label: "Radio", type: "number", min: 0, max: 200, def: 25, unit: "px" },
      { key: "intensity", label: "Intensidad", type: "number", min: 0, max: 400, def: 120, unit: "%" },
      { key: "color", label: "Color", type: "color", def: "#ffd8a8" },
    ],
  },
  shadow: {
    label: "Sombra paralela",
    group: "Perspectiva",
    params: [
      { key: "distance", label: "Distancia", type: "number", min: 0, max: 300, def: 18, unit: "px" },
      { key: "angle", label: "Dirección", type: "number", min: -180, max: 180, def: 135, unit: "°" },
      { key: "softness", label: "Suavidad", type: "number", min: 0, max: 200, def: 20, unit: "px" },
      { key: "opacity", label: "Opacidad", type: "number", min: 0, max: 100, def: 60, unit: "%" },
      { key: "color", label: "Color", type: "color", def: "#000000" },
    ],
  },
  stroke: {
    label: "Contorno",
    group: "Estilizar",
    params: [
      { key: "width", label: "Grosor", type: "number", min: 0, max: 60, def: 6, unit: "px" },
      { key: "color", label: "Color", type: "color", def: "#ffffff" },
    ],
  },
  brightness: {
    label: "Brillo y contraste",
    group: "Corrección de color",
    params: [
      { key: "brightness", label: "Brillo", type: "number", min: -100, max: 100, def: 0 },
      { key: "contrast", label: "Contraste", type: "number", min: -100, max: 100, def: 0 },
    ],
  },
  hueSat: {
    label: "Tono/Saturación",
    group: "Corrección de color",
    params: [
      { key: "hue", label: "Tono", type: "number", min: -180, max: 180, def: 0, unit: "°" },
      { key: "saturation", label: "Saturación", type: "number", min: -100, max: 100, def: 0 },
    ],
  },
  tint: {
    label: "Teñir",
    group: "Corrección de color",
    params: [
      { key: "amount", label: "Cantidad", type: "number", min: 0, max: 100, def: 100, unit: "%" },
      { key: "color", label: "Color", type: "color", def: "#ff922b" },
    ],
  },
  fill: {
    label: "Relleno",
    group: "Generar",
    params: [
      { key: "opacity", label: "Opacidad", type: "number", min: 0, max: 100, def: 100, unit: "%" },
      { key: "color", label: "Color", type: "color", def: "#ff6b6b" },
    ],
  },
  invert: { label: "Invertir", group: "Canal", params: [{ key: "amount", label: "Mezcla", type: "number", min: 0, max: 100, def: 100, unit: "%" }] },
  noise: { label: "Ruido", group: "Ruido y granulado", params: [{ key: "amount", label: "Cantidad", type: "number", min: 0, max: 100, def: 20, unit: "%" }] },
  vignette: {
    label: "Viñeta",
    group: "Estilizar",
    params: [
      { key: "amount", label: "Cantidad", type: "number", min: 0, max: 100, def: 60, unit: "%" },
      { key: "size", label: "Tamaño", type: "number", min: 10, max: 150, def: 70, unit: "%" },
    ],
  },
  mosaic: { label: "Mosaico", group: "Estilizar", params: [{ key: "cells", label: "Tamaño de celda", type: "number", min: 2, max: 200, def: 24, unit: "px" }] },
};

export function newEffect(kind: EffectKind): Effect {
  const params: Effect["params"] = {};
  for (const p of EFFECTS[kind].params) params[p.key] = P(p.def) as Prop<number> | Prop<Color>;
  return { id: newId("fx"), kind, enabled: true, params };
}

export function newMask(kind: Mask["kind"], rect: [number, number, number, number]): Mask {
  return { id: newId("mk"), name: kind === "rect" ? "Máscara rectangular" : kind === "ellipse" ? "Máscara elíptica" : "Máscara", kind, rect: P(rect), path: [], feather: P(0), opacity: P(100), expansion: P(0), inverted: false, mode: "add" };
}

// ---------------------------------------------------------------------------
// Ajustes de animación (como los «Animation Presets»)
// ---------------------------------------------------------------------------

const K = <T,>(t: number, v: T, ease: Keyframe<T>["ease"] = "easeInOut"): Keyframe<T> => ({ id: keyId(), t, v, ease });

export interface AnimPreset {
  id: string;
  name: string;
  group: string;
  apply: (l: Layer, comp: Comp, t: number) => Layer;
}

const tr = (l: Layer, patch: Partial<Layer["transform"]>): Layer => ({ ...l, transform: { ...l.transform, ...patch } });

export const ANIM_PRESETS: AnimPreset[] = [
  { id: "fadeIn", name: "Aparecer (fundido)", group: "Entradas", apply: (l, _c, t) => tr(l, { opacity: { value: 100, keys: [K(t, 0), K(t + 0.6, 100)] } }) },
  { id: "fadeOut", name: "Desaparecer (fundido)", group: "Salidas", apply: (l, _c, t) => tr(l, { opacity: { value: 100, keys: [K(t, 100), K(t + 0.6, 0)] } }) },
  {
    id: "slideLeft",
    name: "Entrar desde la izquierda",
    group: "Entradas",
    apply: (l, c, t) => {
      const p = keyedValue(l.transform.position, t);
      return tr(l, { position: { value: p, keys: [K<[number, number]>(t, [p[0] - c.width * 0.6, p[1]], "easeOut"), K<[number, number]>(t + 0.8, p)] }, opacity: { value: 100, keys: [K(t, 0, "linear"), K(t + 0.3, 100)] } });
    },
  },
  {
    id: "slideUp",
    name: "Subir desde abajo",
    group: "Entradas",
    apply: (l, c, t) => {
      const p = keyedValue(l.transform.position, t);
      return tr(l, { position: { value: p, keys: [K<[number, number]>(t, [p[0], p[1] + c.height * 0.25], "easeOut"), K<[number, number]>(t + 0.7, p)] }, opacity: { value: 100, keys: [K(t, 0, "linear"), K(t + 0.35, 100)] } });
    },
  },
  {
    id: "pop",
    name: "Aparecer con rebote",
    group: "Entradas",
    apply: (l, _c, t) =>
      tr(l, {
        scale: { value: keyedValue(l.transform.scale, t), keys: [K<[number, number]>(t, [0, 0], "easeOut"), K<[number, number]>(t + 0.35, [115, 115], "easeInOut"), K<[number, number]>(t + 0.55, [94, 94], "easeInOut"), K<[number, number]>(t + 0.7, keyedValue(l.transform.scale, t))] },
      }),
  },
  { id: "spinIn", name: "Entrar girando", group: "Entradas", apply: (l, _c, t) => tr(l, { rotation: { value: 0, keys: [K(t, -180, "easeOut"), K(t + 0.9, 0)] }, scale: { value: keyedValue(l.transform.scale, t), keys: [K<[number, number]>(t, [0, 0], "easeOut"), K<[number, number]>(t + 0.9, keyedValue(l.transform.scale, t))] } }) },
  {
    id: "zoomOut",
    name: "Salir con zoom",
    group: "Salidas",
    apply: (l, _c, t) => {
      const s = keyedValue(l.transform.scale, t);
      return tr(l, { scale: { value: s, keys: [K<[number, number]>(t, s, "easeIn"), K<[number, number]>(t + 0.6, [s[0] * 1.8, s[1] * 1.8])] }, opacity: { value: 100, keys: [K(t, 100, "easeIn"), K(t + 0.6, 0)] } });
    },
  },
  { id: "wiggle", name: "Temblor (wiggle)", group: "Movimiento continuo", apply: (l) => tr(l, { position: { ...l.transform.position, expr: "wiggle(3, 25)" } }) },
  { id: "spin", name: "Girar sin parar", group: "Movimiento continuo", apply: (l) => tr(l, { rotation: { ...l.transform.rotation, expr: "value + time * 90" } }) },
  { id: "pulse", name: "Latido", group: "Movimiento continuo", apply: (l) => tr(l, { scale: { ...l.transform.scale, expr: "var s = 1 + Math.sin(time * Math.PI * 2) * 0.06; [value[0] * s, value[1] * s]" } }) },
  { id: "float", name: "Flotar", group: "Movimiento continuo", apply: (l) => tr(l, { position: { ...l.transform.position, expr: "[value[0], value[1] + Math.sin(time * 2) * 18]" } }) },
  { id: "typewriter", name: "Máquina de escribir", group: "Texto", apply: (l, _c, t) => (l.text ? { ...l, text: { ...l.text, animator: "typewriter", progress: { value: 100, keys: [K(t, 0, "linear"), K(t + Math.max(0.6, l.text.text.value.length * 0.06), 100)] } } } : l) },
  { id: "fadeChars", name: "Letras que aparecen", group: "Texto", apply: (l, _c, t) => (l.text ? { ...l, text: { ...l.text, animator: "fadeChars", progress: { value: 100, keys: [K(t, 0, "linear"), K(t + 1.2, 100)] } } } : l) },
  { id: "slideChars", name: "Letras que suben", group: "Texto", apply: (l, _c, t) => (l.text ? { ...l, text: { ...l.text, animator: "slideChars", progress: { value: 100, keys: [K(t, 0, "linear"), K(t + 1.2, 100)] } } } : l) },
  { id: "scaleChars", name: "Letras que crecen", group: "Texto", apply: (l, _c, t) => (l.text ? { ...l, text: { ...l.text, animator: "scaleChars", progress: { value: 100, keys: [K(t, 0, "linear"), K(t + 1, 100)] } } } : l) },
  { id: "blurChars", name: "Letras desde el desenfoque", group: "Texto", apply: (l, _c, t) => (l.text ? { ...l, text: { ...l.text, animator: "blurChars", progress: { value: 100, keys: [K(t, 0, "linear"), K(t + 1.2, 100)] } } } : l) },
  { id: "wave", name: "Ola", group: "Texto", apply: (l) => (l.text ? { ...l, text: { ...l.text, animator: "wave" } } : l) },
  {
    id: "drawOn",
    name: "Dibujar el trazo",
    group: "Formas",
    apply: (l, _c, t) => (l.shape ? { ...l, shape: { ...l.shape, strokeOn: true, trimEnd: { value: 100, keys: [K(t, 0), K(t + 1.2, 100)] } } } : l),
  },
];

// ---------------------------------------------------------------------------
// Plantillas de títulos (composiciones completas)
// ---------------------------------------------------------------------------

export interface TitleTemplate {
  id: string;
  name: string;
  description: string;
  build: (w: number, h: number) => Comp;
}

function addPreset(l: Layer, comp: Comp, id: string, t: number) {
  return ANIM_PRESETS.find((p) => p.id === id)!.apply(l, comp, t);
}

export const TITLE_TEMPLATES: TitleTemplate[] = [
  {
    id: "lower-third",
    name: "Rótulo inferior",
    description: "Barra con nombre y cargo que entra desde la izquierda.",
    build: (w, h) => {
      const c = newComp("Rótulo inferior", w, h, 30, 6);
      c.background = "#00000000";
      const bar = shapeLayer(c, "rect", 0, "#e8590c", w * 0.42, h * 0.11);
      bar.name = "Barra";
      bar.transform.position = P<[number, number]>([w * 0.27, h * 0.8]);
      const nameL = textLayer(c, "Nombre Apellido", 0.2, Math.round(h * 0.05));
      nameL.text!.align = "left";
      nameL.transform.position = P<[number, number]>([w * 0.08, h * 0.795]);
      const role = textLayer(c, "Cargo o descripción", 0.45, Math.round(h * 0.03));
      role.text!.align = "left";
      role.text!.weight = 500;
      role.text!.color = P("#ffe8cc");
      role.transform.position = P<[number, number]>([w * 0.08, h * 0.87]);
      c.layers = [addPreset(role, c, "fadeChars", 0.5), addPreset(nameL, c, "slideLeft", 0.2), addPreset(bar, c, "slideLeft", 0)].map((l) => addPreset(l, c, "fadeOut", 5.2));
      return c;
    },
  },
  {
    id: "kinetic",
    name: "Título cinético",
    description: "Tres palabras que aparecen con rebote y ritmo.",
    build: (w, h) => {
      const c = newComp("Título cinético", w, h, 30, 5);
      c.background = "#1a1020";
      const words = ["CREA", "ANIMA", "BRILLA"];
      const colors = ["#ff922b", "#f06595", "#ffd43b"];
      c.layers = words
        .map((wd, i) => {
          const l = textLayer(c, wd, i * 0.5, Math.round(h * 0.16));
          l.text!.color = P(colors[i]);
          l.transform.position = P<[number, number]>([w / 2, h * (0.3 + i * 0.22)]);
          return addPreset(addPreset(l, c, "pop", i * 0.5), c, "zoomOut", 4.2);
        })
        .reverse();
      const bg = solidLayer(c, "#2b1630", 0, "Fondo");
      bg.effects = [newEffect("vignette")];
      c.layers.push(bg);
      return c;
    },
  },
  {
    id: "logo-reveal",
    name: "Revelado de logotipo",
    description: "Círculo que se dibuja, destello y texto que sube.",
    build: (w, h) => {
      const c = newComp("Revelado de logotipo", w, h, 30, 5);
      c.background = "#0b0b10";
      const ring = shapeLayer(c, "ellipse", 0, "#00000000", h * 0.36, h * 0.36);
      ring.name = "Anillo";
      ring.shape!.fillOn = false;
      ring.shape!.strokeOn = true;
      ring.shape!.stroke = P("#ffa94d");
      ring.shape!.strokeWidth = P(Math.round(h * 0.012));
      ring.transform.position = P<[number, number]>([w / 2, h * 0.42]);
      const fx = newEffect("glow");
      const ringA = addPreset(ring, c, "drawOn", 0.2);
      ringA.effects = [fx];
      const dot = shapeLayer(c, "star", 0.9, "#ffd43b", h * 0.16, h * 0.16);
      dot.name = "Estrella";
      dot.transform.position = P<[number, number]>([w / 2, h * 0.42]);
      const title = textLayer(c, "Tu marca", 1.4, Math.round(h * 0.09));
      title.transform.position = P<[number, number]>([w / 2, h * 0.76]);
      c.layers = [addPreset(title, c, "slideUp", 1.4), addPreset(dot, c, "spinIn", 0.9), ringA];
      return c;
    },
  },
  {
    id: "countdown",
    name: "Cuenta atrás",
    description: "Número de 5 a 0 con una expresión y un anillo que se vacía.",
    build: (w, h) => {
      const c = newComp("Cuenta atrás", w, h, 30, 5);
      c.background = "#14141a";
      const num = textLayer(c, "5", 0, Math.round(h * 0.3));
      num.text!.text = { value: "5", expr: "Math.max(0, Math.ceil(5 - time))" };
      num.transform.position = P<[number, number]>([w / 2, h * 0.5]);
      num.transform.scale = { value: [100, 100], expr: "var f = time % 1; var s = 100 + (1 - Math.min(1, f * 4)) * 20; [s, s]" };
      const ring = shapeLayer(c, "ellipse", 0, "#00000000", h * 0.55, h * 0.55);
      ring.name = "Anillo";
      ring.shape!.fillOn = false;
      ring.shape!.strokeOn = true;
      ring.shape!.stroke = P("#ff922b");
      ring.shape!.strokeWidth = P(Math.round(h * 0.02));
      ring.shape!.trimEnd = { value: 100, keys: [K(0, 100, "linear"), K(5, 0)] };
      ring.transform.position = P<[number, number]>([w / 2, h * 0.5]);
      ring.transform.rotation = P(-90);
      c.layers = [num, ring];
      return c;
    },
  },
  {
    id: "social-quote",
    name: "Cita para redes (9:16)",
    description: "Cita vertical con fondo animado, letras que suben y autor.",
    build: () => {
      const W = 1080;
      const H = 1920;
      const c = newComp("Cita vertical", W, H, 30, 8);
      const bg = shapeLayer(c, "rect", 0, "#d9480f", W, H);
      bg.name = "Fondo";
      bg.shape!.gradient = { on: true, to: "#862e9c", angle: 135, radial: false };
      bg.transform.position = P<[number, number]>([W / 2, H / 2]);
      const blob = shapeLayer(c, "ellipse", 0, "#ffffff22", 700, 700);
      blob.name = "Círculo";
      blob.transform.position = { value: [W * 0.75, H * 0.2], expr: "wiggle(0.4, 120)" };
      blob.effects = [{ ...newEffect("blur"), params: { amount: P(60) } }];
      const quote = textLayer(c, "«La creatividad es\nla inteligencia\ndivirtiéndose»", 0.3, 96);
      quote.transform.position = P<[number, number]>([W / 2, H * 0.46]);
      const author = textLayer(c, "— Albert Einstein", 2.4, 54);
      author.text!.weight = 500;
      author.text!.color = P("#ffe3e3");
      author.transform.position = P<[number, number]>([W / 2, H * 0.66]);
      c.layers = [addPreset(author, c, "fadeIn", 2.4), addPreset(quote, c, "slideChars", 0.3), blob, bg];
      return c;
    },
  },
];

/** Composiciones usadas por una capa (para evitar ciclos al anidar). */
export function compUses(project: Project, compId: string, target: string, seen = new Set<string>()): boolean {
  if (compId === target) return true;
  if (seen.has(compId)) return false;
  seen.add(compId);
  const c = project.comps.find((x) => x.id === compId);
  return !!c?.layers.some((l) => l.compId && compUses(project, l.compId, target, seen));
}

export function serializeProject(p: Project): string {
  return JSON.stringify({ app: "CoffeeMotion", ...p });
}

export function parseProject(text: string): Project {
  const raw = JSON.parse(text);
  if (!raw.comps?.length) return newProject();
  return { version: 1, assets: raw.assets || [], comps: raw.comps, activeComp: raw.comps.some((c: Comp) => c.id === raw.activeComp) ? raw.activeComp : raw.comps[0].id };
}
