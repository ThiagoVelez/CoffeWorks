import { test } from "node:test";
import assert from "node:assert/strict";
import { colorear } from "./colorear";

test("comando y comentario", () => {
  const r = colorear("\\section{A} % c", "latex");
  assert.ok(r.some((x) => x.clase === "cmd" && x.ini === 0 && x.fin === 8));
  assert.ok(r.some((x) => x.clase === "coment" && x.ini === 12 && x.fin === 15));
  assert.ok(r.some((x) => x.clase === "llave"));
});

test("fórmula", () => {
  const r = colorear("Texto $x$ fin", "latex");
  assert.deepEqual(r.find((x) => x.clase === "mate"), { ini: 6, fin: 9, clase: "mate" });
});

test("\\% no es comentario", () => {
  assert.ok(!colorear("50\\% más", "latex").some((x) => x.clase === "coment"));
});

test("entorno de ecuación entero va como fórmula", () => {
  const src = "\\begin{equation}\nF = ma\n\\end{equation}";
  const m = colorear(src, "latex").filter((x) => x.clase === "mate");
  assert.ok(m.some((x) => src.slice(x.ini, x.fin).includes("F = ma")));
});

test("markdown: títulos, fórmulas y código", () => {
  const r = colorear("# Título\n$x$ y `c`", "markdown");
  assert.ok(r.some((x) => x.clase === "cmd" && x.ini === 0));
  assert.ok(r.some((x) => x.clase === "mate"));
  assert.ok(r.some((x) => x.clase === "coment"));
});

test("rangos ordenados y sin solaparse", () => {
  const r = colorear("\\textbf{a $b$} % $c$\n\\[ d \\]", "latex");
  for (let i = 1; i < r.length; i++) assert.ok(r[i].ini >= r[i - 1].fin, JSON.stringify(r));
});
