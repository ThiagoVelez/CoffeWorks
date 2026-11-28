import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import { cabenEnA4, hojaStickers, nombreArchivo, pdfQr } from "./exportar";
import { DISENO_BASE, dibujarSvg } from "./dibujo";

const png = () => new Resvg(dibujarSvg("https://a.co", DISENO_BASE).svg, { fitTo: { mode: "width", value: 300 } }).render().asPng();

test("cuántos stickers caben en A4", () => {
  assert.deepEqual(cabenEnA4(4, 10), { columnas: 4, filas: 6 });
  assert.deepEqual(cabenEnA4(5, 5), { columnas: 3, filas: 5 });
  assert.deepEqual(cabenEnA4(25, 10), { columnas: 0, filas: 0 });
});

test("PDF para imprimir: una página A4 con el QR", async () => {
  const pdf = await pdfQr(png(), 8);
  assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), "%PDF");
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 1);
  const { width, height } = doc.getPage(0).getSize();
  assert.equal(Math.round(width), 595);
  assert.equal(Math.round(height), 842);
});

test("hoja de stickers: 24 QR de 4 cm", async () => {
  const pdf = await hojaStickers(png(), 4, 10);
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 1);
  // cada imagen dibujada es un operador «Do» en el contenido de la página
  assert.equal(await contar(pdf), 24);
  await assert.rejects(hojaStickers(png(), 30, 10), /no cabe/i);
});

test("nombre de archivo seguro", () => {
  assert.equal(nombreArchivo("Menú: «Café» / 2026", "png"), "Menú Café 2026.png");
  assert.equal(nombreArchivo("   ", "svg"), "codigo-qr.svg");
});

async function contar(pdf: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdf);
  const page = doc.getPage(0);
  const { PDFRawStream, PDFArray, decodePDFRawStream } = await import("pdf-lib");
  const c = page.node.Contents();
  const streams = c instanceof PDFArray ? c.asArray().map((r) => doc.context.lookup(r)) : [c];
  let s = "";
  for (const st of streams) if (st instanceof PDFRawStream) s += new TextDecoder("latin1").decode(decodePDFRawStream(st).decode());
  return (s.match(/ Do\b/g) ?? []).length;
}
