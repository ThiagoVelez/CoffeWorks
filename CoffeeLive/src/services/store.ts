// Almacenamiento y puente nativo de CoffeeLive.
//
// Escritorio: las grabaciones se escriben por fragmentos en el disco y la
// transmisión pasa por ffmpeg. Navegador: las colecciones viven en IndexedDB
// y las grabaciones se descargan al terminar.

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { baseName, isTauri, readFileText, registerRecent, vaultPath, writeFileText } from "./desktop";
import { newDocument, newId, parseDocument, serializeDocument } from "./live";
import type { LiveDocument } from "../types";

export const APP_ID = "coffeelive";
export const DEFAULT_TITLE = "Mi directo";
export const EXTENSION = "clv";
export const OPEN_FILTERS = [{ name: "Colecciones de escenas de CoffeeLive", extensions: [EXTENSION] }];
export const IMAGE_FILTERS = [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }];
export const MEDIA_FILTERS = [{ name: "Video o audio", extensions: ["mp4", "webm", "mov", "mkv", "mp3", "wav", "ogg", "m4a"] }];

// ---------------------------------------------------------------------------
// IndexedDB (modo navegador)
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("coffeelive", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("collections", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("collections", mode);
      const request = run(tx.objectStore("collections"));
      tx.oncomplete = () => resolve((request ? request.result : undefined) as T);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Escritura por fragmentos
// ---------------------------------------------------------------------------

/** Escribe un archivo grande por partes, en orden. En el navegador junta un Blob. */
export class ChunkWriter {
  private handle: number | null = null;
  private queue: Promise<void> = Promise.resolve();
  private parts: Blob[] = [];
  private failed: Error | null = null;
  bytes = 0;

  private constructor(public readonly path: string | null, private readonly mime: string) {}

  static async open(path: string | null, mime: string): Promise<ChunkWriter> {
    const writer = new ChunkWriter(path, mime);
    if (isTauri && path) writer.handle = await invoke<number>("cams_file_open", { path });
    return writer;
  }

  get error(): Error | null {
    return this.failed;
  }

  append(blob: Blob): void {
    if (blob.size === 0) return;
    this.bytes += blob.size;
    if (this.handle === null) {
      this.parts.push(blob);
      return;
    }
    const handle = this.handle;
    this.queue = this.queue.then(async () => {
      if (this.failed) return;
      try {
        const data = new Uint8Array(await blob.arrayBuffer());
        await invoke("cams_file_append", data, { headers: { "x-handle": String(handle) } });
      } catch (err) {
        this.failed = err instanceof Error ? err : new Error(String(err));
      }
    });
  }

  async close(discard = false): Promise<{ path: string | null; blob: Blob | null }> {
    await this.queue;
    if (this.handle !== null) {
      const path = await invoke<string>("cams_file_close", { handle: this.handle, discard });
      this.handle = null;
      if (this.failed && !discard) throw this.failed;
      return { path: discard ? null : path, blob: null };
    }
    return { path: null, blob: discard ? null : new Blob(this.parts, { type: this.mime }) };
  }
}

export async function videosDir(): Promise<string | null> {
  return isTauri ? invoke<string>("cams_videos_dir") : null;
}

/** Ruta de una grabación nueva (carpeta elegida o Videos\CoffeeWorks). */
export async function recordingPath(fileName: string, folder: string | null): Promise<string | null> {
  if (!isTauri) return null;
  const dir = folder || (await videosDir());
  if (!dir) return null;
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${sep}${fileName}`;
}

export async function pickFolder(): Promise<string | null> {
  return isTauri ? invoke<string | null>("live_pick_folder") : null;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** URL reproducible de un archivo del disco (fuentes de video o audio). */
export const fileUrl = (path: string) => (isTauri ? convertFileSrc(path) : path);

/** Selector nativo: devuelve la ruta sin leer el archivo. */
export async function pickMediaPath(): Promise<string | null> {
  return invoke<string | null>("core_pick_open", { title: "Elegir video o audio", filters: MEDIA_FILTERS });
}

export async function listDevices(): Promise<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }> {
  const devices = (await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])) ?? [];
  return {
    cameras: devices.filter((d) => d.kind === "videoinput"),
    mics: devices.filter((d) => d.kind === "audioinput"),
  };
}

/** Abre una grabación en CoffeeEdit (si está instalado). */
export async function openInEditor(path: string): Promise<void> {
  await invoke("live_open_in_editor", { path });
}

export const openFolder = (path: string) => invoke("core_open_external", { target: path }).catch(() => undefined);

// ---------------------------------------------------------------------------
// Colecciones de escenas
// ---------------------------------------------------------------------------

export interface OpenedDocument {
  name: string;
  doc: LiveDocument;
  location: string | null;
  docId: string;
}

export async function openPath(path: string, docId = newId("clv")): Promise<OpenedDocument> {
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

export async function persistDocument(doc: LiveDocument, title: string, docId: string, location: string | null, pinned = false): Promise<string> {
  const fileName = ensureExtension(title);
  const text = serializeDocument(doc);
  const entry = {
    id: docId,
    name: fileName,
    app_id: APP_ID,
    category: "Multimedia",
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
  await idb("readwrite", (s) => s.put({ id: docId, name: fileName, text }));
  await registerRecent({ ...entry, path: `web:${docId}` });
  return `web:${docId}`;
}

export async function rememberOpened(file: OpenedDocument): Promise<void> {
  if (!file.location) return;
  await registerRecent({
    id: file.docId,
    name: file.name,
    app_id: APP_ID,
    category: "Multimedia",
    last_modified: "",
    is_pinned: false,
    path: file.location,
    updated_at: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// ffmpeg y transmisión (solo escritorio)
// ---------------------------------------------------------------------------

export interface FfmpegStatus {
  available: boolean;
  path: string;
  version: string;
  encoder: string;
  hardware: string;
  can_install: boolean;
}

export const ffmpegStatus = () => invoke<FfmpegStatus>("cams_ffmpeg_status");
export const ffmpegInstall = () => invoke<FfmpegStatus>("cams_ffmpeg_install");

export interface StreamOptions {
  server: string;
  key: string;
  fps: number;
  videoKbps: number;
  audioKbps: number;
  encoder: "auto" | "x264" | "hardware";
  rateControl: "cbr" | "vbr";
  preset: string;
  profile: string;
  keyframeSec: number;
  outWidth: number;
  outHeight: number;
  downscale: string;
  sampleRate: number;
  channels: number;
}

export const streamStart = (options: StreamOptions) => invoke<string>("cams_stream_start", { options });
export const streamWrite = (data: Uint8Array) => invoke("cams_stream_write", data);
export const streamStop = () => invoke("cams_stream_stop");

export function onStreamEvents(onLog: (line: string) => void, onEnded: (ok: boolean, message: string) => void): () => void {
  if (!isTauri) return () => undefined;
  const unlisten: Promise<UnlistenFn>[] = [
    listen<{ line: string }>("cams-stream-log", (e) => onLog(e.payload.line)),
    listen<{ ok: boolean; message: string }>("cams-stream-ended", (e) => onEnded(e.payload.ok, e.payload.message)),
  ];
  return () => unlisten.forEach((p) => void p.then((fn) => fn()));
}
