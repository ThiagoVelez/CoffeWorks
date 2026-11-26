// Reducción de imágenes antes de ponerlas en el tablero (para que lleguen rápido a todos).

export const LADO_MAXIMO = 2048;
export const BYTES_MAXIMOS = 1_500_000;

export function planReduccion(w: number, h: number, bytes: number): { w: number; h: number; recodificar: boolean } {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(w, h));
  const nw = Math.round(w * escala), nh = Math.round(h * escala);
  return { w: nw, h: nh, recodificar: escala < 1 || bytes > BYTES_MAXIMOS };
}

export type TipoImagen = "image/png" | "image/jpeg" | "image/webp";

export async function reducirImagen(datos: Blob): Promise<{ bytes: Uint8Array; w: number; h: number; tipo: TipoImagen }> {
  const bmp = await createImageBitmap(datos);
  const plan = planReduccion(bmp.width, bmp.height, datos.size);
  const tipoOriginal: TipoImagen = datos.type === "image/png" || datos.type === "image/webp" ? (datos.type as TipoImagen) : "image/jpeg";
  if (!plan.recodificar && ["image/png", "image/jpeg", "image/webp"].includes(datos.type)) {
    bmp.close();
    return { bytes: new Uint8Array(await datos.arrayBuffer()), w: plan.w, h: plan.h, tipo: tipoOriginal };
  }
  const lienzo = new OffscreenCanvas(plan.w, plan.h);
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bmp, 0, 0, plan.w, plan.h);
  bmp.close();
  // PNG (puede tener transparencia): se mantiene PNG si cabe; si no, JPEG bajando la calidad.
  if (tipoOriginal === "image/png") {
    const png = await lienzo.convertToBlob({ type: "image/png" });
    if (png.size <= BYTES_MAXIMOS) return { bytes: new Uint8Array(await png.arrayBuffer()), w: plan.w, h: plan.h, tipo: "image/png" };
  }
  let calidad = 0.85;
  let blob = await lienzo.convertToBlob({ type: "image/jpeg", quality: calidad });
  while (blob.size > BYTES_MAXIMOS && calidad > 0.35) {
    calidad -= 0.1;
    blob = await lienzo.convertToBlob({ type: "image/jpeg", quality: calidad });
  }
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: plan.w, h: plan.h, tipo: "image/jpeg" };
}
