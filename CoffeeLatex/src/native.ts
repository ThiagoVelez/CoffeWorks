// Comandos nativos de documentos (coffee-core/docconv): compilar a PDF y convertir con Pandoc.

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./studio/desktop";

export interface Herramientas {
  latex: "tectonic" | "xelatex" | null;
  pandoc: boolean;
}

export class ErrorDeCompilacion extends Error {
  constructor(mensaje: string, public registro: string) {
    super(mensaje);
  }
}

export const SIN_MOTOR = "Instala el complemento «Motor LaTeX» desde el Launcher › Complementos.";
export const SIN_PANDOC = "Instala el complemento «Conversor de documentos (Pandoc)» desde el Launcher › Complementos.";

function aBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function deBase64(t: string): Uint8Array {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export async function herramientas(): Promise<Herramientas> {
  if (!isTauri) return { latex: null, pandoc: false };
  try {
    return await invoke<Herramientas>("doc_herramientas");
  } catch {
    return { latex: null, pandoc: false };
  }
}

/** Compila LaTeX a PDF. `archivos`: nombre relativo → contenido (imágenes de las figuras). */
export async function compilarPdf(tex: string, archivos: { nombre: string; datos: Uint8Array }[] = []): Promise<Uint8Array> {
  if (!isTauri) throw new ErrorDeCompilacion(SIN_MOTOR, "");
  try {
    const b64 = await invoke<string>("doc_latex_pdf", { tex, archivos: archivos.map((a) => [a.nombre, aBase64(a.datos)]) });
    return deBase64(b64);
  } catch (e) {
    let info: { mensaje?: string; registro?: string } = {};
    try {
      info = JSON.parse(String(e));
    } catch {
      info = { mensaje: String(e) };
    }
    throw new ErrorDeCompilacion(info.mensaje || "El documento no se pudo compilar.", info.registro ?? "");
  }
}

export type Desde = "latex" | "markdown";
export type Hacia = "docx" | "odt" | "html" | "markdown" | "latex";

export async function convertir(datos: Uint8Array, desde: Desde, hacia: Hacia): Promise<Uint8Array> {
  if (!isTauri) throw new Error(SIN_PANDOC);
  try {
    return deBase64(await invoke<string>("doc_pandoc", { datos: aBase64(datos), desde, hacia }));
  } catch (e) {
    throw new Error(String(e));
  }
}
