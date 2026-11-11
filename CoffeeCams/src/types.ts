// Modelo de datos de CoffeeCams.
//
// Un proyecto (.ccm) reúne la biblioteca de medios, la línea de tiempo del
// editor (pistas y clips) y las escenas del estudio de grabación/transmisión.

export type MediaKind = "video" | "audio" | "image";

export interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  /** Ruta en disco (aplicación de escritorio). */
  path: string | null;
  duration: number;
  width: number;
  height: number;
}

export type TrackKind = "video" | "text" | "audio";

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface Adjustments {
  brightness: number; // 100 = normal
  contrast: number; // 100 = normal
  saturation: number; // 100 = normal
  hue: number; // grados
  blur: number; // px
  grayscale: number; // 0-100
  sepia: number; // 0-100
}

export interface Transform {
  /** Desplazamiento respecto al centro, en fracción del ancho/alto del lienzo. */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

interface ClipBase {
  id: string;
  trackId: string;
  /** Segundo de la línea de tiempo en que empieza. */
  start: number;
  /** Duración en la línea de tiempo (segundos). */
  duration: number;
  fadeIn: number;
  fadeOut: number;
}

export interface MediaClip extends ClipBase {
  type: "media";
  mediaId: string;
  /** Punto de entrada dentro del archivo original (segundos). */
  in: number;
  speed: number;
  volume: number;
  fit: "contain" | "cover";
  transform: Transform;
  adjust: Adjustments;
}

export type TextAnimation = "none" | "fade" | "slide" | "pop" | "typewriter";

export interface TextClip extends ClipBase {
  type: "text";
  text: string;
  font: string;
  size: number; // px en la resolución del proyecto
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  background: string | null;
  outline: boolean;
  /** Centro del texto, en fracción del lienzo (0-1). */
  x: number;
  y: number;
  animation: TextAnimation;
}

export type Clip = MediaClip | TextClip;

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  background: string;
}

// ---------------------------------------------------------------------------
// Estudio
// ---------------------------------------------------------------------------

export type SourceKind = "screen" | "camera" | "image" | "text" | "color";

export interface StudioSource {
  id: string;
  kind: SourceKind;
  name: string;
  visible: boolean;
  /** Rectángulo en píxeles de la salida. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Cámara elegida. */
  deviceId?: string;
  /** Imagen (data URL). */
  src?: string;
  /** Texto y estilo. */
  text?: string;
  color?: string;
  size?: number;
  /** Recorta la cámara en círculo. */
  round?: boolean;
}

export interface Scene {
  id: string;
  name: string;
  sources: StudioSource[];
}

export type StreamService = "twitch" | "youtube" | "facebook" | "custom";

export interface StreamSettings {
  service: StreamService;
  server: string;
  videoKbps: number;
  audioKbps: number;
  fps: number;
  height: 720 | 1080;
}

export interface Project {
  format: "coffeecams";
  version: 1;
  settings: ProjectSettings;
  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];
  scenes: Scene[];
  stream: StreamSettings;
}

export const ACCENT = "#26a680";
export const ACCENT_DARK = "#106e52";
export const ACCENT_LIGHT = "#e3f6ef";

export const STREAM_SERVERS: Record<Exclude<StreamService, "custom">, { label: string; server: string; help: string }> = {
  twitch: {
    label: "Twitch",
    server: "rtmp://live.twitch.tv/app",
    help: "Copia la clave en Twitch: Panel de control del creador › Configuración › Transmisión.",
  },
  youtube: {
    label: "YouTube",
    server: "rtmp://a.rtmp.youtube.com/live2",
    help: "En YouTube Studio pulsa «Emitir en directo» y copia la «Clave de transmisión».",
  },
  facebook: {
    label: "Facebook",
    server: "rtmps://live-api-s.facebook.com:443/rtmp",
    help: "En Facebook › Vídeo en directo › Software de transmisión, copia la clave de transmisión.",
  },
};
