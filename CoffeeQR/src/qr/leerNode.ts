// Solo para las pruebas en Node: rasteriza el SVG sobre blanco (resvg) y lo lee con jsQR, sin
// probar los colores invertidos, como haría la cámara de muchos celulares.
import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { LECTURAS_CHICAS, anchosChicos, type Dibujo } from "./dibujo";

export function leer(svg: string, px = 600): string | null {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: px }, background: "white", font: { loadSystemFonts: false } }).render();
  const datos = new Uint8ClampedArray(r.pixels.buffer, r.pixels.byteOffset, r.pixels.length);
  return jsQR(datos, r.width, r.height, { inversionAttempts: "dontInvert" })?.data ?? null;
}

/** ¿Se lee en tamaño chico? (al menos `LECTURAS_CHICAS` de los anchos de `anchosChicos`). */
export const leeChico = (d: Dibujo, texto: string) => anchosChicos(d).filter((px) => leer(d.svg, px) === texto).length >= LECTURAS_CHICAS;
