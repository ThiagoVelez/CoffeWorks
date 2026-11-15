import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { pdfToDocx, pdfToPptx, pdfToText, pdfToXlsx, type PageText } from "./office";

const page: PageText = {
  width: 612,
  height: 792,
  items: [
    { str: "Informe anual", x: 72, y: 700, w: 200, size: 24, bold: true },
    { str: "Nombre", x: 72, y: 650, w: 50, size: 11 },
    { str: "Total", x: 300, y: 650, w: 40, size: 11 },
    { str: "Café", x: 72, y: 635, w: 40, size: 11 },
    { str: "1250", x: 300, y: 635, w: 30, size: 11 },
  ],
};

test("PDF a Word: los textos están en el documento y el título es un encabezado", async () => {
  const zip = await JSZip.loadAsync(await pdfToDocx([page, page]));
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.ok(xml.includes("Informe anual") && xml.includes("Café"));
  assert.match(xml, /Heading1|Título 1|w:val="Heading1"/);
  assert.equal((xml.match(/w:br w:type="page"/g) ?? []).length + (xml.match(/pageBreakBefore/g) ?? []).length >= 1, true);
});

test("PDF a Excel: una hoja por página y los números como números", async () => {
  const zip = await JSZip.loadAsync(await pdfToXlsx([page]));
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(sheet, /<v>1250<\/v>/);
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  assert.match(wb, /Página 1/);
});

test("PDF a PowerPoint editable: diapositiva del tamaño de la página, textos en su sitio", async () => {
  const zip = await JSZip.loadAsync(await pdfToPptx([page], "editable"));
  const pres = await zip.file("ppt/presentation.xml")!.async("string");
  assert.match(pres, /<p:sldSz cx="7772400" cy="10058400"/);
  const slide = await zip.file("ppt/slides/slide1.xml")!.async("string");
  assert.ok(slide.includes("Informe anual"));
  assert.match(slide, /sz="2400"/);
});

test("PDF a PowerPoint fiel: una imagen por diapositiva", async () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
  const zip = await JSZip.loadAsync(await pdfToPptx([{ ...page, image: png }], "image"));
  assert.ok(Object.keys(zip.files).some((f) => f.startsWith("ppt/media/")));
});

test("PDF a texto", () => {
  assert.equal(pdfToText([page]).split("\n")[0], "Informe anual");
});
