// Definiciones de tipos para el procesador de textos CoffeDoc

export interface DocumentMetadata {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentStats {
  words: number;
  characters: number;
  charactersWithoutSpaces: number;
  readingTimeMinutes: number;
  pages: number;
  paragraphs: number;
}

export interface DocumentHeading {
  /** Posición del encabezado dentro del documento (orden de aparición). */
  index: number;
  text: string;
  level: number;
}

export type PageSize = "A4" | "Letter" | "Legal";

export type PageOrientation = "portrait" | "landscape";

export type LineSpacing = "1.0" | "1.15" | "1.5" | "2.0";

export type PageMargins = "normal" | "narrow" | "wide";

export type ColumnCount = 1 | 2 | 3;

/** Configuración de página que se guarda con cada documento. */
export interface PageSettings {
  pageSize: PageSize;
  orientation: PageOrientation;
  margins: PageMargins;
  columns: ColumnCount;
  pageColor: string;
  watermark: string;
  lineSpacing: string;
}

/** Cada documento puede dividirse en pestañas independientes. */
export interface DocumentTab {
  id: string;
  name: string;
  content: string;
}

/** Contenido completo de un archivo .cfd */
export interface CoffeDocument {
  metadata: DocumentMetadata;
  settings: PageSettings;
  tabs: DocumentTab[];
  activeTabId: string;
}

/** Estado del formato en la posición del cursor (para la barra de herramientas). */
export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  orderedList: boolean;
  unorderedList: boolean;
  align: "left" | "center" | "right" | "justify";
  block: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
}

export type ExportFormat = "cfd" | "docx" | "md" | "html" | "txt" | "pdf";

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  pageSize: "A4",
  orientation: "portrait",
  margins: "normal",
  columns: 1,
  pageColor: "#ffffff",
  watermark: "",
  lineSpacing: "1.5",
};

/** Dimensiones de página en píxeles CSS (96 ppp) y en milímetros. */
export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number; mm: [number, number] }> = {
  A4: { width: 794, height: 1123, mm: [210, 297] },
  Letter: { width: 816, height: 1056, mm: [215.9, 279.4] },
  Legal: { width: 816, height: 1344, mm: [215.9, 355.6] },
};

/** Márgenes de página en píxeles CSS. */
export const MARGIN_PIXELS: Record<PageMargins, number> = {
  narrow: 48,
  normal: 96,
  wide: 144,
};
