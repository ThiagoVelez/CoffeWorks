// Guardado de documentos de las apps de Ilustración: archivo en la bóveda
// (escritorio) o IndexedDB (navegador), y registro en los recientes del Launcher.

import { baseName, isTauri, readFileText, registerRecent, vaultPath, writeFileText } from "./desktop";
import { newId } from "./color";

export interface StoreConfig<T> {
  appId: string;
  extension: string;
  category: string;
  defaultTitle: string;
  kindLabel: string;
  serialize: (doc: T) => string;
  parse: (text: string) => T;
  create: () => T;
}

export interface OpenedDocument<T> {
  name: string;
  doc: T;
  location: string | null;
  docId: string;
}

export function createDocStore<T>(config: StoreConfig<T>) {
  const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(config.appId, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("docs", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  async function idb<R>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest | void): Promise<R> {
    const db = await openDb();
    try {
      return await new Promise<R>((resolve, reject) => {
        const tx = db.transaction("docs", mode);
        const request = run(tx.objectStore("docs"));
        tx.oncomplete = () => resolve((request ? request.result : undefined) as R);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  const ensureExtension = (title: string) => {
    const clean = title.trim() || config.defaultTitle;
    return new RegExp(`\\.${config.extension}$`, "i").test(clean) ? clean : `${clean}.${config.extension}`;
  };

  return {
    ...config,
    OPEN_FILTERS: [{ name: config.kindLabel, extensions: [config.extension] }],
    newDocId: () => newId(config.extension),
    ensureExtension,

    async openPath(path: string, docId = newId(config.extension)): Promise<OpenedDocument<T>> {
      const text = await readFileText(path);
      const doc = text.trim() ? config.parse(text) : config.create();
      return { name: baseName(path), doc, location: path, docId };
    },

    async openWebEntry(id: string): Promise<OpenedDocument<T> | null> {
      const entry = await idb<{ id: string; name: string; text: string } | undefined>("readonly", (s) => s.get(id));
      return entry ? { name: entry.name, doc: config.parse(entry.text), location: `web:${id}`, docId: id } : null;
    },

    async persist(doc: T, title: string, docId: string, location: string | null, pinned = false): Promise<string> {
      const fileName = ensureExtension(title);
      const text = config.serialize(doc);
      const entry = { id: docId, name: fileName, app_id: config.appId, category: config.category, last_modified: "", is_pinned: pinned, path: "", updated_at: Date.now() };
      if (isTauri) {
        const path = location && !location.startsWith("web:") ? location : await vaultPath(fileName, docId);
        await writeFileText(path, text);
        await registerRecent({ ...entry, name: baseName(path), path });
        return path;
      }
      await idb("readwrite", (s) => s.put({ id: docId, name: fileName, text }));
      await registerRecent({ ...entry, path: `web:${docId}` });
      return `web:${docId}`;
    },

    async remember(file: OpenedDocument<T>): Promise<void> {
      if (!file.location) return;
      await registerRecent({ id: file.docId, name: file.name, app_id: config.appId, category: config.category, last_modified: "", is_pinned: false, path: file.location, updated_at: Date.now() });
    },
  };
}

/** Descarga un archivo en el navegador. */
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
