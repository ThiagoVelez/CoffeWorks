// Modelo de CoffeeAnimate (.can): escenario, línea de tiempo con capas y
// fotogramas clave, símbolos (gráfico, clip de película y botón) y acciones.

export interface Xform {
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Grados. */
  rot: number;
}

export type ElementKind = "path" | "rect" | "ellipse" | "text" | "instance" | "image";

export interface El {
  /** Mismo id en dos claves = se interpola en la interpolación. */
  id: string;
  kind: ElementKind;
  t: Xform;
  alpha: number;
  /** Trazado a mano alzada (coordenadas locales). */
  points?: [number, number][];
  closed?: boolean;
  /** Rectángulo / elipse (centrados en el origen). */
  w?: number;
  h?: number;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string | null;
  text?: string;
  font?: string;
  size?: number;
  bold?: boolean;
  symbolId?: string;
  /** Gráfico: fotograma del símbolo en que empieza; "single" = fijo. */
  loop?: "loop" | "once" | "single";
  firstFrame?: number;
  /** Nombre de instancia (clips y botones). */
  name?: string;
  /** Acción al hacer clic (botones). */
  action?: Action | null;
  /** Tinte (0..1) hacia un color. */
  tint?: { color: string; amount: number } | null;
  imageId?: string;
}

export type Action =
  | { type: "play" }
  | { type: "stop" }
  | { type: "gotoAndPlay"; frame: number }
  | { type: "gotoAndStop"; frame: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "url"; url: string };

export interface Keyframe {
  /** Índice del fotograma (0 = primero). */
  frame: number;
  elements: El[];
  /** Interpolación hasta la siguiente clave de la capa. */
  tween: "none" | "classic";
  /** -100 (acelerar) .. 100 (frenar). */
  ease: number;
  /** Vueltas extra durante la interpolación (+ horario, − antihorario). */
  spin: number;
  label?: string;
  /** Acciones del fotograma (al llegar a él). */
  script?: "" | "stop";
}

export interface ALayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  outline: boolean;
  color: string;
  keyframes: Keyframe[];
}

export interface Timeline {
  layers: ALayer[];
  /** Número de fotogramas (de la capa más larga). */
  length: number;
}

export interface SymbolDef {
  id: string;
  name: string;
  type: "graphic" | "movieclip" | "button";
  timeline: Timeline;
}

export interface ImageAsset {
  id: string;
  name: string;
  data: string;
  width: number;
  height: number;
}

export interface AnimDoc {
  version: 1;
  width: number;
  height: number;
  fps: number;
  background: string;
  main: Timeline;
  symbols: SymbolDef[];
  images: ImageAsset[];
  /** Fotogramas del papel cebolla antes y después. */
  onion: { before: number; after: number };
}

export const ACCENT = "#e8433f";
export const ACCENT_DARK = "#b8322f";
