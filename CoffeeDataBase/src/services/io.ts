// Importar y exportar: CSV, Excel (.xlsx), bases de datos de escritorio
// (.accdb/.mdb, solo lectura), scripts SQL e informes para imprimir.

import { Buffer } from "buffer";
import XLSX from "xlsx-js-style";
import type { ColumnDraft, FieldType } from "../types";
import { CoffeeDb, coerce, quoteId, quoteValue } from "./engine";
import { inferType } from "./assistant";

let keySeq = 0;
const draft = (name: string, type: FieldType, pk = false): ColumnDraft => ({
  key: `imp_${keySeq++}`,
  original: null,
  name,
  type,
  pk,
  notNull: false,
  unique: false,
  defaultValue: "",
});

/** Nombre de tabla válido y que no choque con las existentes. */
export function uniqueTableName(db: CoffeeDb, wanted: string): string {
  const base = (wanted.replace(/\.[^.]+$/, "").trim() || "tabla").replace(/[^\p{L}\p{N}_ ]/gu, "_").slice(0, 60);
  const taken = new Set(db.schema().tables.map((t) => t.name.toLowerCase()));
  let name = base;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base}_${i}`;
  return name;
}

function cleanHeaders(headers: unknown[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    let name = String(h ?? "").trim() || `campo_${i + 1}`;
    if (name.toLowerCase() === "id") name = "id_original";
    const n = seen.get(name.toLowerCase()) || 0;
    seen.set(name.toLowerCase(), n + 1);
    return n ? `${name}_${n + 1}` : name;
  });
}

/** Crea una tabla a partir de una matriz (primera fila = encabezados). */
export function importMatrix(db: CoffeeDb, tableName: string, matrix: unknown[][]): { table: string; rows: number } {
  const rows = matrix.filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== undefined && String(v).trim() !== ""));
  if (rows.length === 0) throw new Error("El archivo no tiene datos.");
  const headers = cleanHeaders(rows[0]);
  const body = rows.slice(1);
  const types = headers.map((_, i) => inferType(body.map((r) => r[i])));
  const table = uniqueTableName(db, tableName);
  const columns = [draft("id", "autonumber", true), ...headers.map((h, i) => draft(h, types[i]))];
  db.transaction(() => {
    db.createTable(table, columns, []);
    const sql = `INSERT INTO ${quoteId(table)} (${headers.map(quoteId).join(", ")}) VALUES (${headers.map(() => "?").join(", ")})`;
    for (const r of body) {
      const values = headers.map((_, i) => {
        const v = r[i];
        if (v === null || v === undefined || v === "") return null;
        if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
        if (typeof v === "number") return types[i] === "boolean" ? (v ? 1 : 0) : v;
        try {
          return coerce(String(v), types[i]);
        } catch {
          return String(v);
        }
      });
      db.run(sql, values as never[]);
    }
  });
  return { table, rows: body.length };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const delimiter = [";", ",", "\t", "|"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(columns: string[], rows: unknown[][]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Uint8Array ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Punto y coma: Excel en español lo abre directamente en columnas
  return "﻿" + [columns.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

export function importExcel(db: CoffeeDb, bytes: Uint8Array): { table: string; rows: number }[] {
  const book = XLSX.read(bytes, { type: "array", cellDates: true });
  const results: { table: string; rows: number }[] = [];
  for (const name of book.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, raw: true, defval: null });
    if (matrix.length < 1) continue;
    try {
      results.push(importMatrix(db, name, matrix));
    } catch {
      // Hoja vacía
    }
  }
  if (!results.length) throw new Error("El libro no tiene hojas con datos.");
  return results;
}

export function toXlsx(sheets: { name: string; columns: string[]; rows: unknown[][] }[]): Uint8Array {
  const book = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sheet of sheets) {
    const data = [sheet.columns, ...sheet.rows.map((r) => r.map((v) => (v instanceof Uint8Array ? `(binario ${v.length} bytes)` : v)))];
    const ws = XLSX.utils.aoa_to_sheet(data);
    sheet.columns.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[ref]) ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "9B111E" } }, alignment: { vertical: "center" } };
    });
    ws["!cols"] = sheet.columns.map((name, c) => ({
      wch: Math.min(50, Math.max(name.length, ...sheet.rows.slice(0, 200).map((r) => String(r[c] ?? "").length)) + 2),
    }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    let name = sheet.name.replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "Hoja";
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${sheet.name.slice(0, 28)}_${i}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(book, ws, name);
  }
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Bases de datos de escritorio (.accdb / .mdb)
// ---------------------------------------------------------------------------

function mapDesktopType(type: string): FieldType {
  switch (type) {
    case "boolean":
      return "boolean";
    case "byte":
    case "integer":
    case "long":
    case "bigint":
      return "integer";
    case "currency":
      return "currency";
    case "float":
    case "double":
    case "numeric":
      return "decimal";
    case "datetime":
    case "datetimeextended":
      return "date";
    case "memo":
      return "longText";
    case "binary":
    case "ole":
      return "binary";
    default:
      return "shortText";
  }
}

/** Importa todas las tablas de un archivo .accdb o .mdb (sin contraseña). */
export async function importDesktopDb(db: CoffeeDb, bytes: Uint8Array): Promise<{ table: string; rows: number }[]> {
  const { default: MDBReader } = await import("mdb-reader");
  let reader;
  try {
    reader = new MDBReader(Buffer.from(bytes));
  } catch (err) {
    throw new Error(`No se pudo leer el archivo: ${err instanceof Error ? err.message : String(err)}. Si tiene contraseña, quítala antes de importarlo.`);
  }
  const results: { table: string; rows: number }[] = [];
  for (const sourceName of reader.getTableNames()) {
    const source = reader.getTable(sourceName);
    const cols = source.getColumns();
    const auto = cols.find((c) => (c as { autoLong?: boolean }).autoLong);
    const columns = cols.map((c) => draft(c.name, auto && c.name === auto.name ? "autonumber" : mapDesktopType(String(c.type)), auto?.name === c.name));
    const table = uniqueTableName(db, sourceName);
    const data = source.getData();
    db.transaction(() => {
      db.createTable(table, columns, []);
      const sql = `INSERT INTO ${quoteId(table)} (${columns.map((c) => quoteId(c.name)).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
      for (const row of data) {
        const values = columns.map((c) => {
          const v = (row as Record<string, unknown>)[c.name];
          if (v === null || v === undefined) return null;
          if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ").replace(" 00:00:00", "");
          if (typeof v === "boolean") return v ? 1 : 0;
          if (typeof v === "bigint") return Number(v);
          if (v instanceof Uint8Array) return v;
          if (c.type === "currency" || c.type === "decimal") {
            const n = Number(v);
            return Number.isFinite(n) ? n : String(v);
          }
          return typeof v === "number" ? v : String(v);
        });
        db.run(sql, values as never[]);
      }
    });
    results.push({ table, rows: data.length });
  }
  if (!results.length) throw new Error("El archivo no tiene tablas.");
  return results;
}

// ---------------------------------------------------------------------------
// Script SQL
// ---------------------------------------------------------------------------

/** Copia completa (estructura + datos) como script SQL. */
export function sqlDump(db: CoffeeDb): string {
  const lines = ["-- Copia generada por CoffeeDataBase", "PRAGMA foreign_keys = OFF;", "BEGIN TRANSACTION;"];
  const objects = db.values<string>("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'table' DESC, name");
  for (const [type, name, sql] of objects) {
    lines.push(`${sql};`);
    if (type !== "table") continue;
    const result = db.query(`SELECT * FROM ${quoteId(name)}`, [], Number.MAX_SAFE_INTEGER);
    for (const row of result.rows) {
      lines.push(`INSERT INTO ${quoteId(name)} (${result.columns.map(quoteId).join(", ")}) VALUES (${row.map(quoteValue).join(", ")});`);
    }
  }
  lines.push("COMMIT;", "PRAGMA foreign_keys = ON;");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Informes
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export function reportHtml(title: string, columns: string[], rows: unknown[][], subtitle = ""): string {
  const head = columns.map((c) => `<th>${esc(c)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((v) => `<td>${esc(v === null || v === undefined ? "" : v instanceof Uint8Array ? "(binario)" : String(v))}</td>`).join("")}</tr>`)
    .join("\n");
  const date = new Date().toLocaleString("es");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#222;margin:28px;}
h1{font-size:22px;margin:0;color:#6e0a16;} .sub{color:#666;font-size:12px;margin:4px 0 16px;}
table{border-collapse:collapse;width:100%;font-size:12px;} th{background:#9b111e;color:#fff;text-align:left;padding:6px 8px;}
td{border-bottom:1px solid #e5d4d6;padding:5px 8px;vertical-align:top;} tr:nth-child(even) td{background:#fbf3f4;}
.foot{margin-top:12px;font-size:11px;color:#888;} @page{margin:14mm;}
</style></head><body><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)} ${esc(date)}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="foot">${rows.length} registros · CoffeeDataBase</div></body></html>`;
}

export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  }, 250);
}

// ---------------------------------------------------------------------------
// Access (.accdb / .mdb) mediante el complemento «Compatibilidad con Access»
// ---------------------------------------------------------------------------

/** Describe la base (tablas, filas y relaciones) para el complemento coffee-accdb. */
export function accessExportJson(db: CoffeeDb): string {
  const schema = db.schema();
  const tables = schema.tables.map((t) => {
    const r = db.query(`SELECT ${t.columns.map((c) => quoteId(c.name)).join(", ")} FROM ${quoteId(t.name)}`, [], Number.MAX_SAFE_INTEGER);
    return {
      name: t.name,
      columns: t.columns.map((c) => ({ name: c.name, type: c.autoIncrement ? "autonumber" : c.type, pk: c.pk })),
      rows: r.rows.map((row) => row.map((v) => (v instanceof Uint8Array ? `base64:${Buffer.from(v).toString("base64")}` : v))),
    };
  });
  const relationships = schema.tables.flatMap((t) =>
    t.foreignKeys.map((fk) => ({
      parent: fk.table,
      parentColumn: fk.to,
      child: t.name,
      childColumn: fk.column,
      cascadeDelete: fk.onDelete === "CASCADE",
      cascadeNull: fk.onDelete === "SET NULL",
    }))
  );
  return JSON.stringify({ tables, relationships });
}
