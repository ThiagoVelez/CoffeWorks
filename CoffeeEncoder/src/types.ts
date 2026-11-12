// Modelo de datos de CoffeeEncoder: una cola (archivo .cen) con archivos de
// origen y, para cada uno, una o varias salidas con su ajuste preestablecido.

export type Container = "mp4" | "mov" | "mkv" | "webm" | "gif" | "mp3" | "m4a" | "wav" | "flac" | "ogg" | "opus" | "jpg" | "png";
export type VideoCodec = "h264" | "hevc" | "vp9" | "av1" | "prores" | "gif" | "mjpeg" | "png" | "copy" | "none";
export type AudioCodec = "aac" | "mp3" | "opus" | "vorbis" | "flac" | "pcm" | "copy" | "none";
export type Hardware = "none" | "nvenc" | "qsv" | "amf";
export type Fit = "fit" | "fill" | "stretch";

export interface EncodeSettings {
  container: Container;
  vcodec: VideoCodec;
  hardware: Hardware;
  /** 0 = como el original. */
  width: number;
  height: number;
  fit: Fit;
  /** 0 = como el original. */
  fps: number;
  rateMode: "crf" | "bitrate";
  /** Calidad constante (menor = mejor). */
  crf: number;
  /** kbps (modo bitrate). */
  bitrate: number;
  speed: "ultrafast" | "veryfast" | "fast" | "medium" | "slow" | "veryslow";
  /** ProRes: 0 proxy, 1 LT, 2 422, 3 HQ. */
  proresProfile: number;
  acodec: AudioCodec;
  /** kbps. */
  abitrate: number;
  /** 0 = como el original. */
  sampleRate: number;
  /** 0 = como el original. */
  channels: number;
  /** Normalización de sonoridad (EBU R128). */
  loudnorm: boolean;
  /** LUFS objetivo de la normalización. */
  loudness: number;
  deinterlace: boolean;
  /** 0, 90, 180 o 270. */
  rotate: number;
  /** Texto de marca de agua (vacío = sin marca). */
  watermark: string;
  watermarkPos: "tl" | "tr" | "bl" | "br" | "c";
  /** Recorte en segundos (fin 0 = hasta el final). */
  trimIn: number;
  trimOut: number;
  /** Miniatura: segundo del fotograma. */
  frameAt: number;
}

export interface Preset {
  id: string;
  name: string;
  category: string;
  description: string;
  settings: EncodeSettings;
  /** Se puede hacer en el navegador (sin FFmpeg). */
  browser?: boolean;
  custom?: boolean;
}

export interface SourceInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  vcodec: string;
  acodec: string;
  sampleRate: number;
  channels: number;
  bitrate: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export type OutputStatus = "ready" | "encoding" | "done" | "error" | "cancelled" | "skipped";

export interface Output {
  id: string;
  presetId: string;
  presetName: string;
  settings: EncodeSettings;
  /** Ruta de salida (escritorio) o nombre del archivo (navegador). */
  target: string;
  status: OutputStatus;
  progress: number;
  message: string;
  startedAt?: number;
  finishedAt?: number;
  /** Tamaño del resultado en bytes. */
  size?: number;
}

export interface QueueItem {
  id: string;
  /** Ruta del original (escritorio) o nombre (navegador). */
  source: string;
  name: string;
  size: number;
  info: SourceInfo | null;
  thumb: string | null;
  outputs: Output[];
}

export interface HistoryEntry {
  id: string;
  name: string;
  preset: string;
  target: string;
  ok: boolean;
  message: string;
  seconds: number;
  at: number;
}

export interface Queue {
  version: 1;
  items: QueueItem[];
  customPresets: Preset[];
  /** Carpeta de salida; vacío = junto al original. */
  outputDir: string;
  /** Empezar en cuanto se añade un archivo. */
  autoStart: boolean;
  /** Avisar con un sonido al terminar la cola. */
  chime: boolean;
  history: HistoryEntry[];
}

export const ACCENT = "#d6336c";
export const ACCENT_DARK = "#a8324a";
