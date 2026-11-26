import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "./markdown";

test("markdown con fórmulas", () => {
  const html = markdownToHtml("# T\n\n$E=mc^2$ y $$F=ma$$");
  assert.match(html, /<h1[^>]*>/);
  assert.ok((html.match(/class="katex"/g) ?? []).length >= 2);
});

test("los guiones bajos de una fórmula no se vuelven cursiva", () => {
  const html = markdownToHtml("$a_1 + b_2$ y texto");
  assert.ok(!html.includes("<em>"));
  assert.ok(html.includes("katex"));
});

test("escapa HTML crudo", () => {
  const html = markdownToHtml("<script>alert(1)</script>");
  assert.ok(!html.includes("<script>"));
});

test("los enlaces peligrosos no se vuelven enlaces", () => {
  for (const md of ["[clic](javascript:alert(1))", "[x](JAVASCRIPT:alert(1))", "![i](javascript:alert(1))", "[d](data:text/html,<script>alert(1)</script>)", "[v](vbscript:msgbox)"]) {
    const html = markdownToHtml(md);
    assert.ok(!/(href|src)="\s*(javascript|data|vbscript):/i.test(html), `${md} → ${html}`);
  }
  assert.ok(markdownToHtml("[web](https://ejemplo.org)").includes('href="https://ejemplo.org"'));
});

test("dinero sin cierre no rompe", () => {
  assert.doesNotThrow(() => markdownToHtml("cuesta $5 y nada más"));
});
