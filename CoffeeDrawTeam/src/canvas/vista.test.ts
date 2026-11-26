import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustarTodo, aPantalla, aTablero, zoomEn, ZOOM_MAX, ZOOM_MIN } from "./vista";

test("aTablero deshace aPantalla", () => {
  const c = { x: -120, y: 40, zoom: 1.7 };
  const p = { x: 33, y: -8 };
  const r = aTablero(c, aPantalla(c, p));
  assert.ok(Math.abs(r.x - p.x) < 1e-9 && Math.abs(r.y - p.y) < 1e-9);
});

test("zoomEn mantiene fijo el punto bajo el ratón", () => {
  const c = { x: 10, y: 20, zoom: 1 };
  const raton = { x: 400, y: 300 };
  const antes = aTablero(c, raton);
  const despues = aTablero(zoomEn(c, 1.5, raton), raton);
  assert.ok(Math.abs(antes.x - despues.x) < 1e-9 && Math.abs(antes.y - despues.y) < 1e-9);
});

test("el zoom queda entre 10 % y 400 %", () => {
  assert.equal(ZOOM_MIN, 0.1);
  assert.equal(ZOOM_MAX, 4);
  assert.equal(zoomEn({ x: 0, y: 0, zoom: 0.12 }, 0.5, { x: 0, y: 0 }).zoom, 0.1);
  assert.equal(zoomEn({ x: 0, y: 0, zoom: 3 }, 2, { x: 0, y: 0 }).zoom, 4);
});

test("ajustarTodo encuadra todas las cajas con margen", () => {
  const cajas = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 900, y: 400, w: 100, h: 100 }];
  const c = ajustarTodo(cajas, 1200, 800);
  for (const k of cajas) {
    const a = aPantalla(c, { x: k.x, y: k.y });
    const b = aPantalla(c, { x: k.x + k.w, y: k.y + k.h });
    assert.ok(a.x >= 40 && a.y >= 40 && b.x <= 1160 && b.y <= 760, JSON.stringify({ a, b }));
  }
});

test("ajustarTodo sin cajas centra el origen", () => {
  const c = ajustarTodo([], 1000, 600);
  const o = aPantalla(c, { x: 0, y: 0 });
  assert.deepEqual([o.x, o.y, c.zoom], [500, 300, 1]);
});
