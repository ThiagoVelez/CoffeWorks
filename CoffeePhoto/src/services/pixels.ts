// Almacén de píxeles: cada "ficha" identifica un lienzo inmutable.
//
// Las capas del documento guardan fichas en lugar de imágenes: deshacer y
// rehacer solo cambian la ficha (instantáneo) y las imágenes PNG se generan
// únicamente al guardar (y se recuerdan para no volver a codificarlas).

interface Entry {
  canvas: HTMLCanvasElement | null;
  url: string | null;
  used: number;
}

const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
let counter = 0;
const MAX_ENTRIES = 160;

const touch = (e: Entry) => (e.used = ++counter);

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const notify = () => listeners.forEach((fn) => fn());

export function newCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

/** Registra un lienzo (el almacén pasa a ser su dueño: no se debe modificar después). */
export function fromCanvas(canvas: HTMLCanvasElement): string {
  const token = `px${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  store.set(token, { canvas, url: null, used: counter });
  evict();
  return token;
}

/** Registra una imagen PNG/JPEG (data URL); se decodifica en segundo plano. */
export function fromDataUrl(url: string, width?: number, height?: number): string {
  const token = `px${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entry: Entry = { canvas: null, url, used: counter };
  store.set(token, entry);
  const img = new Image();
  img.onload = () => {
    const c = newCanvas(width ?? img.naturalWidth, height ?? img.naturalHeight);
    ctx2d(c).drawImage(img, 0, 0);
    entry.canvas = c;
    notify();
  };
  img.onerror = () => {
    entry.canvas = newCanvas(width ?? 1, height ?? 1);
    notify();
  };
  img.src = url;
  return token;
}

export function getCanvas(token: string | null | undefined): HTMLCanvasElement | null {
  if (!token) return null;
  const e = store.get(token);
  if (!e) return null;
  touch(e);
  return e.canvas;
}

export const isReady = (tokens: Array<string | null | undefined>) => tokens.every((t) => !t || !!store.get(t)?.canvas);

export function whenReady(tokens: Array<string | null | undefined>): Promise<void> {
  if (isReady(tokens)) return Promise.resolve();
  return new Promise((resolve) => {
    const off = subscribe(() => {
      if (isReady(tokens)) {
        off();
        resolve();
      }
    });
  });
}

/** PNG de la ficha (se recuerda para no volver a codificarlo). */
export function toDataUrl(token: string): string {
  const e = store.get(token);
  if (!e) return "";
  if (!e.url && e.canvas) e.url = e.canvas.toDataURL("image/png");
  return e.url || "";
}

/** Copia editable del lienzo de una ficha. */
export function cloneCanvas(token: string, width: number, height: number): HTMLCanvasElement {
  const c = newCanvas(width, height);
  const src = getCanvas(token);
  if (src) ctx2d(c).drawImage(src, 0, 0);
  return c;
}

/** Libera las fichas menos usadas que no estén en uso (`keep`). */
let keepFn: () => Set<string> = () => new Set();
export function setKeep(fn: () => Set<string>) {
  keepFn = fn;
}

function evict() {
  if (store.size <= MAX_ENTRIES) return;
  const keep = keepFn();
  const entries = [...store.entries()].filter(([t]) => !keep.has(t)).sort((a, b) => a[1].used - b[1].used);
  for (const [t] of entries.slice(0, store.size - MAX_ENTRIES)) store.delete(t);
}
