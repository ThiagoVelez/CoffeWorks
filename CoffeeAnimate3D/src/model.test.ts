import { test } from "node:test";
import assert from "node:assert/strict";
import { addPart, duplicatePart, fillFace, getPixel, mirrorPart, newModel, paintPixel, parseModel, removePart, removeKeyframe, samplePose, serializeModel, setKeyframe, updatePart, validateModel, addAnimation } from "./model";
import { TEMPLATES } from "./templates";

test("piezas en jerarquía y borrado en cascada con sus pistas", () => {
  let m = newModel("Prueba");
  let body: string, leg: string, foot: string;
  [m, body] = addPart(m, { name: "cuerpo", box: { from: [-4, 0, -6], size: [8, 6, 12] } });
  [m, leg] = addPart(m, { name: "pata", parent: body, pivot: [2, 0, 4], box: { from: [-1, -6, -1], size: [2, 6, 2] } });
  [m, foot] = addPart(m, { name: "pezuña", parent: leg, box: { from: [-1, -7, -1], size: [2, 1, 2] } });
  let anim: string;
  [m, anim] = addAnimation(m, "Andar", 1);
  m = setKeyframe(m, anim, foot, 0.5, { rot: [10, 0, 0] });
  m = removePart(m, leg);
  assert.deepEqual(m.parts.map((p) => p.name), ["cuerpo"]);
  assert.equal(m.animations[0].tracks[foot], undefined);
  assert.deepEqual(validateModel(m), []);
});

test("espejo: lado contrario, nombre izquierda/derecha y pivote reflejado", () => {
  let m = newModel("Espejo");
  let arm: string;
  [m, arm] = addPart(m, { name: "brazo izquierdo", pivot: [5, 20, 0], rotation: [0, 0, 10], box: { from: [0, -10, -2], size: [3, 10, 4] } });
  m = paintPixel(m, arm, "px", 1, 2, "#ff0000");
  let copy: string;
  [m, copy] = mirrorPart(m, arm);
  const c = m.parts.find((p) => p.id === copy)!;
  assert.equal(c.name, "brazo derecho");
  assert.deepEqual(c.pivot, [-5, 20, 0]);
  assert.deepEqual(c.rotation, [0, 0, -10]);
  assert.deepEqual(c.box!.from, [-3, -10, -2]);
  // La cara +X del original pasa a ser la −X de la copia.
  assert.equal(getPixel(m, copy, "nx", 1, 2), "#ff0000");
});

test("pintar píxeles y rellenar caras", () => {
  let m = newModel("Pintura");
  let p: string;
  [m, p] = addPart(m, { name: "cubo", box: { from: [0, 0, 0], size: [4, 4, 4] } });
  assert.equal(getPixel(m, p, "py", 0, 0), m.parts[0].box!.faces.py.color);
  m = paintPixel(m, p, "py", 31, 31, "#123456");
  assert.equal(getPixel(m, p, "py", 31, 31), "#123456");
  assert.equal(getPixel(m, p, "py", 0, 31), m.parts[0].box!.faces.py.color);
  m = fillFace(m, p, "py", "#abcdef");
  assert.equal(getPixel(m, p, "py", 31, 31), "#abcdef");
  assert.equal(m.parts[0].box!.faces.py.pixels, undefined);
  assert.throws(() => paintPixel(m, p, "py", 32, 0, "#000000"));
});

test("fotogramas clave: orden, reemplazo, interpolación y bucle", () => {
  let m = newModel("Anim");
  let p: string, a: string;
  [m, p] = addPart(m, { name: "cabeza", box: { from: [0, 0, 0], size: [4, 4, 4] } });
  [m, a] = addAnimation(m, "Mirar", 2);
  m = setKeyframe(m, a, p, 1, { rot: [0, 90, 0] });
  m = setKeyframe(m, a, p, 0, { rot: [0, 0, 0] });
  m = setKeyframe(m, a, p, 2, { rot: [0, 0, 0] });
  assert.deepEqual(m.animations[0].tracks[p].map((k) => k.t), [0, 1, 2]);
  m = setKeyframe(m, a, p, 1, { rot: [0, 80, 0] });
  assert.equal(m.animations[0].tracks[p].length, 3);
  const mid = samplePose(m, a, 0.5).get(p)!;
  assert.ok(Math.abs(mid.rot[1] - 40) < 1e-6, `lineal ${mid.rot[1]}`);
  m = setKeyframe(m, a, p, 0, { rot: [0, 0, 0], ease: "step" });
  assert.equal(samplePose(m, a, 0.5).get(p)!.rot[1], 0, "escalón");
  // Bucle: 2,5 s en una animación de 2 s equivale a 0,5 s.
  assert.deepEqual(samplePose(m, a, 2.5).get(p)!.rot, samplePose(m, a, 0.5).get(p)!.rot);
  m = removeKeyframe(m, a, p, 1);
  assert.equal(m.animations[0].tracks[p].length, 2);
  // Sin pista: pose neutra.
  assert.deepEqual(samplePose(m, a, 1).get("no-existe"), undefined);
});

test("guardar y abrir, y archivos dañados", () => {
  let m = newModel("Guardar");
  let p: string;
  [m, p] = addPart(m, { name: "x", box: { from: [0, 0, 0], size: [1, 2, 3] } });
  m = paintPixel(m, p, "nz", 5, 5, "#00ff00");
  const back = parseModel(serializeModel(m));
  assert.deepEqual(back, m);
  assert.throws(() => parseModel("{no es json"));
  assert.throws(() => parseModel(JSON.stringify({ version: 99, parts: [] })));
  // Un padre que no existe se corrige a la raíz.
  const broken = JSON.parse(serializeModel(m));
  broken.parts[0].parent = "fantasma";
  assert.equal(parseModel(JSON.stringify(broken)).parts[0].parent, null);
});

test("duplicar copia la rama con ids nuevos y actualizar valida", () => {
  let m = newModel("Dup");
  let a: string, b: string;
  [m, a] = addPart(m, { name: "a", box: { from: [0, 0, 0], size: [2, 2, 2] } });
  [m, b] = addPart(m, { name: "b", parent: a, box: { from: [0, 0, 0], size: [1, 1, 1] } });
  let c: string;
  [m, c] = duplicatePart(m, a);
  assert.equal(m.parts.length, 4);
  assert.notEqual(c, a);
  assert.ok(m.parts.some((p) => p.parent === c && p.name === "b"));
  m = updatePart(m, b, { name: "bb", box: { from: [0, 0, 0], size: [3, 3, 3] } });
  assert.deepEqual(m.parts.find((p) => p.id === b)!.box!.size, [3, 3, 3]);
  assert.throws(() => updatePart(m, a, { parent: b }), /ciclo/);
});

test("plantillas válidas con animaciones", () => {
  assert.deepEqual(Object.keys(TEMPLATES).sort(), ["ave", "araña", "bípedo", "cuadrúpedo"].sort());
  for (const [name, make] of Object.entries(TEMPLATES)) {
    const m = make();
    assert.deepEqual(validateModel(m), [], name);
    assert.ok(m.parts.length >= 6, name);
    assert.ok(m.animations.some((a) => a.name === "Andar"), `${name} anda`);
    // La animación de andar mueve alguna pieza a mitad de ciclo.
    const walk = m.animations.find((a) => a.name === "Andar")!;
    const moved = [...samplePose(m, walk.id, walk.length / 4).values()].some((p) => p.rot.some((r) => Math.abs(r) > 1));
    assert.ok(moved, `${name} se mueve`);
  }
});

test("las plantillas miran hacia +Z (delante), como glTF", () => {
  const FRONT: Record<string, string> = { cuadrúpedo: "hocico", bípedo: "nariz", ave: "pico", araña: "cabeza" };
  for (const [name, make] of Object.entries(TEMPLATES)) {
    const m = make();
    // z aproximada en el mundo: pivotes encadenados + centro de la caja.
    const z = (id: string): number => {
      const p = m.parts.find((x) => x.id === id)!;
      return p.pivot[2] + (p.parent ? z(p.parent) : 0);
    };
    const center = (n: string) => {
      const p = m.parts.find((x) => x.name === n)!;
      return z(p.id) + (p.box ? p.box.from[2] + p.box.size[2] / 2 : 0);
    };
    const front = center(FRONT[name]);
    const others = m.parts.filter((p) => p.box && p.name !== FRONT[name]).map((p) => center(p.name));
    assert.ok(front > 0, `${name}: ${FRONT[name]} delante (+Z), z = ${front}`);
    assert.ok(front >= Math.max(...others) - 0.01, `${name}: ${FRONT[name]} es lo más adelantado`);
  }
});
