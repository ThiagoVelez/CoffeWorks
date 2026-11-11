// Guardado de los PDF de CoffePDF.
//
// En el ejecutable se trabaja con archivos .pdf reales: el PDF abierto se
// sobrescribe al guardar y los nuevos van a la bóveda (Documentos\CoffeWorks).
// En el navegador (modo de desarrollo) los PDF se guardan en IndexedDB.

import {
  baseName,
  isTauri,
  readFileBytes,
  registerRecent,
  vaultPath,
  writeFileBytes,
} from "./desktop";
import { newId } from "./geometry";

export const APP_ID = "coffepdf";
export const DEFAULT_TITLE = "Documento PDF";

export const OPEN_FILTERS = [{ name: "Documentos PDF", extensions: ["pdf"] }];
export const IMAGE_FILTERS = [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }];

// ---------------------------------------------------------------------------
// IndexedDB (solo modo web)
// ---------------------------------------------------------------------------

interface WebEntry {
  id: string;
  name: string;
  bytes: Uint8Array;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("coffepdf", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function webPut(entry: WebEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function webGet(id: string): Promise<WebEntry | null> {
  const db = await openDb();
  const entry = await new Promise<WebEntry | null>((resolve, reject) => {
    const request = db.transaction("files", "readonly").objectStore("files").get(id);
    request.onsuccess = () => resolve((request.result as WebEntry) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return entry;
}

// ---------------------------------------------------------------------------
// Abrir y guardar
// ---------------------------------------------------------------------------

export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  /** Ruta en disco (escritorio) o `web:<id>` (navegador). */
  location: string | null;
  docId: string;
}

export async function openPath(path: string, docId = newId("pdf")): Promise<OpenedFile> {
  const bytes = await readFileBytes(path);
  return { name: baseName(path), bytes, location: path, docId };
}

export async function openWebEntry(id: string): Promise<OpenedFile | null> {
  const entry = await webGet(id);
  return entry ? { name: entry.name, bytes: entry.bytes, location: `web:${id}`, docId: id } : null;
}

const ensurePdfName = (title: string) => {
  const clean = title.trim() || DEFAULT_TITLE;
  return /\.pdf$/i.test(clean) ? clean : `${clean}.pdf`;
};

/**
 * Guarda el PDF. Si ya tiene ubicación la sobrescribe; si no, lo crea en la
 * bóveda con el título indicado. Devuelve la ubicación final.
 */
export async function persistPdf(
  bytes: Uint8Array,
  title: string,
  docId: string,
  location: string | null,
  pinned = false
): Promise<string> {
  const fileName = ensurePdfName(title);
  const entry = {
    id: docId,
    name: fileName,
    app_id: APP_ID,
    category: "PDF",
    last_modified: "",
    is_pinned: pinned,
    path: "",
    updated_at: Date.now(),
  };

  if (isTauri) {
    const path = location && !location.startsWith("web:") ? location : await vaultPath(fileName, docId);
    await writeFileBytes(path, bytes);
    await registerRecent({ ...entry, name: baseName(path), path });
    return path;
  }

  await webPut({ id: docId, name: fileName, bytes, updatedAt: Date.now() });
  await registerRecent({ ...entry, path: `web:${docId}` });
  return `web:${docId}`;
}

/** Anota en los recientes un PDF recién abierto desde el disco. */
export async function rememberOpened(file: OpenedFile): Promise<void> {
  if (!file.location) return;
  await registerRecent({
    id: file.docId,
    name: file.name,
    app_id: APP_ID,
    category: "PDF",
    last_modified: "",
    is_pinned: false,
    path: file.location,
    updated_at: Date.now(),
  });
}
