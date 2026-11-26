import { test } from "node:test";
import assert from "node:assert/strict";
import { cajaDe, elementosEnRect, redimensionar } from "./seleccion";
import type { Elemento } from "../board/model";

const n = (id: string, x: number, y: number, w = 100, h = 100): Elemento => ({ id, kind: "nota", x, y, w, h, z: 1, autor: "a", color: "amarillo", texto: "" });

test("elementosEnRect solo los contenidos", () => {
  const els = [n("a", 0, 0), n("b", 150, 0), n("c", 500, 500)];
  assert.deepEqual(elementosEnRect(els, { x: -10, y: -10, w: 300, h: 200 }), ["a", "b"]);
  assert.deepEqual(elementosEnRect(els, { x: 290, y: 190, w: -300, h: -200 }), ["a", "b"]);
  assert.deepEqual(elementosEnRect(els, { x: 50, y: 50, w: 10, h: 10 }), []);
});

test("cajaDe une las cajas", () => {
  assert.deepEqual(cajaDe([n("a", 0, 0), n("b", 150, 20)], ["a", "b"]), { x: 0, y: 0, w: 250, h: 120 });
  assert.equal(cajaDe([n("a", 0, 0)], []), null);
});

test("redimensionar desde la esquina sureste", () => {
  assert.deepEqual(redimensionar(n("a", 0, 0), "se", { dx: 50, dy: 20 }, false), { x: 0, y: 0, w: 150, h: 120 });
});

test("redimensionar desde el noroeste mueve el origen", () => {
  assert.deepEqual(redimensionar(n("a", 0, 0), "no", { dx: 10, dy: 30 }, false), { x: 10, y: 30, w: 90, h: 70 });
});

test("redimensionar con Shift mantiene proporción", () => {
  const r = redimensionar(n("a", 0, 0, 200, 100), "se", { dx: 100, dy: 0 }, true);
  assert.equal(r.w / r.h, 2);
  assert.equal(r.w, 300);
});

test("redimensionar no baja de 20 px", () => {
  const r = redimensionar(n("a", 0, 0), "se", { dx: -500, dy: -500 }, false);
  assert.deepEqual([r.w, r.h], [20, 20]);
});
