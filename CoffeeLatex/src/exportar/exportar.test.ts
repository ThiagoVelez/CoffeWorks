import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { texErrors } from "./errores";
import { documentoHtml, incrustarFuentes } from "./exportar";

const REGISTRO = `This is XeTeX, Version 3.141592653
(./documento.tex
LaTeX2e <2023-11-01>
! Undefined control sequence.
l.12 \\foo
          {x}
?
! Emergency stop.
l.12 \\foo
`;

test("texErrors encuentra línea y mensaje", () => {
  const e = texErrors(REGISTRO);
  assert.deepEqual(e[0], { linea: 12, mensaje: "Comando desconocido: \\foo" });
  assert.ok(e.some((x) => x.mensaje.startsWith("El documento tiene un error")));
});

test("traduce Missing $ inserted", () => {
  const e = texErrors("! Missing $ inserted.\n<inserted text> \n                $\nl.7 x^\n");
  assert.equal(e[0].linea, 7);
  assert.equal(e[0].mensaje, "Falta abrir o cerrar una fórmula ($)");
});

test("traduce archivo no encontrado y deja lo demás tal cual", () => {
  const e = texErrors("! LaTeX Error: File `foto.png' not found.\n\nl.20 \\includegraphics{foto.png}\n! Algo raro pasó.\nl.30 x\n");
  assert.deepEqual(e[0], { linea: 20, mensaje: "No se encuentra el archivo foto.png" });
  assert.deepEqual(e[1], { linea: 30, mensaje: "Algo raro pasó." });
});

test("errores de Tectonic", () => {
  const e = texErrors("error: documento.tex:5: Undefined control sequence\nerror: halted on potentially-recoverable error as specified\n");
  assert.equal(e[0].linea, 5);
  assert.ok(e[0].mensaje.startsWith("Comando desconocido"));
});

test("registro vacío da lista vacía", () => {
  assert.deepEqual(texErrors(""), []);
});

test("incrustarFuentes reconoce las rutas que reescribe Vite", () => {
  const fuentes = { "KaTeX_Main-Regular.woff2": "data:font/woff2;base64,AAA" };
  for (const url of ["fonts/KaTeX_Main-Regular.woff2", "/node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2", "/assets/KaTeX_Main-Regular-DRggAlZN.woff2"]) {
    const css = `@font-face{font-family:KaTeX_Main;src:url(${url}) format("woff2"),url(x.woff) format("woff");font-weight:400}`;
    const r = incrustarFuentes(css, fuentes);
    assert.ok(r.includes("data:font/woff2;base64,AAA"), url);
    assert.ok(!r.includes(".woff)"), url);
  }
});

test("exportarHtml no depende de internet", () => {
  const dir = join(process.cwd(), "node_modules/katex/dist");
  const css = readFileSync(join(dir, "katex.min.css"), "utf8");
  const fuentes: Record<string, string> = {};
  for (const f of readdirSync(join(dir, "fonts")).filter((f) => f.endsWith(".woff2"))) {
    fuentes[f] = `data:font/woff2;base64,${readFileSync(join(dir, "fonts", f)).toString("base64")}`;
  }
  const html = documentoHtml("Caída <libre>", "<p>Hola</p>", incrustarFuentes(css, fuentes));
  assert.ok(!/(href|src)=["']https?:/.test(html));
  assert.ok(!/url\(["']?https?:/.test(html));
  assert.ok(!/url\(fonts\//.test(html));
  assert.ok(html.includes("@font-face"));
  assert.ok(html.includes("data:font/woff2;base64,"));
  assert.ok(html.includes("<title>Caída &lt;libre&gt;</title>"));
  assert.ok(html.includes("<p>Hola</p>"));
});
