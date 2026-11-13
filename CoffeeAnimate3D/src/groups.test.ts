import { test } from "node:test";
import assert from "node:assert/strict";
import { addPart, addAnimation, findPart, groupParts, newModel, rotateParts, scaleParts, setKeyframe, topLevel, translateParts, ungroup, updatePart, sameParent } from "./model";

test("topLevel quita descendientes", () => {
  let m = newModel(); let a: string, b: string, c: string;
  [m, a] = addPart(m, { name: "A" });
  [m, b] = addPart(m, { name: "B", parent: a });
  [m, c] = addPart(m, { name: "C" });
  assert.deepEqual(topLevel(m, [b, a, c]), [a, c]);
  assert.equal(sameParent(m, [a, c]), true);
  assert.equal(sameParent(m, [b, c]), false);
});

test("groupParts conserva la posición en el mundo", () => {
  let m = newModel(); let a: string, b: string, g: string;
  [m, a] = addPart(m, { name: "A", pivot: [0, 0, 0] });
  [m, b] = addPart(m, { name: "B", pivot: [8, 4, 0] });
  [m, g] = groupParts(m, [a, b]);
  assert.deepEqual(findPart(m, g).pivot, [4, 2, 0]);
  assert.equal(findPart(m, g).box, null);
  assert.equal(findPart(m, g).name, "Grupo");
  assert.deepEqual(findPart(m, a).pivot, [-4, -2, 0]);
  assert.equal(findPart(m, b).parent, g);
});

test("groupParts rechaza padres distintos sin cambiar nada", () => {
  let m = newModel(); let a: string, b: string, c: string;
  [m, a] = addPart(m, { name: "A" });
  [m, b] = addPart(m, { name: "B", parent: a });
  [m, c] = addPart(m, { name: "C" });
  assert.throws(() => groupParts(m, [b, c]), /mismo padre/);
});

test("ungroup devuelve los hijos y rechaza grupos girados", () => {
  let m = newModel(); let a: string, g: string;
  [m, a] = addPart(m, { name: "A", pivot: [2, 0, 0], box: { from: [0, 0, 0], size: [2, 2, 2] } });
  [m, g] = groupParts(m, [a]);
  const back = ungroup(m, g);
  assert.deepEqual(findPart(back, a).pivot, [2, 0, 0]);
  assert.equal(findPart(back, a).parent, null);
  assert.equal(back.parts.length, 1);
  const turned = updatePart(m, g, { rotation: [0, 30, 0] });
  assert.throws(() => ungroup(turned, g), /giro del grupo/);
  assert.throws(() => ungroup(m, a), /Solo se pueden desagrupar grupos/);
});

test("ungroup borra las pistas del grupo", () => {
  let m = newModel(); let a: string, g: string, an: string;
  [m, a] = addPart(m, { name: "A" });
  [m, g] = groupParts(m, [a]);
  [m, an] = addAnimation(m, "X", 1);
  m = setKeyframe(m, an, g, 0, { rot: [0, 10, 0] });
  const back = ungroup(m, g);
  assert.equal(back.animations[0].tracks[g], undefined);
});

test("scaleParts nunca deja tamaños menores que 1", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", box: { from: [0, 0, 0], size: [4, 4, 4] } });
  const s = scaleParts(m, [a], [0, -2, 0.5], [0, 0, 0]);
  assert.deepEqual(findPart(s, a).box!.size, [1, 1, 2]);
});

test("scaleParts escala la distancia de los pivotes al centro", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", pivot: [4, 0, 0], box: { from: [0, 0, 0], size: [2, 2, 2] } });
  const s = scaleParts(m, [a], [2, 2, 2], [0, 0, 0]);
  assert.deepEqual(findPart(s, a).pivot, [8, 0, 0]);
  assert.deepEqual(findPart(s, a).box!.size, [4, 4, 4]);
});

test("translateParts mueve una vez padre e hijo seleccionados", () => {
  let m = newModel(); let a: string, b: string;
  [m, a] = addPart(m, { name: "A" });
  [m, b] = addPart(m, { name: "B", parent: a, pivot: [1, 0, 0] });
  const t = translateParts(m, [a, b], [0, 4, 0]);
  assert.deepEqual(findPart(t, a).pivot, [0, 4, 0]);
  assert.deepEqual(findPart(t, b).pivot, [1, 0, 0]);
});

test("rotateParts gira pivotes alrededor del centro", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", pivot: [4, 0, 0] });
  const r = rotateParts(m, [a], 1, 90, [0, 0, 0]);
  assert.deepEqual(findPart(r, a).pivot.map((v) => Math.round(v * 100) / 100 + 0), [0, 0, -4]);
  assert.equal(findPart(r, a).rotation[1], 90);
});
