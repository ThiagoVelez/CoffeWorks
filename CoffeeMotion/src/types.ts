// Modelo de CoffeeMotion: un proyecto (.cmo) con recursos y composiciones;
// cada composición tiene capas cuyas propiedades se animan con fotogramas
// clave (con suavizado) o con expresiones.

export type Ease = "linear" | "hold" | "easeIn" | "easeOut" | "easeInOut" | "bezier";

export interface Keyframe<T> {
  id: string;
  /** Segundos (tiempo de la composición). */
  t: number;
  v: T;
  ease: Ease;
  /** Curva personalizada (x1, y1, x2, y2) si `ease` es "bezier". */
  bez?: [number, number, number, number];
}

export interface Prop<T> {
  value: T;
  keys?: Keyframe<T>[];
  /** Expresión (JavaScript): `time`, `value`, `wiggle(f, a)`, `loopOut()`... */
  expr?: string;
}

export type Vec = [number, number];
export type Color = string;

export type LayerType = "shape" | "text" | "image" | "video" | "audio" | "solid" | "null" | "precomp" | "adjustment";
export type ShapeKind = "rect" | "ellipse" | "star" | "polygon" | "path";
export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity" | "add";
export type MatteMode = "none" | "alpha" | "alphaInverted" | "luma" | "lumaInverted";

export interface PathPoint {
  x: number;
  y: number;
  /** Manejadores relativos al punto. */
  ix: number;
  iy: number;
  ox: number;
  oy: number;
}

export interface Transform {
  anchor: Prop<Vec>;
  position: Prop<Vec>;
  /** Porcentaje. */
  scale: Prop<Vec>;
  /** Grados. */
  rotation: Prop<number>;
  /** 0..100 */
  opacity: Prop<number>;
}

export interface ShapeData {
  kind: ShapeKind;
  size: Prop<Vec>;
  roundness: Prop<number>;
  /** Estrella/polígono. */
  points: number;
  innerRatio: number;
  path: PathPoint[];
  closed: boolean;
  fill: Prop<Color>;
  fillOn: boolean;
  stroke: Prop<Color>;
  strokeWidth: Prop<number>;
  strokeOn: boolean;
  /** Recortar trazados (0..100). */
  trimStart: Prop<number>;
  trimEnd: Prop<number>;
  dash: number;
  /** Degradado de relleno (si hay dos colores). */
  gradient: { on: boolean; to: Color; angle: number; radial: boolean };
}

export type TextAnimator = "none" | "typewriter" | "fadeChars" | "slideChars" | "scaleChars" | "blurChars" | "wave";

export interface TextData {
  text: Prop<string>;
  font: string;
  weight: number;
  italic: boolean;
  size: Prop<number>;
  color: Prop<Color>;
  align: "left" | "center" | "right";
  tracking: Prop<number>;
  lineHeight: number;
  stroke: Color;
  strokeWidth: number;
  /** Animador de texto por caracteres, controlado por `progress` (0..100). */
  animator: TextAnimator;
  progress: Prop<number>;
}

export type EffectKind = "blur" | "glow" | "shadow" | "brightness" | "hueSat" | "tint" | "fill" | "invert" | "noise" | "vignette" | "mosaic" | "directionalBlur" | "stroke";

export interface Effect {
  id: string;
  kind: EffectKind;
  enabled: boolean;
  params: Record<string, Prop<number> | Prop<Color>>;
}

export interface Mask {
  id: string;
  name: string;
  kind: "rect" | "ellipse" | "path";
  /** Rectángulo/elipse en coordenadas de la capa. */
  rect: Prop<[number, number, number, number]>;
  path: PathPoint[];
  feather: Prop<number>;
  opacity: Prop<number>;
  expansion: Prop<number>;
  inverted: boolean;
  mode: "add" | "subtract" | "intersect";
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  /** Tiempo de la composición en que aparece y desaparece. */
  inPoint: number;
  outPoint: number;
  /** Desfase del contenido (video/audio/precomp): segundo de la comp en que empieza. */
  startTime: number;
  visible: boolean;
  locked: boolean;
  solo: boolean;
  /** Mostrar/ocultar las propiedades en la línea de tiempo. */
  expanded: boolean;
  label: Color;
  parent: string | null;
  blend: BlendMode;
  matte: MatteMode;
  motionBlur: boolean;
  transform: Transform;
  effects: Effect[];
  masks: Mask[];
  shape?: ShapeData;
  text?: TextData;
  /** Recurso (imagen, video o audio) o composición anidada. */
  assetId?: string;
  compId?: string;
  /** Sólido. */
  color?: Prop<Color>;
  /** Volumen en dB (audio y video). */
  volume?: Prop<number>;
  /** Velocidad de reproducción del contenido (%). */
  timeStretch?: number;
}

export interface Comp {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: Color;
  /** Área de trabajo (lo que se reproduce y se exporta). */
  workIn: number;
  workOut: number;
  layers: Layer[];
  motionBlurOn: boolean;
  shutterAngle: number;
}

export interface Asset {
  id: string;
  name: string;
  kind: "image" | "video" | "audio";
  /** data: URL. */
  data: string;
  width: number;
  height: number;
  duration: number;
}

export interface Project {
  version: 1;
  assets: Asset[];
  comps: Comp[];
  activeComp: string;
}

export const ACCENT = "#c2367f";
export const ACCENT_DARK = "#9c2c6b";

export const LABELS = ["#e8590c", "#f59f00", "#d6336c", "#ae3ec9", "#4dabf7", "#20c997", "#94d82d", "#fab005", "#ff8787", "#868e96"];
