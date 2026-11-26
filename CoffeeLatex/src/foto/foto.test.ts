import { test } from "node:test";
import assert from "node:assert/strict";
import { gris } from "./imagen";
import { segmentarRenglones } from "./segmentar";
import { ajustarDudas, ensamblar, pareceFormula, revisarFormula, sugerencias, textoDeTsv } from "./corrector";

/** Hoja blanca con rectángulos negros (como renglones escritos). */
function hoja(renglones: [number, number, number, number][], ancho = 400, alto = 300) {
  const g = gris(ancho, alto);
  for (const [x, y, w, h] of renglones) for (let f = y; f < y + h; f++) for (let c = x; c < x + w; c++) g.datos[f * ancho + c] = 20;
  return g;
}

test("segmentar encuentra cada renglón con su caja", () => {
  const r = segmentarRenglones(hoja([[40, 30, 300, 20], [60, 110, 200, 30], [40, 200, 250, 18]]));
  assert.equal(r.length, 3);
  assert.ok(Math.abs(r[1].y - 110) <= 8 && Math.abs(r[1].alto - 30) <= 16, JSON.stringify(r[1]));
  assert.ok(r[1].x <= 60 && r[1].x + r[1].ancho >= 260, JSON.stringify(r[1]));
});

test("segmentar une los trazos de un mismo renglón (exponentes, fracciones)", () => {
  // Una fracción: numerador, raya y denominador muy juntos
  const r = segmentarRenglones(hoja([[100, 50, 40, 15], [90, 68, 60, 3], [100, 74, 40, 15]]));
  assert.equal(r.length, 1);
});

test("segmentar ignora manchas pequeñas y una hoja vacía", () => {
  assert.equal(segmentarRenglones(hoja([[10, 10, 2, 2]])).length, 0);
  assert.equal(segmentarRenglones(gris(200, 100)).length, 0);
});

test("segmentar con iluminación desigual (sombra de la foto)", () => {
  const g = hoja([[40, 40, 300, 20], [40, 150, 300, 20]]);
  for (let y = 0; y < g.alto; y++) for (let x = 0; x < g.ancho; x++) if (g.datos[y * g.ancho + x] > 100) g.datos[y * g.ancho + x] = 255 - Math.round(x * 0.35);
  assert.equal(segmentarRenglones(g).length, 2);
});

test("sugerencias de física y matemáticas para confusiones típicas", () => {
  assert.ok(sugerencias("a", []).includes("\\alpha"));
  assert.ok(sugerencias("v", []).includes("\\nu"));
  assert.ok(sugerencias("x", []).includes("\\times"));
  assert.ok(sugerencias("1", []).includes("l"));
  assert.ok(sugerencias("w", []).includes("\\omega"));
  // Las del modelo van primero y sin repetir
  const s = sugerencias("a", ["\\alpha", "o"]);
  assert.deepEqual(s.slice(0, 2), ["\\alpha", "o"]);
  assert.equal(s.filter((x) => x === "\\alpha").length, 1);
});

test("revisarFormula avisa llaves sin cerrar y comandos desconocidos", () => {
  const a = revisarFormula("\\frac{1}{2");
  assert.ok(a.some((x) => /llave/i.test(x.mensaje)));
  const b = revisarFormula("\\fracc{1}{2}");
  assert.ok(b.some((x) => /desconocido/i.test(x.mensaje)));
  assert.deepEqual(revisarFormula("\\frac{1}{2}gt^{2}"), []);
  assert.ok(revisarFormula("(a+b").some((x) => /paréntesis/i.test(x.mensaje)));
});

test("textoDeTsv arma el renglón y marca las palabras dudosas", () => {
  const tsv = [
    "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
    "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t95.1\tLa",
    "5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t41.0\tvelocidad",
    "5\t1\t1\t1\t1\t3\t0\t0\t10\t10\t88.0\tes",
    "4\t1\t1\t1\t1\t0\t0\t0\t10\t10\t-1\t",
  ].join("\n");
  const r = textoDeTsv(tsv);
  assert.equal(r.texto, "La velocidad es");
  assert.equal(r.dudas.length, 1);
  assert.equal(r.texto.slice(r.dudas[0].ini, r.dudas[0].fin), "velocidad");
  assert.ok(r.confianza > 0.6 && r.confianza < 0.8);
});

test("pareceFormula distingue texto de fórmulas", () => {
  assert.equal(pareceFormula("La velocidad es constante", 0.9), false);
  assert.equal(pareceFormula("F = m a", 0.9), true);
  assert.equal(pareceFormula("v^2 = v0^2 + 2ad", 0.8), true);
  assert.equal(pareceFormula("garabato", 0.2), true); // ilegible como texto: se prueba como fórmula
});

test("ensamblar une texto y fórmulas y desplaza las dudas", () => {
  const r = ensamblar(
    [
      { tipo: "texto", texto: "Segunda ley", dudas: [{ ini: 8, fin: 11, prob: 0.3, alternativas: [] }] },
      { tipo: "formula", texto: "F=m a", dudas: [{ ini: 4, fin: 5, prob: 0.4, alternativas: ["\\alpha"] }] },
    ],
    "latex",
  );
  assert.equal(r.texto, "Segunda ley\n\\[\n  F=m a\n\\]\n");
  assert.equal(r.texto.slice(r.dudas[0].ini, r.dudas[0].fin), "ley");
  assert.equal(r.texto.slice(r.dudas[1].ini, r.dudas[1].fin), "a");
  assert.equal(ensamblar([{ tipo: "formula", texto: "x", dudas: [] }], "markdown").texto, "$$\nx\n$$\n");
});

test("ajustarDudas sigue a las dudas al editar y quita las tocadas", () => {
  const dudas = [{ ini: 0, fin: 1, prob: 0.3, alternativas: [] }, { ini: 6, fin: 7, prob: 0.3, alternativas: [] }];
  // Se inserta texto al principio: las dos se corren
  let r = ajustarDudas("F = m a", "XX F = m a", dudas);
  assert.deepEqual(r.map((d) => [d.ini, d.fin]), [[3, 4], [9, 10]]);
  // Se corrige la primera: desaparece, la otra se mantiene
  r = ajustarDudas("F = m a", "G = m a", dudas);
  assert.deepEqual(r.map((d) => [d.ini, d.fin]), [[6, 7]]);
});
