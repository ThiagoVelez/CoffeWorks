import { test } from "node:test";
import assert from "node:assert/strict";
import { armarLatex, posprocesar } from "./tokens";

test("posprocesar quita los espacios como pix2tex", () => {
  assert.equal(posprocesar("h = { \\frac { 1 } { 2 } } g t ^ { 2 }").texto, "h={\\frac{1}{2}}g t^{2}");
  assert.equal(posprocesar("F = m a").texto, "F=m a"); // como pix2tex: entre letras queda el espacio
  // Entre dos letras se conserva (separa un comando de la letra siguiente)
  assert.equal(posprocesar("\\alpha b").texto, "\\alpha b");
  // Dentro de \mathrm { … } se quitan todos
  assert.equal(posprocesar("\\mathrm { m / s }").texto, "\\mathrm{m/s}");
  // Un espacio explícito «\ » se conserva
  assert.equal(posprocesar("a \\ b").texto, "a\\ b");
});

test("el mapa de posiciones apunta al texto final", () => {
  const r = posprocesar("F = m a");
  assert.equal(r.mapa[0], 0); // F
  assert.equal(r.mapa[1], -1); // espacio quitado
  assert.equal(r.mapa[6], 4); // a
});

test("armarLatex une las piezas y ubica las dudas", () => {
  const piezas = [
    { texto: "F", prob: 0.99, alternativas: [] },
    { texto: "Ġ=", prob: 0.98, alternativas: [] },
    { texto: "Ġm", prob: 0.97, alternativas: [] },
    { texto: "Ġa", prob: 0.31, alternativas: [{ texto: "Ġ\\alpha", prob: 0.3 }, { texto: "Ġo", prob: 0.2 }] },
  ];
  const r = armarLatex(piezas, 0.5);
  assert.equal(r.latex, "F=m a");
  assert.equal(r.dudas.length, 1);
  const d = r.dudas[0];
  assert.equal(r.latex.slice(d.ini, d.fin), "a");
  assert.deepEqual(d.alternativas, ["\\alpha", "o"]);
  assert.ok(d.prob < 0.5);
});

test("una duda en el nombre de un comando abarca la barra y las alternativas la llevan", () => {
  const piezas = [
    { texto: "\\", prob: 0.99, alternativas: [] },
    { texto: "alpha", prob: 0.3, alternativas: [{ texto: "mathbf", prob: 0.2 }, { texto: "nabla", prob: 0.1 }] },
    { texto: "Ġ+", prob: 0.9, alternativas: [] },
  ];
  const r = armarLatex(piezas, 0.5);
  assert.equal(r.latex, "\\alpha+");
  assert.equal(r.latex.slice(r.dudas[0].ini, r.dudas[0].fin), "\\alpha");
  assert.deepEqual(r.dudas[0].alternativas, ["\\mathbf", "\\nabla"]);
});

test("sin piezas da texto vacío", () => {
  assert.deepEqual(armarLatex([], 0.5), { latex: "", dudas: [] });
});
