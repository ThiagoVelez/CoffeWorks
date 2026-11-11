// Motor de CoffeeDataBase: SQLite completo (sql.js, compilado a WebAssembly)
// que se ejecuta dentro de la aplicación. La base vive en memoria mientras se
// trabaja y se guarda entera en su archivo.

import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { ColumnDraft, ColumnInfo, FieldType, ForeignKey, QueryResult, RefAction, SavedQuery, Schema, TableInfo } from "../types";
import { FIELD_TYPES } from "../types";

let sqlPromise: Promise<SqlJsStatic> | null = null;
const loadSql = () => (sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl }));

/** Tablas internas de la aplicación (consultas guardadas, posiciones del diagrama). */
export const META_TABLES = ["_coffee_queries", "_coffee_meta"];
const isInternal = (name: string) => name.startsWith("sqlite_") || META_TABLES.includes(name);

export const quoteId = (name: string) => `"${name.replace(/"/g, '""')}"`;
export const quoteValue = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Uint8Array) return `X'${Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

/** Tipo de campo a partir del tipo declarado en SQLite. */
export function fieldTypeOf(declared: string, pk: boolean, autoIncrement: boolean): FieldType {
  const d = declared.toUpperCase();
  if (pk && autoIncrement) return "autonumber";
  if (/BOOL/.test(d)) return "boolean";
  if (/DATE|TIME/.test(d)) return "date";
  if (/BLOB|BINARY|IMAGE/.test(d) || d === "") return d === "" ? "shortText" : "binary";
  if (/DECIMAL|MONEY|CURRENCY|NUMERIC/.test(d)) return "currency";
  if (/REAL|FLOA|DOUB/.test(d)) return "decimal";
  if (/INT/.test(d)) return pk && autoIncrement ? "autonumber" : "integer";
  if (/CHAR\(|VARCHAR|NVARCHAR/.test(d)) return "shortText";
  if (/TEXT|CLOB|MEMO/.test(d)) return "longText";
  return "shortText";
}

export class CoffeeDb {
  private constructor(private db: Database) {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("CREATE TABLE IF NOT EXISTS _coffee_queries (name TEXT PRIMARY KEY, sql TEXT NOT NULL)");
    db.run("CREATE TABLE IF NOT EXISTS _coffee_meta (key TEXT PRIMARY KEY, value TEXT)");
  }

  /** Abre una base (bytes de un archivo SQLite) o crea una vacía. */
  static async open(bytes?: Uint8Array): Promise<CoffeeDb> {
    const SQL = await loadSql();
    if (bytes && bytes.length > 0) {
      const header = new TextDecoder().decode(bytes.slice(0, 15));
      if (header !== "SQLite format 3") throw new Error("El archivo no es una base de datos SQLite.");
    }
    return new CoffeeDb(new SQL.Database(bytes && bytes.length ? bytes : undefined));
  }

  /** Crea una base nueva ejecutando un script de plantilla del Launcher. */
  static async fromScript(sql: string): Promise<CoffeeDb> {
    const db = await CoffeeDb.open();
    db.db.exec("PRAGMA foreign_keys = OFF");
    db.db.exec(sql);
    db.db.exec("PRAGMA foreign_keys = ON");
    return db;
  }

  close() {
    this.db.close();
  }

  export(): Uint8Array {
    return this.db.export();
  }

  // -------------------------------------------------------------------------
  // Consultas
  // -------------------------------------------------------------------------

  /** Ejecuta una o varias sentencias y devuelve el resultado de la última que devuelve filas. */
  query(sql: string, params: SqlValue[] = [], maxRows = 5000): QueryResult {
    const started = performance.now();
    const trimmed = sql.trim();
    if (!trimmed) return { columns: [], rows: [], changes: 0, elapsedMs: 0, isSelect: false, truncated: false };
    if (params.length) {
      const stmt = this.db.prepare(trimmed);
      try {
        stmt.bind(params);
        const columns = stmt.getColumnNames();
        const rows: unknown[][] = [];
        let truncated = false;
        while (stmt.step()) {
          if (rows.length >= maxRows) {
            truncated = true;
            break;
          }
          rows.push(stmt.get());
        }
        return { columns, rows, changes: this.db.getRowsModified(), elapsedMs: performance.now() - started, isSelect: columns.length > 0, truncated };
      } finally {
        stmt.free();
      }
    }
    let columns: string[] = [];
    let rows: unknown[][] = [];
    let isSelect = false;
    let truncated = false;
    let changes = 0;
    for (const stmt of this.db.iterateStatements(trimmed)) {
      try {
        const cols = stmt.getColumnNames();
        const current: unknown[][] = [];
        let cut = false;
        while (stmt.step()) {
          if (current.length >= maxRows) {
            cut = true;
            break;
          }
          current.push(stmt.get());
        }
        if (cols.length > 0) {
          columns = cols;
          rows = current;
          isSelect = true;
          truncated = cut;
        } else {
          changes += this.db.getRowsModified();
        }
      } finally {
        stmt.free();
      }
    }
    return { columns, rows, changes, elapsedMs: performance.now() - started, isSelect, truncated };
  }

  run(sql: string, params: SqlValue[] = []) {
    this.db.run(sql, params);
    return this.db.getRowsModified();
  }

  values<T = unknown>(sql: string, params: SqlValue[] = []): T[][] {
    return this.query(sql, params, Number.MAX_SAFE_INTEGER).rows as T[][];
  }

  scalar<T = unknown>(sql: string, params: SqlValue[] = []): T | null {
    const rows = this.values<T>(sql, params);
    return rows.length ? rows[0][0] : null;
  }

  /** Ejecuta varias sentencias en una transacción (todo o nada). */
  transaction(fn: () => void) {
    this.db.run("BEGIN");
    try {
      fn();
      this.db.run("COMMIT");
    } catch (err) {
      try {
        this.db.run("ROLLBACK");
      } catch {
        // La transacción ya se deshizo
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Esquema
  // -------------------------------------------------------------------------

  schema(): Schema {
    const objects = this.values<string>("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name");
    const tables: TableInfo[] = [];
    const views: Schema["views"] = [];
    const indexes: Schema["indexes"] = [];
    for (const [type, name, table, sql] of objects) {
      if (isInternal(name)) continue;
      if (type === "table") tables.push(this.tableInfo(name, sql));
      else if (type === "view") views.push({ name, sql });
      else if (type === "index" && !isInternal(table)) {
        const info = this.values<string | number>(`PRAGMA index_info(${quoteId(name)})`).map((r) => String(r[2]));
        const unique = /^\s*CREATE\s+UNIQUE/i.test(sql);
        indexes.push({ name, table, columns: info, unique });
      }
    }
    const queries = this.values<string>("SELECT name, sql FROM _coffee_queries ORDER BY name").map(([name, sql]) => ({ name, sql }));
    return { tables, views, queries, indexes };
  }

  tableInfo(name: string, sql = this.scalar<string>("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [name]) || ""): TableInfo {
    const pragma = this.values<string | number | null>(`PRAGMA table_info(${quoteId(name)})`);
    const pkCount = pragma.filter((r) => Number(r[5]) > 0).length;
    const autoInc = /AUTOINCREMENT/i.test(sql);
    // Columnas con índice único de una sola columna
    const uniques = new Set<string>();
    for (const [, idxName, unique] of this.values<string | number>(`PRAGMA index_list(${quoteId(name)})`)) {
      if (!Number(unique)) continue;
      const cols = this.values<string | number>(`PRAGMA index_info(${quoteId(String(idxName))})`);
      if (cols.length === 1) uniques.add(String(cols[0][2]));
    }
    const columns: ColumnInfo[] = pragma.map(([, colName, declared, notNull, dflt, pk]) => {
      const isPk = Number(pk) > 0;
      const isInteger = /^INTEGER$/i.test(String(declared || ""));
      const auto = isPk && pkCount === 1 && isInteger && (autoInc || true);
      return {
        name: String(colName),
        declared: String(declared || ""),
        type: fieldTypeOf(String(declared || ""), isPk && pkCount === 1, auto),
        notNull: Boolean(Number(notNull)) || isPk,
        pk: isPk,
        autoIncrement: auto,
        unique: uniques.has(String(colName)),
        defaultValue: dflt === null ? null : String(dflt),
      };
    });
    const foreignKeys: ForeignKey[] = this.values<string | number>(`PRAGMA foreign_key_list(${quoteId(name)})`).map((r) => ({
      table: String(r[2]),
      column: String(r[3]),
      to: r[4] === null ? "" : String(r[4]),
      onUpdate: String(r[5]) as RefAction,
      onDelete: String(r[6]) as RefAction,
    }));
    const rowCount = Number(this.scalar(`SELECT COUNT(*) FROM ${quoteId(name)}`) || 0);
    return { name, columns, foreignKeys, rowCount, sql };
  }

  // -------------------------------------------------------------------------
  // Diseño de tablas
  // -------------------------------------------------------------------------

  /** Texto CREATE TABLE a partir de la definición del diseñador. */
  static createSql(table: string, columns: ColumnDraft[], foreignKeys: ForeignKey[]): string {
    const pks = columns.filter((c) => c.pk);
    const parts = columns.map((c) => {
      const def = FIELD_TYPES.find((f) => f.id === c.type) || FIELD_TYPES[1];
      let line = `${quoteId(c.name)} ${def.sql}`;
      if (c.type === "autonumber" && pks.length <= 1) return `${quoteId(c.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
      if (c.pk && pks.length === 1) line += " PRIMARY KEY";
      if (c.notNull && !c.pk) line += " NOT NULL";
      if (c.unique && !c.pk) line += " UNIQUE";
      if (c.defaultValue.trim() !== "") {
        const v = c.defaultValue.trim();
        const isExpr = /^(CURRENT_(DATE|TIME|TIMESTAMP)|NULL|-?\d+(\.\d+)?|\(.*\))$/i.test(v);
        line += ` DEFAULT ${isExpr ? v : quoteValue(v.replace(/^'(.*)'$/, "$1"))}`;
      }
      return line;
    });
    if (pks.length > 1) parts.push(`PRIMARY KEY (${pks.map((c) => quoteId(c.name)).join(", ")})`);
    for (const fk of foreignKeys) {
      parts.push(
        `FOREIGN KEY (${quoteId(fk.column)}) REFERENCES ${quoteId(fk.table)}(${quoteId(fk.to)}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
      );
    }
    return `CREATE TABLE ${quoteId(table)} (\n  ${parts.join(",\n  ")}\n)`;
  }

  createTable(table: string, columns: ColumnDraft[], foreignKeys: ForeignKey[] = []) {
    this.run(CoffeeDb.createSql(table, columns, foreignKeys));
  }

  /**
   * Cambia la estructura de una tabla conservando sus datos: SQLite no
   * permite modificar columnas, así que se crea la tabla nueva, se copian los
   * datos y se reemplaza (con las relaciones e índices que sigan siendo válidos).
   */
  rebuildTable(table: string, newName: string, columns: ColumnDraft[], foreignKeys: ForeignKey[]) {
    const tmp = `_coffee_new_${Date.now().toString(36)}`;
    const keepIndexes = this.values<string>("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL", [table]);
    const mapped = columns.filter((c) => c.original);
    const renamed = new Map(mapped.map((c) => [c.original as string, c.name]));
    const validFks = foreignKeys
      .map((fk) => ({ ...fk, column: renamed.get(fk.column) || fk.column }))
      .filter((fk) => columns.some((c) => c.name === fk.column));
    this.run("PRAGMA foreign_keys = OFF");
    try {
      this.transaction(() => {
        this.run(CoffeeDb.createSql(tmp, columns, validFks));
        if (mapped.length) {
          this.run(
            `INSERT INTO ${quoteId(tmp)} (${mapped.map((c) => quoteId(c.name)).join(", ")}) SELECT ${mapped
              .map((c) => quoteId(c.original as string))
              .join(", ")} FROM ${quoteId(table)}`
          );
        }
        this.run(`DROP TABLE ${quoteId(table)}`);
        this.run(`ALTER TABLE ${quoteId(tmp)} RENAME TO ${quoteId(newName)}`);
        // Las relaciones de otras tablas hacia esta siguen el cambio de nombre
        for (const [idxName, idxSql] of keepIndexes) {
          let sqlText = idxSql;
          renamed.forEach((to, from) => {
            if (from !== to) sqlText = sqlText.split(quoteId(from)).join(quoteId(to));
          });
          sqlText = sqlText.replace(new RegExp(`ON\\s+("?${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?)`, "i"), `ON ${quoteId(newName)}`);
          try {
            this.run(sqlText);
          } catch {
            // El índice usaba columnas que ya no existen
            void idxName;
          }
        }
        const problems = this.values("PRAGMA foreign_key_check");
        if (problems.length) {
          throw new Error(`Hay ${problems.length} registros que no cumplen las relaciones (claves externas sin registro relacionado).`);
        }
      });
    } finally {
      this.run("PRAGMA foreign_keys = ON");
    }
  }

  /** Borradores del diseñador a partir de una tabla existente. */
  drafts(info: TableInfo): ColumnDraft[] {
    return info.columns.map((c, i) => ({
      key: `${c.name}_${i}`,
      original: c.name,
      name: c.name,
      type: c.type,
      pk: c.pk,
      notNull: c.notNull && !c.pk,
      unique: c.unique,
      defaultValue: c.defaultValue ?? "",
    }));
  }

  dropTable(table: string) {
    this.run("PRAGMA foreign_keys = OFF");
    try {
      this.run(`DROP TABLE ${quoteId(table)}`);
    } finally {
      this.run("PRAGMA foreign_keys = ON");
    }
  }

  renameTable(from: string, to: string) {
    this.run(`ALTER TABLE ${quoteId(from)} RENAME TO ${quoteId(to)}`);
  }

  // -------------------------------------------------------------------------
  // Relaciones
  // -------------------------------------------------------------------------

  addRelationship(fk: ForeignKey & { child: string }, oneToOne = false) {
    const info = this.tableInfo(fk.child);
    const drafts = this.drafts(info).map((d) => (oneToOne && d.name === fk.column ? { ...d, unique: true } : d));
    const others = info.foreignKeys.filter((f) => f.column !== fk.column);
    this.rebuildTable(fk.child, fk.child, drafts, [...others, { column: fk.column, table: fk.table, to: fk.to, onDelete: fk.onDelete, onUpdate: fk.onUpdate }]);
  }

  removeRelationship(child: string, column: string) {
    const info = this.tableInfo(child);
    this.rebuildTable(child, child, this.drafts(info), info.foreignKeys.filter((f) => f.column !== column));
  }

  // -------------------------------------------------------------------------
  // Consultas guardadas y metadatos
  // -------------------------------------------------------------------------

  saveQuery(name: string, sql: string) {
    this.run("INSERT INTO _coffee_queries(name, sql) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET sql = excluded.sql", [name, sql]);
  }

  deleteQuery(name: string) {
    this.run("DELETE FROM _coffee_queries WHERE name = ?", [name]);
  }

  queries(): SavedQuery[] {
    return this.values<string>("SELECT name, sql FROM _coffee_queries ORDER BY name").map(([name, sql]) => ({ name, sql }));
  }

  getMeta<T>(key: string, fallback: T): T {
    const raw = this.scalar<string>("SELECT value FROM _coffee_meta WHERE key = ?", [key]);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  setMeta(key: string, value: unknown) {
    this.run("INSERT INTO _coffee_meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, JSON.stringify(value)]);
  }

  // -------------------------------------------------------------------------
  // Datos
  // -------------------------------------------------------------------------

  /** Página de una tabla con su rowid para poder editar cada fila. */
  page(
    table: string,
    options: { offset: number; limit: number; orderBy?: string | null; desc?: boolean; search?: string; columns: string[] }
  ): { rowids: number[]; rows: unknown[][]; total: number } {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.search?.trim()) {
      where.push(`(${options.columns.map((c) => `CAST(${quoteId(c)} AS TEXT) LIKE ?`).join(" OR ")})`);
      options.columns.forEach(() => params.push(`%${options.search?.trim()}%`));
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const order = options.orderBy ? ` ORDER BY ${quoteId(options.orderBy)} ${options.desc ? "DESC" : "ASC"}` : " ORDER BY rowid";
    const total = Number(this.scalar(`SELECT COUNT(*) FROM ${quoteId(table)}${whereSql}`, params) || 0);
    const result = this.values(
      `SELECT rowid, ${options.columns.map(quoteId).join(", ")} FROM ${quoteId(table)}${whereSql}${order} LIMIT ? OFFSET ?`,
      [...params, options.limit, options.offset]
    );
    return { rowids: result.map((r) => Number(r[0])), rows: result.map((r) => r.slice(1)), total };
  }

  updateCell(table: string, rowid: number, column: string, value: SqlValue) {
    this.run(`UPDATE ${quoteId(table)} SET ${quoteId(column)} = ? WHERE rowid = ?`, [value, rowid]);
  }

  insertRow(table: string, values: Record<string, SqlValue>): number {
    const cols = Object.keys(values);
    if (cols.length === 0) this.run(`INSERT INTO ${quoteId(table)} DEFAULT VALUES`);
    else this.run(`INSERT INTO ${quoteId(table)} (${cols.map(quoteId).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => values[c]));
    return Number(this.scalar("SELECT last_insert_rowid()"));
  }

  deleteRows(table: string, rowids: number[]) {
    if (!rowids.length) return;
    this.run(`DELETE FROM ${quoteId(table)} WHERE rowid IN (${rowids.map(() => "?").join(",")})`, rowids);
  }

  sizeBytes(): number {
    const pages = Number(this.scalar("PRAGMA page_count") || 0);
    const size = Number(this.scalar("PRAGMA page_size") || 0);
    return pages * size;
  }
}

/** Convierte lo que escribe el usuario al tipo del campo. */
export function coerce(value: string, type: FieldType): SqlValue {
  const v = value.trim();
  if (v === "") return null;
  switch (type) {
    case "autonumber":
    case "integer": {
      const n = Number(v.replace(/\s/g, ""));
      if (!Number.isInteger(n)) throw new Error(`«${value}» no es un número entero.`);
      return n;
    }
    case "decimal":
    case "currency": {
      const n = Number(v.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
      if (!Number.isFinite(n)) throw new Error(`«${value}» no es un número.`);
      return n;
    }
    case "boolean":
      return /^(1|s[ií]|true|verdadero|x)$/i.test(v) ? 1 : 0;
    case "date": {
      const d = parseDate(v);
      if (!d) throw new Error(`«${value}» no es una fecha válida (usa AAAA-MM-DD o DD/MM/AAAA).`);
      return d;
    }
    default:
      return value;
  }
}

/** Fecha en formato ISO de SQLite a partir de varios formatos habituales. */
export function parseDate(v: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
  let parts: number[] | null = null;
  if (iso) parts = [Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0)];
  else if (local) parts = [Number(local[3]), Number(local[2]), Number(local[1]), Number(local[4] || 0), Number(local[5] || 0), Number(local[6] || 0)];
  if (!parts) return null;
  const [y, m, d, h, mi, s] = parts;
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = `${y}-${pad(m)}-${pad(d)}`;
  return h || mi || s ? `${date} ${pad(h)}:${pad(mi)}:${pad(s)}` : date;
}

export function formatCell(value: unknown, type?: FieldType): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Uint8Array) return `(binario, ${value.length} bytes)`;
  if (type === "currency" && typeof value === "number") return value.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === "boolean") return Number(value) ? "Sí" : "No";
  return String(value);
}

/** Primera línea de las plantillas del Launcher (un script SQL en lugar de SQLite). */
export const TEMPLATE_MARK = "-- CoffeeWorks plantilla";

/** Si los bytes son una plantilla, devuelve el script; si no, `null`. */
export function templateScript(bytes: Uint8Array): string | null {
  if (bytes.length < TEMPLATE_MARK.length) return null;
  const head = new TextDecoder().decode(bytes.slice(0, 64)).replace(/^\uFEFF/, "");
  return head.startsWith(TEMPLATE_MARK) ? new TextDecoder().decode(bytes) : null;
}
