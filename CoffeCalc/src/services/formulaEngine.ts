// Motor de cálculo de CoffeCalc.
//
// Analiza las fórmulas con un analizador sintáctico propio (sin `eval`) y las
// evalúa sobre el libro completo: operadores aritméticos, comparación y
// concatenación, referencias relativas y absolutas, rangos, referencias a
// otras hojas, funciones anidadas en español o en inglés y detección de
// referencias circulares.

import type { CellData, Sheet } from "../types";

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

/** Índice de columna a letras (0 -> A, 25 -> Z, 26 -> AA). */
export function colIndexToName(index: number): string {
  let name = "";
  let temp = index;
  while (temp >= 0) {
    name = String.fromCharCode((temp % 26) + 65) + name;
    temp = Math.floor(temp / 26) - 1;
  }
  return name;
}

/** Letras de columna a índice (A -> 0, Z -> 25, AA -> 26). */
export function colNameToIndex(name: string): number {
  let index = 0;
  for (let i = 0; i < name.length; i++) {
    index = index * 26 + (name.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function cellKey(col: number, row: number): string {
  return `${colIndexToName(col)}${row + 1}`;
}

/** Descompone "B12" en { col: 1, row: 11, colName: "B", rowNum: 12 }. */
export function parseCellKey(
  key: string
): { col: number; row: number; colName: string; rowNum: number } | null {
  const match = /^\$?([A-Z]+)\$?([0-9]+)$/.exec(key.toUpperCase().trim());
  if (!match) return null;
  const rowNum = parseInt(match[2], 10);
  if (rowNum < 1) return null;
  return { col: colNameToIndex(match[1]), row: rowNum - 1, colName: match[1], rowNum };
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

export type Scalar = number | string | boolean | null;

interface RangeValue {
  kind: "range";
  rows: Scalar[][];
}

type Value = Scalar | RangeValue;

export const ERRORS = {
  div0: "#¡DIV/0!",
  value: "#¡VALOR!",
  name: "#¿NOMBRE?",
  ref: "#¡REF!",
  na: "#N/D",
  num: "#¡NUM!",
  circular: "#¡CIRCULAR!",
  syntax: "#¡ERROR!",
} as const;

/** Texto que representa un error de cálculo (#¡DIV/0!, #N/D...). */
export type ErrorText = string & { readonly __error?: true };

export function isErrorValue(value: unknown): value is ErrorText {
  return typeof value === "string" && value.startsWith("#") && /^#[¡¿N]/.test(value);
}

class FormulaError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const isRange = (value: Value): value is RangeValue =>
  typeof value === "object" && value !== null && (value as RangeValue).kind === "range";

// ---------------------------------------------------------------------------
// Fechas (números de serie compatibles con Excel)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);

export function dateToSerial(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - EPOCH) / DAY_MS);
}

export function serialToDate(serial: number): Date {
  return new Date(EPOCH + Math.floor(serial) * DAY_MS + Math.round((serial % 1) * DAY_MS));
}

/** Reconoce fechas escritas como 25/12/2026, 25-12-2026 o 2026-12-25. */
export function parseDateLiteral(text: string): number | null {
  const trimmed = text.trim();
  let match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(trimmed);
  let year: number;
  let month: number;
  let day: number;
  if (match) {
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
  } else {
    match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1) return null;
  return dateToSerial(year, month, day);
}

/**
 * Interpreta lo que el usuario escribe en una celda: número (admite coma o
 * punto decimal y el signo %), fecha, valor lógico o texto.
 */
export function parseLiteral(raw: string): { value: Scalar; format?: "percent" | "date" } {
  const text = raw.trim();
  if (text === "") return { value: null };
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) return { value: Number(text) };
  if (/^-?\d+,\d+$/.test(text)) return { value: Number(text.replace(",", ".")) };
  if (/^-?\d+([.,]\d+)?\s*%$/.test(text)) {
    return { value: Number(text.replace("%", "").trim().replace(",", ".")) / 100, format: "percent" };
  }
  const date = parseDateLiteral(text);
  if (date !== null) return { value: date, format: "date" };
  const upper = text.toUpperCase();
  if (upper === "VERDADERO" || upper === "TRUE") return { value: true };
  if (upper === "FALSO" || upper === "FALSE") return { value: false };
  return { value: raw };
}

// ---------------------------------------------------------------------------
// Analizador léxico
// ---------------------------------------------------------------------------

type TokenType = "num" | "str" | "id" | "ref" | "op" | "lparen" | "rparen" | "sep" | "colon" | "bang";

interface Token {
  type: TokenType;
  text: string;
  /** Posición en la fórmula (para reescribir referencias). */
  start: number;
  end: number;
}

const ID_START = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_]/;
const ID_PART = /[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ_.]/;

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const start = i;
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] || ""))) {
      while (i < source.length && /[0-9]/.test(source[i])) i++;
      if (source[i] === "." && /[0-9]/.test(source[i + 1] || "")) {
        i++;
        while (i < source.length && /[0-9]/.test(source[i])) i++;
      }
      if (/[eE]/.test(source[i] || "") && /[0-9+-]/.test(source[i + 1] || "")) {
        i += 2;
        while (i < source.length && /[0-9]/.test(source[i])) i++;
      }
      tokens.push({ type: "num", text: source.slice(start, i), start, end: i });
      continue;
    }
    if (ch === '"') {
      let text = "";
      i++;
      while (i < source.length) {
        if (source[i] === '"') {
          if (source[i + 1] === '"') {
            text += '"';
            i += 2;
            continue;
          }
          break;
        }
        text += source[i++];
      }
      i++;
      tokens.push({ type: "str", text, start, end: i });
      continue;
    }
    if (ch === "'") {
      // Nombre de hoja entre comillas simples: 'Mi hoja'!A1
      let text = "";
      i++;
      while (i < source.length && source[i] !== "'") text += source[i++];
      i++;
      tokens.push({ type: "id", text, start, end: i });
      continue;
    }
    if (ch === "$" || ID_START.test(ch)) {
      const refMatch = /^\$?[A-Za-z]{1,3}\$?[0-9]+/.exec(source.slice(i));
      const afterRef = source[i + (refMatch ? refMatch[0].length : 0)] || "";
      // LOG10( es una función, no la celda LOG10
      if (refMatch && !ID_PART.test(afterRef) && afterRef !== "(") {
        i += refMatch[0].length;
        tokens.push({ type: "ref", text: refMatch[0].toUpperCase(), start, end: i });
        continue;
      }
      if (ch === "$") {
        // Referencia de columna completa absoluta ($A:$A)
        i++;
      }
      while (i < source.length && ID_PART.test(source[i])) i++;
      tokens.push({ type: "id", text: source.slice(start, i), start, end: i });
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", text: ch, start, end: ++i });
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", text: ch, start, end: ++i });
      continue;
    }
    if (ch === "," || ch === ";") {
      tokens.push({ type: "sep", text: ch, start, end: ++i });
      continue;
    }
    if (ch === ":") {
      tokens.push({ type: "colon", text: ch, start, end: ++i });
      continue;
    }
    if (ch === "!") {
      tokens.push({ type: "bang", text: ch, start, end: ++i });
      continue;
    }
    const two = source.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") {
      i += 2;
      tokens.push({ type: "op", text: two, start, end: i });
      continue;
    }
    if ("+-*/^&=<>%".includes(ch)) {
      tokens.push({ type: "op", text: ch, start, end: ++i });
      continue;
    }
    throw new FormulaError(ERRORS.syntax);
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Árbol sintáctico
// ---------------------------------------------------------------------------

type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; sheet?: string; col: number; row: number }
  | { t: "range"; sheet?: string; c1: number; r1: number; c2: number; r2: number; wholeCols?: boolean }
  | { t: "unary"; op: string; arg: Node }
  | { t: "binary"; op: string; left: Node; right: Node }
  | { t: "percent"; arg: Node }
  | { t: "call"; name: string; args: Node[] };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): Node {
    const node = this.comparison();
    if (this.pos < this.tokens.length) throw new FormulaError(ERRORS.syntax);
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(...ops: string[]): boolean {
    const token = this.peek();
    return Boolean(token && token.type === "op" && ops.includes(token.text));
  }

  private comparison(): Node {
    let left = this.concat();
    while (this.isOp("=", "<>", "<", ">", "<=", ">=")) {
      const op = this.tokens[this.pos++].text;
      left = { t: "binary", op, left, right: this.concat() };
    }
    return left;
  }

  private concat(): Node {
    let left = this.additive();
    while (this.isOp("&")) {
      this.pos++;
      left = { t: "binary", op: "&", left, right: this.additive() };
    }
    return left;
  }

  private additive(): Node {
    let left = this.multiplicative();
    while (this.isOp("+", "-")) {
      const op = this.tokens[this.pos++].text;
      left = { t: "binary", op, left, right: this.multiplicative() };
    }
    return left;
  }

  private multiplicative(): Node {
    let left = this.power();
    while (this.isOp("*", "/")) {
      const op = this.tokens[this.pos++].text;
      left = { t: "binary", op, left, right: this.power() };
    }
    return left;
  }

  private power(): Node {
    let left = this.unary();
    while (this.isOp("^")) {
      this.pos++;
      left = { t: "binary", op: "^", left, right: this.unary() };
    }
    return left;
  }

  private unary(): Node {
    if (this.isOp("-", "+")) {
      const op = this.tokens[this.pos++].text;
      return { t: "unary", op, arg: this.unary() };
    }
    return this.postfix();
  }

  private postfix(): Node {
    let node = this.primary();
    while (this.isOp("%")) {
      this.pos++;
      node = { t: "percent", arg: node };
    }
    return node;
  }

  private refOrRange(sheet?: string): Node {
    const first = this.tokens[this.pos++];
    const start = parseCellKey(first.text);
    if (!start) throw new FormulaError(ERRORS.ref);
    if (this.peek()?.type === "colon" && this.tokens[this.pos + 1]?.type === "ref") {
      this.pos++;
      const end = parseCellKey(this.tokens[this.pos++].text);
      if (!end) throw new FormulaError(ERRORS.ref);
      return {
        t: "range",
        sheet,
        c1: Math.min(start.col, end.col),
        r1: Math.min(start.row, end.row),
        c2: Math.max(start.col, end.col),
        r2: Math.max(start.row, end.row),
      };
    }
    return { t: "ref", sheet, col: start.col, row: start.row };
  }

  private primary(): Node {
    const token = this.peek();
    if (!token) throw new FormulaError(ERRORS.syntax);

    if (token.type === "num") {
      this.pos++;
      return { t: "num", v: Number(token.text) };
    }
    if (token.type === "str") {
      this.pos++;
      return { t: "str", v: token.text };
    }
    if (token.type === "lparen") {
      this.pos++;
      const node = this.comparison();
      if (this.peek()?.type !== "rparen") throw new FormulaError(ERRORS.syntax);
      this.pos++;
      return node;
    }
    if (token.type === "ref") {
      return this.refOrRange();
    }
    if (token.type === "id") {
      const next = this.tokens[this.pos + 1];
      // Referencia a otra hoja: Hoja2!A1
      if (next?.type === "bang") {
        this.pos += 2;
        if (this.peek()?.type !== "ref") throw new FormulaError(ERRORS.ref);
        return this.refOrRange(token.text);
      }
      // Llamada a función
      if (next?.type === "lparen") {
        this.pos += 2;
        const args: Node[] = [];
        if (this.peek()?.type === "rparen") {
          this.pos++;
          return { t: "call", name: token.text.toUpperCase(), args };
        }
        for (;;) {
          args.push(this.comparison());
          const after = this.peek();
          if (after?.type === "sep") {
            this.pos++;
            continue;
          }
          if (after?.type === "rparen") {
            this.pos++;
            break;
          }
          throw new FormulaError(ERRORS.syntax);
        }
        return { t: "call", name: token.text.toUpperCase(), args };
      }
      // Columnas completas: A:C
      const clean = token.text.replace(/\$/g, "").toUpperCase();
      if (/^[A-Z]{1,3}$/.test(clean) && next?.type === "colon") {
        const endToken = this.tokens[this.pos + 2];
        const endClean = endToken?.text.replace(/\$/g, "").toUpperCase() || "";
        if (endToken?.type === "id" && /^[A-Z]{1,3}$/.test(endClean)) {
          this.pos += 3;
          const a = colNameToIndex(clean);
          const b = colNameToIndex(endClean);
          return { t: "range", c1: Math.min(a, b), c2: Math.max(a, b), r1: 0, r2: 0, wholeCols: true };
        }
      }
      this.pos++;
      const upper = token.text.toUpperCase();
      if (upper === "VERDADERO" || upper === "TRUE") return { t: "bool", v: true };
      if (upper === "FALSO" || upper === "FALSE") return { t: "bool", v: false };
      throw new FormulaError(ERRORS.name);
    }
    throw new FormulaError(ERRORS.syntax);
  }
}

const astCache = new Map<string, Node | FormulaError>();

function parseFormula(expression: string): Node {
  const cached = astCache.get(expression);
  if (cached) {
    if (cached instanceof FormulaError) throw cached;
    return cached;
  }
  try {
    const ast = new Parser(tokenize(expression)).parse();
    if (astCache.size > 5000) astCache.clear();
    astCache.set(expression, ast);
    return ast;
  } catch (err) {
    const error = err instanceof FormulaError ? err : new FormulaError(ERRORS.syntax);
    astCache.set(expression, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Conversión de valores
// ---------------------------------------------------------------------------

function toNumber(value: Value): number {
  if (isRange(value)) return toNumber(value.rows[0]?.[0] ?? null);
  if (value === null || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isErrorValue(value)) throw new FormulaError(value);
  const parsed = parseLiteral(value);
  if (typeof parsed.value === "number") return parsed.value;
  throw new FormulaError(ERRORS.value);
}

function toText(value: Value): string {
  if (isRange(value)) return toText(value.rows[0]?.[0] ?? null);
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
  if (typeof value === "number") return formatGeneral(value);
  if (isErrorValue(value)) throw new FormulaError(value);
  return value;
}

function toBool(value: Value): boolean {
  if (isRange(value)) return toBool(value.rows[0]?.[0] ?? null);
  if (value === null || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (isErrorValue(value)) throw new FormulaError(value);
  const upper = String(value).toUpperCase();
  if (upper === "VERDADERO" || upper === "TRUE") return true;
  if (upper === "FALSO" || upper === "FALSE") return false;
  throw new FormulaError(ERRORS.value);
}

function scalarOf(value: Value): Scalar {
  return isRange(value) ? value.rows[0]?.[0] ?? null : value;
}

/** Aplana argumentos (escalares y rangos) en una lista de valores. */
function flatten(args: Value[]): Scalar[] {
  const out: Scalar[] = [];
  for (const arg of args) {
    if (isRange(arg)) {
      for (const row of arg.rows) out.push(...row);
    } else {
      out.push(arg);
    }
  }
  return out;
}

/** Números de los argumentos; en rangos se ignoran textos y celdas vacías. */
function numbersOf(args: Value[]): number[] {
  const out: number[] = [];
  for (const arg of args) {
    if (isRange(arg)) {
      for (const row of arg.rows) {
        for (const cell of row) {
          if (isErrorValue(cell)) throw new FormulaError(cell);
          if (typeof cell === "number") out.push(cell);
        }
      }
    } else if (arg !== null && arg !== "") {
      out.push(toNumber(arg));
    }
  }
  return out;
}

function compareValues(a: Scalar, b: Scalar): number {
  const left = a === null ? (typeof b === "string" ? "" : 0) : a;
  const right = b === null ? (typeof a === "string" ? "" : 0) : b;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, "es", { sensitivity: "accent" });
  }
  // Orden de Excel entre tipos distintos: números < textos < lógicos
  const rank = (v: Scalar) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);
  return rank(left) - rank(right);
}

/** Criterio de CONTAR.SI / SUMAR.SI: ">10", "<>0", "caf*", 5... */
function matchesCriterion(value: Scalar, criterion: Scalar): boolean {
  if (typeof criterion !== "string") {
    return value !== null && compareValues(value, criterion) === 0 && typeof value === typeof criterion;
  }
  const match = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(criterion);
  const op = match?.[1] || "=";
  const targetText = match?.[2] ?? "";
  const target = parseLiteral(targetText).value;

  if (typeof target === "number") {
    if (typeof value !== "number") return op === "<>";
    switch (op) {
      case ">": return value > target;
      case "<": return value < target;
      case ">=": return value >= target;
      case "<=": return value <= target;
      case "<>": return value !== target;
      default: return value === target;
    }
  }

  const text = value === null ? "" : toTextSafe(value).toLocaleLowerCase();
  const wanted = targetText.toLocaleLowerCase();
  if (op === "=" || op === "<>") {
    let equal: boolean;
    if (/[*?]/.test(wanted)) {
      const pattern = wanted.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
      equal = new RegExp(`^${pattern}$`).test(text);
    } else {
      equal = text === wanted;
    }
    return op === "=" ? equal : !equal;
  }
  const order = text.localeCompare(wanted, "es");
  return op === ">" ? order > 0 : op === "<" ? order < 0 : op === ">=" ? order >= 0 : order <= 0;
}

function toTextSafe(value: Scalar): string {
  try {
    return toText(value);
  } catch {
    return String(value);
  }
}

function formatGeneral(value: number): string {
  if (!isFinite(value)) return ERRORS.num;
  const rounded = Number(value.toPrecision(12));
  return String(rounded).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Funciones
// ---------------------------------------------------------------------------

interface CallContext {
  /** Posición de la celda que contiene la fórmula. */
  col: number;
  row: number;
}

type FunctionImpl = (args: Value[], ctx: CallContext) => Value;

const need = (args: Value[], min: number, max = min) => {
  if (args.length < min || args.length > max) throw new FormulaError(ERRORS.value);
};

const rangeArg = (value: Value): RangeValue => (isRange(value) ? value : { kind: "range", rows: [[value]] });

function roundTo(value: number, digits: number, mode: "round" | "up" | "down"): number {
  const factor = Math.pow(10, digits);
  const scaled = value * factor;
  const epsilon = 1e-9 * Math.sign(scaled);
  if (mode === "round") return Math.round(scaled + epsilon) / factor;
  if (mode === "up") return (Math.sign(scaled) * Math.ceil(Math.abs(scaled) - 1e-9)) / factor;
  return (Math.sign(scaled) * Math.floor(Math.abs(scaled) + 1e-9)) / factor;
}

function variance(values: number[], sample: boolean): number {
  const n = values.length;
  if (n < (sample ? 2 : 1)) throw new FormulaError(ERRORS.div0);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (sample ? n - 1 : n);
}

/** Recorre pares (rango de criterios, criterio) y devuelve las posiciones que cumplen todos. */
function criteriaMatches(pairs: Value[]): Array<[number, number]> {
  if (pairs.length < 2 || pairs.length % 2 !== 0) throw new FormulaError(ERRORS.value);
  const first = rangeArg(pairs[0]);
  const matches: Array<[number, number]> = [];
  for (let r = 0; r < first.rows.length; r++) {
    for (let c = 0; c < first.rows[r].length; c++) {
      let ok = true;
      for (let i = 0; i < pairs.length && ok; i += 2) {
        const range = rangeArg(pairs[i]);
        ok = matchesCriterion(range.rows[r]?.[c] ?? null, scalarOf(pairs[i + 1]));
      }
      if (ok) matches.push([r, c]);
    }
  }
  return matches;
}

function lookupIndex(needle: Scalar, haystack: Scalar[], approximate: boolean): number {
  if (!approximate) {
    return haystack.findIndex((item) => {
      if (typeof needle === "string" && typeof item === "string") {
        return item.toLocaleLowerCase() === needle.toLocaleLowerCase();
      }
      return item !== null && typeof item === typeof needle && compareValues(item, needle) === 0;
    });
  }
  // Coincidencia aproximada: el mayor valor que no supera al buscado
  let found = -1;
  for (let i = 0; i < haystack.length; i++) {
    const item = haystack[i];
    if (item === null || typeof item !== typeof needle) continue;
    if (compareValues(item, needle) <= 0) found = i;
    else break;
  }
  return found;
}

const todaySerial = () => {
  const now = new Date();
  return dateToSerial(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

function addMonths(serial: number, months: number, endOfMonth: boolean): number {
  const date = serialToDate(serial);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  if (endOfMonth) {
    const last = new Date(Date.UTC(year, month + 1, 0));
    return dateToSerial(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate());
  }
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
  return dateToSerial(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
}

function formatWithPattern(value: number, pattern: string): string {
  const lower = pattern.toLowerCase();
  if (/[dmay]/.test(lower) && !/[0#]/.test(pattern)) {
    const date = serialToDate(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return lower
      .replace(/yyyy|aaaa/g, String(date.getUTCFullYear()))
      .replace(/yy|aa/g, String(date.getUTCFullYear()).slice(-2))
      .replace(/mm/g, pad(date.getUTCMonth() + 1))
      .replace(/dd/g, pad(date.getUTCDate()))
      .replace(/hh/g, pad(date.getUTCHours()))
      .replace(/ss/g, pad(date.getUTCSeconds()));
  }
  const percent = pattern.includes("%");
  const decimals = (pattern.split(/[.,](?=[0#]+%?$)/)[1] || "").replace(/[^0#]/g, "").length;
  const grouping = /[#0][.,][#0]{3}/.test(pattern);
  const number = percent ? value * 100 : value;
  const text = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  }).format(number);
  return percent ? `${text}%` : text;
}

const FUNCTIONS: Record<string, FunctionImpl> = {
  // --- Matemáticas ---
  SUM: (a) => numbersOf(a).reduce((x, y) => x + y, 0),
  PRODUCT: (a) => {
    const nums = numbersOf(a);
    return nums.length === 0 ? 0 : nums.reduce((x, y) => x * y, 1);
  },
  ROUND: (a) => (need(a, 1, 2), roundTo(toNumber(a[0]), a[1] === undefined ? 0 : toNumber(a[1]), "round")),
  ROUNDUP: (a) => (need(a, 1, 2), roundTo(toNumber(a[0]), a[1] === undefined ? 0 : toNumber(a[1]), "up")),
  ROUNDDOWN: (a) => (need(a, 1, 2), roundTo(toNumber(a[0]), a[1] === undefined ? 0 : toNumber(a[1]), "down")),
  TRUNC: (a) => (need(a, 1, 2), roundTo(toNumber(a[0]), a[1] === undefined ? 0 : toNumber(a[1]), "down")),
  INT: (a) => (need(a, 1), Math.floor(toNumber(a[0]))),
  ABS: (a) => (need(a, 1), Math.abs(toNumber(a[0]))),
  SIGN: (a) => (need(a, 1), Math.sign(toNumber(a[0]))),
  SQRT: (a) => {
    need(a, 1);
    const n = toNumber(a[0]);
    if (n < 0) throw new FormulaError(ERRORS.num);
    return Math.sqrt(n);
  },
  POWER: (a) => (need(a, 2), Math.pow(toNumber(a[0]), toNumber(a[1]))),
  MOD: (a) => {
    need(a, 2);
    const divisor = toNumber(a[1]);
    if (divisor === 0) throw new FormulaError(ERRORS.div0);
    const n = toNumber(a[0]);
    return n - divisor * Math.floor(n / divisor);
  },
  QUOTIENT: (a) => {
    need(a, 2);
    const divisor = toNumber(a[1]);
    if (divisor === 0) throw new FormulaError(ERRORS.div0);
    return Math.trunc(toNumber(a[0]) / divisor);
  },
  EXP: (a) => (need(a, 1), Math.exp(toNumber(a[0]))),
  LN: (a) => {
    need(a, 1);
    const n = toNumber(a[0]);
    if (n <= 0) throw new FormulaError(ERRORS.num);
    return Math.log(n);
  },
  LOG10: (a) => {
    need(a, 1);
    const n = toNumber(a[0]);
    if (n <= 0) throw new FormulaError(ERRORS.num);
    return Math.log10(n);
  },
  LOG: (a) => {
    need(a, 1, 2);
    const n = toNumber(a[0]);
    const base = a[1] === undefined ? 10 : toNumber(a[1]);
    if (n <= 0 || base <= 0 || base === 1) throw new FormulaError(ERRORS.num);
    return Math.log(n) / Math.log(base);
  },
  PI: () => Math.PI,
  SIN: (a) => (need(a, 1), Math.sin(toNumber(a[0]))),
  COS: (a) => (need(a, 1), Math.cos(toNumber(a[0]))),
  TAN: (a) => (need(a, 1), Math.tan(toNumber(a[0]))),
  RADIANS: (a) => (need(a, 1), (toNumber(a[0]) * Math.PI) / 180),
  DEGREES: (a) => (need(a, 1), (toNumber(a[0]) * 180) / Math.PI),
  FACT: (a) => {
    need(a, 1);
    const n = Math.floor(toNumber(a[0]));
    if (n < 0 || n > 170) throw new FormulaError(ERRORS.num);
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  },
  RAND: () => Math.random(),
  RANDBETWEEN: (a) => {
    need(a, 2);
    const low = Math.ceil(toNumber(a[0]));
    const high = Math.floor(toNumber(a[1]));
    if (low > high) throw new FormulaError(ERRORS.num);
    return low + Math.floor(Math.random() * (high - low + 1));
  },
  SUMPRODUCT: (a) => {
    if (a.length === 0) throw new FormulaError(ERRORS.value);
    const ranges = a.map(rangeArg);
    let total = 0;
    for (let r = 0; r < ranges[0].rows.length; r++) {
      for (let c = 0; c < ranges[0].rows[r].length; c++) {
        let product = 1;
        for (const range of ranges) {
          const cell = range.rows[r]?.[c];
          product *= typeof cell === "number" ? cell : 0;
        }
        total += product;
      }
    }
    return total;
  },
  SUMSQ: (a) => numbersOf(a).reduce((x, y) => x + y * y, 0),

  // --- Estadísticas ---
  AVERAGE: (a) => {
    const nums = numbersOf(a);
    if (nums.length === 0) throw new FormulaError(ERRORS.div0);
    return nums.reduce((x, y) => x + y, 0) / nums.length;
  },
  COUNT: (a) => flatten(a).filter((v) => typeof v === "number").length,
  COUNTA: (a) => flatten(a).filter((v) => v !== null && v !== "").length,
  COUNTBLANK: (a) => flatten(a).filter((v) => v === null || v === "").length,
  MAX: (a) => {
    const nums = numbersOf(a);
    return nums.length ? Math.max(...nums) : 0;
  },
  MIN: (a) => {
    const nums = numbersOf(a);
    return nums.length ? Math.min(...nums) : 0;
  },
  MEDIAN: (a) => {
    const nums = numbersOf(a).sort((x, y) => x - y);
    if (nums.length === 0) throw new FormulaError(ERRORS.num);
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  },
  MODE: (a) => {
    const counts = new Map<number, number>();
    let best: number | null = null;
    let bestCount = 1;
    for (const n of numbersOf(a)) {
      const count = (counts.get(n) || 0) + 1;
      counts.set(n, count);
      if (count > bestCount) {
        best = n;
        bestCount = count;
      }
    }
    if (best === null) throw new FormulaError(ERRORS.na);
    return best;
  },
  STDEV: (a) => Math.sqrt(variance(numbersOf(a), true)),
  STDEVP: (a) => Math.sqrt(variance(numbersOf(a), false)),
  VAR: (a) => variance(numbersOf(a), true),
  VARP: (a) => variance(numbersOf(a), false),
  LARGE: (a) => {
    need(a, 2);
    const nums = numbersOf([a[0]]).sort((x, y) => y - x);
    const k = Math.floor(toNumber(a[1]));
    if (k < 1 || k > nums.length) throw new FormulaError(ERRORS.num);
    return nums[k - 1];
  },
  SMALL: (a) => {
    need(a, 2);
    const nums = numbersOf([a[0]]).sort((x, y) => x - y);
    const k = Math.floor(toNumber(a[1]));
    if (k < 1 || k > nums.length) throw new FormulaError(ERRORS.num);
    return nums[k - 1];
  },
  RANK: (a) => {
    need(a, 2, 3);
    const value = toNumber(a[0]);
    const nums = numbersOf([a[1]]);
    if (!nums.includes(value)) throw new FormulaError(ERRORS.na);
    const ascending = a[2] !== undefined && toNumber(a[2]) !== 0;
    return 1 + nums.filter((n) => (ascending ? n < value : n > value)).length;
  },
  COUNTIF: (a) => (need(a, 2), criteriaMatches(a).length),
  COUNTIFS: (a) => criteriaMatches(a).length,
  SUMIF: (a) => {
    need(a, 2, 3);
    const source = rangeArg(a[2] ?? a[0]);
    return criteriaMatches([a[0], a[1]]).reduce((total, [r, c]) => {
      const cell = source.rows[r]?.[c];
      return total + (typeof cell === "number" ? cell : 0);
    }, 0);
  },
  SUMIFS: (a) => {
    if (a.length < 3) throw new FormulaError(ERRORS.value);
    const source = rangeArg(a[0]);
    return criteriaMatches(a.slice(1)).reduce((total, [r, c]) => {
      const cell = source.rows[r]?.[c];
      return total + (typeof cell === "number" ? cell : 0);
    }, 0);
  },
  AVERAGEIF: (a) => {
    need(a, 2, 3);
    const source = rangeArg(a[2] ?? a[0]);
    const nums = criteriaMatches([a[0], a[1]])
      .map(([r, c]) => source.rows[r]?.[c])
      .filter((v): v is number => typeof v === "number");
    if (nums.length === 0) throw new FormulaError(ERRORS.div0);
    return nums.reduce((x, y) => x + y, 0) / nums.length;
  },
  AVERAGEIFS: (a) => {
    if (a.length < 3) throw new FormulaError(ERRORS.value);
    const source = rangeArg(a[0]);
    const nums = criteriaMatches(a.slice(1))
      .map(([r, c]) => source.rows[r]?.[c])
      .filter((v): v is number => typeof v === "number");
    if (nums.length === 0) throw new FormulaError(ERRORS.div0);
    return nums.reduce((x, y) => x + y, 0) / nums.length;
  },

  // --- Lógicas (SI, SI.ERROR y SI.CONJUNTO se evalúan de forma perezosa aparte) ---
  AND: (a) => flatten(a).filter((v) => v !== null && v !== "").every((v) => toBool(v)),
  OR: (a) => flatten(a).filter((v) => v !== null && v !== "").some((v) => toBool(v)),
  XOR: (a) => flatten(a).filter((v) => v !== null && v !== "").filter((v) => toBool(v)).length % 2 === 1,
  NOT: (a) => (need(a, 1), !toBool(a[0])),
  TRUE: () => true,
  FALSE: () => false,

  // --- Texto ---
  CONCATENATE: (a) => flatten(a).map(toText).join(""),
  TEXTJOIN: (a) => {
    if (a.length < 3) throw new FormulaError(ERRORS.value);
    const delimiter = toText(a[0]);
    const ignoreEmpty = toBool(a[1]);
    return flatten(a.slice(2))
      .filter((v) => !ignoreEmpty || (v !== null && v !== ""))
      .map(toText)
      .join(delimiter);
  },
  LEFT: (a) => (need(a, 1, 2), toText(a[0]).slice(0, a[1] === undefined ? 1 : Math.max(0, toNumber(a[1])))),
  RIGHT: (a) => {
    need(a, 1, 2);
    const text = toText(a[0]);
    const count = a[1] === undefined ? 1 : Math.max(0, toNumber(a[1]));
    return count === 0 ? "" : text.slice(-count);
  },
  MID: (a) => {
    need(a, 3);
    const start = toNumber(a[1]);
    if (start < 1) throw new FormulaError(ERRORS.value);
    return toText(a[0]).substr(start - 1, Math.max(0, toNumber(a[2])));
  },
  LEN: (a) => (need(a, 1), toText(a[0]).length),
  TRIM: (a) => (need(a, 1), toText(a[0]).trim().replace(/\s+/g, " ")),
  UPPER: (a) => (need(a, 1), toText(a[0]).toLocaleUpperCase("es")),
  LOWER: (a) => (need(a, 1), toText(a[0]).toLocaleLowerCase("es")),
  PROPER: (a) =>
    (need(a, 1),
    toText(a[0])
      .toLocaleLowerCase("es")
      .replace(/(^|[^\p{L}])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase("es"))),
  SUBSTITUTE: (a) => {
    need(a, 3, 4);
    const text = toText(a[0]);
    const search = toText(a[1]);
    const replacement = toText(a[2]);
    if (search === "") return text;
    if (a[3] === undefined) return text.split(search).join(replacement);
    const occurrence = toNumber(a[3]);
    let index = -1;
    for (let i = 0; i < occurrence; i++) {
      index = text.indexOf(search, index + 1);
      if (index === -1) return text;
    }
    return text.slice(0, index) + replacement + text.slice(index + search.length);
  },
  REPLACE: (a) => {
    need(a, 4);
    const text = toText(a[0]);
    const start = toNumber(a[1]) - 1;
    return text.slice(0, start) + toText(a[3]) + text.slice(start + toNumber(a[2]));
  },
  FIND: (a) => {
    need(a, 2, 3);
    const index = toText(a[1]).indexOf(toText(a[0]), a[2] === undefined ? 0 : toNumber(a[2]) - 1);
    if (index === -1) throw new FormulaError(ERRORS.value);
    return index + 1;
  },
  SEARCH: (a) => {
    need(a, 2, 3);
    const index = toText(a[1])
      .toLocaleLowerCase()
      .indexOf(toText(a[0]).toLocaleLowerCase(), a[2] === undefined ? 0 : toNumber(a[2]) - 1);
    if (index === -1) throw new FormulaError(ERRORS.value);
    return index + 1;
  },
  REPT: (a) => (need(a, 2), toText(a[0]).repeat(Math.max(0, Math.floor(toNumber(a[1]))))),
  EXACT: (a) => (need(a, 2), toText(a[0]) === toText(a[1])),
  VALUE: (a) => (need(a, 1), toNumber(a[0])),
  TEXT: (a) => (need(a, 2), formatWithPattern(toNumber(a[0]), toText(a[1]))),

  // --- Fecha y hora ---
  TODAY: () => todaySerial(),
  NOW: () => {
    const now = new Date();
    return todaySerial() + (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  },
  DATE: (a) => (need(a, 3), dateToSerial(toNumber(a[0]), toNumber(a[1]), toNumber(a[2]))),
  YEAR: (a) => (need(a, 1), serialToDate(toNumber(a[0])).getUTCFullYear()),
  MONTH: (a) => (need(a, 1), serialToDate(toNumber(a[0])).getUTCMonth() + 1),
  DAY: (a) => (need(a, 1), serialToDate(toNumber(a[0])).getUTCDate()),
  HOUR: (a) => (need(a, 1), serialToDate(toNumber(a[0])).getUTCHours()),
  MINUTE: (a) => (need(a, 1), serialToDate(toNumber(a[0])).getUTCMinutes()),
  SECOND: (a) => (need(a, 1), serialToDate(toNumber(a[0])).getUTCSeconds()),
  WEEKDAY: (a) => {
    need(a, 1, 2);
    const day = serialToDate(toNumber(a[0])).getUTCDay();
    const mode = a[1] === undefined ? 1 : toNumber(a[1]);
    return mode === 2 ? ((day + 6) % 7) + 1 : mode === 3 ? (day + 6) % 7 : day + 1;
  },
  DAYS: (a) => (need(a, 2), Math.floor(toNumber(a[0])) - Math.floor(toNumber(a[1]))),
  EDATE: (a) => (need(a, 2), addMonths(toNumber(a[0]), Math.trunc(toNumber(a[1])), false)),
  EOMONTH: (a) => (need(a, 2), addMonths(toNumber(a[0]), Math.trunc(toNumber(a[1])), true)),
  DATEDIF: (a) => {
    need(a, 3);
    const start = serialToDate(toNumber(a[0]));
    const end = serialToDate(toNumber(a[1]));
    if (end < start) throw new FormulaError(ERRORS.num);
    const unit = toText(a[2]).toUpperCase();
    const months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth()) -
      (end.getUTCDate() < start.getUTCDate() ? 1 : 0);
    if (unit === "D") return Math.floor(toNumber(a[1])) - Math.floor(toNumber(a[0]));
    if (unit === "M") return months;
    if (unit === "Y" || unit === "A") return Math.floor(months / 12);
    throw new FormulaError(ERRORS.num);
  },

  // --- Búsqueda y referencia ---
  VLOOKUP: (a) => {
    need(a, 3, 4);
    const table = rangeArg(a[1]);
    const column = Math.floor(toNumber(a[2]));
    if (column < 1 || column > (table.rows[0]?.length || 0)) throw new FormulaError(ERRORS.ref);
    const approximate = a[3] === undefined ? true : toBool(a[3]);
    const index = lookupIndex(scalarOf(a[0]), table.rows.map((row) => row[0]), approximate);
    if (index === -1) throw new FormulaError(ERRORS.na);
    return table.rows[index][column - 1];
  },
  HLOOKUP: (a) => {
    need(a, 3, 4);
    const table = rangeArg(a[1]);
    const rowIndex = Math.floor(toNumber(a[2]));
    if (rowIndex < 1 || rowIndex > table.rows.length) throw new FormulaError(ERRORS.ref);
    const approximate = a[3] === undefined ? true : toBool(a[3]);
    const index = lookupIndex(scalarOf(a[0]), table.rows[0] || [], approximate);
    if (index === -1) throw new FormulaError(ERRORS.na);
    return table.rows[rowIndex - 1][index];
  },
  XLOOKUP: (a) => {
    need(a, 3, 4);
    const keys = flatten([a[1]]);
    const results = flatten([a[2]]);
    const index = lookupIndex(scalarOf(a[0]), keys, false);
    if (index === -1) {
      if (a[3] !== undefined) return scalarOf(a[3]);
      throw new FormulaError(ERRORS.na);
    }
    return results[index] ?? null;
  },
  INDEX: (a) => {
    need(a, 2, 3);
    const table = rangeArg(a[0]);
    let rowIndex = Math.floor(toNumber(a[1]));
    let column = a[2] === undefined ? 1 : Math.floor(toNumber(a[2]));
    // En un rango de una sola fila el segundo argumento indica la columna
    if (table.rows.length === 1 && a[2] === undefined) {
      column = rowIndex;
      rowIndex = 1;
    }
    const value = table.rows[rowIndex - 1]?.[column - 1];
    if (value === undefined) throw new FormulaError(ERRORS.ref);
    return value;
  },
  MATCH: (a) => {
    need(a, 2, 3);
    const mode = a[2] === undefined ? 1 : toNumber(a[2]);
    const index = lookupIndex(scalarOf(a[0]), flatten([a[1]]), mode !== 0);
    if (index === -1) throw new FormulaError(ERRORS.na);
    return index + 1;
  },
  CHOOSE: (a) => {
    if (a.length < 2) throw new FormulaError(ERRORS.value);
    const index = Math.floor(toNumber(a[0]));
    if (index < 1 || index >= a.length) throw new FormulaError(ERRORS.value);
    return a[index];
  },
  ROWS: (a) => (need(a, 1), rangeArg(a[0]).rows.length),
  COLUMNS: (a) => (need(a, 1), rangeArg(a[0]).rows[0]?.length || 0),

  // --- Información ---
  ISBLANK: (a) => (need(a, 1), scalarOf(a[0]) === null || scalarOf(a[0]) === ""),
  ISNUMBER: (a) => (need(a, 1), typeof scalarOf(a[0]) === "number"),
  ISTEXT: (a) => {
    need(a, 1);
    const value = scalarOf(a[0]);
    return typeof value === "string" && value !== "" && !isErrorValue(value);
  },
  ISLOGICAL: (a) => (need(a, 1), typeof scalarOf(a[0]) === "boolean"),
  ISEVEN: (a) => (need(a, 1), Math.trunc(toNumber(a[0])) % 2 === 0),
  ISODD: (a) => (need(a, 1), Math.abs(Math.trunc(toNumber(a[0])) % 2) === 1),

  // --- Financieras ---
  PMT: (a) => {
    need(a, 3, 5);
    const rate = toNumber(a[0]);
    const periods = toNumber(a[1]);
    const present = toNumber(a[2]);
    const future = a[3] === undefined ? 0 : toNumber(a[3]);
    const type = a[4] === undefined ? 0 : toNumber(a[4]);
    if (periods === 0) throw new FormulaError(ERRORS.num);
    if (rate === 0) return -(present + future) / periods;
    const growth = Math.pow(1 + rate, periods);
    return (-(present * growth + future) * rate) / ((growth - 1) * (1 + rate * type));
  },
  FV: (a) => {
    need(a, 3, 5);
    const rate = toNumber(a[0]);
    const periods = toNumber(a[1]);
    const payment = toNumber(a[2]);
    const present = a[3] === undefined ? 0 : toNumber(a[3]);
    const type = a[4] === undefined ? 0 : toNumber(a[4]);
    if (rate === 0) return -(present + payment * periods);
    const growth = Math.pow(1 + rate, periods);
    return -(present * growth + (payment * (1 + rate * type) * (growth - 1)) / rate);
  },
  PV: (a) => {
    need(a, 3, 5);
    const rate = toNumber(a[0]);
    const periods = toNumber(a[1]);
    const payment = toNumber(a[2]);
    const future = a[3] === undefined ? 0 : toNumber(a[3]);
    const type = a[4] === undefined ? 0 : toNumber(a[4]);
    if (rate === 0) return -(future + payment * periods);
    const growth = Math.pow(1 + rate, periods);
    return -(future + (payment * (1 + rate * type) * (growth - 1)) / rate) / growth;
  },
  NPV: (a) => {
    if (a.length < 2) throw new FormulaError(ERRORS.value);
    const rate = toNumber(a[0]);
    return numbersOf(a.slice(1)).reduce((total, flow, i) => total + flow / Math.pow(1 + rate, i + 1), 0);
  },
};

/** Nombres en español (y sinónimos) de cada función. */
const ALIASES: Record<string, string> = {
  SUMA: "SUM", PRODUCTO: "PRODUCT", REDONDEAR: "ROUND", "REDONDEAR.MAS": "ROUNDUP",
  "REDONDEAR.MENOS": "ROUNDDOWN", TRUNCAR: "TRUNC", ENTERO: "INT", SIGNO: "SIGN", RAIZ: "SQRT",
  "RAÍZ": "SQRT", POTENCIA: "POWER", RESIDUO: "MOD", RESTO: "MOD", COCIENTE: "QUOTIENT",
  SENO: "SIN", COSENO: "COS", TANGENTE: "TAN", RADIANES: "RADIANS", GRADOS: "DEGREES",
  ALEATORIO: "RAND", "ALEATORIO.ENTRE": "RANDBETWEEN", SUMAPRODUCTO: "SUMPRODUCT",
  "SUMA.CUADRADOS": "SUMSQ", PROMEDIO: "AVERAGE", CONTAR: "COUNT", CONTARA: "COUNTA",
  "CONTAR.BLANCO": "COUNTBLANK", MEDIANA: "MEDIAN", MODA: "MODE", "MODA.UNO": "MODE",
  "MODE.SNGL": "MODE", DESVEST: "STDEV", "DESVEST.M": "STDEV", "STDEV.S": "STDEV",
  "DESVEST.P": "STDEVP", "STDEV.P": "STDEVP", "VAR.S": "VAR", "VAR.P": "VARP",
  "K.ESIMO.MAYOR": "LARGE", "K.ESIMO.MENOR": "SMALL", JERARQUIA: "RANK", "JERARQUÍA": "RANK",
  "RANK.EQ": "RANK", "JERARQUIA.EQV": "RANK", "CONTAR.SI": "COUNTIF",
  "CONTAR.SI.CONJUNTO": "COUNTIFS", "SUMAR.SI": "SUMIF", "SUMAR.SI.CONJUNTO": "SUMIFS",
  "PROMEDIO.SI": "AVERAGEIF", "PROMEDIO.SI.CONJUNTO": "AVERAGEIFS", SI: "IF",
  "SI.ERROR": "IFERROR", "SI.ND": "IFNA", "SI.CONJUNTO": "IFS", Y: "AND", O: "OR", XO: "XOR",
  NO: "NOT", VERDADERO: "TRUE", FALSO: "FALSE", CONCATENAR: "CONCATENATE", CONCAT: "CONCATENATE",
  UNIRCADENAS: "TEXTJOIN", IZQUIERDA: "LEFT", DERECHA: "RIGHT", EXTRAE: "MID", LARGO: "LEN",
  ESPACIOS: "TRIM", MAYUSC: "UPPER", MINUSC: "LOWER", NOMPROPIO: "PROPER", SUSTITUIR: "SUBSTITUTE",
  REEMPLAZAR: "REPLACE", ENCONTRAR: "FIND", HALLAR: "SEARCH", REPETIR: "REPT", IGUAL: "EXACT",
  VALOR: "VALUE", TEXTO: "TEXT", HOY: "TODAY", AHORA: "NOW", FECHA: "DATE", "AÑO": "YEAR",
  ANO: "YEAR", MES: "MONTH", DIA: "DAY", "DÍA": "DAY", HORA: "HOUR", MINUTO: "MINUTE",
  SEGUNDO: "SECOND", DIASEM: "WEEKDAY", DIAS: "DAYS", "DÍAS": "DAYS", "FECHA.MES": "EDATE",
  "FIN.MES": "EOMONTH", SIFECHA: "DATEDIF", BUSCARV: "VLOOKUP", BUSCARH: "HLOOKUP",
  BUSCARX: "XLOOKUP", INDICE: "INDEX", "ÍNDICE": "INDEX", COINCIDIR: "MATCH", ELEGIR: "CHOOSE",
  FILA: "ROW", COLUMNA: "COLUMN", FILAS: "ROWS", COLUMNAS: "COLUMNS", ESBLANCO: "ISBLANK",
  ESNUMERO: "ISNUMBER", "ESNÚMERO": "ISNUMBER", ESTEXTO: "ISTEXT", ESERROR: "ISERROR",
  ESLOGICO: "ISLOGICAL", "ES.PAR": "ISEVEN", "ES.IMPAR": "ISODD", ESNOD: "ISNA", PAGO: "PMT",
  VF: "FV", VA: "PV", VNA: "NPV",
};

/** Funciones que se evalúan de forma especial (perezosas o dependientes de la posición). */
const SPECIAL = new Set(["IF", "IFERROR", "IFNA", "IFS", "ISERROR", "ISNA", "ROW", "COLUMN"]);

export function canonicalFunctionName(name: string): string | null {
  const upper = name.toUpperCase();
  const canonical = ALIASES[upper] || upper;
  return FUNCTIONS[canonical] || SPECIAL.has(canonical) ? canonical : null;
}

/** Funciones que devuelven fechas: su celda se muestra con formato de fecha. */
const DATE_FUNCTIONS = new Set(["TODAY", "DATE", "EDATE", "EOMONTH"]);

/** Formato sugerido para el resultado de una fórmula recién escrita. */
export function suggestedFormat(raw: string): "date" | undefined {
  const match = /^=\s*([A-Za-zÁÉÍÓÚÑáéíóúñ.]+)\s*\(/.exec(raw);
  if (!match) return undefined;
  const canonical = canonicalFunctionName(match[1]);
  return canonical && DATE_FUNCTIONS.has(canonical) ? "date" : undefined;
}

/** Catálogo para el selector de funciones de la barra de fórmulas. */
export const FUNCTION_CATALOG: Array<{ name: string; syntax: string; description: string; category: string }> = [
  { name: "SUMA", syntax: "SUMA(rango)", description: "Suma los valores", category: "Matemáticas" },
  { name: "PROMEDIO", syntax: "PROMEDIO(rango)", description: "Media aritmética", category: "Estadísticas" },
  { name: "CONTAR", syntax: "CONTAR(rango)", description: "Cuenta las celdas con números", category: "Estadísticas" },
  { name: "CONTARA", syntax: "CONTARA(rango)", description: "Cuenta las celdas no vacías", category: "Estadísticas" },
  { name: "MAX", syntax: "MAX(rango)", description: "Valor máximo", category: "Estadísticas" },
  { name: "MIN", syntax: "MIN(rango)", description: "Valor mínimo", category: "Estadísticas" },
  { name: "MEDIANA", syntax: "MEDIANA(rango)", description: "Valor central", category: "Estadísticas" },
  { name: "DESVEST", syntax: "DESVEST(rango)", description: "Desviación estándar de una muestra", category: "Estadísticas" },
  { name: "REDONDEAR", syntax: "REDONDEAR(número; decimales)", description: "Redondea un número", category: "Matemáticas" },
  { name: "ENTERO", syntax: "ENTERO(número)", description: "Redondea hacia abajo al entero", category: "Matemáticas" },
  { name: "RAIZ", syntax: "RAIZ(número)", description: "Raíz cuadrada", category: "Matemáticas" },
  { name: "POTENCIA", syntax: "POTENCIA(base; exponente)", description: "Eleva a una potencia", category: "Matemáticas" },
  { name: "SUMAPRODUCTO", syntax: "SUMAPRODUCTO(rango1; rango2)", description: "Suma de productos", category: "Matemáticas" },
  { name: "SI", syntax: "SI(condición; si_verdadero; si_falso)", description: "Devuelve un valor según una condición", category: "Lógicas" },
  { name: "SI.ERROR", syntax: "SI.ERROR(valor; si_error)", description: "Valor alternativo si hay error", category: "Lógicas" },
  { name: "Y", syntax: "Y(condición1; condición2)", description: "Verdadero si todas se cumplen", category: "Lógicas" },
  { name: "O", syntax: "O(condición1; condición2)", description: "Verdadero si alguna se cumple", category: "Lógicas" },
  { name: "CONTAR.SI", syntax: "CONTAR.SI(rango; criterio)", description: "Cuenta las celdas que cumplen un criterio", category: "Condicionales" },
  { name: "SUMAR.SI", syntax: "SUMAR.SI(rango; criterio; rango_suma)", description: "Suma con una condición", category: "Condicionales" },
  { name: "PROMEDIO.SI", syntax: "PROMEDIO.SI(rango; criterio; rango_promedio)", description: "Promedio con una condición", category: "Condicionales" },
  { name: "BUSCARV", syntax: "BUSCARV(valor; tabla; columna; FALSO)", description: "Busca en la primera columna de una tabla", category: "Búsqueda" },
  { name: "BUSCARX", syntax: "BUSCARX(valor; rango_búsqueda; rango_resultado)", description: "Búsqueda flexible", category: "Búsqueda" },
  { name: "INDICE", syntax: "INDICE(rango; fila; columna)", description: "Valor de una posición del rango", category: "Búsqueda" },
  { name: "COINCIDIR", syntax: "COINCIDIR(valor; rango; 0)", description: "Posición de un valor", category: "Búsqueda" },
  { name: "CONCATENAR", syntax: "CONCATENAR(texto1; texto2)", description: "Une textos", category: "Texto" },
  { name: "IZQUIERDA", syntax: "IZQUIERDA(texto; caracteres)", description: "Primeros caracteres", category: "Texto" },
  { name: "DERECHA", syntax: "DERECHA(texto; caracteres)", description: "Últimos caracteres", category: "Texto" },
  { name: "EXTRAE", syntax: "EXTRAE(texto; inicio; caracteres)", description: "Parte de un texto", category: "Texto" },
  { name: "LARGO", syntax: "LARGO(texto)", description: "Número de caracteres", category: "Texto" },
  { name: "MAYUSC", syntax: "MAYUSC(texto)", description: "Convierte a mayúsculas", category: "Texto" },
  { name: "MINUSC", syntax: "MINUSC(texto)", description: "Convierte a minúsculas", category: "Texto" },
  { name: "ESPACIOS", syntax: "ESPACIOS(texto)", description: "Quita espacios sobrantes", category: "Texto" },
  { name: "SUSTITUIR", syntax: "SUSTITUIR(texto; buscado; nuevo)", description: "Reemplaza un texto por otro", category: "Texto" },
  { name: "HOY", syntax: "HOY()", description: "Fecha actual", category: "Fecha" },
  { name: "AHORA", syntax: "AHORA()", description: "Fecha y hora actuales", category: "Fecha" },
  { name: "FECHA", syntax: "FECHA(año; mes; día)", description: "Crea una fecha", category: "Fecha" },
  { name: "AÑO", syntax: "AÑO(fecha)", description: "Año de una fecha", category: "Fecha" },
  { name: "MES", syntax: "MES(fecha)", description: "Mes de una fecha", category: "Fecha" },
  { name: "DIA", syntax: "DIA(fecha)", description: "Día de una fecha", category: "Fecha" },
  { name: "SIFECHA", syntax: "SIFECHA(inicio; fin; \"D\")", description: "Diferencia entre dos fechas", category: "Fecha" },
  { name: "PAGO", syntax: "PAGO(tasa; periodos; valor_actual)", description: "Cuota de un préstamo", category: "Financieras" },
  { name: "VF", syntax: "VF(tasa; periodos; pago)", description: "Valor futuro de una inversión", category: "Financieras" },
  { name: "VNA", syntax: "VNA(tasa; flujo1; flujo2)", description: "Valor neto actual", category: "Financieras" },
];

// ---------------------------------------------------------------------------
// Evaluador del libro
// ---------------------------------------------------------------------------

function literalValueOf(cell: CellData | undefined): Scalar {
  if (!cell || cell.raw === "" || cell.raw === undefined) return null;
  if (cell.format === "text") return cell.raw;
  return parseLiteral(cell.raw).value;
}

class WorkbookEvaluator {
  private byName = new Map<string, Sheet>();
  private cache = new Map<string, Scalar>();
  private visiting = new Set<string>();
  private extents = new Map<string, number>();

  constructor(sheets: Sheet[]) {
    for (const sheet of sheets) this.byName.set(sheet.name.toLocaleLowerCase(), sheet);
  }

  private sheetFor(name: string | undefined, current: Sheet): Sheet {
    if (!name) return current;
    const found = this.byName.get(name.toLocaleLowerCase());
    if (!found) throw new FormulaError(ERRORS.ref);
    return found;
  }

  private lastRow(sheet: Sheet): number {
    let extent = this.extents.get(sheet.id);
    if (extent === undefined) {
      extent = 0;
      for (const key of Object.keys(sheet.data)) {
        const parsed = parseCellKey(key);
        if (parsed && parsed.row > extent) extent = parsed.row;
      }
      this.extents.set(sheet.id, extent);
    }
    return extent;
  }

  /** Valor de una celda, calculando su fórmula si hace falta. */
  cellValue(sheet: Sheet, col: number, row: number): Scalar {
    const key = cellKey(col, row);
    const cell = sheet.data[key];
    if (!cell || !cell.raw) return null;
    if (!cell.raw.startsWith("=") || cell.format === "text") return literalValueOf(cell);

    const id = `${sheet.id}!${key}`;
    if (this.cache.has(id)) return this.cache.get(id) as Scalar;
    if (this.visiting.has(id)) return ERRORS.circular;

    this.visiting.add(id);
    let result: Scalar;
    try {
      const value = this.evaluate(parseFormula(cell.raw.slice(1)), sheet, { col, row });
      result = scalarOf(value);
      if (typeof result === "number" && !isFinite(result)) result = ERRORS.num;
    } catch (err) {
      result = err instanceof FormulaError ? err.code : ERRORS.value;
    }
    this.visiting.delete(id);

    // Libros importados: si la función no existe aquí se conserva el valor de Excel
    if (result === ERRORS.name && cell.cached !== undefined && cell.cached !== null) {
      result = cell.cached;
    }
    this.cache.set(id, result);
    return result;
  }

  private rangeValue(sheet: Sheet, node: Extract<Node, { t: "range" }>): RangeValue {
    const r1 = node.wholeCols ? 0 : node.r1;
    const r2 = node.wholeCols ? this.lastRow(sheet) : node.r2;
    const rows: Scalar[][] = [];
    for (let r = r1; r <= r2; r++) {
      const line: Scalar[] = [];
      for (let c = node.c1; c <= node.c2; c++) line.push(this.cellValue(sheet, c, r));
      rows.push(line);
    }
    return { kind: "range", rows };
  }

  private evaluate(node: Node, sheet: Sheet, ctx: CallContext): Value {
    switch (node.t) {
      case "num":
      case "str":
      case "bool":
        return node.v;
      case "ref": {
        const value = this.cellValue(this.sheetFor(node.sheet, sheet), node.col, node.row);
        return value;
      }
      case "range":
        return this.rangeValue(this.sheetFor(node.sheet, sheet), node);
      case "unary": {
        const value = toNumber(this.evaluate(node.arg, sheet, ctx));
        return node.op === "-" ? -value : value;
      }
      case "percent":
        return toNumber(this.evaluate(node.arg, sheet, ctx)) / 100;
      case "binary":
        return this.binary(node, sheet, ctx);
      case "call":
        return this.call(node, sheet, ctx);
    }
  }

  private binary(node: Extract<Node, { t: "binary" }>, sheet: Sheet, ctx: CallContext): Value {
    const left = scalarOf(this.evaluate(node.left, sheet, ctx));
    const right = scalarOf(this.evaluate(node.right, sheet, ctx));
    if (isErrorValue(left)) throw new FormulaError(left);
    if (isErrorValue(right)) throw new FormulaError(right);

    switch (node.op) {
      case "+": return toNumber(left) + toNumber(right);
      case "-": return toNumber(left) - toNumber(right);
      case "*": return toNumber(left) * toNumber(right);
      case "/": {
        const divisor = toNumber(right);
        if (divisor === 0) throw new FormulaError(ERRORS.div0);
        return toNumber(left) / divisor;
      }
      case "^": return Math.pow(toNumber(left), toNumber(right));
      case "&": return toText(left) + toText(right);
      case "=": return this.looseEquals(left, right);
      case "<>": return !this.looseEquals(left, right);
      case "<": return compareValues(left, right) < 0;
      case ">": return compareValues(left, right) > 0;
      case "<=": return compareValues(left, right) <= 0;
      case ">=": return compareValues(left, right) >= 0;
    }
    throw new FormulaError(ERRORS.syntax);
  }

  private looseEquals(a: Scalar, b: Scalar): boolean {
    if (typeof a === "string" && typeof b === "string") {
      return a.toLocaleLowerCase() === b.toLocaleLowerCase();
    }
    return compareValues(a, b) === 0;
  }

  private call(node: Extract<Node, { t: "call" }>, sheet: Sheet, ctx: CallContext): Value {
    const name = ALIASES[node.name] || node.name;
    const arg = (index: number) => this.evaluate(node.args[index], sheet, ctx);

    // Funciones perezosas: solo evalúan la rama necesaria
    if (name === "IF") {
      if (node.args.length < 2 || node.args.length > 3) throw new FormulaError(ERRORS.value);
      if (toBool(arg(0))) return arg(1);
      return node.args.length === 3 ? arg(2) : false;
    }
    if (name === "IFS") {
      for (let i = 0; i + 1 < node.args.length; i += 2) {
        if (toBool(arg(i))) return arg(i + 1);
      }
      throw new FormulaError(ERRORS.na);
    }
    if (name === "IFERROR" || name === "IFNA") {
      if (node.args.length !== 2) throw new FormulaError(ERRORS.value);
      try {
        const value = arg(0);
        const scalar = scalarOf(value);
        if (isErrorValue(scalar) && (name === "IFERROR" || scalar === ERRORS.na)) return arg(1);
        return value;
      } catch (err) {
        if (err instanceof FormulaError && (name === "IFERROR" || err.code === ERRORS.na)) return arg(1);
        throw err;
      }
    }
    if (name === "ISERROR" || name === "ISNA") {
      try {
        const scalar = scalarOf(arg(0));
        return name === "ISERROR" ? isErrorValue(scalar) : scalar === ERRORS.na;
      } catch (err) {
        return name === "ISERROR" ? true : err instanceof FormulaError && err.code === ERRORS.na;
      }
    }
    if (name === "ROW" || name === "COLUMN") {
      const target = node.args[0];
      if (!target) return (name === "ROW" ? ctx.row : ctx.col) + 1;
      if (target.t === "ref") return (name === "ROW" ? target.row : target.col) + 1;
      if (target.t === "range") return (name === "ROW" ? target.r1 : target.c1) + 1;
      throw new FormulaError(ERRORS.value);
    }

    const impl = FUNCTIONS[name];
    if (!impl) throw new FormulaError(ERRORS.name);
    const args = node.args.map((_, index) => arg(index));
    return impl(args, ctx);
  }
}

/**
 * Recalcula todas las fórmulas del libro. Devuelve los mismos objetos de hoja
 * y celda cuando su resultado no cambia, para no provocar renders innecesarios.
 */
export function recalcWorkbook(sheets: Sheet[]): Sheet[] {
  const evaluator = new WorkbookEvaluator(sheets);
  return sheets.map((sheet) => {
    let changed = false;
    const data: Record<string, CellData> = {};
    for (const [key, cell] of Object.entries(sheet.data)) {
      const parsed = parseCellKey(key);
      if (!parsed) continue;
      const computed = evaluator.cellValue(sheet, parsed.col, parsed.row);
      if (cell.computed === computed) {
        data[key] = cell;
      } else {
        data[key] = { ...cell, computed };
        changed = true;
      }
    }
    return changed ? { ...sheet, data } : sheet;
  });
}

// ---------------------------------------------------------------------------
// Reescritura de fórmulas
// ---------------------------------------------------------------------------

function shiftReference(ref: string, dCol: number, dRow: number): string {
  const match = /^(\$?)([A-Z]+)(\$?)([0-9]+)$/.exec(ref);
  if (!match) return ref;
  const col = match[1] ? colNameToIndex(match[2]) : colNameToIndex(match[2]) + dCol;
  const row = match[3] ? Number(match[4]) : Number(match[4]) + dRow;
  if (col < 0 || row < 1) return ERRORS.ref;
  return `${match[1]}${colIndexToName(col)}${match[3]}${row}`;
}

function rewriteReferences(raw: string, transform: (ref: string) => string): string {
  if (!raw.startsWith("=")) return raw;
  let tokens: Token[];
  try {
    tokens = tokenize(raw.slice(1));
  } catch {
    return raw;
  }
  const body = raw.slice(1);
  let out = "";
  let cursor = 0;
  for (const token of tokens) {
    out += body.slice(cursor, token.start);
    out += token.type === "ref" ? transform(token.text) : body.slice(token.start, token.end);
    cursor = token.end;
  }
  return "=" + out + body.slice(cursor);
}

/** Desplaza las referencias relativas (copiar, pegar y rellenar). */
export function offsetFormula(raw: string, dCol: number, dRow: number): string {
  if (dCol === 0 && dRow === 0) return raw;
  return rewriteReferences(raw, (ref) => shiftReference(ref, dCol, dRow));
}

/** Ajusta las referencias al insertar o eliminar una fila o columna. */
export function adjustFormulaForStructure(
  raw: string,
  axis: "row" | "col",
  index: number,
  delta: 1 | -1
): string {
  return rewriteReferences(raw, (ref) => {
    const match = /^(\$?)([A-Z]+)(\$?)([0-9]+)$/.exec(ref);
    if (!match) return ref;
    let col = colNameToIndex(match[2]);
    let row = Number(match[4]) - 1;
    if (axis === "row") {
      if (delta === -1 && row === index) return ERRORS.ref;
      if (row >= index + (delta === -1 ? 1 : 0)) row += delta;
    } else {
      if (delta === -1 && col === index) return ERRORS.ref;
      if (col >= index + (delta === -1 ? 1 : 0)) col += delta;
    }
    return `${match[1]}${colIndexToName(col)}${match[3]}${row + 1}`;
  });
}

/** Traduce una fórmula al dialecto de los archivos .xlsx (inglés y comas). */
export function toExcelFormula(raw: string): string {
  if (!raw.startsWith("=")) return raw;
  try {
    const body = raw.slice(1);
    const tokens = tokenize(body);
    let out = "";
    tokens.forEach((token, i) => {
      if (token.type === "id" && tokens[i + 1]?.type === "lparen") {
        out += canonicalFunctionName(token.text) || token.text.toUpperCase();
      } else if (token.type === "id" && tokens[i + 1]?.type === "bang") {
        out += /^[A-Za-z0-9_]+$/.test(token.text) ? token.text : `'${token.text}'`;
      } else if (token.type === "id") {
        const upper = token.text.toUpperCase();
        out += upper === "VERDADERO" ? "TRUE" : upper === "FALSO" ? "FALSE" : token.text;
      } else if (token.type === "sep") {
        out += ",";
      } else if (token.type === "str") {
        out += `"${token.text.replace(/"/g, '""')}"`;
      } else {
        out += token.text;
      }
    });
    return out;
  } catch {
    // Fórmulas con referencias rotas (#¡REF!): se exportan con el error estándar
    return raw.slice(1).replace(/#¡REF!/g, "#REF!").replace(/;/g, ",");
  }
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

/** Texto que se muestra en la celda según su valor y su formato. */
export function formatCellValue(
  value: Scalar | undefined,
  cell?: Pick<CellData, "format" | "decimals" | "currency">
): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
  if (typeof value === "string") return value;
  if (!isFinite(value)) return ERRORS.num;

  const format = cell?.format || "general";
  const decimals = cell?.decimals;

  switch (format) {
    case "currency": {
      const currency = cell?.currency || "COP";
      const digits = decimals ?? (currency === "COP" ? 0 : 2);
      return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "es-ES", {
        style: "currency",
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    }
    case "percent": {
      const digits = decimals ?? (Number.isInteger(Number((value * 100).toPrecision(12))) ? 0 : 1);
      return `${new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value * 100)}%`;
    }
    case "number":
      return new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
        useGrouping: true,
      }).format(value);
    case "date": {
      const date = serialToDate(value);
      const pad = (n: number) => String(n).padStart(2, "0");
      const base = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
      return value % 1 === 0 ? base : `${base} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    }
    case "text":
      return String(value);
    default:
      if (decimals !== undefined) {
        return new Intl.NumberFormat("es-ES", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          useGrouping: false,
        }).format(value);
      }
      return formatGeneral(value);
  }
}

/** Valor numérico de una celda ya calculada (o `null` si no es un número). */
export function numericValue(cell: CellData | undefined): number | null {
  return cell && typeof cell.computed === "number" ? cell.computed : null;
}
