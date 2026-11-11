// Utilidades multimedia: analizar archivos, reloj en segundo plano y formatos
// de grabación.

import type { MediaKind } from "../types";

export interface Probe {
  duration: number;
  width: number;
  height: number;
  thumbnail: string | null;
}

const once = <T extends Event>(target: EventTarget, ok: string, fail = "error", ms = 15000) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("El archivo tardó demasiado en cargar"));
    }, ms);
    const onOk = (e: Event) => {
      cleanup();
      resolve(e as T);
    };
    const onFail = () => {
      cleanup();
      reject(new Error("El formato del archivo no es compatible"));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(ok, onOk);
      target.removeEventListener(fail, onFail);
    };
    target.addEventListener(ok, onOk);
    target.addEventListener(fail, onFail);
  });

function snapshot(source: CanvasImageSource, width: number, height: number): string | null {
  try {
    const w = 192;
    const h = Math.max(1, Math.round((height / Math.max(1, width)) * w)) || 108;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = Math.min(h, 192);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

/** Duración, tamaño y miniatura de un archivo. */
export async function probeMedia(url: string, kind: MediaKind): Promise<Probe> {
  if (kind === "image") {
    const img = new Image();
    img.src = url;
    await once(img, "load");
    return { duration: 0, width: img.naturalWidth, height: img.naturalHeight, thumbnail: snapshot(img, img.naturalWidth, img.naturalHeight) };
  }
  const el = document.createElement(kind === "video" ? "video" : "audio");
  el.preload = "auto";
  el.muted = true;
  el.src = url;
  await once(el, "loadedmetadata");
  let duration = el.duration;
  // Los WebM grabados en el navegador no indican su duración: se busca el final
  if (!Number.isFinite(duration)) {
    el.currentTime = 1e9;
    await once(el, "durationchange", "error", 8000).catch(() => undefined);
    duration = Number.isFinite(el.duration) ? el.duration : 0;
    el.currentTime = 0;
  }
  if (kind === "audio") return { duration, width: 0, height: 0, thumbnail: null };
  const video = el as HTMLVideoElement;
  let thumbnail: string | null = null;
  try {
    video.currentTime = Math.min(1, duration / 3 || 0);
    await once(video, "seeked", "error", 6000);
    thumbnail = snapshot(video, video.videoWidth, video.videoHeight);
  } catch {
    thumbnail = null;
  }
  const result = { duration, width: video.videoWidth, height: video.videoHeight, thumbnail };
  video.removeAttribute("src");
  video.load();
  return result;
}

/** Picos de volumen para dibujar la onda de un audio (archivos pequeños). */
export async function waveform(url: string, buckets = 400): Promise<number[] | null> {
  try {
    const response = await fetch(url);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 80 * 1024 * 1024) return null;
    const buffer = await response.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const audio = await ctx.decodeAudioData(buffer);
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    for (let i = 0; i < data.length; i += step) {
      let max = 0;
      for (let j = i; j < Math.min(i + step, data.length); j += 16) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    return peaks;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reloj que sigue funcionando con la ventana minimizada
// ---------------------------------------------------------------------------

const TICKER_SOURCE = `let id=null;onmessage=(e)=>{if(id!==null)clearInterval(id);id=null;if(e.data>0)id=setInterval(()=>postMessage(0),e.data);};`;

/**
 * Los temporizadores de la página se ralentizan cuando la ventana está oculta;
 * los de un Worker no. Se usa para grabar, transmitir y exportar.
 */
export class Ticker {
  private worker: Worker | null = null;
  private url: string | null = null;

  start(intervalMs: number, callback: () => void) {
    this.stop();
    this.url = URL.createObjectURL(new Blob([TICKER_SOURCE], { type: "text/javascript" }));
    this.worker = new Worker(this.url);
    this.worker.onmessage = callback;
    this.worker.postMessage(intervalMs);
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

// ---------------------------------------------------------------------------
// Formatos de grabación
// ---------------------------------------------------------------------------

export interface RecordingFormat {
  mime: string;
  extension: "mp4" | "webm";
  label: string;
}

const CANDIDATES: RecordingFormat[] = [
  { mime: "video/mp4;codecs=avc1.640028,mp4a.40.2", extension: "mp4", label: "MP4 (H.264 + AAC)" },
  { mime: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4", label: "MP4 (H.264 + AAC)" },
  { mime: "video/mp4;codecs=avc1,opus", extension: "mp4", label: "MP4 (H.264)" },
  { mime: "video/mp4", extension: "mp4", label: "MP4" },
  { mime: "video/webm;codecs=vp9,opus", extension: "webm", label: "WebM (VP9)" },
  { mime: "video/webm;codecs=vp8,opus", extension: "webm", label: "WebM (VP8)" },
  { mime: "video/webm", extension: "webm", label: "WebM" },
];

const supported = (mime: string) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime);

/** Mejor formato para guardar archivos (MP4 si el sistema lo permite). */
export function recordingFormat(prefer: "mp4" | "webm" = "mp4"): RecordingFormat | null {
  const ordered = prefer === "webm" ? [...CANDIDATES.filter((c) => c.extension === "webm"), ...CANDIDATES] : CANDIDATES;
  return ordered.find((c) => supported(c.mime)) || null;
}

export const canRecordMp4 = () => CANDIDATES.some((c) => c.extension === "mp4" && supported(c.mime));
