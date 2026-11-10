// Almacén de libros de CoffeCalc: formato nativo .cfs, guardado en la bóveda de
// CoffeWorks, importación (Excel, CSV) y exportación (Excel con formato, CSV).

import * as XLSX from "xlsx-js-style";
import type { Bounds, CellData, CellValue, ExportFormat, Sheet, Workbook } from "../types";
import { DEFAULT_COL_WIDTH } from "../types";
import {
  baseName,
  bytesToText,
  extensionOf,
  isTauri,
  readFileBytes,
  registerRecent,
  renameInVault,
  saveFileAs,
  stripExtension,
  vaultPath,
  writeFileText,
  type PickedFile,
} from "./desktop";
import {
  cellKey,
  colIndexToName,
  formatCellValue,
  parseCellKey,
  recalcWorkbook,
  toExcelFormula,
} from "./formulaEngine";

export const APP_ID = "coffecalc";
export const NATIVE_EXTENSION = "cfs";
export const DEFAULT_TITLE = "Libro sin título";

const WEB_DOC_PREFIX = "coffecalc:doc:";
const LAST_KEY = "coffecalc:last";
const LEGACY_KEY = "coffecalc_active_workbook";

export const OPEN_FILTERS = [
  { name: "Hojas de cálculo", extensions: ["cfs", "xlsx", "xls", "csv", "tsv", "ods"] },
  { name: "Libro de CoffeCalc", extensions: ["cfs"] },
  { name: "Libro de Excel", extensions: ["xlsx", "xls"] },
  { name: "Valores separados por comas", extensions: ["csv", "tsv"] },
];

export interface OpenResult {
  workbook: Workbook;
  /** Ruta del archivo .cfs en disco; `null` si el libro aún no tiene archivo. */
  filePath: string | null;
}

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function createSheet(name: string): Sheet {
  return { id: newId("sheet"), name, data: {}, colWidths: {} };
}

export function createBlankWorkbook(title = DEFAULT_TITLE): Workbook {
  const now = new Date().toISOString();
  const sheet = createSheet("Hoja1");
  return {
    metadata: { id: newId("cfs"), title, author: "Usuario CoffeWorks", createdAt: now, updatedAt: now },
    sheets: [sheet],
    activeSheetId: sheet.id,
  };
}

/** Libro de ejemplo: un presupuesto con fórmulas, formato y un gráfico. */
export function createSampleWorkbook(): Workbook {
  const workbook = createBlankWorkbook("Presupuesto trimestral");
  const header = { bold: true, bg: "#107c41", color: "#ffffff" } as const;
  const money = { format: "currency" as const, align: "right" as const };
  const total = { bold: true, bg: "#dff6dd", ...money };
  const data: Record<string, CellData> = {
    A1: { raw: "INFORME FINANCIERO Y PRESUPUESTO", bold: true, color: "#107c41", fontSize: 13 },
    A2: { raw: "Ingresos del cuarto trimestre", italic: true, color: "#6f4e37" },
    A4: { raw: "CONCEPTO", ...header },
    B4: { raw: "OCTUBRE", ...header, align: "right" },
    C4: { raw: "NOVIEMBRE", ...header, align: "right" },
    D4: { raw: "DICIEMBRE", ...header, align: "right" },
    E4: { raw: "TOTAL", ...header, bg: "#0e6b37", align: "right" },
    A5: { raw: "Ventas de café especial" },
    B5: { raw: "14500000", ...money },
    C5: { raw: "16200000", ...money },
    D5: { raw: "19800000", ...money },
    E5: { raw: "=SUMA(B5:D5)", bold: true, ...money },
    A6: { raw: "Suscripciones digitales" },
    B6: { raw: "4800000", ...money },
    C6: { raw: "5300000", ...money },
    D6: { raw: "6100000", ...money },
    E6: { raw: "=SUMA(B6:D6)", bold: true, ...money },
    A7: { raw: "Consultoría de software" },
    B7: { raw: "8500000", ...money },
    C7: { raw: "9100000", ...money },
    D7: { raw: "10500000", ...money },
    E7: { raw: "=SUMA(B7:D7)", bold: true, ...money },
    A8: { raw: "TOTAL INGRESOS", bold: true, bg: "#dff6dd", color: "#0e6b37" },
    B8: { raw: "=SUMA(B5:B7)", ...total },
    C8: { raw: "=SUMA(C5:C7)", ...total },
    D8: { raw: "=SUMA(D5:D7)", ...total },
    E8: { raw: "=SUMA(E5:E7)", ...total },
    A10: { raw: "Promedio mensual", italic: true, bold: true },
    B10: { raw: "=PROMEDIO(B5:B7)", ...money },
    C10: { raw: "=PROMEDIO(C5:C7)", ...money },
    D10: { raw: "=PROMEDIO(D5:D7)", ...money },
    A11: { raw: "Crecimiento frente al mes anterior", italic: true },
    C11: { raw: "=(C8-B8)/B8", format: "percent", decimals: 1, align: "right" },
    D11: { raw: "=(D8-C8)/C8", format: "percent", decimals: 1, align: "right" },
  };
  const sheet: Sheet = {
    ...workbook.sheets[0],
    data,
    colWidths: { A: 250, B: 140, C: 140, D: 140, E: 160 },
    charts: [
      {
        id: newId("chart"),
        type: "bar",
        title: "Ingresos por concepto",
        range: { r1: 3, c1: 0, r2: 6, c2: 3 },
        x: 60,
        y: 300,
        width: 520,
        height: 300,
      },
    ],
  };
  return { ...workbook, sheets: recalcWorkbook([sheet]) };
}

// ---------------------------------------------------------------------------
// Formato nativo
// ---------------------------------------------------------------------------

/** Interpreta el contenido de un archivo .cfs (formato actual o heredado). */
export function parseCfs(text: string, fallbackTitle: string): Workbook {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.sheets) || parsed.sheets.length === 0) {
    throw new Error("El archivo no es un libro de CoffeCalc válido");
  }
  const blank = createBlankWorkbook(fallbackTitle);
  const sheets: Sheet[] = parsed.sheets.map((sheet: Partial<Sheet> & { chart?: unknown }, index: number) => ({
    id: sheet.id || newId("sheet"),
    name: sheet.name || `Hoja${index + 1}`,
    data: sheet.data || {},
    colWidths: sheet.colWidths || {},
    rowHeights: sheet.rowHeights || {},
    merges: sheet.merges || [],
    charts: sheet.charts || [],
    conditional: sheet.conditional || [],
    filter: sheet.filter || null,
    frozenRows: sheet.frozenRows || 0,
    frozenCols: sheet.frozenCols || 0,
    isProtected: Boolean(sheet.isProtected),
    tabColor: sheet.tabColor,
  }));
  const metadata = { ...blank.metadata, ...(parsed.metadata || {}) };
  if (!metadata.title) metadata.title = fallbackTitle;
  const activeSheetId = sheets.some((s) => s.id === parsed.activeSheetId) ? parsed.activeSheetId : sheets[0].id;
  return { metadata, sheets: recalcWorkbook(sheets), activeSheetId };
}

export function serializeCfs(workbook: Workbook): string {
  return JSON.stringify({ format: "coffecalc", version: 2, ...workbook });
}

// ---------------------------------------------------------------------------
// Importación desde Excel / CSV
// ---------------------------------------------------------------------------

function formatFromNumFmt(z: unknown): Pick<CellData, "format" | "decimals" | "currency"> {
  if (typeof z !== "string" || z === "General") return {};
  const lower = z.toLowerCase();
  const decimals = (/\.(0+)/.exec(z)?.[1] || "").length;
  if (lower.includes("%")) return { format: "percent", decimals };
  if (/[$€£]|cop|usd|eur/.test(lower)) {
    const currency = lower.includes("€") || lower.includes("eur") ? "EUR" : lower.includes("usd") ? "USD" : "COP";
    return { format: "currency", decimals, currency };
  }
  if (/[dmy]/.test(lower) && !/[0#]/.test(lower)) return { format: "date" };
  if (/[0#]/.test(z)) return { format: "number", decimals };
  return {};
}

function rgbOf(color: { rgb?: string } | undefined): string | undefined {
  if (!color?.rgb || color.rgb.length < 6) return undefined;
  return `#${color.rgb.slice(-6).toLowerCase()}`;
}

function importWorksheet(ws: XLSX.WorkSheet, name: string): Sheet {
  const data: Record<string, CellData> = {};
  const colWidths: Record<string, number> = {};

  if (Array.isArray(ws["!cols"])) {
    ws["!cols"].forEach((col, index) => {
      if (!col) return;
      const width = col.wpx ? Math.round(col.wpx) : col.wch ? Math.round(col.wch * 7.5 + 12) : 0;
      if (width > 0) colWidths[colIndexToName(index)] = Math.min(500, Math.max(40, width));
    });
  }

  for (const key of Object.keys(ws)) {
    if (key.startsWith("!")) continue;
    const source = ws[key] as XLSX.CellObject & { s?: Record<string, any> };
    if (!source) continue;

    const cell: CellData = { raw: "" };
    if (source.f) {
      cell.raw = `=${source.f}`;
      if (source.v !== undefined && !(source.v instanceof Date)) cell.cached = source.v as CellValue;
    } else if (source.t === "d" && source.v instanceof Date) {
      const date = source.v;
      cell.raw = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      cell.format = "date";
    } else if (source.t === "b") {
      cell.raw = source.v ? "VERDADERO" : "FALSO";
    } else if (source.t === "n") {
      cell.raw = String(source.v);
    } else if (source.v !== undefined && source.v !== null) {
      cell.raw = String(source.v);
      // Un texto que parece número se conserva como texto
      if (/^-?\d+([.,]\d+)?$/.test(cell.raw.trim())) cell.format = "text";
    }
    if (cell.raw === "" && !source.s) continue;

    Object.assign(cell, formatFromNumFmt(source.z));

    const style = source.s;
    if (style) {
      const fill = rgbOf(style.fgColor) || rgbOf(style.fill?.fgColor);
      if (fill && fill !== "#ffffff" && style.patternType !== "none") cell.bg = fill;
      if (style.font) {
        if (style.font.bold) cell.bold = true;
        if (style.font.italic) cell.italic = true;
        if (style.font.underline) cell.underline = true;
        if (style.font.strike) cell.strike = true;
        const color = rgbOf(style.font.color);
        if (color && color !== "#000000") cell.color = color;
      }
      const horizontal = style.alignment?.horizontal;
      if (horizontal === "center" || horizontal === "right" || horizontal === "left") cell.align = horizontal;
      if (style.alignment?.wrapText) cell.wrapText = true;
    }
    if (source.l?.Target) cell.link = source.l.Target;
    data[key.toUpperCase()] = cell;
  }

  const merges: Bounds[] = (ws["!merges"] || []).map((m) => ({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c }));
  return { id: newId("sheet"), name, data, colWidths, merges };
}

function importSpreadsheet(bytes: Uint8Array, fileName: string): Workbook {
  const extension = extensionOf(fileName);
  const isText = extension === "csv" || extension === "tsv" || extension === "txt";
  const wb = isText
    ? XLSX.read(bytesToText(bytes), { type: "string", raw: false, FS: extension === "tsv" ? "\t" : undefined })
    : XLSX.read(bytes, { type: "array", cellFormula: true, cellStyles: true, cellDates: true, cellNF: true });

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error("El archivo no contiene ninguna hoja de cálculo");
  }
  const workbook = createBlankWorkbook(stripExtension(fileName) || DEFAULT_TITLE);
  const sheets = wb.SheetNames.map((name, index) =>
    importWorksheet(wb.Sheets[name], isText ? `Hoja${index + 1}` : name)
  );
  return { ...workbook, sheets: recalcWorkbook(sheets), activeSheetId: sheets[0].id };
}

/** Convierte un archivo elegido por el usuario en un libro editable. */
export async function importFile(file: PickedFile): Promise<OpenResult> {
  const extension = extensionOf(file.name);
  if (extension === NATIVE_EXTENSION || extension === "json") {
    const workbook = parseCfs(bytesToText(file.bytes), stripExtension(file.name) || DEFAULT_TITLE);
    return { workbook, filePath: extension === NATIVE_EXTENSION ? file.path : null };
  }
  return { workbook: importSpreadsheet(file.bytes, file.name), filePath: null };
}

export async function openPath(path: string): Promise<OpenResult> {
  const bytes = await readFileBytes(path);
  return importFile({ name: baseName(path), path, bytes });
}

export function loadWebWorkbook(id: string): Workbook | null {
  try {
    const raw = localStorage.getItem(WEB_DOC_PREFIX + id);
    return raw ? parseCfs(raw, DEFAULT_TITLE) : null;
  } catch {
    return null;
  }
}

/** Libro guardado por versiones anteriores de CoffeCalc en el navegador. */
export function loadLegacyWorkbook(): Workbook | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? parseCfs(raw, DEFAULT_TITLE) : null;
  } catch {
    return null;
  }
}

/**
 * Guarda el libro. En escritorio escribe el archivo .cfs (en la bóveda si aún
 * no tiene ubicación) y devuelve su ruta; en el navegador usa localStorage.
 */
export async function persistWorkbook(workbook: Workbook, filePath: string | null): Promise<string | null> {
  const stamped: Workbook = {
    ...workbook,
    metadata: { ...workbook.metadata, updatedAt: new Date().toISOString() },
  };
  const json = serializeCfs(stamped);
  const title = workbook.metadata.title.trim() || DEFAULT_TITLE;
  const fileName = `${title}.${NATIVE_EXTENSION}`;
  const entry = {
    id: workbook.metadata.id,
    name: fileName,
    app_id: APP_ID,
    category: "Hoja de cálculo",
    last_modified: "",
    is_pinned: false,
    path: "",
    updated_at: Date.now(),
  };

  if (isTauri) {
    const path = filePath
      ? await renameInVault(filePath, fileName, workbook.metadata.id)
      : await vaultPath(fileName, workbook.metadata.id);
    await writeFileText(path, json);
    await registerRecent({ ...entry, name: baseName(path), path });
    localStorage.setItem(LAST_KEY, path);
    return path;
  }

  localStorage.setItem(WEB_DOC_PREFIX + workbook.metadata.id, json);
  localStorage.setItem(LAST_KEY, workbook.metadata.id);
  await registerRecent({ ...entry, path: `web:${workbook.metadata.id}` });
  return null;
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

/** Límites del área con datos de una hoja. */
export function usedBounds(sheet: Sheet): Bounds | null {
  let bounds: Bounds | null = null;
  for (const [key, cell] of Object.entries(sheet.data)) {
    if (!cell.raw && !cell.bg && !cell.borders) continue;
    const parsed = parseCellKey(key);
    if (!parsed) continue;
    if (!bounds) {
      bounds = { r1: parsed.row, c1: parsed.col, r2: parsed.row, c2: parsed.col };
    } else {
      bounds.r1 = Math.min(bounds.r1, parsed.row);
      bounds.c1 = Math.min(bounds.c1, parsed.col);
      bounds.r2 = Math.max(bounds.r2, parsed.row);
      bounds.c2 = Math.max(bounds.c2, parsed.col);
    }
  }
  return bounds;
}

const hex = (color: string | undefined) =>
  color && /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1).toUpperCase() : undefined;

function numberFormatOf(cell: CellData): string | undefined {
  const decimals = (count: number) => (count > 0 ? "." + "0".repeat(count) : "");
  switch (cell.format) {
    case "currency": {
      const currency = cell.currency || "COP";
      const symbol = currency === "EUR" ? "€" : "$";
      return `"${symbol}" #,##0${decimals(cell.decimals ?? (currency === "COP" ? 0 : 2))}`;
    }
    case "percent":
      return `0${decimals(cell.decimals ?? 0)}%`;
    case "number":
      return `#,##0${decimals(cell.decimals ?? 2)}`;
    case "date":
      return "dd/mm/yyyy";
    case "text":
      return "@";
    default:
      return cell.decimals !== undefined ? `0${decimals(cell.decimals)}` : undefined;
  }
}

function buildWorksheet(sheet: Sheet): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const bounds = usedBounds(sheet);
  const thin = { style: "thin", color: { rgb: "000000" } };

  for (const [key, cell] of Object.entries(sheet.data)) {
    const value = cell.computed;
    let out: Record<string, unknown>;
    if (typeof value === "number") out = { t: "n", v: value };
    else if (typeof value === "boolean") out = { t: "b", v: value };
    else if (typeof value === "string" && value.startsWith("#")) out = { t: "e", w: value, v: 0x0f };
    else out = { t: "s", v: value === null || value === undefined ? "" : String(value) };

    if (cell.raw?.startsWith("=") && cell.format !== "text") {
      out.f = toExcelFormula(cell.raw);
      if (out.t === "e") out = { t: "n", f: out.f };
    }
    const numFmt = numberFormatOf(cell);
    if (numFmt) out.z = numFmt;
    if (cell.link) out.l = { Target: cell.link };

    const style: Record<string, unknown> = {};
    const font: Record<string, unknown> = {};
    if (cell.bold) font.bold = true;
    if (cell.italic) font.italic = true;
    if (cell.underline || cell.link) font.underline = true;
    if (cell.strike) font.strike = true;
    if (cell.fontFamily) font.name = cell.fontFamily;
    if (cell.fontSize) font.sz = cell.fontSize;
    const fontColor = hex(cell.color) || (cell.link ? "0B57D0" : undefined);
    if (fontColor) font.color = { rgb: fontColor };
    if (Object.keys(font).length > 0) style.font = font;
    const fill = hex(cell.bg);
    if (fill) style.fill = { patternType: "solid", fgColor: { rgb: fill } };
    if (cell.align || cell.valign || cell.wrapText) {
      style.alignment = {
        horizontal: cell.align,
        vertical: cell.valign === "middle" ? "center" : cell.valign,
        wrapText: cell.wrapText || undefined,
      };
    }
    if (cell.borders) {
      style.border = {
        top: cell.borders.top ? thin : undefined,
        bottom: cell.borders.bottom ? thin : undefined,
        left: cell.borders.left ? thin : undefined,
        right: cell.borders.right ? thin : undefined,
      };
    }
    if (numFmt) style.numFmt = numFmt;
    if (Object.keys(style).length > 0) out.s = style;

    ws[key] = out as unknown as XLSX.CellObject;
  }

  ws["!ref"] = bounds ? `A1:${cellKey(bounds.c2, bounds.r2)}` : "A1:A1";
  const lastCol = bounds ? bounds.c2 : 0;
  ws["!cols"] = Array.from({ length: lastCol + 1 }, (_, index) => ({
    wpx: sheet.colWidths?.[colIndexToName(index)] || DEFAULT_COL_WIDTH,
  }));
  if (sheet.merges && sheet.merges.length > 0) {
    ws["!merges"] = sheet.merges.map((m) => ({ s: { r: m.r1, c: m.c1 }, e: { r: m.r2, c: m.c2 } }));
  }
  return ws;
}

function workbookToXlsx(workbook: Workbook): Uint8Array {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sheet of workbook.sheets) {
    // Excel limita los nombres de hoja a 31 caracteres y prohíbe algunos símbolos
    let name = (sheet.name || "Hoja").replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "Hoja";
    let suffix = 2;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)}_${suffix++}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, buildWorksheet(sheet), name);
  }
  const output = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Uint8Array(output);
}

/** Texto CSV de una hoja con los valores tal como se muestran. */
export function sheetToCsv(sheet: Sheet, separator = ","): string {
  const bounds = usedBounds(sheet);
  if (!bounds) return "";
  const lines: string[] = [];
  for (let r = 0; r <= bounds.r2; r++) {
    const fields: string[] = [];
    for (let c = 0; c <= bounds.c2; c++) {
      const cell = sheet.data[cellKey(c, r)];
      let text = "";
      if (cell) {
        // Los números se exportan sin separadores de miles para poder reimportarlos
        text =
          typeof cell.computed === "number" && cell.format !== "date" && cell.format !== "percent"
            ? String(cell.computed)
            : formatCellValue(cell.computed, cell);
      }
      fields.push(/["\n\r]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text);
    }
    lines.push(fields.join(separator));
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * Exporta el libro mediante el diálogo "Guardar como". Devuelve `false` si el
 * usuario canceló. El PDF se gestiona con la impresión del sistema.
 */
export async function exportWorkbook(
  workbook: Workbook,
  format: Exclude<ExportFormat, "pdf">
): Promise<boolean> {
  const title = workbook.metadata.title.trim() || DEFAULT_TITLE;
  const active = workbook.sheets.find((s) => s.id === workbook.activeSheetId) || workbook.sheets[0];
  let data: Uint8Array | string;
  let filterName: string;

  if (format === "xlsx") {
    data = workbookToXlsx(workbook);
    filterName = "Libro de Excel";
  } else if (format === "csv") {
    // El BOM permite que Excel reconozca los acentos
    data = "﻿" + sheetToCsv(active);
    filterName = "Valores separados por comas";
  } else {
    data = serializeCfs(workbook);
    filterName = "Libro de CoffeCalc";
  }

  const saved = await saveFileAs(
    `${title}.${format}`,
    [{ name: filterName, extensions: [format] }],
    data,
    "Exportar libro"
  );
  return saved !== null;
}

/** "Guardar como": elige una nueva ubicación para el archivo .cfs. */
export async function saveWorkbookAs(workbook: Workbook): Promise<string | null> {
  const title = workbook.metadata.title.trim() || DEFAULT_TITLE;
  return saveFileAs(
    `${title}.${NATIVE_EXTENSION}`,
    [{ name: "Libro de CoffeCalc", extensions: [NATIVE_EXTENSION] }],
    serializeCfs(workbook),
    "Guardar libro como"
  );
}
