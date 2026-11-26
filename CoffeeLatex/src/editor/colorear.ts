// Colores del código: comandos, fórmulas, comentarios y llaves. Devuelve rangos ordenados y
// sin solaparse; lo que no está en un rango es texto normal.

import type { Modo } from "./insertar";

export type Clase = "cmd" | "mate" | "coment" | "llave";
export interface Tramo { ini: number; fin: number; clase: Clase }

const ENTORNO_MATE = /^\\begin\{(equation|align|gather|multline|eqnarray|displaymath)(\*?)\}/;

function latex(s: string): Tramo[] {
  const out: Tramo[] = [];
  const push = (ini: number, fin: number, clase: Clase) => fin > ini && out.push({ ini, fin, clase });
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === "%") {
      const f = s.indexOf("\n", i);
      const fin = f < 0 ? s.length : f;
      push(i, fin, "coment");
      i = fin;
      continue;
    }
    if (c === "$") {
      const marca = s[i + 1] === "$" ? "$$" : "$";
      let f = s.indexOf(marca, i + marca.length);
      while (f > 0 && s[f - 1] === "\\") f = s.indexOf(marca, f + 1);
      const fin = f < 0 ? s.length : f + marca.length;
      push(i, fin, "mate");
      i = fin;
      continue;
    }
    if (c === "\\") {
      const sig = s[i + 1];
      if (sig === "[" || sig === "(") {
        const f = s.indexOf(sig === "[" ? "\\]" : "\\)", i + 2);
        const fin = f < 0 ? s.length : f + 2;
        push(i, fin, "mate");
        i = fin;
        continue;
      }
      const env = ENTORNO_MATE.exec(s.slice(i, i + 40));
      if (env) {
        const cierre = `\\end{${env[1]}${env[2]}}`;
        const f = s.indexOf(cierre, i);
        const fin = f < 0 ? s.length : f + cierre.length;
        push(i, fin, "mate");
        i = fin;
        continue;
      }
      const m = /^\\([A-Za-z]+\*?|.)/.exec(s.slice(i, i + 40));
      const fin = i + (m ? m[0].length : 1);
      push(i, fin, "cmd");
      i = fin;
      continue;
    }
    if (c === "{" || c === "}") {
      push(i, i + 1, "llave");
      i++;
      continue;
    }
    i++;
  }
  return out;
}

function markdown(s: string): Tramo[] {
  const out: Tramo[] = [];
  const re = /```[\s\S]*?(?:```|$)|`[^`\n]*`|\$\$[\s\S]*?(?:\$\$|$)|\$[^$\n]+\$|^#{1,6} |^\s*(?:[-*+]|\d+\.) |\*\*|__/gm;
  for (let m; (m = re.exec(s)); ) {
    if (!m[0].length) { re.lastIndex++; continue; }
    const t = m[0];
    const clase: Clase = t.startsWith("`") ? "coment" : t.startsWith("$") ? "mate" : "cmd";
    out.push({ ini: m.index, fin: m.index + t.length, clase });
  }
  return out;
}

export function colorear(src: string, modo: Modo): Tramo[] {
  return modo === "latex" ? latex(src) : markdown(src);
}
