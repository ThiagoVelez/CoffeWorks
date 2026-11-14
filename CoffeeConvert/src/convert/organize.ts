// Organizar PDF y crear PDF (pdf-lib): unir, dividir, rotar, reordenar, numerar, marca de
// agua, compresión básica, imágenes a PDF y maquetado de bloques de texto.

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { winAnsiSafe, wrapText, type Block } from "./blocks";

const A4: [number, number] = [595.28, 841.89];

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
  }
  return out.save();
}

/** Un PDF por grupo de páginas (números desde 1). */
export async function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out: Uint8Array[] = [];
  for (const g of groups) {
    const d = await PDFDocument.create();
    for (const p of await d.copyPages(src, g.map((n) => n - 1))) d.addPage(p);
    out.push(await d.save());
  }
  return out;
}

/** Gira las páginas indicadas (o todas si `pages` está vacío) los grados dados. */
export async function rotatePages(bytes: Uint8Array, pages: number[], angle: 90 | 180 | 270): Promise<Uint8Array> {
  const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
  d.getPages().forEach((p, i) => {
    if (!pages.length || pages.includes(i + 1)) p.setRotation(degrees((p.getRotation().angle + angle) % 360));
  });
  return d.save();
}

/** Nuevo PDF con las páginas en el orden dado (las que no aparecen se quitan). */
export async function reorderPages(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  return (await splitPdf(bytes, [order]))[0];
}

/** Número en el pie: `{n}` y `{total}` se sustituyen. */
export async function numberPages(bytes: Uint8Array, pattern = "{n} / {total}"): Promise<Uint8Array> {
  const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await d.embedFont(StandardFonts.Helvetica);
  const pages = d.getPages();
  pages.forEach((p, i) => {
    const text = winAnsiSafe(pattern.replace("{n}", String(i + 1)).replace("{total}", String(pages.length)));
    const size = 10;
    const { width } = p.getSize();
    p.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y: 22, size, font, color: rgb(0.35, 0.35, 0.38) });
  });
  return d.save();
}

export async function watermark(bytes: Uint8Array, text: string, opacity = 0.18): Promise<Uint8Array> {
  const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await d.embedFont(StandardFonts.HelveticaBold);
  const safe = winAnsiSafe(text);
  for (const p of d.getPages()) {
    const { width, height } = p.getSize();
    const size = Math.min(72, (Math.hypot(width, height) * 0.7) / Math.max(1, font.widthOfTextAtSize(safe, 1)));
    const w = font.widthOfTextAtSize(safe, size);
    const a = Math.atan2(height, width);
    p.drawText(safe, {
      x: width / 2 - (Math.cos(a) * w) / 2 + (Math.sin(a) * size) / 3,
      y: height / 2 - (Math.sin(a) * w) / 2 - (Math.cos(a) * size) / 3,
      size,
      font,
      color: rgb(0.8, 0.1, 0.1),
      opacity,
      rotate: degrees((a * 180) / Math.PI),
    });
  }
  return d.save();
}

/** Reescribe el PDF con flujos de objetos comprimidos (no toca la calidad). */
export async function compressBasic(bytes: Uint8Array): Promise<Uint8Array> {
  const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
  d.setProducer("CoffeeConvert");
  return d.save({ useObjectStreams: true });
}

export interface ImageInput {
  bytes: Uint8Array;
  type: "png" | "jpg";
}

/** Una página por imagen: centrada en A4 (con margen) o del tamaño de la imagen. */
export async function imagesToPdf(images: ImageInput[], fit: "a4" | "image"): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (const img of images) {
    const emb = img.type === "png" ? await d.embedPng(img.bytes) : await d.embedJpg(img.bytes);
    if (fit === "image") {
      const p = d.addPage([emb.width, emb.height]);
      p.drawImage(emb, { x: 0, y: 0, width: emb.width, height: emb.height });
      continue;
    }
    const landscape = emb.width > emb.height;
    const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
    const p = d.addPage([pw, ph]);
    const margin = 28;
    const k = Math.min((pw - margin * 2) / emb.width, (ph - margin * 2) / emb.height, 1e9);
    const [w, h] = [emb.width * k, emb.height * k];
    p.drawImage(emb, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return d.save();
}

/** Maqueta bloques (títulos, párrafos, listas, código y tablas) en páginas A4. */
export async function blocksToPdf(blocks: Block[], title: string): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  d.setTitle(winAnsiSafe(title));
  d.setCreator("CoffeeConvert");
  const fonts = {
    regular: await d.embedFont(StandardFonts.Helvetica),
    bold: await d.embedFont(StandardFonts.HelveticaBold),
    mono: await d.embedFont(StandardFonts.Courier),
  };
  const [W, H] = A4;
  const M = 56;
  let page: PDFPage = d.addPage(A4);
  let y = H - M;
  const ensure = (h: number) => {
    if (y - h < M) {
      page = d.addPage(A4);
      y = H - M;
    }
  };
  const lines = (text: string, font: PDFFont, size: number, width: number) => wrapText(winAnsiSafe(text), width, (s) => font.widthOfTextAtSize(s, size));
  const write = (text: string, font: PDFFont, size: number, x: number, width: number, gap: number, color = rgb(0.12, 0.12, 0.14)) => {
    for (const line of lines(text, font, size, width)) {
      ensure(size * 1.35);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size * 1.35;
    }
    y -= gap;
  };
  for (const b of blocks) {
    if (b.kind === "table" && b.rows?.length) {
      const cols = Math.max(...b.rows.map((r) => r.length));
      const cw = (W - M * 2) / cols;
      const size = cols > 6 ? 8 : 10;
      b.rows.forEach((row, ri) => {
        const font = ri === 0 ? fonts.bold : fonts.regular;
        const cells = Array.from({ length: cols }, (_, c) => lines(row[c] ?? "", font, size, cw - 8));
        const h = Math.max(...cells.map((c) => c.length)) * size * 1.3 + 8;
        ensure(h);
        cells.forEach((cell, c) => {
          page.drawRectangle({ x: M + c * cw, y: y - h, width: cw, height: h, borderColor: rgb(0.75, 0.75, 0.78), borderWidth: 0.6, color: ri === 0 ? rgb(0.94, 0.95, 0.96) : undefined });
          cell.forEach((line, li) => page.drawText(line, { x: M + c * cw + 4, y: y - 4 - size - li * size * 1.3, size, font }));
        });
        y -= h;
      });
      y -= 10;
      continue;
    }
    if (b.kind === "h1") write(b.text, fonts.bold, 22, M, W - M * 2, 10);
    else if (b.kind === "h2") write(b.text, fonts.bold, 17, M, W - M * 2, 8);
    else if (b.kind === "h3") write(b.text, fonts.bold, 13.5, M, W - M * 2, 6);
    else if (b.kind === "li") {
      ensure(14);
      page.drawText("•", { x: M + 4, y: y - 11, size: 11, font: fonts.regular });
      write(b.text, fonts.regular, 11, M + 18, W - M * 2 - 18, 3);
    } else if (b.kind === "code") write(b.text, fonts.mono, 9.5, M + 8, W - M * 2 - 16, 8, rgb(0.2, 0.22, 0.3));
    else write(b.text, fonts.regular, 11, M, W - M * 2, 8);
  }
  return d.save();
}
