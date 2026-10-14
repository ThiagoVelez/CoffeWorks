// Tipos de datos para CoffeView (Herramienta de Presentaciones estilo Microsoft PowerPoint)

export type ElementType = "title" | "subtitle" | "text" | "shape" | "image";

export type ShapeType = "rectangle" | "circle" | "arrow-right" | "star";

export type TextAlign = "left" | "center" | "right" | "justify";

export interface SlideElement {
  id: string;
  type: ElementType;
  x: number; // Porcentaje relativo al ancho (0 - 100)
  y: number; // Porcentaje relativo al alto (0 - 100)
  width: number; // Porcentaje de ancho (0 - 100)
  height: number; // Porcentaje de alto (0 - 100)
  content: string; // Texto o URL de imagen
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  underline?: boolean;
  align?: TextAlign;
  color?: string;
  bg?: string;
  shapeType?: ShapeType;
  zIndex?: number;
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
