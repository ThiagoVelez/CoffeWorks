// Asistente de CoffeeDataBase: plantillas de bases de datos, datos de prueba,
// tipos sugeridos al importar y diagnóstico del diseño.

import type { ColumnDraft, FieldType, ForeignKey, Schema, TableInfo } from "../types";
import { CoffeeDb, quoteId } from "./engine";

let keySeq = 0;
const col = (name: string, type: FieldType, opts: Partial<ColumnDraft> = {}): ColumnDraft => ({
  key: `${name}_${keySeq++}`,
  original: null,
  name,
  type,
  pk: type === "autonumber",
  notNull: false,
  unique: false,
  defaultValue: "",
  ...opts,
});

const fk = (column: string, table: string, onDelete: ForeignKey["onDelete"] = "CASCADE"): ForeignKey => ({
  column,
  table,
  to: "id",
  onDelete,
  onUpdate: "CASCADE",
});

export interface Template {
  id: string;
  name: string;
  description: string;
  tables: { name: string; columns: ColumnDraft[]; foreignKeys: ForeignKey[] }[];
}

export const TEMPLATES: Template[] = [
  {
    id: "store",
    name: "Tienda: clientes, productos y pedidos",
    description: "Clientes, catálogo de productos, pedidos y el detalle de cada pedido (relación muchos a muchos).",
    tables: [
      {
        name: "clientes",
        columns: [
          col("id", "autonumber"),
          col("nombre", "shortText", { notNull: true }),
          col("correo", "shortText", { notNull: true, unique: true }),
          col("telefono", "shortText"),
          col("ciudad", "shortText"),
        ],
        foreignKeys: [],
      },
      {
        name: "productos",
        columns: [
          col("id", "autonumber"),
          col("nombre", "shortText", { notNull: true }),
          col("precio", "currency", { notNull: true, defaultValue: "0" }),
          col("stock", "integer", { notNull: true, defaultValue: "0" }),
          col("categoria", "shortText"),
        ],
        foreignKeys: [],
      },
      {
        name: "pedidos",
        columns: [
          col("id", "autonumber"),
          col("cliente_id", "integer", { notNull: true }),
          col("fecha", "date", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" }),
          col("total", "currency", { notNull: true, defaultValue: "0" }),
          col("estado", "shortText", { notNull: true, defaultValue: "PENDIENTE" }),
        ],
        foreignKeys: [fk("cliente_id", "clientes", "RESTRICT")],
      },
      {
        name: "pedidos_productos",
        columns: [
          col("id", "autonumber"),
          col("pedido_id", "integer", { notNull: true }),
          col("producto_id", "integer", { notNull: true }),
          col("cantidad", "integer", { notNull: true, defaultValue: "1" }),
          col("precio_unitario", "currency", { notNull: true }),
        ],
        foreignKeys: [fk("pedido_id", "pedidos"), fk("producto_id", "productos", "RESTRICT")],
      },
    ],
  },
  {
    id: "research",
    name: "Semilleros de investigación y estudiantes",
    description: "Grupos de investigación, estudiantes y sus membresías (tabla intermedia muchos a muchos).",
    tables: [
      {
        name: "semilleros",
        columns: [
          col("id", "autonumber"),
          col("nombre", "shortText", { notNull: true }),
          col("linea_investigacion", "shortText"),
          col("lider", "shortText"),
          col("estado", "shortText", { notNull: true, defaultValue: "ACTIVO" }),
        ],
        foreignKeys: [],
      },
      {
        name: "estudiantes",
        columns: [
          col("id", "autonumber"),
          col("nombre", "shortText", { notNull: true }),
          col("apellido", "shortText", { notNull: true }),
          col("cedula", "integer", { notNull: true, unique: true }),
          col("correo", "shortText", { notNull: true, unique: true }),
          col("carrera", "shortText"),
        ],
        foreignKeys: [],
      },
      {
        name: "estudiantes_semilleros",
        columns: [
          col("id", "autonumber"),
          col("estudiante_id", "integer", { notNull: true }),
          col("semillero_id", "integer", { notNull: true }),
          col("rol", "shortText", { notNull: true, defaultValue: "INVESTIGADOR" }),
          col("fecha_vinculacion", "date", { notNull: true, defaultValue: "CURRENT_DATE" }),
        ],
        foreignKeys: [fk("estudiante_id", "estudiantes"), fk("semillero_id", "semilleros")],
      },
    ],
  },
  {
    id: "library",
    name: "Biblioteca: libros, socios y préstamos",
    description: "Catálogo de libros y autores, socios y préstamos con fecha de devolución.",
    tables: [
      {
        name: "autores",
        columns: [col("id", "autonumber"), col("nombre", "shortText", { notNull: true }), col("pais", "shortText")],
        foreignKeys: [],
      },
      {
        name: "libros",
        columns: [
          col("id", "autonumber"),
          col("titulo", "shortText", { notNull: true }),
          col("autor_id", "integer"),
          col("isbn", "shortText", { unique: true }),
          col("anio", "integer"),
          col("disponible", "boolean", { notNull: true, defaultValue: "1" }),
        ],
        foreignKeys: [fk("autor_id", "autores", "SET NULL")],
      },
      {
        name: "socios",
        columns: [
          col("id", "autonumber"),
          col("nombre", "shortText", { notNull: true }),
          col("correo", "shortText", { unique: true }),
          col("telefono", "shortText"),
          col("alta", "date", { defaultValue: "CURRENT_DATE" }),
        ],
        foreignKeys: [],
      },
      {
        name: "prestamos",
        columns: [
          col("id", "autonumber"),
          col("libro_id", "integer", { notNull: true }),
          col("socio_id", "integer", { notNull: true }),
          col("fecha_prestamo", "date", { notNull: true, defaultValue: "CURRENT_DATE" }),
          col("fecha_devolucion", "date"),
        ],
        foreignKeys: [fk("libro_id", "libros", "RESTRICT"), fk("socio_id", "socios", "RESTRICT")],
      },
    ],
  },
  {
    id: "inventory",
    name: "Inventario y proveedores",
    description: "Artículos, proveedores, almacenes y movimientos de entrada y salida.",
    tables: [
      {
        name: "proveedores",
        columns: [col("id", "autonumber"), col("nombre", "shortText", { notNull: true }), col("contacto", "shortText"), col("telefono", "shortText")],
        foreignKeys: [],
      },
      {
        name: "articulos",
        columns: [
          col("id", "autonumber"),
          col("codigo", "shortText", { notNull: true, unique: true }),
          col("descripcion", "shortText", { notNull: true }),
          col("proveedor_id", "integer"),
          col("costo", "currency", { defaultValue: "0" }),
          col("stock_minimo", "integer", { defaultValue: "0" }),
        ],
        foreignKeys: [fk("proveedor_id", "proveedores", "SET NULL")],
      },
      {
        name: "movimientos",
        columns: [
          col("id", "autonumber"),
          col("articulo_id", "integer", { notNull: true }),
          col("tipo", "shortText", { notNull: true, defaultValue: "ENTRADA" }),
          col("cantidad", "integer", { notNull: true }),
          col("fecha", "date", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" }),
          col("notas", "longText"),
        ],
        foreignKeys: [fk("articulo_id", "articulos")],
      },
    ],
  },
];

export function applyTemplate(db: CoffeeDb, template: Template) {
  const existing = new Set(db.schema().tables.map((t) => t.name));
  const clash = template.tables.find((t) => existing.has(t.name));
  if (clash) throw new Error(`Ya existe una tabla llamada «${clash.name}».`);
  db.transaction(() => {
    for (const t of template.tables) db.createTable(t.name, t.columns, t.foreignKeys);
  });
}

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const FIRST = ["Ana", "Carlos", "Lucía", "Mateo", "Valentina", "Santiago", "Camila", "Juan", "Sofía", "Andrés", "Isabella", "Diego", "Mariana", "Felipe", "Daniela", "Tomás"];
const LAST = ["García", "Rodríguez", "Martínez", "López", "Gómez", "Pérez", "Sánchez", "Ramírez", "Torres", "Vargas", "Castro", "Morales", "Rojas", "Herrera"];
const CITIES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Madrid", "Barcelona", "México", "Lima", "Quito", "Buenos Aires", "Santiago", "Montevideo"];
const PRODUCTS = ["Café de origen", "Taza de cerámica", "Molinillo", "Prensa francesa", "Filtro de papel", "Termo", "Chocolate", "Té verde", "Galletas", "Cafetera italiana"];
const WORDS = ["proyecto", "informe", "revisión", "análisis", "plan", "diseño", "entrega", "reunión", "propuesta", "ciclo"];
const STATES = ["PENDIENTE", "ENVIADO", "ENTREGADO", "CANCELADO", "ACTIVO", "INACTIVO"];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

function fakeValue(column: TableInfo["columns"][number], index: number): unknown {
  const n = slug(column.name);
  const first = pick(FIRST);
  const last = pick(LAST);
  switch (column.type) {
    case "boolean":
      return Math.random() < 0.7 ? 1 : 0;
    case "date": {
      const d = new Date(Date.now() - rint(0, 730) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    case "currency":
    case "decimal":
      return Math.round(Math.random() * (n.includes("precio") || n.includes("costo") ? 200 : 1000) * 100) / 100;
    case "integer":
      if (n.includes("anio") || n.includes("year")) return rint(1950, 2025);
      if (n.includes("cedula") || n.includes("documento") || n.includes("dni")) return 10_000_000 + index * 7919 + rint(0, 7000);
      if (n.includes("edad")) return rint(16, 80);
      return rint(1, n.includes("stock") || n.includes("cantidad") ? 50 : 500);
    case "binary":
      return null;
    default:
      if (n.includes("correo") || n.includes("email")) return `${slug(first)}.${slug(last)}${index}@ejemplo.com`;
      if (n.includes("telefono") || n.includes("celular")) return `+57 3${rint(0, 2)}${rint(0, 9)} ${rint(100, 999)} ${rint(1000, 9999)}`;
      if (n.includes("ciudad") || n.includes("pais")) return pick(CITIES);
      if (n.includes("apellido")) return last;
      if (n.includes("producto") || n.includes("titulo") || n.includes("descripcion") && !n.includes("larga")) return `${pick(PRODUCTS)} ${index + 1}`;
      if (n.includes("nombre") || n.includes("lider") || n.includes("contacto") || n.includes("autor")) return `${first} ${last}`;
      if (n.includes("estado") || n.includes("tipo") || n.includes("rol")) return pick(STATES);
      if (n.includes("codigo") || n.includes("isbn") || n.includes("serie")) return `${n.slice(0, 3).toUpperCase()}-${(index + 1).toString().padStart(5, "0")}`;
      if (column.type === "longText" || n.includes("nota") || n.includes("comentario")) return `${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)}`;
      return `${column.name} ${index + 1}`;
  }
}

/** Inserta `count` registros inventados, respetando relaciones y campos únicos. */
export function generateMockData(db: CoffeeDb, table: string, count: number): number {
  const info = db.tableInfo(table);
  const parents = new Map<string, unknown[]>();
  for (const f of info.foreignKeys) {
    const ids = db.values(`SELECT ${quoteId(f.to || "rowid")} FROM ${quoteId(f.table)} LIMIT 5000`).map((r) => r[0]);
    if (!ids.length) throw new Error(`Primero añade registros a «${f.table}»: «${table}.${f.column}» necesita que existan.`);
    parents.set(f.column, ids);
  }
  const columns = info.columns.filter((c) => !c.autoIncrement);
  const start = info.rowCount;
  let inserted = 0;
  db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const values = columns.map((c) => (parents.has(c.name) ? pick(parents.get(c.name) as unknown[]) : fakeValue(c, start + i)));
      try {
        db.run(
          `INSERT INTO ${quoteId(table)} (${columns.map((c) => quoteId(c.name)).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
          values as never[]
        );
        inserted++;
      } catch {
        // Un valor único repetido: se omite ese registro
      }
    }
  });
  return inserted;
}

// ---------------------------------------------------------------------------
// Tipos sugeridos al importar
// ---------------------------------------------------------------------------

export function inferType(values: unknown[]): FieldType {
  const sample = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "").slice(0, 500);
  if (!sample.length) return "shortText";
  const strings = sample.map((v) => String(v).trim());
  if (strings.every((s) => /^(s[ií]|no|true|false|verdadero|falso|0|1)$/i.test(s)) && strings.some((s) => !/^[01]$/.test(s))) return "boolean";
  if (strings.every((s) => /^-?\d{1,15}$/.test(s))) return "integer";
  if (strings.every((s) => /^-?\d+([.,]\d+)?$/.test(s))) return "decimal";
  if (strings.every((s) => /^\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?/.test(s) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(s))) return "date";
  if (strings.some((s) => s.length > 255)) return "longText";
  return "shortText";
}

// ---------------------------------------------------------------------------
// Diagnóstico del diseño
// ---------------------------------------------------------------------------

export interface Finding {
  id: string;
  level: "error" | "warning" | "info";
  title: string;
  detail: string;
  fix?: {
    label: string;
    sql?: string;
    relationship?: { child: string; column: string; parent: string };
    /** Varias relaciones de una vez (tabla intermedia muchos a muchos). */
    relationships?: { child: string; column: string; parent: string }[];
  };
}

export function diagnoseSchema(db: CoffeeDb, schema: Schema): Finding[] {
  const findings: Finding[] = [];
  const tableNames = new Map(schema.tables.map((t) => [t.name.toLowerCase(), t.name]));
  for (const t of schema.tables) {
    if (!t.columns.some((c) => c.pk)) {
      findings.push({
        id: `nopk-${t.name}`,
        level: "warning",
        title: `«${t.name}» no tiene clave principal`,
        detail: "Sin clave principal no se puede identificar cada registro ni relacionarlo con otras tablas. Añade un campo Autonumérico «id» en el diseño de la tabla.",
      });
    }
    if (t.rowCount === 0) {
      findings.push({ id: `empty-${t.name}`, level: "info", title: `«${t.name}» está vacía`, detail: "Puedes añadir registros en la hoja de datos o generar datos de prueba." });
    }
    for (const f of t.foreignKeys) {
      const indexed = schema.indexes.some((i) => i.table === t.name && i.columns[0] === f.column) || t.columns.find((c) => c.name === f.column)?.unique;
      if (!indexed) {
        findings.push({
          id: `idx-${t.name}-${f.column}`,
          level: "info",
          title: `Sin índice en «${t.name}.${f.column}»`,
          detail: "Un índice en los campos relacionados acelera las búsquedas y las consultas que unen tablas.",
          fix: { label: "Crear índice", sql: `CREATE INDEX ${quoteId(`idx_${t.name}_${f.column}`)} ON ${quoteId(t.name)}(${quoteId(f.column)})` },
        });
      }
    }
    // Tabla intermedia sin relaciones: dos o más campos «algo_id» que apuntan
    // a tablas distintas indican una relación muchos a muchos
    const links = t.columns
      .filter((c) => !c.pk && !t.foreignKeys.some((f) => f.column === c.name))
      .map((c) => {
        const m = /^(.+?)_?id$/i.exec(c.name);
        if (!m) return null;
        const base = m[1].toLowerCase();
        const parent = [base, `${base}s`, `${base}es`].map((n) => tableNames.get(n)).find(Boolean);
        return parent && parent !== t.name ? { child: t.name, column: c.name, parent } : null;
      })
      .filter((x): x is { child: string; column: string; parent: string } => x !== null);
    const parents = new Set(links.map((l) => l.parent));
    if (links.length >= 2 && parents.size >= 2) {
      findings.push({
        id: `nm-${t.name}`,
        level: "warning",
        title: `«${t.name}» une ${[...parents].map((p) => `«${p}»`).join(" y ")} (muchos a muchos)`,
        detail: "Es una tabla intermedia: cada registro relaciona un elemento de cada tabla. Crear sus relaciones protege los datos y permite unirlas en las consultas.",
        fix: { label: "Crear las relaciones", relationships: links },
      });
      continue;
    }
    // Campos «algo_id» sin relación: el asistente sugiere crearla
    for (const c of t.columns) {
      const m = /^(.+?)_?id$/i.exec(c.name);
      if (!m || c.pk || t.foreignKeys.some((f) => f.column === c.name)) continue;
      const base = m[1].toLowerCase();
      const parent = [base, `${base}s`, `${base}es`].map((n) => tableNames.get(n)).find(Boolean);
      if (parent && parent !== t.name) {
        findings.push({
          id: `rel-${t.name}-${c.name}`,
          level: "warning",
          title: `«${t.name}.${c.name}» parece apuntar a «${parent}»`,
          detail: "Crear la relación evita registros huérfanos (por ejemplo, pedidos de clientes que no existen).",
          fix: { label: "Crear relación", relationship: { child: t.name, column: c.name, parent } },
        });
      }
    }
  }
  const orphans = db.values<string | number>("PRAGMA foreign_key_check");
  const byTable = new Map<string, number>();
  orphans.forEach((r) => byTable.set(String(r[0]), (byTable.get(String(r[0])) || 0) + 1));
  byTable.forEach((count, table) =>
    findings.push({
      id: `orphans-${table}`,
      level: "error",
      title: `${count} registros huérfanos en «${table}»`,
      detail: "Apuntan a registros que ya no existen en la tabla relacionada. Corrígelos o bórralos en la hoja de datos.",
    })
  );
  const integrity = db.scalar<string>("PRAGMA quick_check");
  if (integrity && integrity !== "ok") {
    findings.push({ id: "integrity", level: "error", title: "El archivo tiene daños", detail: String(integrity) });
  }
  return findings;
}
