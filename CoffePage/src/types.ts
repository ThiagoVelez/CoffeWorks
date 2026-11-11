// Modelo de datos de CoffePage.
//
// Un cuaderno (.cpg) contiene secciones y cada sección contiene páginas. Las
// páginas son lienzos libres: se escribe en cualquier punto (bloques de texto
// con posición propia), se pegan imágenes y se dibuja a mano alzada encima.

export type PaperStyle = "blank" | "lines" | "grid";

export interface TextBlock {
  id: string;
  kind: "text";
  x: number;
  y: number;
  width: number;
  html: string;
}

export interface ImageBlock {
  id: string;
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

export type Block = TextBlock | ImageBlock;

export interface Stroke {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  points: [number, number][];
}

export interface Page {
  id: string;
  title: string;
  /** 0 = página, 1 = subpágina (sangrada bajo la anterior). */
  level: 0 | 1;
  createdAt: number;
  updatedAt: number;
  paper: PaperStyle;
  blocks: Block[];
  strokes: Stroke[];
}

export interface Section {
  id: string;
  name: string;
  color: string;
  pages: Page[];
}

export interface Notebook {
  format: "coffepage";
  version: 1;
  sections: Section[];
}

export type Tool = "type" | "select" | "pen" | "highlighter" | "eraser";

export interface InkStyle {
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  highlighterWidth: number;
}

/** Colores de las pestañas de sección (como los separadores de un cuaderno). */
export const SECTION_COLORS = [
  "#8e24aa",
  "#1e88e5",
  "#43a047",
  "#fb8c00",
  "#e53935",
  "#00897b",
  "#f4b400",
  "#6d4c41",
];

export const ACCENT = "#7b1fa2";
export const ACCENT_DARK = "#4a148c";
export const ACCENT_LIGHT = "#f3e5f5";
