// Modelo de datos de CoffeeSound.
//
// Una sesión tiene archivos de audio (los "recursos", cada uno una ficha del
// almacén de audio) y pistas de multipista con clips que los usan. En el
// editor de forma de onda se edita un recurso directamente.

export type EffectKind = "eq" | "compressor" | "reverb" | "delay" | "lowpass" | "highpass" | "gain" | "distortion" | "chorus" | "limiter";

export interface Effect {
  id: string;
  kind: EffectKind;
  enabled: boolean;
  params: Record<string, number>;
}

export interface Clip {
  id: string;
  assetId: string;
  /** Inicio en la línea de tiempo (s). */
  start: number;
  /** Desde dónde se lee el recurso (s). */
  offset: number;
  duration: number;
  /** Ganancia del clip (dB). */
  gain: number;
  fadeIn: number;
  fadeOut: number;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  /** Volumen (dB). */
  volume: number;
  /** Panorama -1 (izquierda) a 1 (derecha). */
  pan: number;
  mute: boolean;
  solo: boolean;
  effects: Effect[];
  clips: Clip[];
}

export interface Asset {
  id: string;
  name: string;
  /** Ficha del almacén de audio. */
  data: string;
  duration: number;
  sampleRate: number;
  channels: number;
}

export interface Marker {
  id: string;
  time: number;
  name: string;
}

export interface Session {
  version: 1;
  sampleRate: number;
  assets: Asset[];
  tracks: Track[];
  masterVolume: number;
  markers: Marker[];
  /** Recurso abierto en el editor de forma de onda. */
  activeAsset: string | null;
  mode: "waveform" | "multitrack";
}

export const ACCENT = "#e67700";
export const ACCENT_DARK = "#b35c00";
export const TRACK_COLORS = ["#ff922b", "#f06595", "#4dabf7", "#69db7c", "#ffd43b", "#b197fc", "#63e6be", "#ff8787"];
