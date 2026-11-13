// Ajuste a la cuadrícula para mover, escalar y pivotes, y paso de giro.
// Es una preferencia de la app (localStorage), no del documento.

import type { Vec3 } from "./types";

export type SnapStep = 0 | 0.5 | 1 | 8 | 16;

export const SNAP_OPTIONS: { step: SnapStep; label: string }[] = [
  { step: 0, label: "Libre" },
  { step: 0.5, label: "1 px" },
  { step: 1, label: "1 u" },
  { step: 8, label: "½ bloque" },
  { step: 16, label: "1 bloque" },
];

/** Paso de giro cuando el ajuste está activo. */
export const ROTATE_STEP = 15;

export interface SnapPrefs {
  step: SnapStep;
  rotate: boolean;
}

const KEY = "ca3d.snap";
const DEFAULT: SnapPrefs = { step: 1, rotate: true };

export function snapValue(v: number, step: SnapStep): number {
  if (!step) return v;
  return Math.round(v / step) * step + 0;
}

export function snapVec(v: Vec3, step: SnapStep): Vec3 {
  return v.map((x) => snapValue(x, step)) as Vec3;
}

export function loadSnap(): SnapPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const v = JSON.parse(raw) as Partial<SnapPrefs>;
    const step = SNAP_OPTIONS.some((o) => o.step === v.step) ? (v.step as SnapStep) : DEFAULT.step;
    return { step, rotate: v.rotate ?? DEFAULT.rotate };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSnap(s: SnapPrefs) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: solo dura esta sesión */
  }
}

const num = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");

/** «2,5 bloques (40 u)»: distancia medida para mostrar. */
export function formatDistance(units: number): string {
  const blocks = units / 16;
  return `${num(blocks)} ${Math.round(blocks * 100) === 100 ? "bloque" : "bloques"} (${num(units)} u)`;
}
