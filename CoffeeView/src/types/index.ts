// Tipos de datos de CoffeeView (presentaciones de la suite CoffeeWorks)

export type ElementType = "title" | "subtitle" | "text" | "shape" | "image" | "table" | "video" | "line";

export type ShapeType =
  | "rectangle"
  | "rounded"
  | "circle"
  | "triangle"
  | "arrow-right"
  | "star"
  | "diamond"
  | "callout";

export type TextAlign = "left" | "center" | "right" | "justify";

export type VerticalAlign = "top" | "middle" | "bottom";

export interface SlideElement {
  id: string;
  type: ElementType;
  /** Posición y tamaño en porcentaje de la diapositiva (0 - 100). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Texto, o dirección / datos de la imagen o del vídeo. */
  content: string;
  /** Celdas de una tabla, por filas. */
  rows?: string[][];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  underline?: boolean;
  align?: TextAlign;
  valign?: VerticalAlign;
  color?: string;
  bg?: string;
  borderColor?: string;
  borderWidth?: number;
  shapeType?: ShapeType;
  /** En líneas: dibujar de abajo-izquierda a arriba-derecha. */
  flip?: boolean;
}

export type SlideLayout = "title" | "title-content" | "two-columns" | "section" | "blank";

export type SlideTransition = "none" | "fade" | "push" | "wipe" | "zoom";

export interface Slide {
  id: string;
  layout: SlideLayout;
  background?: string;
  elements: SlideElement[];
  notes: string;
  transition: SlideTransition;
  hidden?: boolean;
  /** Segundos antes de avanzar automáticamente (intervalos ensayados). */
  duration?: number;
}

export interface SlideTheme {
  id: string;
  name: string;
  slideBg: string;
  titleColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
}

export type AspectRatio = "16:9" | "4:3";

export interface PresentationMetadata {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  themeId: string;
  aspectRatio: AspectRatio;
  /** Avanzar solo usando los intervalos ensayados de cada diapositiva. */
  autoAdvance?: boolean;
}

/** Imagen subida a la biblioteca de la presentación. */
export interface MediaAsset {
  id: string;
  name: string;
  dataUrl: string;
}

export interface Presentation {
  metadata: PresentationMetadata;
  slides: Slide[];
  assets: MediaAsset[];
}

export type ExportFormat = "csl" | "pptx" | "html" | "pdf";

/** Tamaño lógico de la diapositiva en píxeles; todo se dibuja a esta escala. */
export const SLIDE_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 960, height: 540 },
  "4:3": { width: 960, height: 720 },
};

export const TEXT_TYPES: ElementType[] = ["title", "subtitle", "text", "shape"];
