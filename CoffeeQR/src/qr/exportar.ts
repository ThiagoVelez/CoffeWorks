// Descargas para imprimir: un PDF A4 con el QR centrado y una hoja de stickers con el QR repetido.
import { PDFDocument, rgb } from "pdf-lib";

const PT_CM = 72 / 2.54;
const A4 = { ancho: 21, alto: 29.7 }; // cm
const SEPARACION = 0.5; // cm entre stickers

/** Cuántos QR cuadrados de `cm` caben en una hoja A4 con un margen de `margenMm`. */
export function cabenEnA4(cm: number, margenMm: number): { columnas: number; filas: number } {
  const m = (2 * margenMm) / 10;
  const cabe = (largo: number) => Math.max(0, Math.floor((largo - m + SEPARACION) / (cm + SEPARACION)));
  const columnas = cabe(A4.ancho), filas = cabe(A4.alto);
  return columnas && filas ? { columnas, filas } : { columnas: 0, filas: 0 };
}

async function nuevo(png: Uint8Array) {
  const doc = await PDFDocument.create();
  doc.setTitle("Código QR");
  doc.setCreator("CoffeeQR");
  const img = await doc.embedPng(png);
  const page = doc.addPage([A4.ancho * PT_CM, A4.alto * PT_CM]);
  return { doc, img, page };
}

/** PDF A4 con el QR de `cm` de ancho, centrado (la altura sigue la proporción de la imagen). */
export async function pdfQr(png: Uint8Array, cm: number): Promise<Uint8Array> {
  const { doc, img, page } = await nuevo(png);
  const w = Math.min(cm, A4.ancho - 2) * PT_CM;
  const h = (w * img.height) / img.width;
  page.drawImage(img, { x: (page.getWidth() - w) / 2, y: (page.getHeight() - h) / 2, width: w, height: h });
  return doc.save();
}

/** Hoja A4 de stickers: el QR repetido a `cm`, con líneas de corte suaves. */
export async function hojaStickers(png: Uint8Array, cm: number, margenMm: number): Promise<Uint8Array> {
  const { columnas, filas } = cabenEnA4(cm, margenMm);
  if (!columnas) throw new Error(`Un QR de ${cm} cm no cabe en una hoja A4.`);
  const { doc, img, page } = await nuevo(png);
  const w = cm * PT_CM, h = (w * img.height) / img.width;
  const filasReales = Math.max(1, Math.min(filas, Math.floor((A4.alto * PT_CM - (2 * margenMm * PT_CM) / 10 + SEPARACION * PT_CM) / (h + SEPARACION * PT_CM))));
  const sep = SEPARACION * PT_CM;
  const totalW = columnas * w + (columnas - 1) * sep, totalH = filasReales * h + (filasReales - 1) * sep;
  const x0 = (page.getWidth() - totalW) / 2, y0 = (page.getHeight() + totalH) / 2;
  for (let f = 0; f < filasReales; f++) {
    for (let c = 0; c < columnas; c++) {
      const x = x0 + c * (w + sep), y = y0 - (f + 1) * h - f * sep;
      page.drawRectangle({ x: x - 2, y: y - 2, width: w + 4, height: h + 4, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.4, borderDashArray: [2, 2] });
      page.drawImage(img, { x, y, width: w, height: h });
    }
  }
  return doc.save();
}

/** Nombre de archivo sin caracteres que den problemas en Windows o en el celular. */
export function nombreArchivo(nombre: string, ext: string): string {
  const limpio = nombre.replace(/[\\/:*?"<>|«»]+/g, " ").replace(/\s+/g, " ").trim();
  return `${limpio || "codigo-qr"}.${ext}`;
}
