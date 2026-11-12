// Guardado de Modelos de CoffeeUML: archivos .cuml en la bóveda (escritorio) o en
// IndexedDB (navegador), y registro en los recientes del Launcher.

import { baseName, isTauri, readFileText, registerRecent, vaultPath, writeFileText } from "./desktop";
import { newDocument, newId, parseDocument, serializeDocument } from "./model";
import type { DiagramDocument } from "../types";

export const APP_ID = "coffeeuml";
export const DEFAULT_TITLE = "Mi modelo";
export const EXTENSION = "cuml";
export const CATEGORY = "Desarrollador";
export const OPEN_FILTERS = [{ name: "Modelos de CoffeeUML", extensions: [EXTENSION] }];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("coffeeuml", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("docs", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("docs", mode);
      const request = run(tx.objectStore("docs"));
      tx.oncomplete = () => resolve((request ? request.result : undefined) as T);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export interface OpenedDocument {
  name: string;
  doc: DiagramDocument;
  location: string | null;
  docId: string;
}

export async function openPath(path: string, docId = newId("cuml")): Promise<OpenedDocument> {
  const text = await readFileText(path);
  const doc = text.trim() ? parseDocument(text) : newDocument();
  return { name: baseName(path), doc, location: path, docId };
}

export async function openWebEntry(id: string): Promise<OpenedDocument | null> {
  const entry = await idb<{ id: string; name: string; text: string } | undefined>("readonly", (s) => s.get(id));
  return entry ? { name: entry.name, doc: parseDocument(entry.text), location: `web:${id}`, docId: id } : null;
}

export const ensureExtension = (title: string) => {
  const clean = title.trim() || DEFAULT_TITLE;
  return new RegExp(`\\.${EXTENSION}$`, "i").test(clean) ? clean : `${clean}.${EXTENSION}`;
};

export async function persistDocument(doc: DiagramDocument, title: string, docId: string, location: string | null, pinned = false): Promise<string> {
  const fileName = ensureExtension(title);
  const text = serializeDocument(doc);
  const entry = { id: docId, name: fileName, app_id: APP_ID, category: CATEGORY, last_modified: "", is_pinned: pinned, path: "", updated_at: Date.now() };
  if (isTauri) {
    const path = location && !location.startsWith("web:") ? location : await vaultPath(fileName, docId);
    await writeFileText(path, text);
    await registerRecent({ ...entry, name: baseName(path), path });
    return path;
  }
  await idb("readwrite", (s) => s.put({ id: docId, name: fileName, text }));
  await registerRecent({ ...entry, path: `web:${docId}` });
  return `web:${docId}`;
}

export async function rememberOpened(file: OpenedDocument): Promise<void> {
  if (!file.location) return;
  await registerRecent({ id: file.docId, name: file.name, app_id: APP_ID, category: CATEGORY, last_modified: "", is_pinned: false, path: file.location, updated_at: Date.now() });
}

/** Descarga un archivo en el navegador o lo guarda con el diálogo del sistema. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
