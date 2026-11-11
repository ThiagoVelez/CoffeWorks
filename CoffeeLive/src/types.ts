// Modelo de datos de CoffeeLive.
//
// Un documento (.clv) es una «colección de escenas» con todos los ajustes de
// grabación y transmisión, como los perfiles de las apps de streaming.

export type SourceKind = "screen" | "camera" | "image" | "text" | "color" | "media" | "slideshow";

export interface SourceFilters {
  /** Recorte en píxeles del origen (izquierda, arriba, derecha, abajo). */
  crop: { left: number; top: number; right: number; bottom: number };
  brightness: number; // 100 = normal
  contrast: number;
  saturation: number;
  hue: number; // grados
  opacity: number; // 0-100
  blur: number; // px
  chroma: { enabled: boolean; color: string; similarity: number; smoothness: number };
}

export interface StudioSource {
  id: string;
  kind: SourceKind;
  name: string;
  visible: boolean;
  locked: boolean;
  /** Rectángulo en píxeles de la resolución base. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  /** Radio de las esquinas en px; `round` recorta en círculo/elipse. */
  radius: number;
  round: boolean;
  /** Pantalla: ajustar entera (contain) o rellenar (cover). */
  fit: "contain" | "cover" | "stretch";
  filters: SourceFilters;
  // Por tipo
  deviceId?: string;
  src?: string;
  srcs?: string[];
  interval?: number;
  path?: string | null;
  loop?: boolean;
  text?: string;
  font?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  outline?: boolean;
  background?: string | null;
  align?: "left" | "center" | "right";
}

export interface Scene {
  id: string;
  name: string;
  sources: StudioSource[];
}

export type StreamService = "twitch" | "youtube" | "facebook" | "kick" | "custom";
export type X264Preset = "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium";
export type TransitionKind = "cut" | "fade" | "slide" | "swipe" | "zoom";

export type HotkeyAction =
  | "toggleRecording"
  | "pauseRecording"
  | "toggleStreaming"
  | "toggleMic"
  | "pushToTalk"
  | "transition"
  | "nextScene"
  | "previousScene"
  | "screenshot";

export interface LiveSettings {
  stream: {
    service: StreamService;
    server: string;
    rememberKey: boolean;
    videoKbps: number;
    audioKbps: number;
    encoder: "auto" | "x264" | "hardware";
    rateControl: "cbr" | "vbr";
    preset: X264Preset;
    profile: "baseline" | "main" | "high";
    keyframeSec: number;
    reconnect: boolean;
    retryDelaySec: number;
    maxRetries: number;
    confirmStart: boolean;
    confirmStop: boolean;
    recordWhileStreaming: boolean;
  };
  recording: {
    format: "mp4" | "webm";
    videoKbps: number;
    audioKbps: number;
    folder: string | null;
    fileName: string;
  };
  video: {
    baseWidth: number;
    baseHeight: number;
    outWidth: number;
    outHeight: number;
    fps: number;
    downscale: "bilinear" | "bicubic" | "lanczos";
  };
  audio: {
    sampleRate: 44100 | 48000;
    channels: 1 | 2;
    micDevice: string | null;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGain: boolean;
    desktopAudio: boolean;
    noiseGate: boolean;
    gateThreshold: number; // dB
    compressor: boolean;
    micGainDb: number;
  };
  hotkeys: Record<HotkeyAction, string>;
  transition: { kind: TransitionKind; durationMs: number };
  general: { studioMode: boolean; showStats: boolean; confirmExit: boolean };
}

export interface LiveDocument {
  format: "coffeelive";
  version: 1;
  scenes: Scene[];
  currentSceneId: string;
  settings: LiveSettings;
}

export const ACCENT = "#ef6c00";
export const ACCENT_DARK = "#b84f00";

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
  kick: {
    label: "Kick",
    server: "rtmps://fa723fc1b171.global-contribute.live-video.net/app",
    help: "En Kick › Configuración del canal › Clave de transmisión. Comprueba que la URL coincide con la de tu panel.",
  },
};

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  toggleRecording: "Iniciar / detener grabación",
  pauseRecording: "Pausar / reanudar grabación",
  toggleStreaming: "Iniciar / detener transmisión",
  toggleMic: "Silenciar / activar micrófono",
  pushToTalk: "Pulsar para hablar (mantener)",
  transition: "Transición (modo estudio)",
  nextScene: "Escena siguiente",
  previousScene: "Escena anterior",
  screenshot: "Captura de la salida (PNG)",
};
