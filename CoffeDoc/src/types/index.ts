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
  id: string;
  text: string;
  level: number;
}

export type DocumentTheme = "dark-espresso" | "paper-white";

export type PageSize = "A4" | "Letter";

export type LineSpacing = "1.0" | "1.15" | "1.5" | "2.0";

export type PageMargins = "normal" | "narrow" | "wide";

export type ColumnCount = 1 | 2 | 3;
