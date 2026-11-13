// Operaciones puras sobre el modelo 3D (sin three.js): las usan el editor, el servidor
// MCP y la exportación. Todas devuelven un modelo nuevo; nunca mutan el anterior.

import { newId } from "./studio/color";
import { eulerFromQuat, quatFromAxisAngle, quatFromEuler, quatMul, rotateVec, type Quat } from "./rotation";
import { EASES, FACES, SHAPES, TEX, type Shape, type Animation, type Box, type Ease, type FaceName, type FaceTex, type Keyframe, type Model3D, type Part, type Pose, type Vec3 } from "./types";

export const DEFAULT_COLOR = "#c8a27a";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function newModel(name = "Modelo sin título"): Model3D {
  return { version: 2, name, parts: [], animations: [] };
}

function makeFaces(color: string): Record<FaceName, FaceTex> {
  const f = {} as Record<FaceName, FaceTex>;
  for (const n of FACES) f[n] = { color };
  return f;
}

export interface BoxInput {
  shape?: Shape;
  from: Vec3;
  size: Vec3;
  color?: string;
  faces?: Partial<Record<FaceName, FaceTex>>;
}

export interface PartInput {
  name: string;
  parent?: string | null;
  pivot?: Vec3;
  rotation?: Vec3;
  box?: BoxInput | null;
  visible?: boolean;
}

function toBox(b: BoxInput): Box {
  if (b.size.some((s) => !(s > 0))) throw new Error("El tamaño de la caja debe ser mayor que 0");
  const faces = makeFaces(b.color ?? DEFAULT_COLOR);
  for (const n of FACES) if (b.faces?.[n]) faces[n] = { ...b.faces[n]! };
  return { shape: b.shape ?? "box", from: [...b.from] as Vec3, size: [...b.size] as Vec3, faces };
}

export function findPart(m: Model3D, id: string): Part {
  const p = m.parts.find((x) => x.id === id);
  if (!p) throw new Error(`No existe la pieza ${id}`);
  return p;
}

export function children(m: Model3D, id: string | null): Part[] {
  return m.parts.filter((p) => p.parent === id);
}

export function descendants(m: Model3D, id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const c of children(m, pid)) {
      out.push(c.id);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

export function addPart(m: Model3D, input: PartInput): [Model3D, string] {
  if (input.parent && !m.parts.some((p) => p.id === input.parent)) throw new Error(`No existe la pieza padre ${input.parent}`);
  const id = newId("p");
  const part: Part = {
    id,
    name: input.name || "Pieza",
    parent: input.parent ?? null,
    pivot: [...(input.pivot ?? [0, 0, 0])] as Vec3,
    rotation: [...(input.rotation ?? [0, 0, 0])] as Vec3,
    box: input.box ? toBox(input.box) : null,
    visible: input.visible ?? true,
  };
  return [{ ...m, parts: [...m.parts, part] }, id];
}

export interface PartPatch {
  name?: string;
  parent?: string | null;
  pivot?: Vec3;
  rotation?: Vec3;
  box?: Partial<BoxInput> | null;
  visible?: boolean;
}

export function updatePart(m: Model3D, id: string, patch: PartPatch): Model3D {
  const old = findPart(m, id);
  if (patch.parent !== undefined && patch.parent !== null) {
    if (patch.parent === id || descendants(m, id).includes(patch.parent)) throw new Error("No se puede: formaría un ciclo en la jerarquía");
    findPart(m, patch.parent);
  }
  const next: Part = clone(old);
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.parent !== undefined) next.parent = patch.parent;
  if (patch.pivot) next.pivot = [...patch.pivot] as Vec3;
  if (patch.rotation) next.rotation = [...patch.rotation] as Vec3;
  if (patch.visible !== undefined) next.visible = patch.visible;
  if (patch.box === null) next.box = null;
  else if (patch.box) {
    const base = next.box ?? toBox({ from: [0, 0, 0], size: [4, 4, 4], color: patch.box.color });
    if (patch.box.shape) base.shape = patch.box.shape;
    if (patch.box.from) base.from = [...patch.box.from] as Vec3;
    if (patch.box.size) {
      if (patch.box.size.some((s) => !(s > 0))) throw new Error("El tamaño de la caja debe ser mayor que 0");
      base.size = [...patch.box.size] as Vec3;
    }
    if (patch.box.color) for (const n of FACES) base.faces[n] = { color: patch.box.color };
    if (patch.box.faces) for (const n of FACES) if (patch.box.faces[n]) base.faces[n] = { ...patch.box.faces[n]! };
    next.box = base;
  }
  return { ...m, parts: m.parts.map((p) => (p.id === id ? next : p)) };
}

export function removePart(m: Model3D, id: string): Model3D {
  findPart(m, id);
  const gone = new Set([id, ...descendants(m, id)]);
  return {
    ...m,
    parts: m.parts.filter((p) => !gone.has(p.id)),
    animations: m.animations.map((a) => ({ ...a, tracks: Object.fromEntries(Object.entries(a.tracks).filter(([pid]) => !gone.has(pid))) })),
  };
}

/** Copia una rama con ids nuevos. `transform` permite reflejarla. */
function copyBranch(m: Model3D, id: string, transform: (p: Part, isRoot: boolean) => Part, trackFn: (k: Keyframe) => Keyframe): [Model3D, string] {
  const ids = [id, ...descendants(m, id)];
  const map = new Map(ids.map((old) => [old, newId("p")]));
  const copies = ids.map((old, i) => {
    const p = transform(clone(findPart(m, old)), i === 0);
    p.id = map.get(old)!;
    if (i > 0) p.parent = map.get(p.parent!)!;
    return p;
  });
  const animations = m.animations.map((a) => {
    const tracks = { ...a.tracks };
    for (const old of ids) if (a.tracks[old]) tracks[map.get(old)!] = a.tracks[old].map((k) => trackFn(clone(k)));
    return { ...a, tracks };
  });
  return [{ ...m, parts: [...m.parts, ...copies], animations }, map.get(id)!];
}

export function duplicatePart(m: Model3D, id: string): [Model3D, string] {
  return copyBranch(m, id, (p, root) => (root ? { ...p, name: `${p.name} (copia)` } : p), (k) => k);
}

const SWAPS: [RegExp, string][] = [
  [/izquierdo/g, "\u0000derecho"],
  [/derecho/g, "\u0000izquierdo"],
  [/izquierda/g, "\u0000derecha"],
  [/derecha/g, "\u0000izquierda"],
  [/\bizq\b/g, "\u0000der"],
  [/\bder\b/g, "\u0000izq"],
];

export function mirrorName(name: string): string {
  let out = name;
  // Cada sustitución marca lo que ya cambió (\u0000) para no deshacerlo con la siguiente.
  for (const [re, rep] of SWAPS) out = out.replace(re, (match, offset: number, whole: string) => (whole[offset - 1] === "\u0000" ? match : rep));
  if (out === name) return `${name} (espejo)`;
  return out.replace(/\u0000/g, "");
}

function decode(pixels: string): Uint8Array {
  const bin = atob(pixels);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encode(px: Uint8Array): string {
  let s = "";
  for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode(...px.subarray(i, i + 0x8000));
  return btoa(s);
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** Píxeles RGBA de una cara (TEX×TEX), con el color base donde no se ha pintado. */
export function facePixels(face: FaceTex): Uint8Array {
  if (face.pixels) {
    const px = decode(face.pixels);
    if (px.length === TEX * TEX * 4) return px;
  }
  const [r, g, b] = hexToRgb(face.color);
  const px = new Uint8Array(TEX * TEX * 4);
  for (let i = 0; i < TEX * TEX; i++) px.set([r, g, b, 255], i * 4);
  return px;
}

function flipU(face: FaceTex): FaceTex {
  if (!face.pixels) return { ...face };
  const src = facePixels(face);
  const dst = new Uint8Array(src.length);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) dst.set(src.subarray((y * TEX + x) * 4, (y * TEX + x) * 4 + 4), (y * TEX + (TEX - 1 - x)) * 4);
  return { ...face, pixels: encode(dst) };
}

/** Cambia el signo sin producir −0. */
const neg = (v: number) => (v === 0 ? 0 : -v);

/** Copia reflejada (eje X) de una pieza y sus hijas, con sus animaciones. */
export function mirrorPart(m: Model3D, id: string): [Model3D, string] {
  return copyBranch(
    m,
    id,
    (p) => {
      p.name = mirrorName(p.name);
      p.pivot = [neg(p.pivot[0]), p.pivot[1], p.pivot[2]];
      p.rotation = [p.rotation[0], neg(p.rotation[1]), neg(p.rotation[2])];
      if (p.box) {
        const f = p.box.faces;
        p.box.from = [neg(p.box.from[0] + p.box.size[0]), p.box.from[1], p.box.from[2]];
        p.box.faces = { px: f.nx, nx: f.px, py: flipU(f.py), ny: flipU(f.ny), pz: flipU(f.pz), nz: flipU(f.nz) };
      }
      return p;
    },
    (k) => ({ ...k, pos: [neg(k.pos[0]), k.pos[1], k.pos[2]], rot: [k.rot[0], neg(k.rot[1]), neg(k.rot[2])] }),
  );
}

function checkPixel(x: number, y: number) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= TEX || y >= TEX) throw new Error(`Píxel fuera de la textura (0..${TEX - 1}): ${x}, ${y}`);
}

function withFace(m: Model3D, id: string, face: FaceName, fn: (f: FaceTex) => FaceTex): Model3D {
  const p = findPart(m, id);
  if (!p.box) throw new Error(`La pieza «${p.name}» no tiene caja`);
  if (!FACES.includes(face)) throw new Error(`Cara desconocida: ${face}`);
  const box = { ...p.box, faces: { ...p.box.faces, [face]: fn(p.box.faces[face]) } };
  return { ...m, parts: m.parts.map((x) => (x.id === id ? { ...x, box } : x)) };
}

export function getPixel(m: Model3D, id: string, face: FaceName, x: number, y: number): string {
  checkPixel(x, y);
  const p = findPart(m, id);
  if (!p.box) throw new Error(`La pieza «${p.name}» no tiene caja`);
  const px = facePixels(p.box.faces[face]);
  const i = (y * TEX + x) * 4;
  return toHex(px[i], px[i + 1], px[i + 2]);
}

/** Pinta varios píxeles de una cara de una vez. */
export function paintPixels(m: Model3D, id: string, face: FaceName, points: [number, number][], color: string): Model3D {
  for (const [x, y] of points) checkPixel(x, y);
  const [r, g, b] = hexToRgb(color);
  return withFace(m, id, face, (f) => {
    const px = facePixels(f);
    for (const [x, y] of points) px.set([r, g, b, 255], (y * TEX + x) * 4);
    return { color: f.color, pixels: encode(px) };
  });
}

export function paintPixel(m: Model3D, id: string, face: FaceName, x: number, y: number, color: string): Model3D {
  return paintPixels(m, id, face, [[x, y]], color);
}

export function fillFace(m: Model3D, id: string, face: FaceName, color: string): Model3D {
  return withFace(m, id, face, () => ({ color }));
}

// ---------- Animaciones ----------

export function addAnimation(m: Model3D, name: string, length = 1, loop = true): [Model3D, string] {
  const id = newId("a");
  return [{ ...m, animations: [...m.animations, { id, name, length: Math.max(0.05, length), loop, tracks: {} }] }, id];
}

export function updateAnimation(m: Model3D, id: string, patch: Partial<Pick<Animation, "name" | "length" | "loop">>): Model3D {
  if (!m.animations.some((a) => a.id === id)) throw new Error(`No existe la animación ${id}`);
  return { ...m, animations: m.animations.map((a) => (a.id === id ? { ...a, ...patch, length: Math.max(0.05, patch.length ?? a.length) } : a)) };
}

export function removeAnimation(m: Model3D, id: string): Model3D {
  return { ...m, animations: m.animations.filter((a) => a.id !== id) };
}

export function findAnimation(m: Model3D, id: string): Animation {
  const a = m.animations.find((x) => x.id === id);
  if (!a) throw new Error(`No existe la animación ${id}`);
  return a;
}

const NEUTRAL: Pose = { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function sampleTrack(keys: Keyframe[], t: number): Pose {
  if (!keys.length) return clone(NEUTRAL);
  if (t <= keys[0].t) return { pos: [...keys[0].pos], rot: [...keys[0].rot], scale: [...keys[0].scale] };
  const last = keys[keys.length - 1];
  if (t >= last.t) return { pos: [...last.pos], rot: [...last.rot], scale: [...last.scale] };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  let f = (t - a.t) / (b.t - a.t);
  if (a.ease === "step") f = 0;
  else if (a.ease === "smooth") f = f * f * (3 - 2 * f);
  else if (a.ease === "ease-in") f = f * f;
  else if (a.ease === "ease-out") f = 1 - (1 - f) * (1 - f);
  return { pos: lerp3(a.pos, b.pos, f), rot: lerp3(a.rot, b.rot, f), scale: lerp3(a.scale, b.scale, f) };
}

/** Tiempo efectivo dentro de la animación (bucle o tope). */
export function wrapTime(a: Animation, t: number): number {
  return a.loop ? ((t % a.length) + a.length) % a.length : Math.min(Math.max(t, 0), a.length);
}

/** Pose de cada pieza animada en el instante `t` (segundos). */
export function samplePose(m: Model3D, animId: string, t: number): Map<string, Pose> {
  const a = findAnimation(m, animId);
  const time = wrapTime(a, t);
  const out = new Map<string, Pose>();
  for (const [pid, keys] of Object.entries(a.tracks)) if (keys.length) out.set(pid, sampleTrack(keys, time));
  return out;
}

export interface KeyInput {
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
  ease?: Ease;
}

export function setKeyframe(m: Model3D, animId: string, partId: string, t: number, v: KeyInput): Model3D {
  const a = findAnimation(m, animId);
  findPart(m, partId);
  const time = Math.round(Math.min(Math.max(t, 0), a.length) * 1000) / 1000;
  const keys = [...(a.tracks[partId] ?? [])];
  const idx = keys.findIndex((k) => Math.abs(k.t - time) < 1e-4);
  const base = idx >= 0 ? keys[idx] : { t: time, ...sampleTrack(keys, time), ease: "linear" as Ease };
  const k: Keyframe = {
    t: time,
    pos: [...(v.pos ?? base.pos)] as Vec3,
    rot: [...(v.rot ?? base.rot)] as Vec3,
    scale: [...(v.scale ?? base.scale)] as Vec3,
    ease: v.ease ?? base.ease,
  };
  if (idx >= 0) keys[idx] = k;
  else keys.push(k);
  keys.sort((x, y) => x.t - y.t);
  return { ...m, animations: m.animations.map((x) => (x.id === animId ? { ...x, tracks: { ...x.tracks, [partId]: keys } } : x)) };
}

export function removeKeyframe(m: Model3D, animId: string, partId: string, t: number): Model3D {
  const a = findAnimation(m, animId);
  const keys = (a.tracks[partId] ?? []).filter((k) => Math.abs(k.t - t) >= 1e-4);
  const tracks = { ...a.tracks };
  if (keys.length) tracks[partId] = keys;
  else delete tracks[partId];
  return { ...m, animations: m.animations.map((x) => (x.id === animId ? { ...x, tracks } : x)) };
}

// ---------- Validación y archivo ----------

export function validateModel(m: Model3D): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const p of m.parts) {
    if (ids.has(p.id)) issues.push(`id repetido: ${p.id}`);
    ids.add(p.id);
  }
  for (const p of m.parts) {
    if (p.parent && !ids.has(p.parent)) issues.push(`«${p.name}» tiene un padre que no existe`);
    let cur = p.parent;
    let steps = 0;
    while (cur && steps++ <= m.parts.length) cur = m.parts.find((x) => x.id === cur)?.parent ?? null;
    if (steps > m.parts.length) issues.push(`«${p.name}» está en un ciclo`);
    if (p.box && p.box.size.some((s) => !(s > 0))) issues.push(`«${p.name}» tiene una caja de tamaño 0`);
    if (p.box && !SHAPES.includes(p.box.shape)) issues.push(`«${p.name}» tiene una forma desconocida`);
  }
  for (const a of m.animations) for (const pid of Object.keys(a.tracks)) if (!ids.has(pid)) issues.push(`la animación «${a.name}» anima una pieza que no existe`);
  return issues;
}

export function serializeModel(m: Model3D): string {
  return JSON.stringify(m);
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const vec = (v: unknown, d: Vec3): Vec3 => (Array.isArray(v) && v.length === 3 ? [num(v[0], d[0]), num(v[1], d[1]), num(v[2], d[2])] : ([...d] as Vec3));
const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : DEFAULT_COLOR);

/** Lee un archivo .ca3d; corrige lo reparable y rechaza lo que no lo es. */
export function parseModel(text: string): Model3D {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un modelo de CoffeeAnimate3D válido.");
  }
  if (!raw || (raw.version !== 1 && raw.version !== 2) || !Array.isArray(raw.parts)) throw new Error("Versión de archivo desconocida o modelo dañado.");
  const parts: Part[] = raw.parts
    .filter((p: any) => p && typeof p.id === "string")
    .map((p: any): Part => {
      let box: Box | null = null;
      if (p.box && typeof p.box === "object") {
        const faces = {} as Record<FaceName, FaceTex>;
        for (const n of FACES) {
          const f = p.box.faces?.[n];
          faces[n] = { color: color(f?.color) };
          if (typeof f?.pixels === "string") faces[n].pixels = f.pixels;
        }
        box = { shape: SHAPES.includes(p.box.shape) ? p.box.shape : "box", from: vec(p.box.from, [0, 0, 0]), size: vec(p.box.size, [1, 1, 1]).map((s) => (s > 0 ? s : 1)) as Vec3, faces };
      }
      return { id: p.id, name: str(p.name, "Pieza"), parent: typeof p.parent === "string" ? p.parent : null, pivot: vec(p.pivot, [0, 0, 0]), rotation: vec(p.rotation, [0, 0, 0]), box, visible: p.visible !== false };
    });
  const ids = new Set(parts.map((p) => p.id));
  for (const p of parts) if (p.parent && (!ids.has(p.parent) || p.parent === p.id)) p.parent = null;
  const animations: Animation[] = (Array.isArray(raw.animations) ? raw.animations : [])
    .filter((a: any) => a && typeof a.id === "string")
    .map((a: any): Animation => {
      const tracks: Record<string, Keyframe[]> = {};
      for (const [pid, keys] of Object.entries(a.tracks ?? {})) {
        if (!ids.has(pid) || !Array.isArray(keys)) continue;
        tracks[pid] = (keys as any[])
          .map((k): Keyframe => ({ t: num(k?.t, 0), pos: vec(k?.pos, [0, 0, 0]), rot: vec(k?.rot, [0, 0, 0]), scale: vec(k?.scale, [1, 1, 1]), ease: EASES.includes(k?.ease) ? k.ease : "linear" }))
          .sort((x, y) => x.t - y.t);
      }
      return { id: a.id, name: str(a.name, "Animación"), length: Math.max(0.05, num(a.length, 1)), loop: a.loop !== false, tracks };
    });
  const out: Model3D = { version: 2, name: str(raw.name, "Modelo"), parts, animations };
  const ref = raw.reference;
  if (ref && typeof ref.positions === "string" && typeof ref.indices === "string") out.reference = { name: str(ref.name, "Referencia"), positions: ref.positions, indices: ref.indices };
  return out;
}

// ---------------------------------------------------------------------------
// Varias piezas: selección, grupos y transformaciones en conjunto
// ---------------------------------------------------------------------------

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

/** Quita de la lista las piezas que cuelgan de otra de la lista (para no moverlas dos veces). */
export function topLevel(m: Model3D, ids: string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id, i) => {
    if (ids.indexOf(id) !== i) return false;
    let p = m.parts.find((x) => x.id === id)?.parent ?? null;
    while (p) {
      if (set.has(p)) return false;
      p = m.parts.find((x) => x.id === p)?.parent ?? null;
    }
    return true;
  });
}

export function sameParent(m: Model3D, ids: string[]): boolean {
  if (!ids.length) return false;
  const parents = new Set(ids.map((id) => findPart(m, id).parent));
  return parents.size === 1;
}

function mapParts(m: Model3D, ids: string[], fn: (p: Part) => Part): Model3D {
  const set = new Set(topLevel(m, ids));
  return { ...m, parts: m.parts.map((p) => (set.has(p.id) ? fn(clone(p)) : p)) };
}

export function translateParts(m: Model3D, ids: string[], delta: Vec3): Model3D {
  return mapParts(m, ids, (p) => ({ ...p, pivot: p.pivot.map((v, i) => r2(v + delta[i])) as Vec3 }));
}

/** Gira las piezas `deg` grados sobre un eje del padre, alrededor de `center`. */
export function rotateParts(m: Model3D, ids: string[], axis: 0 | 1 | 2, deg: number, center: Vec3): Model3D {
  const dir: Vec3 = [0, 0, 0];
  dir[axis] = 1;
  return rotatePartsQuat(m, ids, quatFromAxisAngle(dir, deg), center);
}

/**
 * Gira las piezas con un cuaternión (en el espacio del padre) alrededor de `center`:
 * mueve los pivotes y compone el giro con el que ya tenía cada pieza.
 */
export function rotatePartsQuat(m: Model3D, ids: string[], q: Quat, center: Vec3): Model3D {
  return mapParts(m, ids, (p) => {
    const d = rotateVec(q, p.pivot.map((x, i) => x - center[i]) as Vec3);
    const pivot = d.map((v, i) => r2(center[i] + v)) as Vec3;
    const rotation = eulerFromQuat(quatMul(q, quatFromEuler(p.rotation))).map(r2) as Vec3;
    return { ...p, pivot, rotation };
  });
}

/** Escala cajas y distancias al centro. Ningún lado queda por debajo de 1 unidad. */
export function scaleParts(m: Model3D, ids: string[], factor: Vec3, center: Vec3): Model3D {
  return mapParts(m, ids, (p) => {
    const pivot = p.pivot.map((x, i) => r2(center[i] + (x - center[i]) * Math.max(0, factor[i]))) as Vec3;
    if (!p.box) return { ...p, pivot };
    const size = p.box.size.map((x, i) => Math.max(1, r2(x * factor[i]))) as Vec3;
    const from = p.box.from.map((x, i) => r2(x * (size[i] / p.box!.size[i]))) as Vec3;
    return { ...p, pivot, box: { ...p.box, from, size } };
  });
}

/** Crea un grupo (pieza sin caja) con las piezas; deben tener el mismo padre. */
export function groupParts(m: Model3D, ids: string[], name = "Grupo"): [Model3D, string] {
  const list = topLevel(m, ids);
  if (!list.length) throw new Error("Selecciona al menos una pieza");
  if (!sameParent(m, list)) throw new Error("Solo se pueden agrupar piezas con el mismo padre");
  const parts = list.map((id) => findPart(m, id));
  const center = [0, 1, 2].map((i) => Math.round((parts.reduce((s, p) => s + p.pivot[i], 0) / parts.length) * 2) / 2) as Vec3;
  const [withGroup, gid] = addPart(m, { name, parent: parts[0].parent, pivot: center });
  const set = new Set(list);
  return [
    {
      ...withGroup,
      parts: withGroup.parts.map((p) => (set.has(p.id) ? { ...p, parent: gid, pivot: p.pivot.map((v, i) => r2(v - center[i])) as Vec3 } : p)),
    },
    gid,
  ];
}

/** Deshace un grupo: sus hijos pasan al padre del grupo en el mismo sitio. */
export function ungroup(m: Model3D, groupId: string): Model3D {
  const g = findPart(m, groupId);
  if (g.box) throw new Error("Solo se pueden desagrupar grupos (piezas sin caja)");
  if (g.rotation.some((r) => r !== 0)) throw new Error("Pon a 0 el giro del grupo antes de desagrupar");
  const moved: Model3D = {
    ...m,
    parts: m.parts
      .filter((p) => p.id !== groupId)
      .map((p) => (p.parent === groupId ? { ...p, parent: g.parent, pivot: p.pivot.map((v, i) => r2(v + g.pivot[i])) as Vec3 } : p)),
  };
  return {
    ...moved,
    animations: moved.animations.map((a) => ({ ...a, tracks: Object.fromEntries(Object.entries(a.tracks).filter(([pid]) => pid !== groupId)) })),
  };
}

/**
 * Cambia el tamaño de la caja. `"pivot"`: escala desde el pivote (como el gizmo);
 * `"center"`: mantiene el centro de la caja (botones −/+). Mínimo 1 unidad por lado.
 */
export function resizeBox(m: Model3D, id: string, size: Vec3, anchor: "pivot" | "center"): Model3D {
  const p = findPart(m, id);
  if (!p.box) throw new Error("La pieza no tiene caja");
  const old = p.box;
  const next = size.map((s) => Math.max(1, r2(s))) as Vec3;
  const from = old.from.map((f, i) => (anchor === "pivot" ? r2(f * (next[i] / old.size[i])) : r2(f + (old.size[i] - next[i]) / 2))) as Vec3;
  return { ...m, parts: m.parts.map((x) => (x.id === id ? { ...x, box: { ...old, from, size: next } } : x)) };
}

// ---------------------------------------------------------------------------
// Claves y poses
// ---------------------------------------------------------------------------

const keyTime = (a: Animation, t: number) => Math.round(Math.min(Math.max(t, 0), a.length) * 1000) / 1000;

/** Mueve una clave en el tiempo y/o cambia un valor (vista de curvas). Si cae sobre otra, la sustituye. */
export function moveKeyframe(m: Model3D, animId: string, partId: string, t: number, patch: { t?: number; channel?: { kind: "pos" | "rot" | "scale"; axis: 0 | 1 | 2; value: number } }): Model3D {
  const a = findAnimation(m, animId);
  const keys = (a.tracks[partId] ?? []).map((k) => clone(k));
  const i = keys.findIndex((k) => Math.abs(k.t - t) < 1e-4);
  if (i < 0) throw new Error("No hay ninguna clave en ese instante");
  const k = keys[i];
  if (patch.channel) k[patch.channel.kind][patch.channel.axis] = r2(patch.channel.value);
  if (patch.t !== undefined) k.t = keyTime(a, patch.t);
  const rest = keys.filter((x, j) => j !== i && Math.abs(x.t - k.t) >= 1e-4);
  const next = [...rest, k].sort((x, y) => x.t - y.t);
  return { ...m, animations: m.animations.map((x) => (x.id === animId ? { ...x, tracks: { ...x.tracks, [partId]: next } } : x)) };
}

export type PoseClip = { name: string; pose: Pose }[];

/** Pose de las piezas en un instante (para pegarla en otro). */
export function copyPose(m: Model3D, animId: string, t: number, ids: string[]): PoseClip {
  const pose = samplePose(m, animId, t);
  return ids.map((id) => ({ name: findPart(m, id).name, pose: clone(pose.get(id) ?? { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }) }));
}

/**
 * Pega una pose como claves. Empareja por nombre; `mirrored` la lleva a la pieza del otro
 * lado (izquierda ↔ derecha) reflejada en X. Devuelve cuántas se pegaron y cuáles no tenían pareja.
 */
export function pastePose(m: Model3D, animId: string, t: number, clip: PoseClip, mirrored: boolean, ease: Ease): { model: Model3D; pasted: number; skipped: string[] } {
  const a = findAnimation(m, animId);
  let model = m;
  let pasted = 0;
  const skipped: string[] = [];
  for (const { name, pose } of clip) {
    const target = mirrored ? mirrorName(name) : name;
    const found = m.parts.filter((p) => p.name.toLowerCase() === target.toLowerCase());
    if (found.length !== 1 || (mirrored && target === name)) {
      skipped.push(name);
      continue;
    }
    const pos: Vec3 = mirrored ? [neg(pose.pos[0]), pose.pos[1], pose.pos[2]] : pose.pos;
    const rot: Vec3 = mirrored ? [pose.rot[0], neg(pose.rot[1]), neg(pose.rot[2])] : pose.rot;
    model = setKeyframe(model, a.id, found[0].id, t, { pos, rot, scale: pose.scale, ease });
    pasted++;
  }
  return { model, pasted, skipped };
}

// ---------------------------------------------------------------------------
// Malla de referencia (para calcar)
// ---------------------------------------------------------------------------

export const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function setReference(m: Model3D, name: string, mesh: { positions: number[]; indices: number[] }): Model3D {
  const bytes = mesh.positions.length * 4 + mesh.indices.length * 4;
  if (bytes > MAX_REFERENCE_BYTES) throw new Error("La referencia es demasiado grande (más de 10 MB)");
  const pos = new Uint8Array(new Float32Array(mesh.positions).buffer);
  const idx = new Uint8Array(new Uint32Array(mesh.indices).buffer);
  return { ...m, reference: { name, positions: toB64(pos), indices: toB64(idx) } };
}

export function getReference(m: Model3D): { name: string; mesh: { positions: number[]; indices: number[] } } | null {
  if (!m.reference) return null;
  try {
    const p = fromB64(m.reference.positions);
    const i = fromB64(m.reference.indices);
    return { name: m.reference.name, mesh: { positions: [...new Float32Array(p.buffer, 0, p.length >> 2)], indices: [...new Uint32Array(i.buffer, 0, i.length >> 2)] } };
  } catch {
    return null;
  }
}

export function clearReference(m: Model3D): Model3D {
  const { reference: _gone, ...rest } = m;
  return rest;
}

// ---------------------------------------------------------------------------
// Piezas listas (complemento «Pack de piezas»)
// ---------------------------------------------------------------------------

/** Ids deterministas (p1…, a1…) para que los archivos generados no cambien en cada vuelta. */
export function normalizeIds(m: Model3D): Model3D {
  const pmap = new Map(m.parts.map((p, i) => [p.id, `p${i + 1}`]));
  const amap = new Map(m.animations.map((a, i) => [a.id, `a${i + 1}`]));
  return {
    ...m,
    parts: m.parts.map((p) => ({ ...p, id: pmap.get(p.id)!, parent: p.parent ? pmap.get(p.parent) ?? null : null })),
    animations: m.animations.map((a) => ({ ...a, id: amap.get(a.id)!, tracks: Object.fromEntries(Object.entries(a.tracks).map(([k, v]) => [pmap.get(k)!, v])) })),
  };
}

/** Inserta una pieza (otro modelo) como grupo nuevo en la raíz, con ids nuevos y sin animaciones. */
export function insertPiece(m: Model3D, piece: Model3D, name: string): [Model3D, string] {
  const [withGroup, gid] = addPart(m, { name, pivot: [0, 0, 0] });
  const map = new Map(piece.parts.map((p) => [p.id, newId("p")]));
  const copies = piece.parts.map((p) => ({ ...clone(p), id: map.get(p.id)!, parent: p.parent ? map.get(p.parent) ?? gid : gid }));
  return [{ ...withGroup, parts: [...withGroup.parts, ...copies] }, gid];
}
