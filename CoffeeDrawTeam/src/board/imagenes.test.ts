import { test } from "node:test";
import assert from "node:assert/strict";
import { planReduccion } from "./imagenes";

test("planReduccion escala imágenes grandes", () => {
  assert.deepEqual(planReduccion(4000, 3000, 2_000_000), { w: 2048, h: 1536, recodificar: true });
  assert.deepEqual(planReduccion(3000, 4000, 100_000), { w: 1536, h: 2048, recodificar: true });
});

test("planReduccion deja igual las pequeñas", () => {
  assert.deepEqual(planReduccion(800, 600, 200_000), { w: 800, h: 600, recodificar: false });
});

test("planReduccion recodifica las pesadas", () => {
  assert.deepEqual(planReduccion(800, 600, 3_000_000), { w: 800, h: 600, recodificar: true });
});
