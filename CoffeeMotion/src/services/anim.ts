// Interpolación de fotogramas clave, curvas de suavizado y expresiones.

import type { Ease, Keyframe, Prop } from "../types";

// ---------------------------------------------------------------------------
// Curvas
// ---------------------------------------------------------------------------

export const EASE_CURVES: Record<Exclude<Ease, "hold" | "bezier">, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.33, 0, 0.67, 1],
};

export const EASE_LABEL: Record<Ease, string> = {
  linear: "Lineal",
  easeIn: "Acelerar (entrada suave)",
  easeOut: "Frenar (salida suave)",
  easeInOut: "Suavizado (entrada y salida)",
  hold: "Mantener",
  bezier: "Curva personalizada",
};

/** Curva de Bézier cúbica (como en CSS): devuelve y para x. */
export function cubicBezier(x: number, [x1, y1, x2, y2]: [number, number, number, number]): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const dx = (t: number) => 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = dx(t);
    if (Math.abs(d) < 1e-6) break;
    t -= (bx(t) - x) / d;
    t = Math.max(0, Math.min(1, t));
  }
  // Bisección de seguridad
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20 && Math.abs(bx(t) - x) > 1e-5; i++) {
    t = (lo + hi) / 2;
    if (bx(t) < x) lo = t;
    else hi = t;
  }
  return by(t);
}

export function easeValue(u: number, k: Keyframe<unknown>): number {
  if (k.ease === "hold") return 0;
  const curve = k.ease === "bezier" ? k.bez || EASE_CURVES.easeInOut : EASE_CURVES[k.ease];
  return cubicBezier(u, curve);
}

// ---------------------------------------------------------------------------
// Mezcla de valores
// ---------------------------------------------------------------------------

const hexToRgba = (hex: string): [number, number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0, full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1];
};
const toHex = (r: number, g: number, b: number, a = 1) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}${a < 1 ? Math.round(a * 255).toString(16).padStart(2, "0") : ""}`;

export function mix<T>(a: T, b: T, u: number): T {
  if (typeof a === "number" && typeof b === "number") return (a + (b - a) * u) as T;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => v + ((b[i] ?? v) - v) * u) as T;
  if (typeof a === "string" && typeof b === "string" && a.startsWith("#") && b.startsWith("#")) {
    const x = hexToRgba(a);
    const y = hexToRgba(b);
    return toHex(x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u, x[3] + (y[3] - x[3]) * u) as T;
  }
  return (u < 1 ? a : b) as T;
}

/** Valor por fotogramas clave (sin expresión). */
export function keyedValue<T>(p: Prop<T>, t: number): T {
  const keys = p.keys;
  if (!keys || !keys.length) return p.value;
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  const u = (t - k0.t) / (k1.t - k0.t || 1);
  return mix(k0.v, k1.v, easeValue(u, k0));
}

export const isAnimated = (p: Prop<unknown>) => !!(p.keys && p.keys.length);

// ---------------------------------------------------------------------------
// Expresiones
// ---------------------------------------------------------------------------

export interface ExprContext {
  /** Semilla estable (id de la capa + propiedad) para wiggle/random. */
  seed: string;
  index: number;
  comp: { width: number; height: number; duration: number; fps: number };
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Ruido suave determinista (suma de senos con fases aleatorias). */
function smoothNoise(seed: number, x: number): number {
  let v = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    const s = hash(`${seed}:${o}`);
    const ph = (s % 1000) / 1000 * Math.PI * 2;
    const f = 1 + o * 1.37 + (s % 97) / 97;
    v += Math.sin(x * f * Math.PI * 2 / 2.2 + ph) * amp;
    norm += amp;
    amp *= 0.55;
  }
  return v / norm;
}

const compiled = new Map<string, ((...a: unknown[]) => unknown) | Error>();
const ARGS = ["time", "value", "wiggle", "loopOut", "loopIn", "linear", "ease", "clamp", "random", "index", "thisComp", "timeToFrames", "degreesToRadians", "radiansToDegrees", "length", "Math"];

export function compileExpr(expr: string): ((...a: unknown[]) => unknown) | Error {
  let fn = compiled.get(expr);
  if (fn) return fn;
  try {
    // Una línea suelta se toma como el resultado
    const body = /\breturn\b/.test(expr) ? expr : expr.includes(";") || expr.includes("\n") ? expr.replace(/;?\s*([^;\n]+)\s*;?\s*$/, ";return ($1);") : `return (${expr});`;
    fn = new Function(...ARGS, `"use strict";${body}`) as (...a: unknown[]) => unknown;
  } catch (e) {
    fn = e instanceof Error ? e : new Error(String(e));
  }
  compiled.set(expr, fn);
  return fn;
}

export function propValue<T>(p: Prop<T>, t: number, ctx?: ExprContext): T {
  const base = keyedValue(p, t);
  if (!p.expr || !p.expr.trim() || !ctx) return base;
  const fn = compileExpr(p.expr);
  if (fn instanceof Error) return base;
  const seed = hash(ctx.seed);
  const wiggle = (freq: number, amp: number) => {
    const w = (k: number) => smoothNoise(seed + k * 7919, t * freq) * amp;
    if (Array.isArray(base)) return base.map((v, i) => v + w(i));
    if (typeof base === "number") return base + w(0);
    return base;
  };
  const loop = (dir: "out" | "in") => (type = "cycle") => {
    const keys = p.keys;
    if (!keys || keys.length < 2) return base;
    const a = keys[0].t;
    const b = keys[keys.length - 1].t;
    const span = b - a;
    if (span <= 0) return base;
    if (dir === "out" && t <= b) return base;
    if (dir === "in" && t >= a) return base;
    if (type === "pingpong") {
      const k = Math.floor((t - a) / span);
      const local = (((t - a) % span) + span) % span;
      return keyedValue(p, k % 2 ? b - local : a + local);
    }
    return keyedValue(p, a + ((((t - a) % span) + span) % span));
  };
  const lin = (x: number, a: number, b: number, c: number, d: number) => c + (d - c) * Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  const easeFn = (x: number, a: number, b: number, c: number, d: number) => c + (d - c) * cubicBezier(Math.max(0, Math.min(1, (x - a) / (b - a || 1))), EASE_CURVES.easeInOut);
  let rnd = seed;
  const random = (a?: number, b?: number) => {
    rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
    const r = rnd / 4294967296;
    if (a === undefined) return r;
    if (b === undefined) return r * a;
    return a + r * (b - a);
  };
  try {
    const out = fn(
      t,
      base,
      wiggle,
      loop("out"),
      loop("in"),
      lin,
      easeFn,
      (x: number, a: number, b: number) => Math.max(a, Math.min(b, x)),
      random,
      ctx.index,
      ctx.comp,
      (s: number) => Math.round(s * ctx.comp.fps),
      (d: number) => (d * Math.PI) / 180,
      (r: number) => (r * 180) / Math.PI,
      (a: number[], b: number[] = [0, 0]) => Math.hypot(a[0] - b[0], a[1] - b[1]),
      Math
    );
    if (Array.isArray(base)) return (Array.isArray(out) && out.every((v) => typeof v === "number" && isFinite(v)) ? out : typeof out === "number" && isFinite(out) ? base.map(() => out) : base) as T;
    if (typeof base === "number") return (typeof out === "number" && isFinite(out) ? out : base) as T;
    if (typeof base === "string") return (out === undefined || out === null ? base : String(out)) as T;
    return base;
  } catch {
    return base;
  }
}

/** Comprueba una expresión y devuelve el error (o null). */
export function exprError(expr: string): string | null {
  if (!expr.trim()) return null;
  const fn = compileExpr(expr);
  return fn instanceof Error ? fn.message : null;
}

// ---------------------------------------------------------------------------
// Edición de fotogramas clave
// ---------------------------------------------------------------------------

let kid = 0;
export const keyId = () => `k${Date.now().toString(36)}${(kid++).toString(36)}`;

/** Fija el valor en `t`: si la propiedad está animada crea o actualiza la clave. */
export function setAt<T>(p: Prop<T>, t: number, v: T): Prop<T> {
  if (!p.keys || !p.keys.length) return { ...p, value: v };
  const eps = 1e-4;
  const keys = p.keys.slice();
  const i = keys.findIndex((k) => Math.abs(k.t - t) < eps);
  if (i >= 0) keys[i] = { ...keys[i], v };
  else {
    const prev = [...keys].reverse().find((k) => k.t < t);
    keys.push({ id: keyId(), t, v, ease: prev?.ease === "hold" ? "hold" : prev?.ease || "linear" });
    keys.sort((a, b) => a.t - b.t);
  }
  return { ...p, keys };
}

/** Activa/desactiva el cronómetro (animación) de la propiedad. */
export function toggleStopwatch<T>(p: Prop<T>, t: number): Prop<T> {
  if (p.keys && p.keys.length) return { ...p, value: keyedValue(p, t), keys: undefined };
  return { ...p, keys: [{ id: keyId(), t, v: p.value, ease: "linear" }] };
}

/** Añade o quita una clave en `t` con el valor actual. */
export function toggleKeyAt<T>(p: Prop<T>, t: number): Prop<T> {
  const keys = p.keys || [];
  const i = keys.findIndex((k) => Math.abs(k.t - t) < 1e-4);
  if (i >= 0) {
    const next = keys.filter((_, j) => j !== i);
    return next.length ? { ...p, keys: next } : { ...p, value: keys[i].v, keys: undefined };
  }
  const prev = [...keys].reverse().find((k) => k.t < t);
  const key: Keyframe<T> = { id: keyId(), t, v: keyedValue(p, t), ease: prev?.ease || "linear" };
  return { ...p, keys: [...keys, key].sort((a, b) => a.t - b.t) };
}

export const fmtTimecode = (t: number, fps: number) => {
  const total = Math.round(t * fps);
  const f = total % Math.round(fps);
  const s = Math.floor(total / Math.round(fps));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
};
