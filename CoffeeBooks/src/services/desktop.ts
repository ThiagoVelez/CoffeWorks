// Puente con el escritorio (Tauri) con alternativa para navegador web.
//
// Las tres aplicaciones de la suite comparten este archivo. Cuando la
// aplicación se ejecuta como .exe usa los comandos nativos de `coffee-core`
// (archivos reales, diálogos del sistema, bóveda en Documentos\CoffeeWorks).
// En el navegador (npm run dev) recurre a localStorage, descargas y al
// endpoint /api/vault del Launcher para que todo siga funcionando.

import { invoke } from "@tauri-apps/api/core";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** URL del Launcher en modo desarrollo web. */
const LAUNCHER_DEV_URL = "http://localhost:1420";
const RECENT_KEY = "coffeeworks_recent_docs";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PickedFile {
  name: string;
  /** Ruta absoluta en disco; `null` cuando se ejecuta en el navegador. */
  path: string | null;
  bytes: Uint8Array;
}

export interface RecentEntry {
  id: string;
  name: string;
  app_id: string;
  category: string;
  last_modified: string;
  is_pinned: boolean;
  path: string;
  updated_at: number;
}

export interface LaunchArgs {
  /** Archivo que hay que abrir al iniciar (ruta en disco). */
  file: string | null;
  /** Título de un documento nuevo solicitado por el Launcher. */
  newTitle: string | null;
  /** Identificador de un documento guardado en el navegador (modo web). */
  docId: string | null;
  /** Contenido de un documento enviado por el Launcher (plantillas, modo web). */
  payload: string | null;
}

// ---------------------------------------------------------------------------
// Utilidades binarias
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

async function toBytes(data: Uint8Array | string | Blob): Promise<Uint8Array> {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return data;
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}

export function extensionOf(name: string): string {
  const match = /\.([^./\\]+)$/.exec(name);
  return match ? match[1].toLowerCase() : "";
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

export async function getLaunchArgs(): Promise<LaunchArgs> {
  if (isTauri) {
    try {
      const args = await invoke<{ file: string | null; new_title: string | null }>(
        "core_launch_args"
      );
      return { file: args.file, newTitle: args.new_title, docId: null, payload: null };
    } catch (err) {
      console.warn("No se pudieron leer los argumentos de arranque:", err);
    }
    return { file: null, newTitle: null, docId: null, payload: null };
  }
  const params = new URLSearchParams(window.location.search);
  let payload: string | null = null;
  if (window.location.hash.startsWith("#cfw=")) {
    try {
      payload = decodeURIComponent(window.location.hash.slice(5));
    } catch {
      payload = null;
    }
    // Se limpia la dirección para que recargar no vuelva a crear el documento
    window.history.replaceState(null, "", window.location.pathname);
  }
  return {
    file: null,
    newTitle: params.get("new"),
    docId: params.get("doc"),
    payload,
  };
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

export async function readFileBytes(path: string): Promise<Uint8Array> {
  const base64 = await invoke<string>("core_read_binary", { path });
  return base64ToBytes(base64);
}

export async function readFileText(path: string): Promise<string> {
  return invoke<string>("core_read_text", { path });
}

export async function writeFileText(path: string, contents: string): Promise<void> {
  await invoke("core_write_text", { path, contents });
}

export async function writeFileBytes(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("core_write_binary", { path, data: bytesToBase64(bytes) });
}

/** Ruta dentro de la bóveda donde guardar un documento nuevo. */
export async function vaultPath(fileName: string, docId: string): Promise<string> {
  return invoke<string>("core_vault_path", { fileName, docId });
}

/** Renombra el archivo si vive en la bóveda y su título cambió. */
export async function renameInVault(
  path: string,
  fileName: string,
  docId: string
): Promise<string> {
  return invoke<string>("core_rename_in_vault", { path, fileName, docId });
}

/** Abre el selector de archivos del sistema y devuelve el archivo elegido. */
export async function pickOpenFile(
  filters: FileFilter[],
  title = "Abrir archivo"
): Promise<PickedFile | null> {
  if (isTauri) {
    const path = await invoke<string | null>("core_pick_open", { title, filters });
    if (!path) return null;
    const bytes = await readFileBytes(path);
    return { name: baseName(path), path, bytes };
  }

  return new Promise<PickedFile | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = filters
      .flatMap((f) => f.extensions)
      .map((ext) => `.${ext}`)
      .join(",");
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      resolve({ name: file.name, path: null, bytes });
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Selector de varios archivos (importar fotos). */
export async function pickOpenFiles(filters: FileFilter[], title = "Abrir archivos"): Promise<PickedFile[]> {
  if (isTauri) {
    const paths = await invoke<string[]>("core_pick_open_many", { title, filters });
    const out: PickedFile[] = [];
    for (const path of paths) out.push({ name: baseName(path), path, bytes: await readFileBytes(path) });
    return out;
  }
  return new Promise<PickedFile[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = filters.flatMap((f) => f.extensions).map((ext) => `.${ext}`).join(",");
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const files = [...(input.files || [])];
      input.remove();
      resolve(await Promise.all(files.map(async (f) => ({ name: f.name, path: null, bytes: new Uint8Array(await f.arrayBuffer()) }))));
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Convierte un `File` del navegador (arrastrar y soltar) en `PickedFile`. */
export async function pickedFromFile(file: File): Promise<PickedFile> {
  return { name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/**
 * Guarda datos con el diálogo "Guardar como" del sistema (o como descarga en
 * el navegador). Devuelve la ruta elegida, o `null` si el usuario canceló.
 * En el navegador devuelve una cadena vacía porque no existe ruta en disco.
 */
export async function saveFileAs(
  defaultName: string,
  filters: FileFilter[],
  data: Uint8Array | string | Blob,
  title = "Guardar como"
): Promise<string | null> {
  const bytes = await toBytes(data);

  if (isTauri) {
    let path = await invoke<string | null>("core_pick_save", {
      title,
      defaultName,
      filters,
    });
    if (!path) return null;
    const wanted = filters[0]?.extensions[0];
    if (wanted && !extensionOf(path)) {
      path = `${path}.${wanted}`;
    }
    await writeFileBytes(path, bytes);
    return path;
  }

  const blob = new Blob([bytes as BlobPart]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "";
}

// ---------------------------------------------------------------------------
// Documentos recientes (compartidos con el Launcher)
// ---------------------------------------------------------------------------

function readLocalRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function registerRecent(entry: RecentEntry): Promise<void> {
  if (isTauri) {
    try {
      await invoke("core_register_recent", { doc: entry });
    } catch (err) {
      console.warn("No se pudo registrar el documento reciente:", err);
    }
    return;
  }

  const docs = readLocalRecent();
  const existing = docs.find((d) => d.id === entry.id);
  const merged = { ...entry, is_pinned: existing?.is_pinned ?? entry.is_pinned };
  const next = [merged, ...docs.filter((d) => d.id !== entry.id)];
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Almacenamiento lleno: el índice de recientes es prescindible.
  }
  fetch(`${LAUNCHER_DEV_URL}/api/vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(merged),
  }).catch(() => {
    // El Launcher no está abierto: no pasa nada.
  });
}

export async function listRecent(appId: string): Promise<RecentEntry[]> {
  let docs: RecentEntry[] = [];
  if (isTauri) {
    try {
      docs = await invoke<RecentEntry[]>("core_list_recent");
    } catch {
      docs = [];
    }
  } else {
    docs = readLocalRecent();
  }
  // Los documentos de la versión anterior usan "coffedoc", "coffecalc"...
  return docs.filter((d) => (d.app_id || "").toLowerCase().replace(/^coffe(?!e)/, "coffee") === appId);
}

/** Fija o desfija el documento en la lista de recientes del Launcher. */
export async function setPinned(id: string, pinned: boolean): Promise<void> {
  if (isTauri) {
    await invoke("core_set_pinned", { id, pinned }).catch(() => undefined);
    return;
  }
  const docs = readLocalRecent().map((d) => (d.id === id ? { ...d, is_pinned: pinned } : d));
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(docs));
  } catch {
    // Sin espacio: se ignora.
  }
  const entry = docs.find((d) => d.id === id);
  if (entry) {
    fetch(`${LAUNCHER_DEV_URL}/api/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => undefined);
  }
}

/** Texto relativo ("hace 5 min") para una marca de tiempo. */
export function relativeTime(timestamp: number): string {
  if (!timestamp) return "";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "hace un momento";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  return new Date(timestamp).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Ventana y sistema
// ---------------------------------------------------------------------------

/** Ejecuta una orden de ventana sin dejar errores sin capturar. */
async function windowCommand(command: string, args?: Record<string, unknown>): Promise<void> {
  try {
    await invoke(command, args);
  } catch (err) {
    console.warn(`No se pudo ejecutar ${command}:`, err);
  }
}

export const appWindow = {
  async minimize(): Promise<void> {
    if (isTauri) await windowCommand("core_window_minimize");
  },
  async toggleMaximize(): Promise<void> {
    if (isTauri) {
      await windowCommand("core_window_toggle_maximize");
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
  },
  async setFullscreen(fullscreen: boolean): Promise<void> {
    if (isTauri) {
      await windowCommand("core_window_set_fullscreen", { fullscreen });
      return;
    }
    if (fullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    } else if (!fullscreen && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
  },
  async close(): Promise<void> {
    if (isTauri) {
      await windowCommand("core_window_close");
    } else {
      window.close();
    }
  },
  async setTitle(title: string): Promise<void> {
    document.title = title;
    if (isTauri) await windowCommand("core_window_set_title", { title });
  },
};

/** Abre una URL o carpeta con el programa predeterminado del sistema. */
export async function openExternal(target: string): Promise<void> {
  if (isTauri) {
    await invoke("core_open_external", { target });
  } else {
    window.open(target, "_blank", "noopener");
  }
}
