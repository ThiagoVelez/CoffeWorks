import { test } from "node:test";
import assert from "node:assert/strict";
import { simplificar, trazoTocado } from "./trazos";
import type { Trazo } from "../board/model";

test("simplificar reduce puntos colineales", () => {
  const pts = [0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 4, 4];
  assert.deepEqual(simplificar(pts, 0.5), [0, 0, 4, 0, 4, 4]);
});

test("simplificar deja trazos cortos igual", () => {
  assert.deepEqual(simplificar([1, 2], 1), [1, 2]);
  assert.deepEqual(simplificar([1, 2, 3, 4], 1), [1, 2, 3, 4]);
});

const t: Trazo = { id: "t", kind: "trazo", x: 100, y: 100, w: 100, h: 0, z: 1, autor: "a", puntos: [0, 0, 100, 0], grosor: 4, color: "#000", marcador: false };

test("borrador toca un trazo cercano y no uno lejano", () => {
  assert.equal(trazoTocado(t, { x: 150, y: 105 }, 6), true);
  assert.equal(trazoTocado(t, { x: 150, y: 140 }, 6), false);
});
