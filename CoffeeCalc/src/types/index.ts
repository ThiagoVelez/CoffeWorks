// Tipos de datos de CoffeeCalc (hoja de cálculo de la suite CoffeeWorks)

export type CellFormat = "general" | "number" | "currency" | "percent" | "date" | "text";

export type CellAlign = "left" | "center" | "right";

export type CellVAlign = "top" | "middle" | "bottom";

export interface CellBorders {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

export type CellValue = number | string | boolean | null;

export interface CellData {
  /** Lo que el usuario escribió: un valor o una fórmula que empieza por "=". */
  raw: string;
  /** Resultado calculado por el motor de fórmulas. */
  computed?: CellValue;
  /** Valor que traía la fórmula en un libro importado (por si la función no existe aquí). */
  cached?: CellValue;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: CellAlign;
  valign?: CellVAlign;
  color?: string;
  bg?: string;
  format?: CellFormat;
  decimals?: number;
  currency?: string;
  borders?: CellBorders;
  fontFamily?: string;
  fontSize?: number;
  wrapText?: boolean;
  /** Dirección web asociada a la celda. */
  link?: string;
  /** Comentario de la celda. */
  note?: string;
}

/** Propiedades de formato que se copian con "Copiar formato". */
export const STYLE_KEYS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "align",
  "valign",
  "color",
  "bg",
  "format",
  "decimals",
  "currency",
  "borders",
  "fontFamily",
  "fontSize",
  "wrapText",
] as const;

export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Rango normalizado (r1 <= r2, c1 <= c2). */
export interface Bounds {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export type ChartType = "bar" | "line" | "area" | "pie";

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  /** Rango de datos del que se alimenta el gráfico. */
  range: Bounds;
  /** Posición y tamaño sobre la hoja, en píxeles. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ConditionKind = "gt" | "lt" | "eq" | "neq" | "between" | "contains" | "duplicate" | "top";

export interface ConditionalRule {
  id: string;
  range: Bounds;
  kind: ConditionKind;
  value: string;
  value2?: string;
  bg: string;
  color: string;
}

export interface FilterState {
  /** Rango filtrado; su primera fila es la de encabezados. */
  range: Bounds;
  /** Por columna, los valores (texto mostrado) que se ocultan. */
  excluded: Record<number, string[]>;
}

export interface Sheet {
  id: string;
  name: string;
  data: Record<string, CellData>;
  colWidths?: Record<string, number>;
  rowHeights?: Record<number, number>;
  merges?: Bounds[];
  charts?: ChartConfig[];
  conditional?: ConditionalRule[];
  filter?: FilterState | null;
  frozenRows?: number;
  frozenCols?: number;
  isProtected?: boolean;
  /** Color de la pestaña de la hoja. */
  tabColor?: string;
}

export interface WorkbookMetadata {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workbook {
  metadata: WorkbookMetadata;
  sheets: Sheet[];
  activeSheetId: string;
}

export interface SelectionStats {
  count: number;
  numericCount: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export type ExportFormat = "cfs" | "xlsx" | "csv" | "pdf";

export const DEFAULT_COL_WIDTH = 110;
export const DEFAULT_ROW_HEIGHT = 24;
export const HEADER_WIDTH = 48;
export const HEADER_HEIGHT = 24;
