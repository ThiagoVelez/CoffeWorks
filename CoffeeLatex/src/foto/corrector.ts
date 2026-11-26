// El corrector de «Desde foto»: sugerencias para lo dudoso (diccionario de física y matemáticas),
// avisos de llaves y comandos, texto de Tesseract con sus palabras dudosas, y el armado final.

import katex from "katex";
import type { Modo } from "../editor/insertar";
import type { Duda } from "./tokens";

/** Confusiones típicas al leer letra a mano en física y matemáticas. */
const CONFUSIONES: Record<string, string[]> = {
  a: ["\\alpha", "o", "d"], "\\alpha": ["a", "\\propto"],
  v: ["\\nu", "u", "r"], "\\nu": ["v"],
  u: ["\\mu", "v"], "\\mu": ["u"],
  w: ["\\omega", "W"], "\\omega": ["w"],
  x: ["\\times", "\\chi", "X"], "\\times": ["x"], "\\chi": ["x"],
  "1": ["l", "I", "|", "7"], l: ["1", "I", "\\ell"], I: ["1", "l"], "|": ["1", "l"],
  "0": ["o", "O", "\\theta"], o: ["0", "\\sigma", "a"], O: ["0", "\\Theta"], "\\theta": ["0", "\\Theta"],
  t: ["+", "\\tau"], "+": ["t", "\\pm"], "\\tau": ["t"],
  p: ["\\rho"], "\\rho": ["p"],
  B: ["\\beta", "8"], "\\beta": ["B"], "8": ["B"],
  e: ["\\epsilon", "c"], "\\epsilon": ["e", "\\in"], "\\in": ["\\epsilon"], "\\varepsilon": ["e", "\\epsilon"],
  n: ["\\eta", "h"], "\\eta": ["n"], h: ["n"],
  y: ["\\gamma", "g"], "\\gamma": ["y", "r"], r: ["\\gamma", "v"],
  s: ["5"], "5": ["s", "S"], S: ["5"],
  z: ["2"], "2": ["z", "Z"], Z: ["2"],
  g: ["9", "q", "y"], "9": ["g", "q"], q: ["9", "g"],
  d: ["\\partial", "a"], "\\partial": ["d"],
  A: ["\\Delta"], "\\Delta": ["A", "\\triangle"],
  ".": ["\\cdot", ","], "\\cdot": [".", "\\times"], ",": [".", "{,}"],
  "-": ["=", "\\_"], "=": ["-", "\\approx"], "\\approx": ["="], "\\sim": ["\\approx", "-"],
  "\\geq": ["\\ge", "\\times", ">"], ">": ["\\geq"], "<": ["\\leq"], "\\leq": ["<"],
  "\\pi": ["n", "\\Pi"], "\\lambda": ["\\Lambda", "x"], "\\phi": ["\\varphi", "\\Phi", "o"], "\\sigma": ["o", "6"], "6": ["\\sigma", "b"], b: ["6"],
  "\\mathbf": ["\\mathrm", ""], "\\mathrm": ["\\text"],
  "\\overset": ["", "\\frac"], "\\ddot": ["", "\\dot"], "\\dot": ["", "\\ddot"],
};

/** Sugerencias para un trozo dudoso: primero lo que consideró el modelo, después el diccionario. */
export function sugerencias(texto: string, delModelo: string[]): string[] {
  const t = texto.trim();
  const lista = [...delModelo, ...(CONFUSIONES[t] ?? []), ...(CONFUSIONES[t.toLowerCase()] ?? [])];
  return lista.filter((s, i) => s !== t && lista.indexOf(s) === i);
}

export interface Aviso {
  ini: number;
  fin: number;
  mensaje: string;
}

/** Llaves y paréntesis sin cerrar y comandos que no existen. */
export function revisarFormula(latex: string): Aviso[] {
  const avisos: Aviso[] = [];
  const llaves: number[] = [];
  const parentesis: number[] = [];
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i];
    if (c === "\\") { i++; continue; }
    if (c === "{") llaves.push(i);
    else if (c === "}") {
      if (llaves.length) llaves.pop();
      else avisos.push({ ini: i, fin: i + 1, mensaje: "Llave } que no se abrió" });
    } else if (c === "(") parentesis.push(i);
    else if (c === ")") {
      if (parentesis.length) parentesis.pop();
      else avisos.push({ ini: i, fin: i + 1, mensaje: "Paréntesis ) que no se abrió" });
    }
  }
  for (const i of llaves) avisos.push({ ini: i, fin: i + 1, mensaje: "Llave { sin cerrar" });
  for (const i of parentesis) avisos.push({ ini: i, fin: i + 1, mensaje: "Paréntesis ( sin cerrar" });
  try {
    katex.renderToString(latex, { throwOnError: true, strict: false });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    const m = /Undefined control sequence: (\\[A-Za-z]+)/.exec(msg);
    if (m) {
      const ini = latex.indexOf(m[1]);
      avisos.push({ ini: Math.max(0, ini), fin: Math.max(0, ini) + m[1].length, mensaje: `Comando desconocido: ${m[1]}` });
    }
  }
  return avisos.sort((a, b) => a.ini - b.ini);
}

export interface Linea {
  tipo: "texto" | "formula";
  texto: string;
  dudas: Duda[];
}

/** Texto de Tesseract (salida TSV): un renglón con sus palabras de baja confianza como dudas. */
export function textoDeTsv(tsv: string): { texto: string; dudas: Duda[]; confianza: number } {
  let texto = "";
  const dudas: Duda[] = [];
  let suma = 0, n = 0;
  let renglon = "";
  for (const fila of tsv.split(/\r?\n/).slice(1)) {
    const c = fila.split("\t");
    if (c.length < 12 || c[0] !== "5") continue;
    const palabra = c.slice(11).join("\t").trim();
    if (!palabra) continue;
    const clave = `${c[2]}-${c[3]}-${c[4]}`;
    if (texto && clave !== renglon) texto += " ";
    else if (texto) texto += " ";
    renglon = clave;
    const conf = Math.max(0, Number(c[10])) / 100;
    if (conf < 0.6) dudas.push({ ini: texto.length, fin: texto.length + palabra.length, prob: conf, alternativas: [] });
    texto += palabra;
    suma += conf;
    n++;
  }
  return { texto, dudas, confianza: n ? suma / n : 0 };
}

/** Si un renglón leído como texto en realidad parece una fórmula. */
export function pareceFormula(texto: string, confianza: number): boolean {
  if (confianza < 0.45 || !texto.trim()) return true;
  if (/[=^_\\∫∑√±≤≥≈→]/.test(texto)) return true;
  const simbolos = (texto.match(/[+\-*/()<>|]/g) ?? []).length;
  const letras = (texto.match(/\p{L}/gu) ?? []).length;
  const palabrasLargas = (texto.match(/\p{L}{4,}/gu) ?? []).length;
  return simbolos * 3 > letras || (palabrasLargas === 0 && /\d/.test(texto));
}

/** Arma el resultado: el texto seguido y cada fórmula aparte, con las dudas en su sitio. */
export function ensamblar(lineas: Linea[], modo: Modo): { texto: string; dudas: Duda[] } {
  let texto = "";
  const dudas: Duda[] = [];
  for (const l of lineas) {
    const t = l.texto.trim();
    if (!t) continue;
    const corrimiento = l.texto.indexOf(t);
    let antes: string, despues: string;
    if (l.tipo === "formula") [antes, despues] = modo === "latex" ? ["\\[\n  ", "\n\\]\n"] : ["$$\n", "\n$$\n"];
    else [antes, despues] = ["", "\n"];
    const base = texto.length + antes.length - corrimiento;
    for (const d of l.dudas) {
      if (d.ini < corrimiento || d.fin > corrimiento + t.length) continue;
      dudas.push({ ...d, ini: d.ini + base, fin: d.fin + base });
    }
    texto += antes + t + despues;
  }
  return { texto, dudas };
}

/** Tras editar el texto, corre las dudas que siguen intactas y quita las que se tocaron. */
export function ajustarDudas<T extends { ini: number; fin: number }>(antes: string, despues: string, dudas: T[]): T[] {
  if (antes === despues) return dudas;
  let p = 0;
  const max = Math.min(antes.length, despues.length);
  while (p < max && antes[p] === despues[p]) p++;
  let s = 0;
  while (s < max - p && antes[antes.length - 1 - s] === despues[despues.length - 1 - s]) s++;
  const finCambio = antes.length - s;
  const delta = despues.length - antes.length;
  const out: T[] = [];
  for (const d of dudas) {
    if (d.fin <= p) out.push(d);
    else if (d.ini >= finCambio) out.push({ ...d, ini: d.ini + delta, fin: d.fin + delta });
  }
  return out;
}
