// Modelo de datos de CoffePDF.
//
// Un documento abierto es una lista de páginas. Cada página procede de una
// página de un PDF de origen (o es una página en blanco) y lleva encima sus
// anotaciones. Las coordenadas de las anotaciones están en puntos PDF sobre la
// página tal como se ve en pantalla (ya girada), con el origen arriba a la
// izquierda. Al guardar se convierten al sistema de coordenadas de la página.

export type FontFamily = "Helvetica" | "Times" | "Courier";

export type TextAlign = "left" | "center" | "right";

export interface TextAnnotation {
  id: string;
  type: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
  color: string;
  align: TextAlign;
}

export type BoxType = "highlight" | "whiteout" | "rect" | "ellipse";

export interface BoxAnnotation {
  id: string;
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Color del trazo (o del resaltado). */
  color: string;
  /** Relleno de rectángulos y elipses; `null` sin relleno. */
  fill: string | null;
  strokeWidth: number;
}

export interface LineAnnotation {
  id: string;
  type: "line" | "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}

export interface InkAnnotation {
  id: string;
  type: "ink";
  /** Puntos consecutivos [x0, y0, x1, y1, ...]. */
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface ImageAnnotation {
  id: string;
  type: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Imagen PNG o JPEG en formato data URL. */
  dataUrl: string;
}

export type Annotation = TextAnnotation | BoxAnnotation | LineAnnotation | InkAnnotation | ImageAnnotation;

export type AnnotationType = Annotation["type"];

/** Recuadro [x0, y0, x1, y1] en coordenadas PDF de la página (CropBox). */
export type ViewBox = [number, number, number, number];

export interface PageItem {
  id: string;
  /** Índice del PDF de origen; `null` para una página en blanco. */
  source: number | null;
  /** Página dentro del PDF de origen (0 = primera). */
  index: number;
  /** Área visible de la página en su PDF de origen. */
  view: ViewBox;
  /** Giro que trae la página en el PDF de origen (0, 90, 180, 270). */
  baseRotation: number;
  /** Giro añadido por el usuario. */
  rotation: number;
  annotations: Annotation[];
}

export type FieldKind = "text" | "checkbox" | "dropdown" | "radio" | "optionlist";

export interface FormField {
  /** Clave única: índice del PDF de origen y nombre del campo. */
  key: string;
  source: number;
  name: string;
  kind: FieldKind;
  options: string[];
  /** Valor original del campo en el PDF. */
  initial: string | boolean;
  readOnly: boolean;
}

/** Estado editable (lo que guarda el historial de deshacer). */
export interface DocumentModel {
  pages: PageItem[];
  formValues: Record<string, string | boolean>;
  flattenForms: boolean;
}

export interface DocumentInfo {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

export type Tool =
  | "select"
  | "text"
  | "replace"
  | "highlight"
  | "whiteout"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "ink";

/** Valores con los que se crean las anotaciones nuevas. */
export interface ToolStyle {
  color: string;
  highlight: string;
  fill: string | null;
  strokeWidth: number;
  fontSize: number;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
}

/** Tamaño A4 en puntos. */
export const A4: ViewBox = [0, 0, 595.28, 841.89];
