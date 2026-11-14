import { test } from "node:test";
import assert from "node:assert/strict";
import { groupLines, toParagraphs, toTable, type TextItem } from "./pdftext";

const it = (str: string, x: number, y: number, size = 12, bold = false): TextItem => ({ str, x, y, w: str.length * size * 0.5, size, bold });

test("groupLines: misma altura = misma línea, ordenadas de arriba abajo y de izquierda a derecha", () => {
  const lines = groupLines([it("mundo", 60, 700.5), it("Hola", 20, 700), it("Abajo", 20, 680)]);
  assert.deepEqual(lines.map((l) => l.text), ["Hola mundo", "Abajo"]);
});

test("toParagraphs une líneas cercanas y separa con un hueco grande; los títulos por tamaño", () => {
  const items = [it("Título grande", 20, 760, 24, true), it("línea uno", 20, 720), it("línea dos", 20, 705), it("otro párrafo", 20, 660)];
  const ps = toParagraphs(groupLines(items));
  assert.deepEqual(ps.map((p) => [p.text, p.heading]), [["Título grande", true], ["línea uno línea dos", false], ["otro párrafo", false]]);
});

test("toParagraphs une palabras cortadas con guion al final de línea", () => {
  const ps = toParagraphs(groupLines([it("compu-", 20, 720), it("tadora", 20, 705)]));
  assert.equal(ps[0].text, "computadora");
});

test("toTable reparte el texto en columnas por posición", () => {
  const items = [it("Nombre", 20, 700), it("Edad", 200, 700), it("Ana", 20, 685), it("30", 200, 685), it("Luis", 20, 670), it("41", 201, 670)];
  assert.deepEqual(toTable(groupLines(items)), [["Nombre", "Edad"], ["Ana", "30"], ["Luis", "41"]]);
});
