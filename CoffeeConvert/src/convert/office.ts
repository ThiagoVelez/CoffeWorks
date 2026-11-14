// PDF a Word, Excel, PowerPoint y texto a partir del texto extraído de cada página (y,
// para PowerPoint «fiel», de la imagen de cada página).

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import XLSX from "xlsx-js-style";
import PptxGenJS from "pptxgenjs";
import { groupLines, readingOrder, toParagraphs, toTable, type Paragraph as TextParagraph, type TextItem } from "./pdftext";

export interface PageText {
  /** Tamaño de la página en puntos. */
  width: number;
  height: number;
  items: TextItem[];
  /** Imagen PNG de la página (data URL), para PowerPoint «fiel». */
  image?: string;
  /** La página dibujada sin el texto (data URL): fondo del PowerPoint editable. */
  background?: string;
}

/** Párrafos de la página en orden de lectura (columna por columna). */
function paragraphsOf(page: PageText): TextParagraph[] {
  const body = groupLines(page.items).map((l) => l.size).sort((a, b) => a - b);
  const bodySize = body[Math.floor(body.length / 2)];
  return readingOrder(page.items).flatMap((block) => toParagraphs(groupLines(block), bodySize));
}

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function pdfToDocx(pages: PageText[]): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  pages.forEach((page, pi) => {
    const paras = paragraphsOf(page);
    const sizes = paras.filter((p) => p.heading).map((p) => p.size);
    const top = sizes.length ? Math.max(...sizes) : 0;
    paras.forEach((p, i) => {
      const pageBreakBefore = pi > 0 && i === 0;
      if (p.heading) children.push(new Paragraph({ text: p.text, heading: p.size >= top * 0.95 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, pageBreakBefore }));
      else children.push(new Paragraph({ children: [new TextRun({ text: p.text, bold: p.bold })], pageBreakBefore, spacing: { after: 120 } }));
    });
    if (!paras.length && pi > 0) children.push(new Paragraph({ text: "", pageBreakBefore: true }));
  });
  const doc = new Document({ creator: "CoffeeConvert", sections: [{ children }] });
  return fromBase64(await Packer.toBase64String(doc));
}

/** Número si la celda lo es (acepta «1.250,5» y «1250.5»). */
function cellValue(s: string): string | number {
  const t = s.trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(",", "."));
  return s;
}

export async function pdfToXlsx(pages: PageText[]): Promise<Uint8Array> {
  const wb = XLSX.utils.book_new();
  pages.forEach((page, i) => {
    const rows = toTable(groupLines(page.items, false)).map((r) => r.map(cellValue));
    const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
    const widths = Array.from({ length: Math.max(1, ...rows.map((r) => r.length)) }, (_, c) => ({ wch: Math.min(60, Math.max(8, ...rows.map((r) => String(r[c] ?? "").length + 2))) }));
    ws["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, `Página ${i + 1}`);
  });
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/**
 * PDF a PowerPoint con diapositivas del tamaño de la página. «editable»: una caja de texto
 * por línea, en su sitio y con su tamaño; «image»: cada página como imagen (idéntica).
 */
export async function pdfToPptx(pages: PageText[], mode: "editable" | "image"): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  const first = pages[0] ?? { width: 960, height: 540 };
  pptx.defineLayout({ name: "PDF", width: first.width / 72, height: first.height / 72 });
  pptx.layout = "PDF";
  pptx.author = "CoffeeConvert";
  for (const page of pages) {
    const slide = pptx.addSlide();
    const sx = first.width / page.width;
    const sy = first.height / page.height;
    if (mode === "image" && page.image) {
      slide.addImage({ data: page.image, x: 0, y: 0, w: first.width / 72, h: first.height / 72 });
      continue;
    }
    // Fondo: la página sin el texto (formas, colores, logos); encima, el texto editable.
    if (page.background) slide.addImage({ data: page.background, x: 0, y: 0, w: first.width / 72, h: first.height / 72 });
    for (const line of groupLines(page.items)) {
      // Trozos de la línea: un hueco mayor que un espacio separa cajas (cada una en su sitio,
      // como el número de sección junto a su título).
      const chunks: TextItem[][] = [];
      for (const it of line.items) {
        const last = chunks[chunks.length - 1];
        const prev = last?.[last.length - 1];
        if (prev && it.x - (prev.x + prev.w) > Math.min(prev.size, it.size) * 0.6) chunks.push([it]);
        else if (last) last.push(it);
        else chunks.push([it]);
      }
      for (const chunk of chunks) {
        const left = chunk[0].x;
        const right = Math.max(...chunk.map((it) => it.x + it.w));
        const big = Math.max(...chunk.map((it) => it.size));
        // Cada fragmento con su color, negrita, cursiva y tamaño.
        const runs = chunk.map((it, i) => {
          const prev = chunk[i - 1];
          const space = prev && it.x - (prev.x + prev.w) > it.size * 0.2 && !prev.str.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
          return { text: space + it.str, options: { bold: !!it.bold, italic: !!it.italic, color: (it.color ?? "#1f1f1f").replace("#", ""), fontSize: Math.round(it.size * Math.min(sx, sy) * 10) / 10 } };
        });
        slide.addText(runs, {
          x: (left * sx) / 72,
          y: ((page.height - line.y - big) * sy) / 72,
          w: Math.max(0.2, ((right - left) * sx * 1.06) / 72),
          h: (big * Math.min(sx, sy) * 1.3) / 72,
          fontFace: "Arial",
          margin: 0,
          valign: "top",
          fit: "none",
          wrap: false,
        });
      }
    }
  }
  return (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
}

export function pdfToText(pages: PageText[]): string {
  return pages.map((p) => paragraphsOf(p).map((x) => x.text).join("\n\n")).join("\n\n\f\n\n").trim() + "\n";
}
