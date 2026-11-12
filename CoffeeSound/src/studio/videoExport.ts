// ⚠ Copia de shared/studio/videoExport.ts: edita el original y ejecuta node scripts/sync-shared.mjs
// Exportación de animaciones fotograma a fotograma (CoffeeMotion,
// CoffeeAnimate, CoffeePuppet):
// - WebM exacto con WebCodecs (sin complementos).
// - MP4 / MOV / GIF de alta calidad con el complemento FFmpeg (escritorio).
// - GIF y secuencia PNG sin complementos.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { bytesToBase64, isTauri } from "./desktop";
import { encodeGif } from "./gif";
import { muxWebM, opusHead, type MuxChunk } from "./webm";
import { makeZip } from "./zip";

export type VideoFormat = "webm" | "mp4" | "mov" | "gif" | "gif-ffmpeg" | "png";

export interface FrameJob {
  width: number;
  height: number;
  fps: number;
  frames: number;
  /** Dibuja el fotograma `i` y devuelve el lienzo (del tamaño de salida). */
  render: (i: number) => Promise<HTMLCanvasElement> | HTMLCanvasElement;
  audio?: AudioBuffer | null;
  onProgress?: (fraction: number, label: string) => void;
  /** Se comprueba entre fotogramas; `true` cancela. */
  cancelled?: () => boolean;
  /** kbps (WebM y MP4). */
  bitrate?: number;
  /** Mantener la transparencia (GIF, PNG y MOV). */
  alpha?: boolean;
}

export const FORMAT_LABEL: Record<VideoFormat, string> = {
  webm: "Video WebM (VP9)",
  mp4: "Video MP4 (H.264) · FFmpeg",
  mov: "QuickTime MOV (ProRes 4444 con transparencia) · FFmpeg",
  gif: "GIF animado",
  "gif-ffmpeg": "GIF animado de alta calidad · FFmpeg",
  png: "Secuencia PNG (ZIP)",
};

export const needsFfmpeg = (f: VideoFormat) => f === "mp4" || f === "mov" || f === "gif-ffmpeg";
export const extensionOf = (f: VideoFormat) => (f === "gif-ffmpeg" ? "gif" : f === "png" ? "zip" : f);

class Cancelled extends Error {
  constructor() {
    super("Exportación cancelada");
  }
}
export const isCancelled = (e: unknown) => e instanceof Cancelled;

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Remuestrea el audio a 48 kHz estéreo. */
async function toStereo48k(buf: AudioBuffer, seconds: number): Promise<AudioBuffer> {
  const len = Math.max(1, Math.ceil(seconds * 48000));
  const ctx = new OfflineAudioContext(2, len, 48000);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}

export function encodeWav(buf: AudioBuffer): Uint8Array {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, t: string) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  out.setUint32(4, 36 + n * ch * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true);
      o += 2;
    }
  return new Uint8Array(out.buffer);
}

export const canWebM = () => typeof VideoEncoder !== "undefined";

/** WebM exacto fotograma a fotograma con WebCodecs. */
export async function encodeWebM(job: FrameJob): Promise<Blob> {
  if (!canWebM()) throw new Error("Este navegador no permite codificar video (WebCodecs). Usa GIF o la secuencia PNG.");
  const { fps, frames } = job;
  const width = job.width + (job.width % 2);
  const height = job.height + (job.height % 2);
  const bitrate = (job.bitrate || Math.max(1500, Math.round((width * height * fps * 0.12) / 1000))) * 1000;
  const chunks: MuxChunk[] = [];
  let failure: Error | null = null;
  let codec = "vp09.00.10.08";
  let codecId: "V_VP9" | "V_VP8" = "V_VP9";
  const base = { width, height, bitrate, framerate: fps };
  if (!(await VideoEncoder.isConfigSupported({ ...base, codec })).supported) {
    codec = "vp8";
    codecId = "V_VP8";
  }
  const enc = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({ track: 1, time: chunk.timestamp / 1000, key: chunk.type === "key", data });
    },
    error: (e) => (failure = e instanceof Error ? e : new Error(String(e))),
  });
  enc.configure({ ...base, codec });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  for (let i = 0; i < frames; i++) {
    if (job.cancelled?.()) {
      enc.close();
      throw new Cancelled();
    }
    if (failure) throw failure;
    const src = await job.render(i);
    g.fillStyle = "#000";
    g.fillRect(0, 0, width, height);
    g.drawImage(src, 0, 0);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(frame, { keyFrame: i % Math.max(1, Math.round(fps * 2)) === 0 });
    frame.close();
    while (enc.encodeQueueSize > 4) await tick();
    job.onProgress?.((i + 1) / frames * 0.9, `Fotograma ${i + 1} de ${frames}`);
    if (i % 3 === 0) await tick();
  }
  await enc.flush();
  enc.close();
  if (failure) throw failure;

  // Audio Opus
  let audio: { sampleRate: number; channels: number; codecPrivate: Uint8Array } | null = null;
  const seconds = frames / fps;
  if (job.audio && typeof AudioEncoder !== "undefined") {
    try {
      const pcm = await toStereo48k(job.audio, seconds);
      const cfg = { codec: "opus", sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 };
      if ((await AudioEncoder.isConfigSupported(cfg)).supported) {
        let desc: Uint8Array | null = null;
        const aenc = new AudioEncoder({
          output: (chunk, meta) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            chunks.push({ track: 2, time: chunk.timestamp / 1000, key: true, data });
            const d = meta?.decoderConfig?.description;
            if (d && !desc) desc = d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array((d as ArrayBufferView).buffer);
          },
          error: () => undefined,
        });
        aenc.configure(cfg);
        const L = pcm.getChannelData(0);
        const R = pcm.getChannelData(1);
        const block = 960 * 10;
        for (let o = 0; o < pcm.length; o += block) {
          const n = Math.min(block, pcm.length - o);
          const data = new Float32Array(n * 2);
          data.set(L.subarray(o, o + n), 0);
          data.set(R.subarray(o, o + n), n);
          const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((o / 48000) * 1e6), data });
          aenc.encode(ad);
          ad.close();
        }
        await aenc.flush();
        aenc.close();
        audio = { sampleRate: 48000, channels: 2, codecPrivate: desc || opusHead(2, 48000) };
      }
    } catch {
      audio = null;
    }
    if (!audio) for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].track === 2) chunks.splice(i, 1);
  }
  job.onProgress?.(1, "Guardando");
  return muxWebM(chunks, { width, height, videoCodec: codecId, duration: seconds * 1000, audio });
}

/** GIF sin complementos. */
export async function encodeGifJob(job: FrameJob, maxWidth = 640): Promise<Blob> {
  const scale = Math.min(1, maxWidth / job.width);
  const w = Math.max(2, Math.round(job.width * scale));
  const h = Math.max(2, Math.round(job.height * scale));
  // GIF: como mucho 25 fps (retardos en centésimas)
  const step = job.fps > 25 ? Math.ceil(job.fps / 25) : 1;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const imgs: ImageData[] = [];
  const total = Math.ceil(job.frames / step);
  for (let i = 0; i < job.frames; i += step) {
    if (job.cancelled?.()) throw new Cancelled();
    const src = await job.render(i);
    g.clearRect(0, 0, w, h);
    if (!job.alpha) {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
    }
    g.drawImage(src, 0, 0, w, h);
    imgs.push(g.getImageData(0, 0, w, h));
    job.onProgress?.((imgs.length / total) * 0.6, `Fotograma ${imgs.length} de ${total}`);
    await tick();
  }
  return encodeGif(imgs, { width: w, height: h, delay: Math.max(2, Math.round((100 * step) / job.fps)), dither: true, transparent: !!job.alpha }, (f) => job.onProgress?.(0.6 + f * 0.4, "Comprimiendo GIF"));
}

/** Secuencia PNG en un ZIP. */
export async function encodePngSequence(job: FrameJob, baseName: string): Promise<Blob> {
  const entries = [];
  const pad = String(job.frames).length;
  for (let i = 0; i < job.frames; i++) {
    if (job.cancelled?.()) throw new Cancelled();
    const c = await job.render(i);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    entries.push({ name: `${baseName}_${String(i).padStart(Math.max(4, pad), "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    job.onProgress?.((i + 1) / job.frames, `Fotograma ${i + 1} de ${job.frames}`);
  }
  return makeZip(entries);
}

/**
 * MP4 / MOV / GIF con FFmpeg (escritorio): los fotogramas se escriben en un
 * archivo temporal y FFmpeg los codifica directamente en `target`.
 */
export async function encodeWithFfmpeg(job: FrameJob, format: "mp4" | "mov" | "gif-ffmpeg", target: string): Promise<void> {
  if (!isTauri) throw new Error("Este formato necesita la aplicación de escritorio con el complemento FFmpeg.");
  const png = format !== "mp4";
  const stamp = Date.now().toString(36);
  const framesPath = await invoke<string>("core_temp_path", { name: `frames-${stamp}.${png ? "png" : "mjpeg"}` });
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < job.frames; i++) {
    if (job.cancelled?.()) throw new Cancelled();
    const c = await job.render(i);
    let src = c;
    if (!png) {
      // JPEG sin transparencia: fondo negro
      const flat = document.createElement("canvas");
      flat.width = c.width;
      flat.height = c.height;
      const g = flat.getContext("2d")!;
      g.fillStyle = "#000";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(c, 0, 0);
      src = flat;
    }
    const blob = await new Promise<Blob>((r) => src.toBlob((b) => r(b!), png ? "image/png" : "image/jpeg", 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    parts.push(bytes);
    total += bytes.length;
    job.onProgress?.(((i + 1) / job.frames) * 0.6, `Fotograma ${i + 1} de ${job.frames}`);
    if (i % 2 === 0) await tick();
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  await invoke("core_write_binary", { path: framesPath, data: bytesToBase64(all) });
  let audioPath: string | null = null;
  if (job.audio && format !== "gif-ffmpeg") {
    audioPath = await invoke<string>("core_temp_path", { name: `audio-${stamp}.wav` });
    await invoke("core_write_binary", { path: audioPath, data: bytesToBase64(encodeWav(await toStereo48k(job.audio, job.frames / job.fps))) });
  }
  const w = job.width + (job.width % 2);
  const h = job.height + (job.height % 2);
  const args = ["-hide_banner", "-y", "-nostats", "-progress", "pipe:1", "-f", "image2pipe", "-framerate", String(job.fps), "-vcodec", png ? "png" : "mjpeg", "-i", framesPath];
  if (audioPath) args.push("-i", audioPath);
  if (format === "mp4") args.push("-vf", `scale=${w}:${h}`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  else if (format === "mov") args.push("-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", job.alpha ? "yuva444p10le" : "yuv444p10le", "-vendor", "apl0");
  else args.push("-filter_complex", "[0:v]split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=sierra2_4a", "-loop", "0");
  if (audioPath) args.push("-c:a", format === "mov" ? "pcm_s16le" : "aac", "-b:a", "192k", "-shortest");
  args.push(target);
  const id = `export-${stamp}`;
  const seconds = job.frames / job.fps;
  await new Promise<void>((resolve, reject) => {
    const offs: (() => void)[] = [];
    const done = (err?: Error) => {
      offs.forEach((f) => f());
      void invoke("core_remove_temp", { path: framesPath });
      if (audioPath) void invoke("core_remove_temp", { path: audioPath });
      if (err) reject(err);
      else resolve();
    };
    void (async () => {
      offs.push(
        await listen<{ id: string; data: Record<string, string> }>("coffee-job-progress", (e) => {
          if (e.payload.id !== id) return;
          const t = Number(e.payload.data.out_time_us || 0) / 1e6;
          job.onProgress?.(0.6 + Math.min(1, t / seconds) * 0.4, "Codificando con FFmpeg");
        })
      );
      offs.push(
        await listen<{ id: string; ok: boolean; message: string }>("coffee-job-ended", (e) => {
          if (e.payload.id !== id) return;
          done(e.payload.ok ? undefined : new Error(e.payload.message || "FFmpeg no pudo codificar el video."));
        })
      );
      const watch = window.setInterval(() => {
        if (job.cancelled?.()) {
          window.clearInterval(watch);
          void invoke("core_job_cancel", { id });
        }
      }, 300);
      offs.push(() => window.clearInterval(watch));
      try {
        await invoke("core_job_start", { id, addon: "ffmpeg", args });
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  });
}
