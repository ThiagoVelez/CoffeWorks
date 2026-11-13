import { test } from "node:test";
import assert from "node:assert/strict";
import { SNAP_OPTIONS, formatDistance, gridAnchor, loadSnap, parseNumber, snapValue, snapVec } from "./snap";
import { addPart, findPart, newModel, resizeBox } from "./model";

test("snapValue", () => {
  assert.equal(snapValue(7.3, 8), 8);
  assert.equal(snapValue(7.3, 0.5), 7.5);
  assert.equal(snapValue(7.3, 0), 7.3);
  assert.deepEqual(snapVec([1.2, 15, -7.9], 16), [0, 16, 0]);
});

test("opciones de ajuste del spec", () => {
  assert.deepEqual(SNAP_OPTIONS.map((o) => o.step), [0, 0.5, 1, 8, 16]);
  assert.deepEqual(SNAP_OPTIONS.map((o) => o.label), ["Libre", "1 px", "1 u", "½ bloque", "1 bloque"]);
});

test("loadSnap sin localStorage devuelve el valor por defecto", () => {
  assert.deepEqual(loadSnap(), { step: 1, rotate: true });
});

test("resizeBox desde el pivote y desde el centro", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", box: { from: [-2, 0, -2], size: [4, 8, 4] } });
  assert.deepEqual(findPart(resizeBox(m, a, [8, 8, 4], "pivot"), a).box!.from, [-4, 0, -2]);
  assert.deepEqual(findPart(resizeBox(m, a, [4, 16, 4], "center"), a).box!.from, [-2, -4, -2]);
  assert.deepEqual(findPart(resizeBox(m, a, [0, -3, 4], "center"), a).box!.size, [1, 1, 4]);
});

test("formatDistance en bloques y unidades con coma decimal", () => {
  assert.equal(formatDistance(40), "2,5 bloques (40 u)");
  assert.equal(formatDistance(16), "1 bloque (16 u)");
  assert.equal(formatDistance(7.25), "0,45 bloques (7,25 u)");
});

test("gridAnchor: el gizmo de varias piezas empieza en la cuadrícula", () => {
  assert.deepEqual(gridAnchor([[0, 0, 0], [3, 0, 0]], 1), [2, 0, 0]);
  assert.deepEqual(gridAnchor([[0, 0, 0], [3, 0, 0]], 16), [0, 0, 0]);
  assert.deepEqual(gridAnchor([[0, 0, 0], [3, 0, 0]], 0), [1.5, 0, 0]);
});

test("parseNumber: vacío no es 0", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("  "), null);
  assert.equal(parseNumber("2,5"), 2.5);
  assert.equal(parseNumber("abc"), null);
});
