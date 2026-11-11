// Guardado de las bases de datos de CoffeeDataBase.
//
// En el escritorio se trabaja con el archivo real (.cdb, .db o .sqlite): al
// guardar se reescribe entero. Las bases nuevas van a la bóveda
// (Documentos\CoffeeWorks). En el navegador se guardan en IndexedDB.

import { baseName, isTauri, readFileBytes, registerRecent, vaultPath, writeFileBytes } from "./desktop";

export const APP_ID = "coffeedatabase";
export const DEFAULT_TITLE = "Mi base de datos";
export const EXTENSION = "cdb";
export const OPEN_FILTERS = [{ name: "Bases de datos (CoffeeDataBase, SQLite)", extensions: ["cdb", "db", "sqlite", "sqlite3"] }];
export const IMPORT_FILTERS = {
  csv: [{ name: "Texto separado por comas", extensions: ["csv", "txt", "tsv"] }],
  excel: [{ name: "Libros de Excel", extensions: ["xlsx", "xls", "ods"] }],
  desktop: [{ name: "Bases de datos de escritorio", extensions: ["accdb", "mdb"] }],
  sql: [{ name: "Script SQL", extensions: ["sql"] }],
};

let counter = 0;
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface WebEntry {
  id: string;
  name: string;
  bytes: Uint8Array;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("coffeedatabase", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function webPut(entry: WebEntry) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function webGet(id: string): Promise<WebEntry | null> {
  const db = await openDb();
  const entry = await new Promise<WebEntry | null>((resolve, reject) => {
    const request = db.transaction("files", "readonly").objectStore("files").get(id);
    request.onsuccess = () => resolve((request.result as WebEntry) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return entry;
}

export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  location: string | null;
  docId: string;
}

export async function openPath(path: string, docId = newId("cdb")): Promise<OpenedFile> {
  return { name: baseName(path), bytes: await readFileBytes(path), location: path, docId };
}

export async function openWebEntry(id: string): Promise<OpenedFile | null> {
  const entry = await webGet(id);
  return entry ? { name: entry.name, bytes: entry.bytes, location: `web:${id}`, docId: id } : null;
}

export const ensureExtension = (title: string, location: string | null) => {
  const clean = title.trim() || DEFAULT_TITLE;
  // Un archivo .db o .sqlite abierto conserva su extensión
  const current = location && !location.startsWith("web:") ? /\.([a-z0-9]+)$/i.exec(location)?.[1] : null;
  const ext = current && ["db", "sqlite", "sqlite3", "cdb"].includes(current.toLowerCase()) ? current : EXTENSION;
  return new RegExp(`\\.${ext}$`, "i").test(clean) ? clean : `${clean}.${ext}`;
};

export async function persistDb(bytes: Uint8Array, title: string, docId: string, location: string | null, pinned = false): Promise<string> {
  const fileName = ensureExtension(title, location);
  const entry = {
    id: docId,
    name: fileName,
    app_id: APP_ID,
    category: "Base de datos",
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
  await webPut({ id: docId, name: fileName, bytes });
  await registerRecent({ ...entry, path: `web:${docId}` });
  return `web:${docId}`;
}

export async function rememberOpened(file: OpenedFile): Promise<void> {
  if (!file.location) return;
  await registerRecent({
    id: file.docId,
    name: file.name,
    app_id: APP_ID,
    category: "Base de datos",
    last_modified: "",
    is_pinned: false,
    path: file.location,
    updated_at: Date.now(),
  });
}
