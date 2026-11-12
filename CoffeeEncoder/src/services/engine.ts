// Motores de codificación:
// - Escritorio: FFmpeg (complemento) con rutas reales, progreso y cancelación.
// - Navegador: lo que el propio navegador sabe hacer (WebM en tiempo real,
//   WAV y fotogramas JPG/PNG) para los archivos arrastrados a la ventana.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "../studio/desktop";
import type { EncodeSettings, QueueItem, SourceInfo } from "../types";
import { buildArgs, isStill, parseProbe } from "./ffmpeg";

export interface EncodeResult {
  ok: boolean;
  cancelled?: boolean;
  message: string;
  size: number;
  /** Navegador: el resultado, para descargarlo. */
  blob?: Blob;
}

export interface Progress {
  /** 0..1 */
  fraction: number;
  /** Segundos del resultado ya codificados. */
  time: number;
  speed: string;
  fps: string;
}

// ---------------------------------------------------------------------------
// Archivos del navegador
// ---------------------------------------------------------------------------

const browserFiles = new Map<string, File>();
export const registerBrowserFile = (key: string, file: File) => browserFiles.set(key, file);
export const hasBrowserFile = (key: string) => browserFiles.has(key);

// ---------------------------------------------------------------------------
// Análisis y miniatura
// ---------------------------------------------------------------------------

function mediaElement(file: File, video: boolean): Promise<HTMLVideoElement | HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(video ? "video" : "audio") as HTMLVideoElement;
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;
    el.src = URL.createObjectURL(file);
    el.onloadedmetadata = () => resolve(el);
    el.onerror = () => reject(new Error("El navegador no puede leer este archivo."));
  });
}

export async function probe(source: string): Promise<SourceInfo | null> {
  if (isTauri) {
    try {
      return parseProbe(await invoke<string>("core_media_probe", { path: source }));
    } catch {
      return null;
    }
  }
  const file = browserFiles.get(source);
  if (!file) return null;
  const isVideo = file.type.startsWith("video") || /\.(mp4|webm|mov|mkv|m4v|ogv)$/i.test(file.name);
  const isImage = file.type.startsWith("image");
  if (isImage) return null;
  try {
    const el = await mediaElement(file, isVideo);
    const v = el as HTMLVideoElement;
    const info: SourceInfo = {
      duration: isFinite(el.duration) ? el.duration : 0,
      width: isVideo ? v.videoWidth : 0,
      height: isVideo ? v.videoHeight : 0,
      fps: isVideo ? 30 : 0,
      vcodec: isVideo ? file.type.split("/")[1] || "video" : "",
      acodec: "audio",
      sampleRate: 48000,
      channels: 2,
      bitrate: el.duration ? Math.round((file.size * 8) / el.duration / 1000) : 0,
      hasVideo: isVideo && v.videoWidth > 0,
      hasAudio: true,
    };
    URL.revokeObjectURL(el.src);
    return info;
  } catch {
    return null;
  }
}

async function frameFromFile(file: File, at: number, maxW: number): Promise<HTMLCanvasElement | null> {
  const el = (await mediaElement(file, true)) as HTMLVideoElement;
  if (!el.videoWidth) return null;
  await new Promise<void>((resolve) => {
    el.onseeked = () => resolve();
    el.currentTime = Math.min(Math.max(0, at), Math.max(0, el.duration - 0.05));
  });
  const scale = maxW ? Math.min(1, maxW / el.videoWidth) : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(el.videoWidth * scale);
  c.height = Math.round(el.videoHeight * scale);
  c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
  URL.revokeObjectURL(el.src);
  return c;
}

export async function thumbnail(source: string, info: SourceInfo | null): Promise<string | null> {
  if (!info?.hasVideo) return null;
  const at = Math.min(1, (info.duration || 0) / 3);
  if (isTauri) {
    try {
      const b64 = await invoke<string>("core_addon_run", {
        id: "ffmpeg",
        args: ["-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", source, "-frames:v", "1", "-vf", "scale=240:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "{stdout-base64}"],
        input: null,
      });
      return b64 ? `data:image/jpeg;base64,${b64}` : null;
    } catch {
      return null;
    }
  }
  const file = browserFiles.get(source);
  if (!file) return null;
  try {
    return (await frameFromFile(file, at, 240))?.toDataURL("image/jpeg", 0.8) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Escritorio: trabajos de FFmpeg
// ---------------------------------------------------------------------------

type JobProgress = { id: string; data: Record<string, string> };
type JobEnded = { id: string; ok: boolean; cancelled: boolean; message: string; size: number };

const progressHandlers = new Map<string, (p: Record<string, string>) => void>();
const endHandlers = new Map<string, (e: JobEnded) => void>();
let listening: Promise<void> | null = null;

function ensureListening() {
  if (!listening)
    listening = (async () => {
      await listen<JobProgress>("coffee-job-progress", (e) => progressHandlers.get(e.payload.id)?.(e.payload.data));
      await listen<JobEnded>("coffee-job-ended", (e) => endHandlers.get(e.payload.id)?.(e.payload));
    })();
  return listening;
}

/** Explica los errores más frecuentes de FFmpeg. */
function explain(message: string): string {
  if (/Could not write header|codec not currently supported in container|incorrect codec parameters/i.test(message))
    return "Los códecs del original no caben en este contenedor sin recodificar. Elige un ajuste que recodifique el video.";
  if (/No such file|does not exist/i.test(message)) return "No se encuentra el archivo de origen.";
  if (/Permission denied/i.test(message)) return "No se puede escribir en la carpeta de destino.";
  if (/(nvenc|qsv|amf).*(not|fail|error)|Cannot load|No capable devices|device type .* not/i.test(message))
    return "La aceleración por hardware elegida no está disponible en este equipo. Usa «Software».";
  if (/does not contain any stream|Output file .* does not contain|matches no streams/i.test(message)) return "El original no tiene el tipo de pista que pide este ajuste (por ejemplo, video en un archivo de solo audio).";
  return message || "FFmpeg terminó con un error.";
}

export function encodeDesktop(jobId: string, source: string, target: string, s: EncodeSettings, info: SourceInfo | null, duration: number, onProgress: (p: Progress) => void): Promise<EncodeResult> {
  return new Promise((resolve, reject) => {
    void ensureListening().then(() => {
      progressHandlers.set(jobId, (d) => {
        const us = Number(d.out_time_us || d.out_time_ms || 0);
        const time = isFinite(us) ? us / 1e6 : 0;
        onProgress({ fraction: duration ? Math.min(1, time / duration) : 0, time, speed: d.speed || "", fps: d.fps || "" });
      });
      endHandlers.set(jobId, (e) => {
        progressHandlers.delete(jobId);
        endHandlers.delete(jobId);
        resolve({ ok: e.ok, cancelled: e.cancelled, message: e.ok ? "" : e.cancelled ? "Cancelado" : explain(e.message), size: e.size });
      });
      invoke("core_job_start", { id: jobId, addon: "ffmpeg", args: buildArgs(source, target, s, info, true) }).catch((err) => {
        progressHandlers.delete(jobId);
        endHandlers.delete(jobId);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------

/** ¿Puede el navegador hacer esta salida? */
export function browserCan(s: EncodeSettings): boolean {
  if (isStill(s)) return true;
  if (s.container === "wav") return true;
  return s.container === "webm" && typeof MediaRecorder !== "undefined";
}

const browserCancel = new Map<string, () => void>();

export function cancelJob(jobId: string) {
  if (isTauri) void invoke("core_job_cancel", { id: jobId });
  browserCancel.get(jobId)?.();
}

function encodeWav(buf: AudioBuffer, a: number, b: number, channels: number): Blob {
  const rate = buf.sampleRate;
  const from = Math.floor(a * rate);
  const to = Math.min(buf.length, Math.floor(b * rate));
  const n = Math.max(0, to - from);
  const ch = channels || buf.numberOfChannels;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, t: string) => [...t].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  data.setUint32(4, 36 + n * ch * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  w(36, "data");
  data.setUint32(40, n * ch * 2, true);
  const src = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = from; i < from + n; i++)
    for (let c = 0; c < ch; c++) {
      // Mezcla a mono o duplica a estéreo si hace falta
      const v = ch === 1 && src.length > 1 ? src.reduce((s, x) => s + x[i], 0) / src.length : src[Math.min(c, src.length - 1)][i];
      data.setInt16(o, Math.max(-1, Math.min(1, v)) * 0x7fff, true);
      o += 2;
    }
  return new Blob([data.buffer], { type: "audio/wav" });
}

/** Dibuja el fotograma con la escala y el encuadre pedidos. */
function drawFitted(g: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, W: number, H: number, fit: EncodeSettings["fit"]) {
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  if (fit === "stretch") return g.drawImage(src, 0, 0, W, H);
  const k = fit === "fill" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const w = sw * k;
  const h = sh * k;
  g.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
}

function outSize(s: EncodeSettings, sw: number, sh: number) {
  const W = s.width || (s.height ? Math.round((sw * s.height) / sh) : sw);
  const H = s.height || (s.width ? Math.round((sh * s.width) / sw) : sh);
  return { W: Math.max(2, Math.round(W / 2) * 2), H: Math.max(2, Math.round(H / 2) * 2) };
}

function drawWatermark(g: CanvasRenderingContext2D, s: EncodeSettings, W: number, H: number) {
  if (!s.watermark.trim()) return;
  const size = Math.round(H / 22);
  g.font = `600 ${size}px sans-serif`;
  const tw = g.measureText(s.watermark).width;
  const m = 24;
  const x = s.watermarkPos === "tl" || s.watermarkPos === "bl" ? m : s.watermarkPos === "c" ? (W - tw) / 2 : W - tw - m;
  const y = s.watermarkPos === "tl" || s.watermarkPos === "tr" ? m + size : s.watermarkPos === "c" ? (H + size) / 2 : H - m;
  g.lineWidth = 3;
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.strokeText(s.watermark, x, y);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillText(s.watermark, x, y);
}

export async function encodeBrowser(jobId: string, item: QueueItem, s: EncodeSettings, onProgress: (p: Progress) => void): Promise<EncodeResult> {
  const file = browserFiles.get(item.source);
  if (!file) return { ok: false, message: "Vuelve a añadir el archivo: el navegador no conserva los archivos al recargar.", size: 0 };
  if (!browserCan(s)) return { ok: false, message: "Este ajuste necesita FFmpeg: usa la aplicación de escritorio (o un ajuste marcado «sin FFmpeg»).", size: 0 };

  if (isStill(s)) {
    const frame = await frameFromFile(file, s.frameAt, 0);
    if (!frame) return { ok: false, message: "El archivo no tiene video.", size: 0 };
    const { W, H } = outSize(s, frame.width, frame.height);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    drawFitted(g, frame, frame.width, frame.height, W, H, s.fit);
    drawWatermark(g, s, W, H);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, s.container === "png" ? "image/png" : "image/jpeg", 0.92));
    onProgress({ fraction: 1, time: 0, speed: "", fps: "" });
    return blob ? { ok: true, message: "", size: blob.size, blob } : { ok: false, message: "No se pudo crear la imagen.", size: 0 };
  }

  if (s.container === "wav") {
    const ctx = new OfflineAudioContext(1, 1, 48000);
    let buf: AudioBuffer;
    try {
      buf = await ctx.decodeAudioData(await file.arrayBuffer());
    } catch {
      return { ok: false, message: "El navegador no puede decodificar el audio de este archivo.", size: 0 };
    }
    const b = s.trimOut > s.trimIn ? s.trimOut : buf.duration;
    const blob = encodeWav(buf, s.trimIn, b, s.channels);
    onProgress({ fraction: 1, time: b - s.trimIn, speed: "", fps: "" });
    return { ok: true, message: "", size: blob.size, blob };
  }

  // WebM en tiempo real: se reproduce el video y se graba un lienzo
  const el = (await mediaElement(file, true)) as HTMLVideoElement;
  el.muted = false;
  el.volume = 1;
  const hasVideo = el.videoWidth > 0 && s.vcodec !== "none";
  const { W, H } = hasVideo ? outSize(s, el.videoWidth, el.videoHeight) : { W: 2, H: 2 };
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const fps = s.fps || 30;
  const stream = hasVideo ? canvas.captureStream(fps) : new MediaStream();
  const actx = new AudioContext();
  let audioOk = false;
  if (s.acodec !== "none") {
    try {
      const node = actx.createMediaElementSource(el);
      const dest = actx.createMediaStreamDestination();
      node.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      audioOk = true;
    } catch {
      /* sin audio */
    }
  }
  const mime = [hasVideo ? "video/webm;codecs=vp9,opus" : "audio/webm;codecs=opus", hasVideo ? "video/webm;codecs=vp8,opus" : "audio/webm", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: s.bitrate * 1000, audioBitsPerSecond: audioOk ? s.abitrate * 1000 : undefined });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const start = Math.max(0, s.trimIn);
  const end = s.trimOut > start ? Math.min(el.duration, s.trimOut) : el.duration;
  await new Promise<void>((r) => {
    el.onseeked = () => r();
    el.currentTime = start;
  });
  let cancelled = false;
  let raf = 0;
  const done = new Promise<void>((resolve) => {
    const tick = () => {
      if (hasVideo) {
        drawFitted(g, el, el.videoWidth, el.videoHeight, W, H, s.fit);
        drawWatermark(g, s, W, H);
      }
      const t = el.currentTime - start;
      onProgress({ fraction: Math.min(1, t / (end - start || 1)), time: t, speed: "1x", fps: String(fps) });
      if (cancelled || el.ended || el.currentTime >= end) return resolve();
      raf = requestAnimationFrame(tick);
    };
    el.onended = () => resolve();
    browserCancel.set(jobId, () => {
      cancelled = true;
      resolve();
    });
    rec.start(500);
    void el.play().then(tick, () => resolve());
  });
  await done;
  cancelAnimationFrame(raf);
  el.pause();
  browserCancel.delete(jobId);
  await new Promise<void>((r) => {
    rec.onstop = () => r();
    rec.stop();
  });
  stream.getTracks().forEach((t) => t.stop());
  void actx.close();
  URL.revokeObjectURL(el.src);
  if (cancelled) return { ok: false, cancelled: true, message: "Cancelado", size: 0 };
  const blob = new Blob(chunks, { type: "video/webm" });
  return { ok: true, message: "", size: blob.size, blob };
}
