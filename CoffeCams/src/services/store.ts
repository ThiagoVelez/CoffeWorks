// Almacenamiento y puente nativo de CoffeCams.
//
// Escritorio: los videos se leen del disco con el protocolo de recursos de
// Tauri (sin copiarlos en memoria) y las grabaciones/exportaciones se escriben
// por fragmentos con comandos nativos. Navegador: todo vive en IndexedDB.

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { baseName, isTauri, readFileText, registerRecent, vaultPath, writeFileText } from "./desktop";
import { newId, newProject, parseProject, serializeProject } from "./project";
import type { MediaItem, MediaKind, Project } from "../types";

export const APP_ID = "coffecams";
export const DEFAULT_TITLE = "Mi video";
export const EXTENSION = "ccm";
export const OPEN_FILTERS = [{ name: "Proyectos de CoffeCams", extensions: [EXTENSION] }];

export const VIDEO_EXT = ["mp4", "webm", "mov", "mkv", "m4v", "avi", "ogv"];
export const AUDIO_EXT = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "weba"];
export const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
export const MEDIA_FILTERS = [
  { name: "Videos, audio e imágenes", extensions: [...VIDEO_EXT, ...AUDIO_EXT, ...IMAGE_EXT] },
];

export function kindOf(name: string, mime = ""): MediaKind | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (mime.startsWith("video/") || VIDEO_EXT.includes(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXT.includes(ext)) return "audio";
  if (mime.startsWith("image/") || IMAGE_EXT.includes(ext)) return "image";
  return null;
}

// ---------------------------------------------------------------------------
// IndexedDB (modo navegador)
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("coffecams", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("projects", { keyPath: "id" });
      request.result.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = run(tx.objectStore(store));
      tx.oncomplete = () => resolve((request ? request.result : undefined) as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Sin espacio en el almacenamiento del navegador"));
    });
  } finally {
    db.close();
  }
}

const blobUrls = new Map<string, string>();

/** URL reproducible de un medio. */
export async function mediaUrl(item: MediaItem): Promise<string | null> {
  if (isTauri && item.path) return convertFileSrc(item.path);
  const cached = blobUrls.get(item.id);
  if (cached) return cached;
  const blob = await idb<Blob | undefined>("media", "readonly", (s) => s.get(item.id)).catch(() => undefined);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  blobUrls.set(item.id, url);
  return url;
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

  /** Termina el archivo. Devuelve la ruta (escritorio) o el Blob (navegador). */
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

const sep = (dir: string) => (dir.includes("\\") ? "\\" : "/");

export const stamp = () => {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};

/** Ruta nueva dentro de Videos\CoffeWorks (o null en el navegador). */
export async function newVideoPath(name: string, subfolder?: string): Promise<string | null> {
  const dir = await videosDir();
  if (!dir) return null;
  const s = sep(dir);
  const clean = name.replace(/[<>:"/\\|?*]/g, "-");
  return subfolder ? `${dir}${s}${subfolder}${s}${clean}` : `${dir}${s}${clean}`;
}

/**
 * Importa un archivo soltado o elegido en el navegador. En escritorio se copia
 * a Videos\CoffeWorks\Medios para poder reproducirlo desde el disco.
 */
export async function importBlob(file: File | Blob, name: string, kind: MediaKind): Promise<MediaItem> {
  const id = newId("med");
  if (isTauri) {
    const path = await newVideoPath(`${id.slice(-6)}-${name}`, "Medios");
    const writer = await ChunkWriter.open(path, file.type);
    const chunk = 8 << 20;
    for (let offset = 0; offset < file.size; offset += chunk) writer.append(file.slice(offset, offset + chunk));
    const result = await writer.close();
    return { id, name, kind, path: result.path, duration: 0, width: 0, height: 0 };
  }
  await idb("media", "readwrite", (s) => s.put(file, id));
  return { id, name, kind, path: null, duration: 0, width: 0, height: 0 };
}

/** Selector nativo: devuelve la ruta del archivo sin leerlo en memoria. */
export async function pickMediaPath(): Promise<string | null> {
  return invoke<string | null>("core_pick_open", { title: "Importar medios", filters: MEDIA_FILTERS });
}

export const mediaFromPath = (path: string): MediaItem | null => {
  const name = baseName(path);
  const kind = kindOf(name);
  return kind ? { id: newId("med"), name, kind, path, duration: 0, width: 0, height: 0 } : null;
};

/** Ruta elegida con «Guardar como» (escritorio). */
export async function pickSavePath(defaultName: string, extension: string, label: string): Promise<string | null> {
  const path = await invoke<string | null>("core_pick_save", {
    title: "Exportar video",
    defaultName,
    filters: [{ name: label, extensions: [extension] }],
  });
  if (!path) return null;
  return /\.[a-z0-9]+$/i.test(baseName(path)) ? path : `${path}.${extension}`;
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

/** Lista las cámaras y micrófonos (los nombres aparecen tras dar permiso). */
export async function listDevices(): Promise<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }> {
  const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []) ?? [];
  return {
    cameras: devices.filter((d) => d.kind === "videoinput"),
    mics: devices.filter((d) => d.kind === "audioinput"),
  };
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

export interface OpenedProject {
  name: string;
  project: Project;
  location: string | null;
  docId: string;
}

export async function openPath(path: string, docId = newId("ccm")): Promise<OpenedProject> {
  const text = await readFileText(path);
  const project = text.trim() ? parseProject(text) : newProject();
  return { name: baseName(path), project, location: path, docId };
}

export async function openWebEntry(id: string): Promise<OpenedProject | null> {
  const entry = await idb<{ id: string; name: string; text: string } | undefined>("projects", "readonly", (s) => s.get(id));
  return entry ? { name: entry.name, project: parseProject(entry.text), location: `web:${id}`, docId: id } : null;
}

export const ensureExtension = (title: string) => {
  const clean = title.trim() || DEFAULT_TITLE;
  return new RegExp(`\\.${EXTENSION}$`, "i").test(clean) ? clean : `${clean}.${EXTENSION}`;
};

export async function persistProject(
  project: Project,
  title: string,
  docId: string,
  location: string | null,
  pinned = false
): Promise<string> {
  const fileName = ensureExtension(title);
  const text = serializeProject(project);
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
  await idb("projects", "readwrite", (s) => s.put({ id: docId, name: fileName, text }));
  await registerRecent({ ...entry, path: `web:${docId}` });
  return `web:${docId}`;
}

export async function rememberOpened(file: OpenedProject): Promise<void> {
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
  can_install: boolean;
}

export const ffmpegStatus = () => invoke<FfmpegStatus>("cams_ffmpeg_status");
export const ffmpegInstall = () => invoke<FfmpegStatus>("cams_ffmpeg_install");

export const streamStart = (options: {
  server: string;
  key: string;
  fps: number;
  videoKbps: number;
  audioKbps: number;
}) => invoke<string>("cams_stream_start", options);

export const streamWrite = (data: Uint8Array) => invoke("cams_stream_write", data);
export const streamStop = () => invoke("cams_stream_stop");

export function onStreamEvents(
  onLog: (line: string) => void,
  onEnded: (ok: boolean, message: string) => void
): () => void {
  if (!isTauri) return () => undefined;
  const unlisten: Promise<UnlistenFn>[] = [
    listen<{ line: string }>("cams-stream-log", (e) => onLog(e.payload.line)),
    listen<{ ok: boolean; message: string }>("cams-stream-ended", (e) => onEnded(e.payload.ok, e.payload.message)),
  ];
  return () => unlisten.forEach((p) => void p.then((fn) => fn()));
}

export const openFolder = (path: string) => invoke("core_open_external", { target: path }).catch(() => undefined);
