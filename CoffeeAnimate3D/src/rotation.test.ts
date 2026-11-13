import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEuler, quatFromAxisAngle } from "./rotation";
import { addPart, findPart, newModel, rotateParts, rotatePartsQuat } from "./model";

const near = (a: number[], b: number[], eps = 0.01) => assert.ok(a.every((v, i) => Math.abs(v - b[i]) < eps), `${a.map((v) => v.toFixed(3))} ≠ ${b}`);

test("rotateParts compone el giro con el que ya tenía la pieza", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", rotation: [30, 0, 0] });
  const r = rotateParts(m, [a], 2, 90, [0, 0, 0]);
  // Eje Y local tras girar 30° en X y luego 90° en Z (del padre): (−0,866, 0, 0,5)
  near(applyEuler(findPart(r, a).rotation, [0, 1, 0]), [-0.866, 0, 0.5]);
});

test("rotatePartsQuat: 120° en Y (más de 90°) gira pivote y orientación bien", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", pivot: [4, 0, 0] });
  const r = rotatePartsQuat(m, [a], quatFromAxisAngle([0, 1, 0], 120), [0, 0, 0]);
  near(findPart(r, a).pivot, [-2, 0, -3.464]);
  near(applyEuler(findPart(r, a).rotation, [1, 0, 0]), [-0.5, 0, -0.866]);
});
