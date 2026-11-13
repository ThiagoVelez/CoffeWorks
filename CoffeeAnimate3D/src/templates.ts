// Plantillas de criaturas: cuadrúpedo, bípedo, ave y araña, con animaciones
// de reposo y de andar (y de volar en el ave). Unidades: 16 = 1 bloque.

import { addAnimation, addPart, mirrorPart, newModel, setKeyframe, type BoxInput } from "./model";
import type { Model3D, Vec3 } from "./types";

type Spec = { name: string; parent?: string; pivot?: Vec3; rotation?: Vec3; box?: BoxInput };

function build(name: string, specs: Spec[]): [Model3D, Map<string, string>] {
  let m = newModel(name);
  const ids = new Map<string, string>();
  for (const s of specs) {
    let id: string;
    [m, id] = addPart(m, { name: s.name, parent: s.parent ? ids.get(s.parent)! : null, pivot: s.pivot, rotation: s.rotation, box: s.box });
    ids.set(s.name, id);
  }
  return [m, ids];
}

function mirror(m: Model3D, ids: Map<string, string>, names: string[]): Model3D {
  for (const n of names) {
    let id: string;
    [m, id] = mirrorPart(m, ids.get(n)!);
    const part = m.parts.find((p) => p.id === id)!;
    ids.set(part.name, id);
  }
  return m;
}

/** Oscila el eje `axis` de varias piezas: `amp` grados, `phase` en fracciones de ciclo. */
function swing(m: Model3D, anim: string, length: number, items: { id: string; axis: 0 | 1 | 2; amp: number; phase: number }[]): Model3D {
  const steps = 4;
  for (const it of items) {
    for (let i = 0; i <= steps; i++) {
      const t = (length * i) / steps;
      const v = Math.round(Math.sin(((i / steps + it.phase) % 1) * Math.PI * 2) * it.amp * 100) / 100;
      const rot: Vec3 = [0, 0, 0];
      rot[it.axis] = v;
      m = setKeyframe(m, anim, it.id, t, { rot, ease: "smooth" });
    }
  }
  return m;
}

function bob(m: Model3D, anim: string, length: number, id: string, amount: number): Model3D {
  m = setKeyframe(m, anim, id, 0, { pos: [0, 0, 0], ease: "smooth" });
  m = setKeyframe(m, anim, id, length / 2, { pos: [0, amount, 0], ease: "smooth" });
  return setKeyframe(m, anim, id, length, { pos: [0, 0, 0], ease: "smooth" });
}

export function quadruped(): Model3D {
  const fur = "#7a5233";
  const legC = "#5a3a22";
  let [m, ids] = build("Cuadrúpedo", [
    { name: "cuerpo", pivot: [0, 12, 0], box: { from: [-6, 0, -10], size: [12, 10, 20], color: fur } },
    { name: "cabeza", parent: "cuerpo", pivot: [0, 8, -10], box: { from: [-4, -3, -8], size: [8, 8, 8], color: fur } },
    { name: "hocico", parent: "cabeza", pivot: [0, 0, -8], box: { from: [-2.5, -2, -3], size: [5, 4, 3], color: "#d9b38c" } },
    { name: "cola", parent: "cuerpo", pivot: [0, 8, 10], rotation: [30, 0, 0], box: { from: [-1, -8, 0], size: [2, 8, 2], color: fur } },
    { name: "pata delantera izquierda", parent: "cuerpo", pivot: [4, 0, -7], box: { from: [-2, -12, -2], size: [4, 12, 4], color: legC } },
    { name: "pata trasera izquierda", parent: "cuerpo", pivot: [4, 0, 7], box: { from: [-2, -12, -2], size: [4, 12, 4], color: legC } },
  ]);
  m = mirror(m, ids, ["pata delantera izquierda", "pata trasera izquierda"]);
  let idle: string, walk: string;
  [m, idle] = addAnimation(m, "Reposo", 2);
  m = swing(m, idle, 2, [{ id: ids.get("cabeza")!, axis: 0, amp: 6, phase: 0 }, { id: ids.get("cola")!, axis: 2, amp: 12, phase: 0.25 }]);
  [m, walk] = addAnimation(m, "Andar", 1);
  m = swing(m, walk, 1, [
    { id: ids.get("pata delantera izquierda")!, axis: 0, amp: 28, phase: 0 },
    { id: ids.get("pata trasera derecha")!, axis: 0, amp: 28, phase: 0 },
    { id: ids.get("pata delantera derecha")!, axis: 0, amp: 28, phase: 0.5 },
    { id: ids.get("pata trasera izquierda")!, axis: 0, amp: 28, phase: 0.5 },
    { id: ids.get("cabeza")!, axis: 0, amp: 4, phase: 0.25 },
  ]);
  return m;
}

export function biped(): Model3D {
  const skin = "#c98f62";
  const shirt = "#3c8f45";
  const pants = "#2f4a7a";
  let [m, ids] = build("Bípedo", [
    { name: "torso", pivot: [0, 12, 0], box: { from: [-4, 0, -2], size: [8, 12, 4], color: shirt } },
    { name: "cabeza", parent: "torso", pivot: [0, 12, 0], box: { from: [-4, 0, -4], size: [8, 8, 8], color: skin } },
    { name: "brazo izquierdo", parent: "torso", pivot: [5, 11, 0], box: { from: [-1, -11, -2], size: [4, 12, 4], color: shirt } },
    { name: "pierna izquierda", parent: "torso", pivot: [2, 0, 0], box: { from: [-2, -12, -2], size: [4, 12, 4], color: pants } },
  ]);
  m = mirror(m, ids, ["brazo izquierdo", "pierna izquierda"]);
  let idle: string, walk: string;
  [m, idle] = addAnimation(m, "Reposo", 3);
  m = swing(m, idle, 3, [
    { id: ids.get("brazo izquierdo")!, axis: 2, amp: 3, phase: 0 },
    { id: ids.get("brazo derecho")!, axis: 2, amp: 3, phase: 0.5 },
  ]);
  m = bob(m, idle, 3, ids.get("cabeza")!, 0.3);
  [m, walk] = addAnimation(m, "Andar", 1);
  m = swing(m, walk, 1, [
    { id: ids.get("pierna izquierda")!, axis: 0, amp: 30, phase: 0 },
    { id: ids.get("pierna derecha")!, axis: 0, amp: 30, phase: 0.5 },
    { id: ids.get("brazo izquierdo")!, axis: 0, amp: 25, phase: 0.5 },
    { id: ids.get("brazo derecho")!, axis: 0, amp: 25, phase: 0 },
  ]);
  return m;
}

export function bird(): Model3D {
  const plum = "#d23a3f";
  let [m, ids] = build("Ave", [
    { name: "cuerpo", pivot: [0, 6, 0], box: { from: [-3, 0, -4], size: [6, 6, 8], color: plum } },
    { name: "cabeza", parent: "cuerpo", pivot: [0, 6, -3], box: { from: [-2.5, 0, -3], size: [5, 5, 5], color: plum } },
    { name: "pico", parent: "cabeza", pivot: [0, 2, -3], box: { from: [-1, -1, -3], size: [2, 2, 3], color: "#f2c230" } },
    { name: "cola", parent: "cuerpo", pivot: [0, 3, 4], rotation: [-20, 0, 0], box: { from: [-2, -1, 0], size: [4, 1, 6], color: "#2f6fb3" } },
    { name: "ala izquierda", parent: "cuerpo", pivot: [3, 5, 0], box: { from: [0, -4, -3], size: [1, 5, 7], color: "#2f6fb3" } },
    { name: "pata izquierda", parent: "cuerpo", pivot: [1.5, 0, 0], box: { from: [-0.5, -4, -0.5], size: [1, 4, 1], color: "#e8822f" } },
  ]);
  m = mirror(m, ids, ["ala izquierda", "pata izquierda"]);
  let walk: string, fly: string;
  [m, walk] = addAnimation(m, "Andar", 0.6);
  m = swing(m, walk, 0.6, [
    { id: ids.get("pata izquierda")!, axis: 0, amp: 25, phase: 0 },
    { id: ids.get("pata derecha")!, axis: 0, amp: 25, phase: 0.5 },
    { id: ids.get("cabeza")!, axis: 0, amp: 8, phase: 0.25 },
  ]);
  [m, fly] = addAnimation(m, "Volar", 0.4);
  m = swing(m, fly, 0.4, [
    { id: ids.get("ala izquierda")!, axis: 2, amp: 55, phase: 0 },
    { id: ids.get("ala derecha")!, axis: 2, amp: -55, phase: 0 },
  ]);
  return m;
}

export function spider(): Model3D {
  const body = "#2b2724";
  let [m, ids] = build("Araña", [
    { name: "tórax", pivot: [0, 6, 0], box: { from: [-4, -2, -4], size: [8, 5, 8], color: body } },
    { name: "abdomen", parent: "tórax", pivot: [0, 1, 4], box: { from: [-5, -3, 0], size: [10, 8, 11], color: "#3a3330" } },
    { name: "cabeza", parent: "tórax", pivot: [0, 0, -4], box: { from: [-3, -2, -5], size: [6, 5, 5], color: body } },
    ...[0, 1, 2, 3].map((i) => ({
      name: `pata ${i + 1} izquierda`,
      parent: "tórax",
      pivot: [4, 0, -3 + i * 2] as Vec3,
      rotation: [0, -35 + i * 23, -25] as Vec3,
      box: { from: [0, -1, -1] as Vec3, size: [14, 2, 2] as Vec3, color: body },
    })),
  ]);
  m = mirror(m, ids, [0, 1, 2, 3].map((i) => `pata ${i + 1} izquierda`));
  let walk: string;
  [m, walk] = addAnimation(m, "Andar", 0.8);
  const legs = [0, 1, 2, 3].flatMap((i) => [
    { id: ids.get(`pata ${i + 1} izquierda`)!, axis: 1 as const, amp: 14, phase: i % 2 ? 0.5 : 0 },
    { id: ids.get(`pata ${i + 1} derecha`)!, axis: 1 as const, amp: 14, phase: i % 2 ? 0 : 0.5 },
  ]);
  m = swing(m, walk, 0.8, legs);
  return m;
}

export const TEMPLATES: Record<string, () => Model3D> = {
  cuadrúpedo: quadruped,
  bípedo: biped,
  ave: bird,
  araña: spider,
};
