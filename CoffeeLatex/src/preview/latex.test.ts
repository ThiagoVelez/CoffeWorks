import { test } from "node:test";
import assert from "node:assert/strict";
import { latexToHtml } from "./latex";

const doc = (cuerpo: string) => `\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n${cuerpo}\n\\end{document}\n`;

test("secciones numeradas", () => {
  const { html } = latexToHtml(doc("\\section{A}\n\\subsection{B}\n\\section{C}"));
  assert.match(html, /1\s*(&nbsp;)?\s*A/);
  assert.match(html, /1\.1\s*(&nbsp;)?\s*B/);
  assert.match(html, /2\s*(&nbsp;)?\s*C/);
  assert.match(html, /<h2[^>]*>/);
  assert.match(html, /<h3[^>]*>/);
});

test("ecuación numerada y referencia", () => {
  const { html } = latexToHtml(doc("\\begin{equation}\\label{e}\nF = m a\n\\end{equation}\nVer la ecuación \\ref{e}."));
  assert.match(html, /\(1\)/);
  assert.match(html, /ecuación 1\./);
  assert.ok(html.includes("katex"));
});

test("fórmulas en línea y aparte", () => {
  for (const f of ["$x^2$", "\\(x\\)", "\\[x\\]", "$$x$$"]) {
    assert.ok(latexToHtml(doc(`Texto ${f} fin`)).html.includes("katex"), f);
  }
  assert.ok(latexToHtml(doc("\\[x\\]")).html.includes("katex-display"));
});

test("negrita, cursiva y listas", () => {
  const { html } = latexToHtml(doc("\\textbf{fuerte} \\emph{suave} \\textit{it}\n\\begin{itemize}\n\\item uno\n\\item dos\n\\end{itemize}\n\\begin{enumerate}\n\\item a\n\\end{enumerate}"));
  assert.ok(html.includes("<strong>fuerte</strong>"));
  assert.ok(html.includes("<em>suave</em>"));
  assert.ok(html.includes("<em>it</em>"));
  assert.equal((html.match(/<li>/g) ?? []).length, 3);
  assert.ok(html.includes("<ul>") && html.includes("<ol>"));
});

test("tabular simple", () => {
  const { html } = latexToHtml(doc("\\begin{tabular}{|c|c|}\n\\hline\n$t$ (s) & $y$ (m) \\\\\n\\hline\n0{,}5 & 1{,}2 \\\\\n\\hline\n\\end{tabular}"));
  assert.ok(html.includes("<table"));
  assert.equal((html.match(/<td/g) ?? []).length, 4);
  assert.ok(html.includes("0,5"));
});

test("título del documento", () => {
  const r = latexToHtml(doc("\\title{Caída libre}\n\\author{Ana Pérez}\n\\maketitle\nHola"));
  assert.equal(r.titulo, "Caída libre");
  assert.ok(r.html.includes("Ana Pérez"));
  assert.ok(r.html.includes("Caída libre"));
});

test("lo desconocido va en gris", () => {
  assert.ok(latexToHtml(doc("\\foo{x} texto")).html.includes('class="desconocido"'));
});

test("latexToHtml tolera código a medio escribir", () => {
  for (const s of ["\\section{A", "\\begin{equation}x", "$x", "\\textbf{a", "\\end{itemize}", "\\begin{itemize}\n\\item a"]) {
    assert.doesNotThrow(() => latexToHtml(doc(s)), s);
    assert.equal(typeof latexToHtml(doc(s)).html, "string");
  }
});

test("fórmula inválida no rompe la vista", () => {
  assert.doesNotThrow(() => latexToHtml(doc("$\\frac{1}{$ y $\\mathrm{m/s^2}$ y $h = 1{,}2\\,\\mathrm{m}$")));
});

test("escapa HTML", () => {
  const { html } = latexToHtml(doc("<script>alert(1)</script> & más"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("comentarios con % y \\% literal", () => {
  const { html } = latexToHtml(doc("Visible % oculto\n50\\% del total"));
  assert.ok(html.includes("Visible"));
  assert.ok(!html.includes("oculto"));
  assert.ok(html.includes("50%"));
});

test("sin \\begin{document} también funciona", () => {
  assert.ok(latexToHtml("\\section{Solo}\nTexto $x$").html.includes("Solo"));
});
