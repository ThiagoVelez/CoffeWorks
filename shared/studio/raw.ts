// Fotos RAW de cámara con el complemento «Revelado RAW» (LibRaw dcraw_emu):
// el programa devuelve una imagen PPM de 8 bits que aquí se convierte en lienzo.

import { base64ToBytes } from "./desktop";
import { ensureAddon, runAddonFile } from "./addons";

export const RAW_EXTENSIONS = ["cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "dng", "raf", "orf", "rw2", "pef", "srw", "x3f", "3fr", "iiq", "erf", "kdc", "mrw", "rwl"];

export const isRaw = (name: string) => RAW_EXTENSIONS.includes(name.split(".").pop()?.toLowerCase() || "");

/** Lee una imagen PPM/PGM binaria (P6/P5) en un lienzo. */
export function ppmToCanvas(bytes: Uint8Array): HTMLCanvasElement {
  let pos = 0;
  const token = () => {
    while (pos < bytes.length) {
      const c = bytes[pos];
      if (c === 35) while (pos < bytes.length && bytes[pos] !== 10) pos++;
      else if (c === 32 || c === 9 || c === 10 || c === 13) pos++;
      else break;
    }
    let s = "";
    while (pos < bytes.length && ![32, 9, 10, 13].includes(bytes[pos])) s += String.fromCharCode(bytes[pos++]);
    return s;
  };
  const magic = token();
  const w = parseInt(token(), 10);
  const h = parseInt(token(), 10);
  const max = parseInt(token(), 10);
  pos++;
  if ((magic !== "P6" && magic !== "P5") || !w || !h) throw new Error("La imagen RAW no se pudo leer.");
  const channels = magic === "P6" ? 3 : 1;
  const wide = max > 255;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    for (let k = 0; k < 3; k++) {
      const ch = channels === 3 ? k : 0;
      const idx = pos + (i * channels + ch) * (wide ? 2 : 1);
      d[i * 4 + k] = wide ? ((bytes[idx] << 8) | bytes[idx + 1]) >> 8 : bytes[idx];
    }
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Revela un archivo RAW con el complemento (lo ofrece instalar si falta). */
export async function decodeRaw(bytes: Uint8Array, name: string, appName: string): Promise<HTMLCanvasElement | null> {
  if (!(await ensureAddon("raw", appName))) return null;
  const ext = name.split(".").pop()?.toLowerCase() || "raw";
  // -w: balance de blancos de la cámara · -o 1: sRGB · -q 3: interpolación AHD · -Z -: a la salida estándar
  const out = await runAddonFile("raw", ["-w", "-o", "1", "-q", "3", "-Z", "-", "{stdout-base64}", "{input}"], bytes, ext);
  return ppmToCanvas(base64ToBytes(out));
}
