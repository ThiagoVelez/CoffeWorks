// Lo que necesita la app de escritorio: LibreOffice (Office → PDF) y el OCR (Tesseract).

import { invoke } from "@tauri-apps/api/core";
import { base64ToBytes, bytesToBase64, isTauri } from "../services/desktop";

export interface AddonInfo {
  id: string;
  name: string;
  installed: boolean;
  can_install: boolean;
  manual_hint: string;
  download_size: string;
}

export async function addonStatus(id: string): Promise<AddonInfo | null> {
  if (!isTauri) return null;
  try {
    return await invoke<AddonInfo>("core_addon_status", { id });
  } catch {
    return null;
  }
}

export async function installAddon(id: string): Promise<AddonInfo> {
  return invoke<AddonInfo>("core_addon_install", { id });
}

/** Word, Excel, PowerPoint, OpenDocument, RTF o EPUB → PDF (complemento LibreOffice). */
export async function officeToPdf(name: string, bytes: Uint8Array): Promise<Uint8Array> {
  if (!isTauri) throw new Error("La conversión de documentos de Office funciona en la app de escritorio.");
  return base64ToBytes(await invoke<string>("office_to_pdf", { fileName: name, data: bytesToBase64(bytes) }));
}

/** Texto de una imagen de página con el OCR (complemento «pdfcheck», español e inglés). */
export async function ocrImage(png: Uint8Array): Promise<string> {
  if (!isTauri) throw new Error("El OCR funciona en la app de escritorio.");
  return invoke<string>("core_addon_run_file", { id: "pdfcheck", args: ["{input}", "stdout", "-l", "spa+eng", "--psm", "3"], data: bytesToBase64(png), extension: "png" });
}
