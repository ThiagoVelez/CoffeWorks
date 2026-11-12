// Modelo de datos de CoffeeVector.
//
// Un documento tiene mesas de trabajo (las "páginas" que se exportan) y una
// lista de objetos vectoriales (de abajo arriba) en coordenadas absolutas.
// Los trazados guardan sus nodos con manejadores Bézier absolutos.

export interface Pt {
  x: number;
  y: number;
}

export interface PathNode extends Pt {
  /** Manejador de entrada (absoluto). */
  hin?: Pt | null;
  /** Manejador de salida (absoluto). */
  hout?: Pt | null;
}

export interface Subpath {
  nodes: PathNode[];
  closed: boolean;
}

export interface GradientStop {
  offset: number;
  color: string;
  opacity: number;
}

export type Paint =
  | { type: "solid"; color: string; opacity: number }
  | { type: "linear"; stops: GradientStop[]; angle: number }
  | { type: "radial"; stops: GradientStop[]; cx: number; cy: number; r: number };

export interface StrokeStyle {
  color: string;
  opacity: number;
  width: number;
  cap: "butt" | "round" | "square";
  join: "miter" | "round" | "bevel";
  dash: number[];
}

interface Base {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend: string;
}

export interface PathObj extends Base {
  type: "path";
  subpaths: Subpath[];
  fill: Paint | null;
  stroke: StrokeStyle | null;
  fillRule: "nonzero" | "evenodd";
}

export interface TextObj extends Base {
  type: "text";
  x: number;
  y: number;
  text: string;
  font: string;
  size: number;
  weight: number;
  italic: boolean;
  align: "start" | "middle" | "end";
  letterSpacing: number;
  lineHeight: number;
  rotation: number;
  fill: Paint | null;
  stroke: StrokeStyle | null;
}

export interface ImageObj extends Base {
  type: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  href: string;
}

export interface GroupObj extends Base {
  type: "group";
  children: VObject[];
  /** El primer hijo recorta al resto (máscara de recorte). */
  clip: boolean;
}

export type VObject = PathObj | TextObj | ImageObj | GroupObj;

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  background: string | null;
}

export interface VDoc {
  version: 1;
  artboards: Artboard[];
  objects: VObject[];
  /** Muestras de color guardadas. */
  swatches: string[];
}

export type Tool =
  | "select"
  | "direct"
  | "pen"
  | "pencil"
  | "convert"
  | "rect"
  | "roundRect"
  | "ellipse"
  | "polygon"
  | "star"
  | "line"
  | "text"
  | "eyedropper"
  | "artboard"
  | "hand"
  | "zoom";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ACCENT = "#e8590c";
export const ACCENT_DARK = "#b34505";
