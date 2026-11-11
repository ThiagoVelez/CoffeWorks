// Modelo de datos de CoffeeEdit.
//
// Un proyecto (.ccm) reúne la biblioteca de medios y la línea de tiempo del
// editor (pistas y clips).

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

export interface Project {
  format: "coffeeedit";
  version: 1;
  settings: ProjectSettings;
  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];
}

export const ACCENT = "#26a680";
export const ACCENT_DARK = "#106e52";
export const ACCENT_LIGHT = "#e3f6ef";
