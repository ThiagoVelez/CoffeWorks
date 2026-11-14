// Imágenes de cualquier formato que entienda el navegador (WebP, GIF, BMP, SVG…) a PNG o
// JPG, que es lo que puede incrustar un PDF.

import type { ImageInput } from "./organize";

export async function toEmbeddable(bytes: Uint8Array, name: string): Promise<ImageInput> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return { bytes, type: "png" };
  if (ext === "jpg" || ext === "jpeg") return { bytes, type: "jpg" };
  const mime = ext === "svg" ? "image/svg+xml" : ext === "bmp" ? "image/bmp" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "application/octet-stream";
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    // Los SVG sin tamaño propio se dibujan a 1200 px de ancho.
    canvas.width = img.naturalWidth || 1200;
    canvas.height = img.naturalHeight || Math.round((canvas.width * 3) / 4);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error();
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png" };
  } catch {
    throw new Error(`No se pudo leer la imagen «${name}».`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
