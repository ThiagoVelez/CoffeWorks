import { test } from "node:test";
import assert from "node:assert/strict";
import { outputName, parseRanges } from "./ranges";

test("parseRanges: páginas sueltas, rangos y abiertos", () => {
  assert.deepEqual(parseRanges("1-3, 5, 8-", 10), [[1, 2, 3], [5], [8, 9, 10]]);
  assert.deepEqual(parseRanges("2", 4), [[2]]);
  assert.deepEqual(parseRanges(" 3 - 1 ", 4), [[3, 2, 1]], "rango al revés");
});

test("parseRanges rechaza lo que no existe, con un mensaje claro", () => {
  assert.throws(() => parseRanges("", 4), /Escribe/);
  assert.throws(() => parseRanges("0", 4), /entre 1 y 4/);
  assert.throws(() => parseRanges("2-9", 4), /entre 1 y 4/);
  assert.throws(() => parseRanges("a-b", 4), /no se entiende/);
});

test("outputName cambia la extensión y numera", () => {
  assert.equal(outputName("Póster final.pdf", "pptx"), "Póster final.pptx");
  assert.equal(outputName("informe.PDF", "png", 3), "informe-3.png");
  assert.equal(outputName("sin extensión", "pdf"), "sin extensión.pdf");
  assert.equal(outputName("a/b\\c.docx", "pdf"), "c.pdf");
});
