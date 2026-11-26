// Botones de «Insertar»: qué escriben y dónde queda el cursor.
// En una plantilla, «▮» marca el cursor y «§» el texto seleccionado.

export type Modo = "latex" | "markdown";

export interface Boton {
  id: string;
  etiqueta: string;
  /** Lo que se dibuja en el botón (con KaTeX). */
  tex: string;
  latex: string;
  markdown?: string;
}

export const BOTONES: Boton[] = [
  { id: "fraccion", etiqueta: "Fracción", tex: "\\frac{a}{b}", latex: "\\frac{§}{▮}" },
  { id: "potencia", etiqueta: "Potencia", tex: "x^{n}", latex: "§^{▮}" },
  { id: "raiz", etiqueta: "Raíz", tex: "\\sqrt{x}", latex: "\\sqrt{§▮}" },
  { id: "vector", etiqueta: "Vector", tex: "\\vec{v}", latex: "\\vec{§▮}" },
  { id: "integral", etiqueta: "Integral", tex: "\\int", latex: "\\int_{▮}^{} § \\, dx" },
  { id: "suma", etiqueta: "Sumatoria", tex: "\\sum", latex: "\\sum_{i=1}^{▮n} §" },
  { id: "derivada", etiqueta: "Derivada", tex: "\\frac{d}{dt}", latex: "\\frac{d§▮}{dt}" },
  { id: "griegas", etiqueta: "Letras griegas", tex: "\\alpha\\beta", latex: "" },
  { id: "unidades", etiqueta: "Unidades", tex: "\\mathrm{m/s}", latex: "" },
  {
    id: "tabla", etiqueta: "Tabla", tex: "\\boxplus",
    latex: "\\begin{table}[h]\n\\centering\n\\begin{tabular}{|c|c|}\n\\hline\n▮ &  \\\\\n\\hline\n &  \\\\\n\\hline\n\\end{tabular}\n\\caption{}\n\\end{table}\n",
    markdown: "| ▮ |  |\n|---|---|\n|  |  |\n",
  },
  {
    id: "figura", etiqueta: "Figura", tex: "\\square",
    latex: "\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.6\\textwidth]{▮}\n\\caption{}\n\\end{figure}\n",
    markdown: "![▮](imagen.png)",
  },
  { id: "cita", etiqueta: "Cita", tex: "[1]", latex: "\\cite{▮}", markdown: "[^▮]" },
];

/** Los botones «griegas» y «unidades» abren un menú con estas opciones. */
export const GRIEGAS = ["alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu", "nu", "pi", "rho", "sigma", "tau", "phi", "omega", "Delta", "Sigma", "Omega"].map((g) => `\\${g}`);
export const UNIDADES = ["\\mathrm{m}", "\\mathrm{s}", "\\mathrm{kg}", "\\mathrm{N}", "\\mathrm{J}", "\\mathrm{W}", "\\mathrm{m/s}", "\\mathrm{m/s^2}", "\\mathrm{N\\cdot m}", "\\mathrm{Pa}", "^{\\circ}\\mathrm{C}", "\\mathrm{K}"];

/** Inserta `plantilla` reemplazando [ini, fin). Devuelve el texto nuevo y la posición del cursor. */
export function insertar(texto: string, ini: number, fin: number, plantilla: string): { texto: string; cursor: number } {
  const sel = texto.slice(ini, fin);
  let p = plantilla.replace("§", () => sel);
  let c = p.indexOf("▮");
  if (c < 0) c = p.length;
  else p = p.replace("▮", "");
  return { texto: texto.slice(0, ini) + p + texto.slice(fin), cursor: ini + c };
}

/** En Markdown, fuera de una fórmula, lo matemático se envuelve en `$…$`. */
export function plantillaPara(b: Boton, modo: Modo, dentroDeFormula: boolean): string {
  if (modo === "markdown") {
    if (b.markdown) return b.markdown;
    return dentroDeFormula ? b.latex : `$${b.latex}$`;
  }
  return b.latex;
}
