import { test } from "node:test";
import assert from "node:assert/strict";
import { dominantRun, fontPx } from "./pptxText";

// Diapositiva normal de PowerPoint: 10 pulgadas = 9144000 EMU = 720 pt; el lienzo de CoffeeView mide 960 px.
test("en una diapositiva de 10 pulgadas, 18 pt son 24 px", () => {
  assert.equal(fontPx(1800, 9144000, 960), 24);
});

test("en un póster de 20 pulgadas (iLovePDF), la letra se reduce a la mitad", () => {
  // 1440 × 810 pt (20 × 11,25 pulgadas): 18 pt ocupan la misma proporción que 9 pt en 10 pulgadas.
  assert.equal(fontPx(1800, 18288000, 960), 12);
});

test("el ajuste automático (fontScale) reduce la letra", () => {
  assert.equal(fontPx(4000, 9144000, 960, 62500), 33);
});

test("sin ancho de diapositiva válido se usa el de 10 pulgadas", () => {
  assert.equal(fontPx(1800, 0, 960), 24);
});

test("dominantRun elige el fragmento con más texto, no el primero", () => {
  const r = dominantRun([
    { text: "Título", sz: 4000, b: true },
    { text: "Un párrafo bastante más largo que el título de arriba", sz: 1800 },
  ]);
  assert.equal(r?.sz, 1800);
  assert.equal(r?.b, undefined);
  assert.equal(dominantRun([]), null);
});
