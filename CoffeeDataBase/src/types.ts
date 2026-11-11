// Modelo de CoffeeDataBase. Las bases de datos son archivos SQLite (.cdb, .db,
// .sqlite); este archivo describe cómo se presentan en la aplicación.

/** Tipos de campo que ve el usuario (se guardan como tipos de SQLite). */
export type FieldType = "autonumber" | "shortText" | "longText" | "integer" | "decimal" | "currency" | "date" | "boolean" | "binary";

export const FIELD_TYPES: { id: FieldType; label: string; sql: string; hint: string }[] = [
  { id: "autonumber", label: "Autonumérico", sql: "INTEGER", hint: "Número que se asigna solo (1, 2, 3…). Ideal como clave principal." },
  { id: "shortText", label: "Texto corto", sql: "VARCHAR(255)", hint: "Nombres, correos, códigos… hasta 255 caracteres." },
  { id: "longText", label: "Texto largo", sql: "TEXT", hint: "Descripciones y notas sin límite de longitud." },
  { id: "integer", label: "Número entero", sql: "INTEGER", hint: "Cantidades, edades, identificadores." },
  { id: "decimal", label: "Número decimal", sql: "REAL", hint: "Medidas y valores con decimales." },
  { id: "currency", label: "Moneda", sql: "DECIMAL(19,4)", hint: "Precios e importes." },
  { id: "date", label: "Fecha y hora", sql: "DATETIME", hint: "Se guarda como AAAA-MM-DD HH:MM:SS." },
  { id: "boolean", label: "Sí/No", sql: "BOOLEAN", hint: "Casillas de verificación (1 = sí, 0 = no)." },
  { id: "binary", label: "Binario (archivo)", sql: "BLOB", hint: "Imágenes u otros archivos." },
];

export const fieldLabel = (t: FieldType) => FIELD_TYPES.find((f) => f.id === t)?.label || t;

export type RefAction = "NO ACTION" | "CASCADE" | "SET NULL" | "RESTRICT";

export interface ForeignKey {
  column: string;
  table: string;
  to: string;
  onDelete: RefAction;
  onUpdate: RefAction;
}

export interface ColumnInfo {
  name: string;
  declared: string;
  type: FieldType;
  notNull: boolean;
  pk: boolean;
  autoIncrement: boolean;
  unique: boolean;
  defaultValue: string | null;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKey[];
  rowCount: number;
  sql: string;
}

export interface SavedQuery {
  name: string;
  sql: string;
}

export interface Schema {
  tables: TableInfo[];
  views: { name: string; sql: string }[];
  queries: SavedQuery[];
  indexes: { name: string; table: string; columns: string[]; unique: boolean }[];
}

/** Definición editable de un campo en el diseñador de tablas. */
export interface ColumnDraft {
  key: string;
  /** Nombre original (para conservar los datos al renombrar); null si es nuevo. */
  original: string | null;
  name: string;
  type: FieldType;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  defaultValue: string;
}

export type ViewId = "home" | "datasheet" | "design" | "form" | "sql" | "builder" | "etl" | "relations" | "assistant";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  changes: number;
  elapsedMs: number;
  /** La consulta devolvía filas (SELECT, PRAGMA, WITH…). */
  isSelect: boolean;
  truncated: boolean;
}

export const ACCENT = "#9b111e";
export const ACCENT_DARK = "#6e0a16";
export const ACCENT_LIGHT = "#fbe9eb";
