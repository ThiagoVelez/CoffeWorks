// En el navegador: pasar el SVG a PNG (con o sin fondo) y leerlo con jsQR para el semáforo.
import jsQR from "jsqr";
import { LECTURAS_CHICAS, anchosChicos, type Dibujo } from "./dibujo";

function imagen(svg: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No se pudo dibujar el QR.")); };
    img.src = url;
  });
}

async function lienzo(d: Dibujo, ancho: number, fondoBlanco: boolean): Promise<HTMLCanvasElement> {
  const img = await imagen(d.svg);
  const c = document.createElement("canvas");
  c.width = Math.round(ancho);
  c.height = Math.round((ancho * d.alto) / d.ancho);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  if (fondoBlanco) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
  }
  g.imageSmoothingEnabled = true;
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** PNG del dibujo a `ancho` píxeles; sin fondo, lo transparente queda transparente. */
export async function aPng(d: Dibujo, ancho: number): Promise<Uint8Array> {
  const c = await lienzo(d, ancho, false);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
  if (!blob) throw new Error("No se pudo crear el PNG.");
  return new Uint8Array(await blob.arrayBuffer());
}

async function lee(d: Dibujo, ancho: number, texto: string): Promise<boolean> {
  const c = await lienzo(d, ancho, true);
  const datos = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  return jsQR(datos.data, c.width, c.height, { inversionAttempts: "dontInvert" })?.data === texto;
}

/** Lo que leería un celular: grande (600 px) y chico (dos de tres tamaños pequeños). */
export async function probarLectura(d: Dibujo, texto: string): Promise<{ grande: boolean; chico: boolean }> {
  const grande = await lee(d, 600, texto);
  let n = 0;
  for (const px of anchosChicos(d)) if (await lee(d, px, texto)) n++;
  return { grande, chico: n >= LECTURAS_CHICAS };
}

/** Imagen elegida para el logo, reducida a 256 px y en PNG (data URL). */
export async function logoDesdeArchivo(archivo: Blob): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error("Esa imagen no se pudo abrir."));
      i.src = url;
    });
    const lado = 256, k = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
