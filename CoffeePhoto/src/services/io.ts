// Importar imágenes (PNG, JPG, WebP, BMP, GIF) y exportar el documento.

import { jsPDF } from "jspdf";
import type { PhotoDoc } from "../types";
import { compose, layerCanvas } from "./model";
import { ctx2d, newCanvas } from "./pixels";
import { makeZip } from "../studio/zip";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", bmp: "image/bmp", gif: "image/gif" };

export async function bytesToCanvas(bytes: Uint8Array, name: string): Promise<HTMLCanvasElement> {
  const ext = name.split(".").pop()?.toLowerCase() || "png";
  const blob = new Blob([bytes as BlobPart], { type: MIME[ext] || "image/png" });
  const bmp = await createImageBitmap(blob);
  const c = newCanvas(bmp.width, bmp.height);
  ctx2d(c).drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

export async function dataUrlToCanvas(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = newCanvas(img.naturalWidth, img.naturalHeight);
  ctx2d(c).drawImage(img, 0, 0);
  return c;
}

export type ExportFormat = "png" | "jpg" | "webp" | "pdf" | "layers";

export async function exportDocument(doc: PhotoDoc, format: ExportFormat, opts: { quality: number; scale: number; background: string }): Promise<Blob> {
  const full = compose(doc);
  const w = Math.max(1, Math.round(doc.width * opts.scale));
  const h = Math.max(1, Math.round(doc.height * opts.scale));
  const scaled = newCanvas(w, h);
  const g = ctx2d(scaled);
  if (format === "jpg" || format === "pdf") {
    g.fillStyle = opts.background;
    g.fillRect(0, 0, w, h);
  }
  g.imageSmoothingQuality = "high";
  g.drawImage(full, 0, 0, w, h);
  if (format === "pdf") {
    const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "pt", format: [(doc.width * 72) / doc.dpi, (doc.height * 72) / doc.dpi] });
    pdf.addImage(scaled.toDataURL("image/jpeg", opts.quality), "JPEG", 0, 0, (doc.width * 72) / doc.dpi, (doc.height * 72) / doc.dpi);
    return pdf.output("blob");
  }
  if (format === "layers") {
    const entries = [];
    let i = 1;
    for (const layer of doc.layers) {
      if (layer.kind === "adjust") continue;
      const c = layerCanvas(doc, layer);
      if (!c) continue;
      const blob = await canvasBlob(c, "image/png", 1);
      entries.push({ name: `${String(i++).padStart(2, "0")} ${layer.name.replace(/[\\/:*?"<>|]/g, "_")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    entries.push({ name: "Imagen completa.png", data: new Uint8Array(await (await canvasBlob(full, "image/png", 1)).arrayBuffer()) });
    return makeZip(entries);
  }
  const type = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  return canvasBlob(scaled, type, opts.quality);
}

export const canvasBlob = (c: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo codificar la imagen"))), type, quality));
