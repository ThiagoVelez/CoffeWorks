import { test } from "node:test";
import assert from "node:assert/strict";
import { BOTONES, insertar } from "./insertar";
import { PLANTILLAS } from "./plantillas";
import { rangosDeProsa } from "./prosa";

test("botones con los ids pedidos", () => {
  const ids = BOTONES.map((b) => b.id);
  for (const id of ["fraccion", "potencia", "raiz", "vector", "integral", "suma", "derivada", "griegas", "unidades", "tabla", "figura", "cita"]) assert.ok(ids.includes(id), id);
});

test("insertar fracción con selección", () => {
  const t = "x = 2h";
  const r = insertar(t, 4, 6, "\\frac{§}{▮}");
  assert.equal(r.texto, "x = \\frac{2h}{}");
  assert.equal(r.texto.slice(r.cursor), "}");
});

test("insertar sin selección deja el cursor en ▮", () => {
  const r = insertar("ab", 1, 1, "\\sqrt{▮}");
  assert.equal(r.texto, "a\\sqrt{}b");
  assert.equal(r.cursor, 7);
});

test("insertar sin ▮ deja el cursor al final", () => {
  const r = insertar("", 0, 0, "\\alpha");
  assert.equal(r.cursor, 6);
});

test("cada plantilla LaTeX tiene \\begin{document} y \\end{document}", () => {
  for (const p of PLANTILLAS.filter((p) => p.modo === "latex")) {
    assert.ok(p.contenido.includes("\\begin{document}") && p.contenido.includes("\\end{document}"), p.id);
  }
  assert.deepEqual(PLANTILLAS.map((p) => p.id).sort(), ["articulo", "blanco", "informe", "md-blanco", "md-notas", "taller"]);
});

test("la plantilla informe tiene sus secciones", () => {
  const p = PLANTILLAS.find((p) => p.id === "informe")!;
  for (const s of ["Objetivos", "Marco teórico", "Procedimiento", "Resultados", "Conclusiones"]) assert.ok(p.contenido.includes(`\\section{${s}}`), s);
});

const textoDe = (src: string, r: { ini: number; fin: number }[]) => r.map((x) => src.slice(x.ini, x.fin)).join("|");

test("prosa excluye comandos, fórmulas y argumentos de \\label y \\cite", () => {
  const src = "Hola \\textbf{mundo} $x$ \\label{eq:a} \\cite{newton} fin";
  const t = textoDe(src, rangosDeProsa(src, "latex"));
  for (const w of ["Hola", "mundo", "fin"]) assert.ok(t.includes(w), w);
  for (const w of ["textbf", "eq:a", "newton"]) assert.ok(!t.includes(w), w);
  assert.ok(!/\bx\b/.test(t));
});

test("prosa en latex excluye comentarios y entornos de fórmulas", () => {
  const src = "Uno % comentario\n\\begin{equation}\nvelocidad = d/t\n\\end{equation}\ndos";
  const t = textoDe(src, rangosDeProsa(src, "latex"));
  assert.ok(t.includes("Uno") && t.includes("dos"));
  assert.ok(!t.includes("comentario") && !t.includes("velocidad") && !t.includes("equation"));
});

test("prosa en markdown excluye código y fórmulas", () => {
  const src = "Texto `codigo` y $$\nformula\n$$ y $inline$\n```\nbloque\n```\nfinal";
  const t = textoDe(src, rangosDeProsa(src, "markdown"));
  assert.ok(t.includes("Texto") && t.includes("final"));
  for (const w of ["codigo", "formula", "inline", "bloque"]) assert.ok(!t.includes(w), w);
});

test("prosa no revisa el preámbulo salvo título, autor y fecha", () => {
  const src = "\\documentclass{article}\n\\sisetup{output-decimal-marker={,}}\n\\title{Caida libre}\n\\author{Ana}\n\\begin{document}\nHola";
  const t = textoDe(src, rangosDeProsa(src, "latex"));
  assert.ok(!t.includes("output") && !t.includes("decimal") && !t.includes("article"), t);
  assert.ok(t.includes("Caida libre") && t.includes("Ana") && t.includes("Hola"), t);
});
