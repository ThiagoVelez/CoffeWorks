// Tipos de datos para CoffeView (Herramienta de Presentaciones estilo Microsoft PowerPoint)

export type ElementType = "title" | "subtitle" | "text" | "shape" | "image" | "table" | "video";

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

export interface SlideElement {
  id: string;
  type: ElementType;
  x: number; // Porcentaje relativo al ancho (0 - 100)
  y: number; // Porcentaje relativo al alto (0 - 100)
  width: number; // Porcentaje de ancho (0 - 100)
  height: number; // Porcentaje de alto (0 - 100)
  content: string; // Texto, JSON de celdas o URL de imagen
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  underline?: boolean;
  align?: TextAlign;
  color?: string;
  bg?: string;
  shapeType?: ShapeType;
  zIndex?: number;
  animation?: "none" | "entrada-desvanecer" | "entrada-zoom" | "enfasis-girar" | "salida-desvanecer";
}

export type SlideLayout = "title" | "title-content" | "two-columns" | "blank";

export type SlideTransition = "none" | "fade" | "push" | "wipe" | "zoom";

export interface Slide {
  id: string;
  slideNumber: number;
  layout: SlideLayout;
  background?: string;
  elements: SlideElement[];
  notes: string;
  transition: SlideTransition;
  hidden?: boolean;
}

export interface SlideTheme {
  id: string;
  name: string;
  slideBg: string;
  titleColor: string;
  textColor: string;
  accentColor: string;
}

export interface PresentationMetadata {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  themeId: string;
}

export type PowerPointRibbonTab =
  | "inicio"
  | "insertar"
  | "dibujo"
  | "diseno"
  | "transiciones"
  | "animaciones"
  | "presentacion"
  | "revisar"
  | "vista"
  | "ayuda";
