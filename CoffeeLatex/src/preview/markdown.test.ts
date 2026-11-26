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

test("dinero sin cierre no rompe", () => {
  assert.doesNotThrow(() => markdownToHtml("cuesta $5 y nada más"));
});
