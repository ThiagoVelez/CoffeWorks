import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToBlocks, htmlToBlocks, markdownToBlocks, textToBlocks, winAnsiSafe, wrapText } from "./blocks";

test("Markdown: títulos, párrafos, listas, código y tablas", () => {
  const b = markdownToBlocks("# Título\n\nUn párrafo\nque sigue.\n\n- uno\n- dos\n1. tres\n\n```\ncódigo\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
  assert.deepEqual(b.map((x) => x.kind), ["h1", "p", "li", "li", "li", "code", "table"]);
  assert.equal(b[1].text, "Un párrafo que sigue.");
  assert.equal(b[4].text, "tres");
  assert.deepEqual(b[6].rows, [["a", "b"], ["1", "2"]]);
});

test("Markdown quita el formato en línea", () => {
  assert.equal(markdownToBlocks("**negrita** y _cursiva_ con [enlace](http://x) y `code`")[0].text, "negrita y cursiva con enlace y code");
});

test("HTML: estructura sin etiquetas ni scripts, con entidades", () => {
  const b = htmlToBlocks("<html><head><style>p{}</style><script>x()</script></head><body><h2>Hola &amp; adiós</h2><p>Uno<br>dos</p><ul><li>a</li><li>b</li></ul><table><tr><th>x</th><td>y</td></tr></table></body></html>");
  assert.deepEqual(b.map((x) => x.kind), ["h2", "p", "li", "li", "table"]);
  assert.equal(b[0].text, "Hola & adiós");
  assert.equal(b[1].text, "Uno\ndos");
  assert.deepEqual(b[4].rows, [["x", "y"]]);
});

test("CSV con comillas, comas y punto y coma", () => {
  assert.deepEqual(csvToBlocks('a,b\n"1,5","dice ""hola"""\n')[0].rows, [["a", "b"], ["1,5", 'dice "hola"']]);
  assert.deepEqual(csvToBlocks("a;b\n1;2")[0].rows, [["a", "b"], ["1", "2"]]);
});

test("texto: párrafos por líneas en blanco, conservando saltos", () => {
  const b = textToBlocks("línea 1\nlínea 2\n\n\notro");
  assert.deepEqual(b.map((x) => x.text), ["línea 1\nlínea 2", "otro"]);
});

test("wrapText corta por palabras según el ancho medido", () => {
  const measure = (s: string) => s.length;
  assert.deepEqual(wrapText("uno dos tres cuatro", 8, measure), ["uno dos", "tres", "cuatro"]);
  assert.deepEqual(wrapText("supercalifragilístico", 6, measure), ["superc", "alifra", "gilíst", "ico"]);
  assert.deepEqual(wrapText("a\nb", 10, measure), ["a", "b"]);
});

test("winAnsiSafe deja los acentos y cambia lo que la fuente no puede dibujar", () => {
  assert.equal(winAnsiSafe("Ñandú — “café” €"), "Ñandú — “café” €");
  assert.equal(winAnsiSafe("π ✓ 日本\ttab"), "? ? ??    tab");
});
