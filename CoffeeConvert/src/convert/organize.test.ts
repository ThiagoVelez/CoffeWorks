import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, degrees } from "pdf-lib";
import { blocksToPdf, compressBasic, imagesToPdf, mergePdfs, numberPages, reorderPages, rotatePages, splitPdf, watermark } from "./organize";
import { markdownToBlocks } from "./blocks";

async function makePdf(pages: number, size: [number, number] = [595, 842]): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage(size);
  return d.save();
}
const count = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

test("unir mantiene el orden y el total de páginas", async () => {
  const out = await mergePdfs([await makePdf(2), await makePdf(3, [300, 300])]);
  const d = await PDFDocument.load(out);
  assert.equal(d.getPageCount(), 5);
  assert.equal(Math.round(d.getPage(2).getWidth()), 300);
});

test("dividir por rangos da un PDF por grupo", async () => {
  const parts = await splitPdf(await makePdf(5), [[1, 2], [5]]);
  assert.deepEqual(await Promise.all(parts.map(count)), [2, 1]);
});

test("rotar, quitar y reordenar páginas", async () => {
  const rot = await PDFDocument.load(await rotatePages(await makePdf(3), [2], 90));
  assert.deepEqual(rot.getPages().map((p) => p.getRotation().angle), [0, 90, 0]);
  const re = await PDFDocument.load(await reorderPages(await makePdf(3, [100, 100]), [3, 1]));
  assert.equal(re.getPageCount(), 2);
  void degrees;
});

test("numerar y marca de agua no rompen el PDF", async () => {
  assert.equal(await count(await numberPages(await makePdf(3), "Página {n} de {total}")), 3);
  assert.equal(await count(await watermark(await makePdf(2), "CONFIDENCIAL — Ñ")), 2);
});

test("compresión básica devuelve un PDF válido", async () => {
  assert.equal(await count(await compressBasic(await makePdf(4))), 4);
});

test("imágenes PNG/JPG a PDF: una página por imagen", async () => {
  // PNG de 1×1 rojo
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"), (c) => c.charCodeAt(0));
  const out = await imagesToPdf([{ bytes: png, type: "png" }, { bytes: png, type: "png" }], "a4");
  assert.equal(await count(out), 2);
  const fit = await PDFDocument.load(await imagesToPdf([{ bytes: png, type: "png" }], "image"));
  assert.equal(Math.round(fit.getPage(0).getWidth()), 1);
});

test("bloques a PDF: textos largos pasan a varias páginas y aguantan caracteres raros", async () => {
  const md = "# Informe\n\n" + Array.from({ length: 120 }, (_, i) => `Párrafo ${i} con acentos áéíóú ñ y un símbolo ✓ que no existe en la fuente.`).join("\n\n") + "\n\n| a | b |\n|---|---|\n| 1 | 2 |";
  const n = await count(await blocksToPdf(markdownToBlocks(md), "Informe"));
  assert.ok(n >= 3, String(n));
});
