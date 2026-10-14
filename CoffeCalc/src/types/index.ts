// Tipos de datos para CoffeCalc (Hoja de cálculo profesional estilo Microsoft Excel)

export type CellFormat = "general" | "currency" | "percent" | "number";

export type CellAlign = "left" | "center" | "right";

export interface CellBorders {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

export interface CellData {
  raw: string;
  computed?: string | number | null;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: CellAlign;
  color?: string;
  bg?: string;
  format?: CellFormat;
  borders?: CellBorders;
  fontFamily?: string;
  fontSize?: number;
  wrapText?: boolean;
  decimals?: number;
}

export interface ChartConfig {
  type: "bar" | "line" | "pie";
  title: string;
  data: Array<{ label: string; value: number }>;
}

export interface Sheet {
  id: string;
  name: string;
  data: Record<string, CellData>;
  colWidths?: Record<string, number>;
  rowHeights?: Record<number, number>;
  isProtected?: boolean;
  filterEnabled?: boolean;
  frozenPanes?: boolean;
  showRawFormulas?: boolean;
  chart?: ChartConfig | null;
}

export interface WorkbookMetadata {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SelectionStats {
  count: number;
  numericCount: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export type ExcelRibbonTab =
  | "inicio"
  | "insertar"
  | "dibujar"
  | "disposicion"
  | "formulas"
  | "datos"
  | "revisar"
  | "vista"
  | "ayuda";
