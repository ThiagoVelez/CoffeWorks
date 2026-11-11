// Guardado de los cuadernos de CoffeePage (.cpg).
//
// En el ejecutable se trabaja con archivos reales: el cuaderno abierto se
// sobrescribe al guardar y los nuevos van a la bóveda (Documentos\CoffeeWorks).
// En el navegador (modo de desarrollo) se guardan en IndexedDB.

import { baseName, isTauri, readFileText, registerRecent, vaultPath, writeFileText } from "./desktop";
import { newId, newNotebook, parseNotebook, serializeNotebook } from "./notebook";
import type { Notebook } from "../types";

export const APP_ID = "coffeepage";
export const DEFAULT_TITLE = "Mi cuaderno";
export const EXTENSION = "cpg";
export const OPEN_FILTERS = [{ name: "Cuadernos de CoffeePage", extensions: [EXTENSION] }];
export const IMAGE_FILTERS = [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }];

interface WebEntry {
  id: string;
  name: string;
  text: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("coffeepage", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("notebooks", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function webPut(entry: WebEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("notebooks", "readwrite");
    tx.objectStore("notebooks").put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function webGet(id: string): Promise<WebEntry | null> {
  const db = await openDb();
  const entry = await new Promise<WebEntry | null>((resolve, reject) => {
    const request = db.transaction("notebooks", "readonly").objectStore("notebooks").get(id);
    request.onsuccess = () => resolve((request.result as WebEntry) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return entry;
}

export interface OpenedNotebook {
  name: string;
  notebook: Notebook;
  location: string | null;
  docId: string;
}

export async function openPath(path: string, docId = newId("cpg")): Promise<OpenedNotebook> {
  const text = await readFileText(path);
  // Un archivo vacío (creado por el Launcher) es un cuaderno nuevo
  const notebook = text.trim() ? parseNotebook(text) : newNotebook();
  return { name: baseName(path), notebook, location: path, docId };
}

export async function openWebEntry(id: string): Promise<OpenedNotebook | null> {
  const entry = await webGet(id);
  return entry ? { name: entry.name, notebook: parseNotebook(entry.text), location: `web:${id}`, docId: id } : null;
}

export const ensureExtension = (title: string) => {
  const clean = title.trim() || DEFAULT_TITLE;
  return new RegExp(`\\.${EXTENSION}$`, "i").test(clean) ? clean : `${clean}.${EXTENSION}`;
};

/** Guarda el cuaderno y devuelve su ubicación final. */
export async function persistNotebook(
  notebook: Notebook,
  title: string,
  docId: string,
  location: string | null,
  pinned = false
): Promise<string> {
  const fileName = ensureExtension(title);
  const text = serializeNotebook(notebook);
  const entry = {
    id: docId,
    name: fileName,
    app_id: APP_ID,
    category: "Notas",
    last_modified: "",
    is_pinned: pinned,
    path: "",
    updated_at: Date.now(),
  };

  if (isTauri) {
    const path = location && !location.startsWith("web:") ? location : await vaultPath(fileName, docId);
    await writeFileText(path, text);
    await registerRecent({ ...entry, name: baseName(path), path });
    return path;
  }

  await webPut({ id: docId, name: fileName, text, updatedAt: Date.now() });
  await registerRecent({ ...entry, path: `web:${docId}` });
  return `web:${docId}`;
}

export async function rememberOpened(file: OpenedNotebook): Promise<void> {
  if (!file.location) return;
  await registerRecent({
    id: file.docId,
    name: file.name,
    app_id: APP_ID,
    category: "Notas",
    last_modified: "",
    is_pinned: false,
    path: file.location,
    updated_at: Date.now(),
  });
}
