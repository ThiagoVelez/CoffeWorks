// Modelo de datos de CoffeePhoto.
//
// Un documento es un lienzo de ancho × alto píxeles con una pila de capas
// (de abajo arriba). Las capas de píxeles guardan su contenido como una
// "ficha" del almacén de píxeles (ver services/pixels.ts): un lienzo en
// memoria mientras se edita y una imagen PNG al guardar.

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export const BLEND_MODES: Array<{ value: BlendMode; label: string }> = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiplicar" },
  { value: "screen", label: "Trama" },
  { value: "overlay", label: "Superponer" },
  { value: "darken", label: "Oscurecer" },
  { value: "lighten", label: "Aclarar" },
  { value: "color-dodge", label: "Sobreexponer color" },
  { value: "color-burn", label: "Subexponer color" },
  { value: "hard-light", label: "Luz fuerte" },
  { value: "soft-light", label: "Luz suave" },
  { value: "difference", label: "Diferencia" },
  { value: "exclusion", label: "Exclusión" },
  { value: "hue", label: "Tono" },
  { value: "saturation", label: "Saturación" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosidad" },
];

export type AdjustKind =
  | "brightness"
  | "levels"
  | "curves"
  | "hsl"
  | "colorBalance"
  | "exposure"
  | "vibrance"
  | "blackWhite"
  | "photoFilter"
  | "invert"
  | "threshold"
  | "posterize"
  | "gradientMap";

export interface Adjustment {
  kind: AdjustKind;
  /** Parámetros de cada ajuste (ver services/adjust.ts). */
  params: Record<string, number | string | number[]>;
}

export interface TextStyle {
  text: string;
  font: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  /** Sombra paralela sencilla. */
  shadow: boolean;
  /** Contorno. */
  stroke: number;
  strokeColor: string;
}

export interface LayerStyle {
  dropShadow?: { color: string; opacity: number; distance: number; angle: number; blur: number };
  stroke?: { color: string; size: number };
  outerGlow?: { color: string; opacity: number; size: number };
}

interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend: BlendMode;
  /** Máscara (ficha del almacén de píxeles; blanco = visible). */
  mask?: string | null;
  maskEnabled?: boolean;
  style?: LayerStyle;
}

export interface RasterLayer extends LayerBase {
  kind: "raster";
  /** Ficha del almacén de píxeles, del tamaño del documento. */
  data: string;
}

export interface TextLayer extends LayerBase {
  kind: "text";
  x: number;
  y: number;
  /** Ancho del cuadro de texto (0 = una sola línea sin ajuste). */
  width: number;
  rotation: number;
  textStyle: TextStyle;
}

export interface AdjustLayer extends LayerBase {
  kind: "adjust";
  adjust: Adjustment;
}

export type Layer = RasterLayer | TextLayer | AdjustLayer;

export interface PhotoDoc {
  version: 1;
  width: number;
  height: number;
  /** Resolución para imprimir (ppp). */
  dpi: number;
  layers: Layer[];
  activeId: string;
  guides?: { x: number[]; y: number[] };
}

export type Tool =
  | "move"
  | "marquee"
  | "ellipseSelect"
  | "lasso"
  | "polyLasso"
  | "wand"
  | "crop"
  | "eyedropper"
  | "heal"
  | "brush"
  | "pencil"
  | "clone"
  | "eraser"
  | "gradient"
  | "bucket"
  | "dodge"
  | "burn"
  | "blurTool"
  | "text"
  | "shape"
  | "hand"
  | "zoom";

export interface BrushSettings {
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
  /** El tamaño responde a la presión del lápiz. */
  pressure: boolean;
}

export interface ToolOptions {
  brush: BrushSettings;
  eraser: BrushSettings;
  clone: BrushSettings;
  heal: BrushSettings;
  tone: BrushSettings & { range: "shadows" | "midtones" | "highlights" };
  blur: BrushSettings;
  selectMode: "new" | "add" | "subtract" | "intersect";
  feather: number;
  wandTolerance: number;
  wandContiguous: boolean;
  /** Muestrear todas las capas (varita, cubo, cuentagotas). */
  sampleAll: boolean;
  bucketTolerance: number;
  gradientType: "linear" | "radial";
  gradientMode: "fgbg" | "fgTransparent";
  shape: "rect" | "ellipse" | "line" | "roundRect";
  shapeFill: boolean;
  shapeStroke: number;
  cornerRadius: number;
}

export const ACCENT = "#e8452c";
export const ACCENT_DARK = "#b8341f";
