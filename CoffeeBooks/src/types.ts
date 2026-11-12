// Modelo de CoffeeBooks (.cbk): un espacio de trabajo con páginas anidadas
// hechas de bloques y bases de datos con vistas de tabla, tablero y lista.

export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "todo"
  | "toggle"
  | "quote"
  | "callout"
  | "code"
  | "divider"
  | "image"
  | "page"
  | "table";

export type BlockColor = "default" | "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red";

export interface Block {
  id: string;
  type: BlockType;
  /** Texto con formato (HTML limitado: b, i, u, s, code, a, mark, br). */
  text: string;
  checked?: boolean;
  /** Desplegable abierto. */
  open?: boolean;
  /** Bloques dentro de un desplegable. */
  children?: Block[];
  color?: BlockColor;
  /** Emoji del aviso. */
  emoji?: string;
  /** Lenguaje del bloque de código. */
  lang?: string;
  /** Imagen (data: URL o https). */
  src?: string;
  /** Enlace a una subpágina. */
  pageId?: string;
  /** Tabla simple: filas × columnas de texto. */
  rows?: string[][];
}

export type ColumnType = "title" | "text" | "number" | "select" | "multi" | "date" | "checkbox" | "url";

export interface SelectOption {
  id: string;
  name: string;
  color: BlockColor;
}

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  options?: SelectOption[];
  width?: number;
}

export interface Row {
  id: string;
  values: Record<string, string | number | boolean | string[] | null>;
  /** Contenido de la fila al abrirla como página. */
  blocks: Block[];
  createdAt: number;
}

export interface DbView {
  id: string;
  name: string;
  kind: "table" | "board" | "list" | "calendar";
  /** Columna de agrupación (tablero) o de fecha (calendario). */
  groupBy?: string;
  sort?: { column: string; dir: "asc" | "desc" } | null;
  filter?: { column: string; op: "contains" | "is" | "isNot" | "checked" | "unchecked" | "empty" | "notEmpty"; value: string } | null;
}

export interface Database {
  columns: Column[];
  rows: Row[];
  views: DbView[];
  activeView: string;
}

export interface Page {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  /** Portada: id de degradado o null. */
  cover: string | null;
  kind: "page" | "database";
  blocks: Block[];
  db?: Database;
  fullWidth: boolean;
  expanded: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  version: 1;
  name: string;
  pages: Page[];
  favorites: string[];
  /** Páginas eliminadas (se pueden restaurar). */
  trash: Page[];
}

export const ACCENT = "#2f2f2f";
export const ACCENT_DARK = "#191919";

export const COLOR_STYLE: Record<BlockColor, { fg: string; bg: string }> = {
  default: { fg: "#37352f", bg: "#f1f1ef" },
  gray: { fg: "#787774", bg: "#f1f1ef" },
  brown: { fg: "#9f6b53", bg: "#f4eeee" },
  orange: { fg: "#d9730d", bg: "#fbecdd" },
  yellow: { fg: "#cb912f", bg: "#fbf3db" },
  green: { fg: "#448361", bg: "#edf3ec" },
  blue: { fg: "#337ea9", bg: "#e7f3f8" },
  purple: { fg: "#9065b0", bg: "#f6f3f9" },
  pink: { fg: "#c14c8a", bg: "#faf1f5" },
  red: { fg: "#d44c47", bg: "#fdebec" },
};

export const COLOR_NAME: Record<BlockColor, string> = {
  default: "Predeterminado",
  gray: "Gris",
  brown: "Marrón",
  orange: "Naranja",
  yellow: "Amarillo",
  green: "Verde",
  blue: "Azul",
  purple: "Morado",
  pink: "Rosa",
  red: "Rojo",
};

export const COVERS: Record<string, string> = {
  sunset: "linear-gradient(135deg,#ff9a8b,#ff6a88 50%,#ff99ac)",
  coffee: "linear-gradient(135deg,#6f4e37,#c08552)",
  ocean: "linear-gradient(135deg,#2193b0,#6dd5ed)",
  forest: "linear-gradient(135deg,#134e5e,#71b280)",
  lavender: "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  peach: "linear-gradient(135deg,#ffecd2,#fcb69f)",
  night: "linear-gradient(135deg,#232526,#414345)",
  lemon: "linear-gradient(135deg,#f6d365,#fda085)",
};
