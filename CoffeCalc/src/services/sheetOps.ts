// Operaciones puras sobre hojas de cálculo: selección, estructura (insertar y
// eliminar filas o columnas), ordenar, rellenar, pegar, filtros y formato
// condicional. Ninguna función modifica la hoja recibida: todas devuelven una nueva.

import type {
  Bounds,
  CellData,
  ConditionalRule,
  SelectionRange,
  Sheet,
} from "../types";
import { STYLE_KEYS } from "../types";
import {
  adjustFormulaForStructure,
  cellKey,
  colIndexToName,
  colNameToIndex,
  formatCellValue,
  offsetFormula,
  parseCellKey,
  parseLiteral,
} from "./formulaEngine";

export function normalize(range: SelectionRange): Bounds {
  return {
    r1: Math.min(range.startRow, range.endRow),
    c1: Math.min(range.startCol, range.endCol),
    r2: Math.max(range.startRow, range.endRow),
    c2: Math.max(range.startCol, range.endCol),
  };
}

export const boundsContain = (b: Bounds, col: number, row: number) =>
  row >= b.r1 && row <= b.r2 && col >= b.c1 && col <= b.c2;

export const boundsLabel = (b: Bounds) =>
  b.r1 === b.r2 && b.c1 === b.c2 ? cellKey(b.c1, b.r1) : `${cellKey(b.c1, b.r1)}:${cellKey(b.c2, b.r2)}`;

const hasContent = (cell: CellData | undefined) => Boolean(cell && cell.raw !== "" && cell.raw !== undefined);

/** Combinación que contiene la celda indicada, si existe. */
export function mergeAt(sheet: Sheet, col: number, row: number): Bounds | null {
  return (sheet.merges || []).find((m) => boundsContain(m, col, row)) || null;
}

/** Región contigua de datos alrededor de una celda (como Ctrl+* en Excel). */
export function dataRegion(sheet: Sheet, col: number, row: number): Bounds {
  const region: Bounds = { r1: row, c1: col, r2: row, c2: col };
  const rowHasData = (r: number) => {
    for (let c = region.c1; c <= region.c2; c++) if (hasContent(sheet.data[cellKey(c, r)])) return true;
    return false;
  };
  const colHasData = (c: number) => {
    for (let r = region.r1; r <= region.r2; r++) if (hasContent(sheet.data[cellKey(c, r)])) return true;
    return false;
  };
  let grew = true;
  while (grew) {
    grew = false;
    if (region.r1 > 0 && rowHasData(region.r1 - 1)) { region.r1--; grew = true; }
    if (rowHasData(region.r2 + 1)) { region.r2++; grew = true; }
    if (region.c1 > 0 && colHasData(region.c1 - 1)) { region.c1--; grew = true; }
    if (colHasData(region.c2 + 1)) { region.c2++; grew = true; }
  }
  return region;
}

/** Rango sobre el que actúa una orden: la selección o, si es una sola celda, su región de datos. */
export function effectiveRange(sheet: Sheet, selection: Bounds): Bounds {
  if (selection.r1 !== selection.r2 || selection.c1 !== selection.c2) return selection;
  return dataRegion(sheet, selection.c1, selection.r1);
}

/** Indica si la primera fila de un rango parece una fila de encabezados. */
export function looksLikeHeader(sheet: Sheet, bounds: Bounds): boolean {
  if (bounds.r2 <= bounds.r1) return false;
  let textHeaders = 0;
  let numericBelow = 0;
  for (let c = bounds.c1; c <= bounds.c2; c++) {
    const top = sheet.data[cellKey(c, bounds.r1)];
    const below = sheet.data[cellKey(c, bounds.r1 + 1)];
    if (typeof top?.computed === "string" && top.computed !== "") textHeaders++;
    if (typeof below?.computed === "number") numericBelow++;
  }
  const columns = bounds.c2 - bounds.c1 + 1;
  return textHeaders === columns && (numericBelow > 0 || Boolean(sheet.data[cellKey(bounds.c1, bounds.r1)]?.bold));
}

// ---------------------------------------------------------------------------
// Estructura: insertar y eliminar filas o columnas
// ---------------------------------------------------------------------------

function shiftBounds(b: Bounds, axis: "row" | "col", index: number, delta: 1 | -1): Bounds | null {
  const next = { ...b };
  const [lo, hi] = axis === "row" ? (["r1", "r2"] as const) : (["c1", "c2"] as const);
  if (delta === 1) {
    if (next[lo] >= index) next[lo]++;
    if (next[hi] >= index) next[hi]++;
  } else {
    if (next[lo] === index && next[hi] === index) return null;
    if (next[lo] > index) next[lo]--;
    if (next[hi] >= index) next[hi]--;
  }
  return next;
}

/** Inserta (delta = 1) o elimina (delta = -1) una fila o columna en `index`. */
export function shiftStructure(sheet: Sheet, axis: "row" | "col", index: number, delta: 1 | -1): Sheet {
  const data: Record<string, CellData> = {};
  for (const [key, cell] of Object.entries(sheet.data)) {
    const parsed = parseCellKey(key);
    if (!parsed) continue;
    let { col, row } = parsed;
    const position = axis === "row" ? row : col;
    if (delta === -1 && position === index) continue;
    if (position >= index + (delta === -1 ? 1 : 0)) {
      if (axis === "row") row += delta;
      else col += delta;
    }
    const raw = cell.raw?.startsWith("=") ? adjustFormulaForStructure(cell.raw, axis, index, delta) : cell.raw;
    data[cellKey(col, row)] = raw === cell.raw ? cell : { ...cell, raw };
  }

  const shiftList = <T extends { range: Bounds }>(items: T[] | undefined): T[] =>
    (items || []).flatMap((item) => {
      const range = shiftBounds(item.range, axis, index, delta);
      return range ? [{ ...item, range }] : [];
    });

  const next: Sheet = {
    ...sheet,
    data,
    merges: (sheet.merges || []).flatMap((m) => {
      const shifted = shiftBounds(m, axis, index, delta);
      return shifted && (shifted.r1 !== shifted.r2 || shifted.c1 !== shifted.c2) ? [shifted] : [];
    }),
    charts: shiftList(sheet.charts),
    conditional: shiftList(sheet.conditional),
  };
  if (sheet.filter) {
    const range = shiftBounds(sheet.filter.range, axis, index, delta);
    next.filter = range ? { range, excluded: axis === "col" ? {} : sheet.filter.excluded } : null;
  }

  if (axis === "col") {
    const widths: Record<string, number> = {};
    for (const [name, width] of Object.entries(sheet.colWidths || {})) {
      const col = colNameToIndex(name);
      if (delta === -1 && col === index) continue;
      widths[colIndexToName(col >= index + (delta === -1 ? 1 : 0) ? col + delta : col)] = width;
    }
    next.colWidths = widths;
  } else {
    const heights: Record<number, number> = {};
    for (const [key, height] of Object.entries(sheet.rowHeights || {})) {
      const row = Number(key);
      if (delta === -1 && row === index) continue;
      heights[row >= index + (delta === -1 ? 1 : 0) ? row + delta : row] = height;
    }
    next.rowHeights = heights;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Edición de celdas
// ---------------------------------------------------------------------------

/** Crea la celda resultante de escribir `raw`, conservando su formato. */
export function writeCell(existing: CellData | undefined, raw: string): CellData {
  const next: CellData = { ...(existing || {}), raw };
  delete next.cached;
  delete next.computed;
  if (!raw.startsWith("=") && next.format !== "text") {
    const literal = parseLiteral(raw);
    if (literal.format && (!existing?.format || existing.format === "general")) {
      next.format = literal.format;
    }
  }
  return next;
}

export function mapRange(sheet: Sheet, bounds: Bounds, update: (cell: CellData, col: number, row: number) => CellData | null): Sheet {
  const data = { ...sheet.data };
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const key = cellKey(c, r);
      const result = update(data[key] || { raw: "" }, c, r);
      if (result === null) delete data[key];
      else data[key] = result;
    }
  }
  return { ...sheet, data };
}

/** Borra el contenido conservando el formato de las celdas. */
export function clearContents(sheet: Sheet, bounds: Bounds): Sheet {
  return mapRange(sheet, bounds, (cell) => {
    const { raw: _raw, computed: _computed, cached: _cached, link: _link, ...style } = cell;
    return Object.keys(style).length > 0 ? { ...style, raw: "" } : null;
  });
}

export function styleOf(cell: CellData | undefined): Partial<CellData> {
  const style: Partial<CellData> = {};
  if (!cell) return style;
  for (const key of STYLE_KEYS) {
    if (cell[key] !== undefined) (style as Record<string, unknown>)[key] = cell[key];
  }
  return style;
}

/** Sustituye el formato de las celdas del rango por el formato copiado. */
export function applyStyle(sheet: Sheet, bounds: Bounds, style: Partial<CellData>): Sheet {
  return mapRange(sheet, bounds, (cell) => {
    const next: CellData = { raw: cell.raw };
    if (cell.computed !== undefined) next.computed = cell.computed;
    if (cell.cached !== undefined) next.cached = cell.cached;
    if (cell.link) next.link = cell.link;
    if (cell.note) next.note = cell.note;
    return { ...next, ...style };
  });
}

// ---------------------------------------------------------------------------
// Portapapeles y relleno
// ---------------------------------------------------------------------------

export interface ClipboardData {
  /** Celdas copiadas por filas; `null` para celdas vacías. */
  cells: Array<Array<CellData | null>>;
  /** Posición original de la esquina superior izquierda. */
  origin: { col: number; row: number };
  sheetId: string;
  cut: boolean;
  /** Texto tabulado equivalente, para detectar si el portapapeles del sistema cambió. */
  text: string;
}

export function copyRange(sheet: Sheet, bounds: Bounds, cut: boolean): ClipboardData {
  const cells: ClipboardData["cells"] = [];
  const lines: string[] = [];
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    const row: Array<CellData | null> = [];
    const texts: string[] = [];
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const cell = sheet.data[cellKey(c, r)] || null;
      row.push(cell);
      texts.push(cell ? formatCellValue(cell.computed, cell).replace(/[\t\n]/g, " ") : "");
    }
    cells.push(row);
    lines.push(texts.join("\t"));
  }
  return { cells, origin: { col: bounds.c1, row: bounds.r1 }, sheetId: sheet.id, cut, text: lines.join("\n") };
}

export type PasteMode = "all" | "values" | "format";

/** Pega las celdas copiadas. Si el destino es mayor que el origen, lo repite. */
export function pasteClipboard(sheet: Sheet, clip: ClipboardData, target: Bounds, mode: PasteMode): { sheet: Sheet; bounds: Bounds } {
  const rows = clip.cells.length;
  const cols = clip.cells[0]?.length || 0;
  const targetRows = target.r2 - target.r1 + 1;
  const targetCols = target.c2 - target.c1 + 1;
  // Repetir el bloque solo si el destino es múltiplo exacto del origen
  const repeatRows = targetRows % rows === 0 ? targetRows / rows : 1;
  const repeatCols = targetCols % cols === 0 ? targetCols / cols : 1;
  const bounds: Bounds = {
    r1: target.r1,
    c1: target.c1,
    r2: target.r1 + rows * repeatRows - 1,
    c2: target.c1 + cols * repeatCols - 1,
  };

  const data = { ...sheet.data };
  if (clip.cut && clip.sheetId === sheet.id && mode === "all") {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) delete data[cellKey(clip.origin.col + c, clip.origin.row + r)];
    }
  }

  for (let r = bounds.r1; r <= bounds.r2; r++) {
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const source = clip.cells[(r - bounds.r1) % rows][(c - bounds.c1) % cols];
      const key = cellKey(c, r);
      const existing = data[key];
      if (mode === "format") {
        const base: CellData = { raw: existing?.raw || "" };
        if (existing?.computed !== undefined) base.computed = existing.computed;
        data[key] = { ...base, ...styleOf(source || undefined) };
        continue;
      }
      if (!source) {
        if (mode === "all") delete data[key];
        else if (existing) data[key] = { ...existing, raw: "" };
        continue;
      }
      if (mode === "values") {
        const value = source.computed;
        const raw =
          value === null || value === undefined
            ? ""
            : typeof value === "boolean"
            ? value ? "VERDADERO" : "FALSO"
            : String(value);
        data[key] = { ...(existing || {}), raw };
        delete data[key].cached;
        continue;
      }
      // Las fórmulas se desplazan salvo al mover (cortar), que conserva sus referencias
      const raw =
        source.raw?.startsWith("=") && !clip.cut
          ? offsetFormula(source.raw, c - clip.origin.col - ((c - bounds.c1) % cols), r - clip.origin.row - ((r - bounds.r1) % rows))
          : source.raw;
      data[key] = { ...source, raw };
      delete data[key].cached;
    }
  }
  return { sheet: { ...sheet, data }, bounds };
}

/** Pega texto tabulado procedente de otra aplicación. */
export function pasteText(sheet: Sheet, text: string, col: number, row: number): { sheet: Sheet; bounds: Bounds } {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const data = { ...sheet.data };
  let maxCols = 1;
  lines.forEach((line, r) => {
    const fields = line.split("\t");
    maxCols = Math.max(maxCols, fields.length);
    fields.forEach((field, c) => {
      const key = cellKey(col + c, row + r);
      data[key] = writeCell(data[key], field);
    });
  });
  return {
    sheet: { ...sheet, data },
    bounds: { r1: row, c1: col, r2: row + lines.length - 1, c2: col + maxCols - 1 },
  };
}

/** Detecta una serie aritmética (1, 2, 3… o 10, 20…) en una lista de celdas. */
function seriesStep(cells: Array<CellData | undefined>): number | null {
  const numbers = cells.map((cell) =>
    cell && !cell.raw.startsWith("=") && typeof cell.computed === "number" ? cell.computed : null
  );
  if (numbers.some((n) => n === null)) return null;
  if (numbers.length === 1) return null;
  const step = (numbers[1] as number) - (numbers[0] as number);
  for (let i = 2; i < numbers.length; i++) {
    if (Math.abs((numbers[i] as number) - (numbers[i - 1] as number) - step) > 1e-9) return null;
  }
  return step;
}

/**
 * Rellena `target` a partir de `source` (tirador de autollenado): continúa las
 * series numéricas y desplaza las referencias de las fórmulas.
 */
export function fillRange(sheet: Sheet, source: Bounds, target: Bounds): Sheet {
  const data = { ...sheet.data };
  const vertical = target.r2 > source.r2 || target.r1 < source.r1;
  const forward = vertical ? target.r2 > source.r2 : target.c2 > source.c2;
  const length = vertical ? source.r2 - source.r1 + 1 : source.c2 - source.c1 + 1;
  const lines = vertical ? [source.c1, source.c2] : [source.r1, source.r2];

  for (let line = lines[0]; line <= lines[1]; line++) {
    const sourceCells = Array.from({ length }, (_, i) =>
      vertical ? sheet.data[cellKey(line, source.r1 + i)] : sheet.data[cellKey(source.c1 + i, line)]
    );
    const step = seriesStep(sourceCells);
    const start = forward ? (vertical ? source.r2 : source.c2) + 1 : (vertical ? source.r1 : source.c1) - 1;
    const end = forward ? (vertical ? target.r2 : target.c2) : vertical ? target.r1 : target.c1;

    for (let position = start, offset = 0; forward ? position <= end : position >= end; position += forward ? 1 : -1, offset++) {
      const index = forward ? offset % length : length - 1 - (offset % length);
      const template = sourceCells[index];
      const col = vertical ? line : position;
      const row = vertical ? position : line;
      const key = cellKey(col, row);
      if (!template) {
        delete data[key];
        continue;
      }
      let raw = template.raw;
      if (raw.startsWith("=")) {
        const origin = vertical ? source.r1 + index : source.c1 + index;
        raw = vertical ? offsetFormula(raw, 0, position - origin) : offsetFormula(raw, position - origin, 0);
      } else if (step !== null) {
        const last = sourceCells[forward ? length - 1 : 0]?.computed as number;
        const value = last + step * (offset + 1) * (forward ? 1 : -1);
        raw = String(Number(value.toPrecision(12)));
      }
      data[key] = { ...template, raw };
      delete data[key].cached;
    }
  }
  return { ...sheet, data };
}

// ---------------------------------------------------------------------------
// Datos: ordenar, duplicados, texto en columnas
// ---------------------------------------------------------------------------

function compareCells(a: CellData | undefined, b: CellData | undefined): number {
  const va = a?.computed ?? null;
  const vb = b?.computed ?? null;
  // Las celdas vacías van siempre al final
  if (va === null || va === "") return vb === null || vb === "" ? 0 : 1;
  if (vb === null || vb === "") return -1;
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  if (typeof va === "number") return -1;
  if (typeof vb === "number") return 1;
  return String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
}

/** Ordena las filas de un rango por una de sus columnas. */
export function sortRange(sheet: Sheet, bounds: Bounds, column: number, ascending: boolean, hasHeader: boolean): Sheet {
  const first = bounds.r1 + (hasHeader ? 1 : 0);
  const rows: number[] = [];
  for (let r = first; r <= bounds.r2; r++) rows.push(r);
  const sorted = [...rows].sort((ra, rb) => {
    const a = sheet.data[cellKey(column, ra)];
    const b = sheet.data[cellKey(column, rb)];
    const order = compareCells(a, b);
    const emptyA = !hasContent(a);
    const emptyB = !hasContent(b);
    if (emptyA || emptyB) return order;
    return ascending ? order : -order;
  });

  const data = { ...sheet.data };
  sorted.forEach((sourceRow, index) => {
    const targetRow = first + index;
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const source = sheet.data[cellKey(c, sourceRow)];
      const key = cellKey(c, targetRow);
      if (!source) {
        delete data[key];
      } else if (source.raw.startsWith("=") && sourceRow !== targetRow) {
        data[key] = { ...source, raw: offsetFormula(source.raw, 0, targetRow - sourceRow) };
      } else {
        data[key] = source;
      }
    }
  });
  return { ...sheet, data };
}

/** Elimina las filas repetidas de un rango. Devuelve cuántas quitó. */
export function removeDuplicates(sheet: Sheet, bounds: Bounds, hasHeader: boolean): { sheet: Sheet; removed: number } {
  const first = bounds.r1 + (hasHeader ? 1 : 0);
  const seen = new Set<string>();
  const kept: number[] = [];
  for (let r = first; r <= bounds.r2; r++) {
    const signature: string[] = [];
    let empty = true;
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const cell = sheet.data[cellKey(c, r)];
      const text = cell ? String(cell.computed ?? "").trim().toLocaleLowerCase() : "";
      if (text !== "") empty = false;
      signature.push(text);
    }
    const id = signature.join("\u0001");
    if (empty || !seen.has(id)) {
      seen.add(id);
      kept.push(r);
    }
  }
  const removed = bounds.r2 - first + 1 - kept.length;
  if (removed === 0) return { sheet, removed };

  const data = { ...sheet.data };
  for (let index = 0; index <= bounds.r2 - first; index++) {
    const targetRow = first + index;
    const sourceRow = kept[index];
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const key = cellKey(c, targetRow);
      const source = sourceRow === undefined ? undefined : sheet.data[cellKey(c, sourceRow)];
      if (!source) delete data[key];
      else data[key] = source;
    }
  }
  return { sheet: { ...sheet, data }, removed };
}

/** Divide el texto de la primera columna del rango en columnas contiguas. */
export function textToColumns(sheet: Sheet, bounds: Bounds, delimiter: string): { sheet: Sheet; columns: number } {
  const data = { ...sheet.data };
  let columns = 1;
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    const cell = sheet.data[cellKey(bounds.c1, r)];
    if (!cell || !cell.raw || cell.raw.startsWith("=")) continue;
    const parts = cell.raw.split(delimiter).map((part) => part.trim());
    columns = Math.max(columns, parts.length);
    parts.forEach((part, index) => {
      const key = cellKey(bounds.c1 + index, r);
      data[key] = writeCell(index === 0 ? cell : data[key], part);
    });
  }
  return { sheet: { ...sheet, data }, columns };
}

// ---------------------------------------------------------------------------
// Filtros y formato condicional
// ---------------------------------------------------------------------------

export function displayText(cell: CellData | undefined): string {
  return cell ? formatCellValue(cell.computed, cell) : "";
}

/** Filas ocultas por el filtro activo. */
export function hiddenRows(sheet: Sheet): Set<number> {
  const hidden = new Set<number>();
  const filter = sheet.filter;
  if (!filter) return hidden;
  const columns = Object.entries(filter.excluded).filter(([, values]) => values.length > 0);
  if (columns.length === 0) return hidden;
  for (let r = filter.range.r1 + 1; r <= filter.range.r2; r++) {
    for (const [col, values] of columns) {
      if (values.includes(displayText(sheet.data[cellKey(Number(col), r)]))) {
        hidden.add(r);
        break;
      }
    }
  }
  return hidden;
}

/** Valores distintos de una columna del filtro, en orden. */
export function filterValues(sheet: Sheet, column: number): string[] {
  const filter = sheet.filter;
  if (!filter) return [];
  const values = new Set<string>();
  for (let r = filter.range.r1 + 1; r <= filter.range.r2; r++) {
    values.add(displayText(sheet.data[cellKey(column, r)]));
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

function ruleMatches(rule: ConditionalRule, cell: CellData | undefined, context: { counts: Map<string, number>; threshold: number }): boolean {
  const value = cell?.computed;
  if (value === null || value === undefined || value === "") return false;
  const target = parseLiteral(rule.value).value;
  const numeric = typeof value === "number" && typeof target === "number";
  switch (rule.kind) {
    case "gt": return numeric && value > (target as number);
    case "lt": return numeric && value < (target as number);
    case "eq":
      return numeric ? value === target : String(value).toLocaleLowerCase() === rule.value.trim().toLocaleLowerCase();
    case "neq":
      return numeric ? value !== target : String(value).toLocaleLowerCase() !== rule.value.trim().toLocaleLowerCase();
    case "between": {
      const upper = parseLiteral(rule.value2 || "").value;
      return numeric && typeof upper === "number" && value >= (target as number) && value <= upper;
    }
    case "contains":
      return displayText(cell).toLocaleLowerCase().includes(rule.value.trim().toLocaleLowerCase());
    case "duplicate":
      return (context.counts.get(String(value).toLocaleLowerCase()) || 0) > 1;
    case "top":
      return typeof value === "number" && value >= context.threshold;
  }
}

/** Estilos resultantes de las reglas de formato condicional, por celda. */
export function conditionalStyles(sheet: Sheet): Map<string, { bg: string; color: string }> {
  const styles = new Map<string, { bg: string; color: string }>();
  for (const rule of sheet.conditional || []) {
    const counts = new Map<string, number>();
    const numbers: number[] = [];
    if (rule.kind === "duplicate" || rule.kind === "top") {
      for (let r = rule.range.r1; r <= rule.range.r2; r++) {
        for (let c = rule.range.c1; c <= rule.range.c2; c++) {
          const value = sheet.data[cellKey(c, r)]?.computed;
          if (value === null || value === undefined || value === "") continue;
          const id = String(value).toLocaleLowerCase();
          counts.set(id, (counts.get(id) || 0) + 1);
          if (typeof value === "number") numbers.push(value);
        }
      }
    }
    numbers.sort((a, b) => b - a);
    const topCount = Math.max(1, Math.floor(Number(rule.value) || 3));
    const threshold = numbers[Math.min(topCount, numbers.length) - 1] ?? Infinity;

    for (let r = rule.range.r1; r <= rule.range.r2; r++) {
      for (let c = rule.range.c1; c <= rule.range.c2; c++) {
        const key = cellKey(c, r);
        if (ruleMatches(rule, sheet.data[key], { counts, threshold })) {
          styles.set(key, { bg: rule.bg, color: rule.color });
        }
      }
    }
  }
  return styles;
}

/** Ancho aproximado en píxeles del texto de una celda (para autoajustar columnas). */
export function estimateTextWidth(cell: CellData | undefined): number {
  const text = displayText(cell);
  const size = cell?.fontSize ? (cell.fontSize * 4) / 3 : 12;
  return Math.ceil(text.length * size * (cell?.bold ? 0.62 : 0.56)) + 16;
}
