// Motor de cálculo y evaluación de fórmulas completo compatible con Microsoft Excel (OpenFormula standard)
import type { CellData, CellFormat } from "../types";

// Conversión de índice numérico a letras de columna (0 -> A, 25 -> Z, 26 -> AA)
export function colIndexToName(index: number): string {
  let name = "";
  let temp = index;
  while (temp >= 0) {
    name = String.fromCharCode((temp % 26) + 65) + name;
    temp = Math.floor(temp / 26) - 1;
  }
  return name;
}

// Conversión de letras de columna a índice (A -> 0, Z -> 25, AA -> 26)
export function colNameToIndex(name: string): number {
  let index = 0;
  for (let i = 0; i < name.length; i++) {
    index = index * 26 + (name.charCodeAt(i) - 64);
  }
  return index - 1;
}

// Descompone una clave de celda tipo "B12" en { col: 1, row: 11, colName: "B", rowNum: 12 }
export function parseCellKey(key: string): { col: number; row: number; colName: string; rowNum: number } | null {
  const match = key.toUpperCase().trim().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  const colName = match[1];
  const rowNum = parseInt(match[2], 10);
  return {
    col: colNameToIndex(colName),
    row: rowNum - 1,
    colName,
    rowNum,
  };
}

// Expande un rango de Excel como "A1:B3" a lista de celdas: ["A1", "A2", "A3", "B1", "B2", "B3"]
export function expandCellRange(rangeStr: string): string[] {
  const parts = rangeStr.split(":").map((p) => p.trim().toUpperCase());
  if (parts.length === 1) {
    return [parts[0]];
  }

  const start = parseCellKey(parts[0]);
  const end = parseCellKey(parts[1]);
  if (!start || !end) return [parts[0]];

  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  const keys: string[] = [];
  for (let c = minCol; c <= maxCol; c++) {
    const colName = colIndexToName(c);
    for (let r = minRow; r <= maxRow; r++) {
      keys.push(`${colName}${r + 1}`);
    }
  }
  return keys;
}

// Obtiene el valor crudo o computado de una celda
export function getCellValue(key: string, data: Record<string, CellData>): string | number {
  const cell = data[key.toUpperCase().trim()];
  if (!cell) return "";
  if (cell.computed !== undefined && cell.computed !== null) {
    return cell.computed;
  }
  return cell.raw || "";
}

// Obtiene el valor numérico de una celda
export function getNumericCellValue(key: string, data: Record<string, CellData>): number {
  const val = getCellValue(key, data);
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

// Resuelve una lista de argumentos (pueden ser rangos como A1:A5 o valores escalares) en una lista plana de valores
function resolveArgList(argsStr: string, data: Record<string, CellData>): Array<string | number> {
  const values: Array<string | number> = [];
  if (!argsStr.trim()) return values;

  // Separar respetando argumentos por coma o punto y coma
  const tokens = argsStr.split(/[,;]/);
  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;
    if (t.includes(":")) {
      const keys = expandCellRange(t);
      for (const k of keys) {
        values.push(getCellValue(k, data));
      }
    } else if (/^[A-Z]+[0-9]+$/i.test(t)) {
      values.push(getCellValue(t, data));
    } else {
      const num = Number(t.replace(/^"|"$/g, ""));
      values.push(!isNaN(num) && !t.startsWith('"') ? num : t.replace(/^"|"$/g, ""));
    }
  }
  return values;
}

// Resuelve lista de números
function resolveNumericList(argsStr: string, data: Record<string, CellData>): number[] {
  const all = resolveArgList(argsStr, data);
  const nums: number[] = [];
  for (const v of all) {
    if (v === "" || v === null || v === undefined) continue;
    const n = Number(v);
    if (!isNaN(n)) nums.push(n);
  }
  return nums;
}

// Diccionario de funciones estándar de Microsoft Excel
export function evaluateExcelFunction(
  fnName: string,
  argsStr: string,
  data: Record<string, CellData>
): string | number {
  const fn = fnName.toUpperCase().trim();

  // 1. MATEMÁTICAS Y TRIGONOMÉTRICAS
  if (fn === "SUM" || fn === "SUMA") {
    const nums = resolveNumericList(argsStr, data);
    return nums.reduce((acc, curr) => acc + curr, 0);
  }

  if (fn === "PRODUCT" || fn === "PRODUCTO") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length === 0 ? 0 : nums.reduce((acc, curr) => acc * curr, 1);
  }

  if (fn === "ROUND" || fn === "REDONDEAR") {
    const args = argsStr.split(/[,;]/);
    const val = getNumericCellValue(args[0]?.trim() || "", data);
    const decimals = parseInt(args[1]?.trim() || "0", 10);
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  if (fn === "ABS") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 ? Math.abs(nums[0]) : 0;
  }

  if (fn === "SQRT" || fn === "RAIZ") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 && nums[0] >= 0 ? Math.sqrt(nums[0]) : "#¡NUM!";
  }

  if (fn === "POWER" || fn === "POTENCIA") {
    const args = argsStr.split(/[,;]/);
    const base = getNumericCellValue(args[0]?.trim() || "", data);
    const exp = getNumericCellValue(args[1]?.trim() || "1", data);
    return Math.pow(base, exp);
  }

  if (fn === "MOD" || fn === "RESIDUO") {
    const args = argsStr.split(/[,;]/);
    const n = getNumericCellValue(args[0]?.trim() || "", data);
    const d = getNumericCellValue(args[1]?.trim() || "1", data);
    return d !== 0 ? n % d : "#¡DIV/0!";
  }

  if (fn === "INT" || fn === "ENTERO") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 ? Math.floor(nums[0]) : 0;
  }

  if (fn === "SIN" || fn === "SENO") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 ? Number(Math.sin(nums[0]).toFixed(6)) : 0;
  }

  if (fn === "COS" || fn === "COSENO") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 ? Number(Math.cos(nums[0]).toFixed(6)) : 0;
  }

  if (fn === "TAN" || fn === "TANGENTE") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 ? Number(Math.tan(nums[0]).toFixed(6)) : 0;
  }

  if (fn === "PI") {
    return Math.PI;
  }

  // 2. ESTADÍSTICAS
  if (fn === "AVERAGE" || fn === "PROMEDIO") {
    const nums = resolveNumericList(argsStr, data);
    if (nums.length === 0) return 0;
    const sum = nums.reduce((acc, curr) => acc + curr, 0);
    return Number((sum / nums.length).toFixed(4));
  }

  if (fn === "COUNT" || fn === "CONTAR") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length;
  }

  if (fn === "COUNTA" || fn === "CONTARA") {
    const vals = resolveArgList(argsStr, data);
    return vals.filter((v) => v !== "" && v !== null && v !== undefined).length;
  }

  if (fn === "MAX") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 ? Math.max(...nums) : 0;
  }

  if (fn === "MIN") {
    const nums = resolveNumericList(argsStr, data);
    return nums.length > 0 ? Math.min(...nums) : 0;
  }

  if (fn === "MEDIAN" || fn === "MEDIANA") {
    const nums = resolveNumericList(argsStr, data).sort((a, b) => a - b);
    if (nums.length === 0) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  }

  if (fn === "STDEV" || fn === "DESVEST" || fn === "STDEV.P") {
    const nums = resolveNumericList(argsStr, data);
    if (nums.length < 2) return 0;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance = nums.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / (nums.length - 1);
    return Number(Math.sqrt(variance).toFixed(4));
  }

  // 3. LÓGICAS
  if (fn === "IF" || fn === "SI") {
    const args = argsStr.split(/[,;]/);
    const cond = args[0]?.trim() || "";
    const trueVal = args[1]?.trim().replace(/^"|"$/g, "") ?? "";
    const falseVal = args[2]?.trim().replace(/^"|"$/g, "") ?? "";

    // Evaluar condición simple tipo A1 > 10, B1 = 5
    const isTrue = evaluateSimpleCondition(cond, data);
    return isTrue ? trueVal : falseVal;
  }

  if (fn === "IFERROR" || fn === "SI.ERROR") {
    const args = argsStr.split(/[,;]/);
    const expr = args[0]?.trim() || "";
    const fallback = args[1]?.trim().replace(/^"|"$/g, "") ?? "";
    try {
      const res = evaluateFormula(`=${expr}`, data);
      if (String(res).startsWith("#")) return fallback;
      return res;
    } catch {
      return fallback;
    }
  }

  if (fn === "AND" || fn === "Y") {
    const args = argsStr.split(/[,;]/);
    return args.every((c) => evaluateSimpleCondition(c.trim(), data)) ? "VERDADERO" : "FALSO";
  }

  if (fn === "OR" || fn === "O") {
    const args = argsStr.split(/[,;]/);
    return args.some((c) => evaluateSimpleCondition(c.trim(), data)) ? "VERDADERO" : "FALSO";
  }

  if (fn === "NOT" || fn === "NO") {
    const res = evaluateSimpleCondition(argsStr.trim(), data);
    return res ? "FALSO" : "VERDADERO";
  }

  // 4. TEXTO
  if (fn === "CONCAT" || fn === "CONCATENAR") {
    const vals = resolveArgList(argsStr, data);
    return vals.join("");
  }

  if (fn === "TEXTJOIN" || fn === "UNIRCADENAS") {
    const args = argsStr.split(/[,;]/);
    const delimiter = args[0]?.trim().replace(/^"|"$/g, "") || "";
    const rest = args.slice(2).join(",");
    const vals = resolveArgList(rest, data);
    return vals.join(delimiter);
  }

  if (fn === "LEFT" || fn === "IZQUIERDA") {
    const args = argsStr.split(/[,;]/);
    const text = String(getCellValue(args[0]?.trim() || "", data));
    const len = parseInt(args[1]?.trim() || "1", 10);
    return text.substring(0, len);
  }

  if (fn === "RIGHT" || fn === "DERECHA") {
    const args = argsStr.split(/[,;]/);
    const text = String(getCellValue(args[0]?.trim() || "", data));
    const len = parseInt(args[1]?.trim() || "1", 10);
    return text.substring(Math.max(0, text.length - len));
  }

  if (fn === "MID" || fn === "EXTRAE") {
    const args = argsStr.split(/[,;]/);
    const text = String(getCellValue(args[0]?.trim() || "", data));
    const start = Math.max(1, parseInt(args[1]?.trim() || "1", 10)) - 1;
    const len = parseInt(args[2]?.trim() || "1", 10);
    return text.substring(start, start + len);
  }

  if (fn === "LEN" || fn === "LARGO") {
    const text = String(getCellValue(argsStr.trim(), data));
    return text.length;
  }

  if (fn === "TRIM" || fn === "ESPACIOS") {
    const text = String(getCellValue(argsStr.trim(), data));
    return text.trim();
  }

  if (fn === "UPPER" || fn === "MAYUSC") {
    const text = String(getCellValue(argsStr.trim(), data));
    return text.toUpperCase();
  }

  if (fn === "LOWER" || fn === "MINUSC") {
    const text = String(getCellValue(argsStr.trim(), data));
    return text.toLowerCase();
  }

  // 5. FECHA Y HORA
  if (fn === "TODAY" || fn === "HOY") {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  if (fn === "NOW" || fn === "AHORA") {
    return new Date().toLocaleString("es-CO");
  }

  if (fn === "YEAR" || fn === "AÑO") {
    return new Date().getFullYear();
  }

  if (fn === "MONTH" || fn === "MES") {
    return new Date().getMonth() + 1;
  }

  if (fn === "DAY" || fn === "DIA") {
    return new Date().getDate();
  }

  // 6. INFORMACIÓN
  if (fn === "ISBLANK" || fn === "ESBLANCO") {
    const v = getCellValue(argsStr.trim(), data);
    return v === "" ? "VERDADERO" : "FALSO";
  }

  if (fn === "ISNUMBER" || fn === "ESNUMERO") {
    const v = getCellValue(argsStr.trim(), data);
    return typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== "")
      ? "VERDADERO"
      : "FALSO";
  }

  if (fn === "ISTEXT" || fn === "ESTEXTO") {
    const v = getCellValue(argsStr.trim(), data);
    return typeof v === "string" && isNaN(Number(v)) ? "VERDADERO" : "FALSO";
  }

  // 7. BÚSQUEDA Y REFERENCIA (VLOOKUP / BUSCARV)
  if (fn === "VLOOKUP" || fn === "BUSCARV") {
    const args = argsStr.split(/[,;]/);
    const lookupVal = getCellValue(args[0]?.trim() || "", data);
    const range = args[1]?.trim() || "";
    const colIndex = parseInt(args[2]?.trim() || "1", 10);

    const rangeKeys = expandCellRange(range);
    if (rangeKeys.length === 0) return "#N/A";

    // Agrupar por filas
    const rowMap: Record<number, string[]> = {};
    for (const k of rangeKeys) {
      const p = parseCellKey(k);
      if (p) {
        if (!rowMap[p.rowNum]) rowMap[p.rowNum] = [];
        rowMap[p.rowNum].push(k);
      }
    }

    for (const rNum of Object.keys(rowMap)) {
      const rowKeys = rowMap[Number(rNum)];
      const firstCellKey = rowKeys[0];
      const firstCellVal = getCellValue(firstCellKey, data);
      if (String(firstCellVal).trim().toLowerCase() === String(lookupVal).trim().toLowerCase()) {
        const targetKey = rowKeys[colIndex - 1];
        return targetKey ? getCellValue(targetKey, data) : "#¡REF!";
      }
    }
    return "#N/A";
  }

  return "#¿NOMBRE?";
}

// Evalúa una condición simple (ej: A1 > 10, B2 = "Café")
function evaluateSimpleCondition(cond: string, data: Record<string, CellData>): boolean {
  const match = cond.match(/(.*?)(>=|<=|<>|>|<|=)(.*)/);
  if (!match) {
    const v = getCellValue(cond, data);
    return Boolean(v && v !== "0" && v !== "FALSO");
  }

  const leftRaw = match[1].trim();
  const op = match[2].trim();
  const rightRaw = match[3].trim().replace(/^"|"$/g, "");

  const leftVal = /^[A-Z]+[0-9]+$/i.test(leftRaw) ? getCellValue(leftRaw, data) : leftRaw;
  const numL = Number(leftVal);
  const numR = Number(rightRaw);

  const useNum = !isNaN(numL) && !isNaN(numR);

  switch (op) {
    case ">":
      return useNum ? numL > numR : String(leftVal) > rightRaw;
    case "<":
      return useNum ? numL < numR : String(leftVal) < rightRaw;
    case ">=":
      return useNum ? numL >= numR : String(leftVal) >= rightRaw;
    case "<=":
      return useNum ? numL <= numR : String(leftVal) <= rightRaw;
    case "=":
      return useNum ? numL === numR : String(leftVal) === rightRaw;
    case "<>":
      return useNum ? numL !== numR : String(leftVal) !== rightRaw;
    default:
      return false;
  }
}

// Evalúa una fórmula completa de Excel
export function evaluateFormula(
  formula: string,
  data: Record<string, CellData>,
  visited: Set<string> = new Set()
): string | number {
  if (!formula.startsWith("=")) return formula;
  const rawExpression = formula.substring(1).trim();

  // 1. Detección de llamada a función estándar tipo NOMBRE_FUNCION(...)
  const fnMatch = rawExpression.match(/^([A-Z0-9_.]+)\((.*)\)$/i);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const fnArgs = fnMatch[2];
    return evaluateExcelFunction(fnName, fnArgs, data);
  }

  // 2. Operador de concatenación de texto & (ej: A1 & " " & B1)
  if (rawExpression.includes("&")) {
    const parts = rawExpression.split("&");
    let result = "";
    for (const p of parts) {
      const partTrim = p.trim();
      if (partTrim.startsWith('"') && partTrim.endsWith('"')) {
        result += partTrim.slice(1, -1);
      } else if (/^[A-Z]+[0-9]+$/i.test(partTrim)) {
        result += String(getCellValue(partTrim, data));
      } else {
        result += partTrim;
      }
    }
    return result;
  }

  // 3. Expresión aritmética con operadores nativos (+, -, *, /, %, ^)
  try {
    // Reemplaza celdas por valores evaluados
    let expr = rawExpression.replace(/[A-Z]+[0-9]+/gi, (cellRef) => {
      const upperRef = cellRef.toUpperCase();
      if (visited.has(upperRef)) return "0";
      const val = getNumericCellValue(upperRef, data);
      return String(val);
    });

    // Reemplazar operador potencia ^ por ** de JavaScript
    expr = expr.replace(/\^/g, "**");

    // Reemplazar porcentaje % por /100
    expr = expr.replace(/([0-9.]+)%/g, "($1/100)");

    // Sanitización estricta: solo números, operadores y paréntesis
    if (/^[0-9+\-*/().\s*]+$/.test(expr)) {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return Number(result.toFixed(6));
      }
    }
  } catch {
    return "#¡VALOR!";
  }

  return rawExpression;
}

// Evalúa una celda completa
export function computeCellValue(raw: string, data: Record<string, CellData>): string | number {
  if (!raw) return "";
  if (raw.startsWith("=")) {
    return evaluateFormula(raw, data);
  }
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== "") {
    return num;
  }
  return raw;
}

// Formatea el valor computado para mostrarlo en pantalla según el estilo de celda
export function formatCellValue(value: string | number | null | undefined, format?: CellFormat): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);

  if (isNaN(num)) {
    return String(value);
  }

  switch (format) {
    case "currency":
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);

    case "percent":
      return `${(num * 100).toFixed(1)}%`;

    case "number":
      return new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);

    case "general":
    default:
      return String(value);
  }
}
