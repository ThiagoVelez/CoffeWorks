// Zonas de «prosa» donde el corrector puede marcar palabras: fuera de comandos, fórmulas,
// comentarios y argumentos técnicos (\label, \ref, \cite, \begin, \end, \includegraphics…).

import type { Modo } from "./insertar";

export interface Rango { ini: number; fin: number }

const ARG_TECNICO = new Set([
  "label", "ref", "eqref", "cite", "begin", "end", "includegraphics", "usepackage", "documentclass",
  "url", "href", "input", "include", "bibliography", "bibliographystyle", "newcommand", "renewcommand",
  "setlength", "hspace", "vspace", "pageref", "autoref", "color", "textcolor", "geometry",
]);

const ENTORNOS_MATE = /^(equation|align|gather|multline|eqnarray|displaymath|math)\*?$/;
const ENTORNOS_CODIGO = /^(verbatim|lstlisting|minted)\*?$/;

function saltarGrupo(s: string, i: number): number {
  let nivel = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") { j++; continue; }
    if (s[j] === "{") nivel++;
    else if (s[j] === "}" && --nivel === 0) return j + 1;
  }
  return s.length;
}

function prosaLatex(s: string): Rango[] {
  const r: Rango[] = [];
  let ini = 0;
  const cortar = (hasta: number, sigue: number) => {
    if (hasta > ini) r.push({ ini, fin: hasta });
    ini = sigue;
  };
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === "%") {
      const fin = s.indexOf("\n", i);
      const f = fin < 0 ? s.length : fin;
      cortar(i, f);
      i = f;
      continue;
    }
    if (c === "$") {
      const marca = s[i + 1] === "$" ? "$$" : "$";
      let fin = s.indexOf(marca, i + marca.length);
      while (fin > 0 && s[fin - 1] === "\\") fin = s.indexOf(marca, fin + 1);
      const f = fin < 0 ? s.length : fin + marca.length;
      cortar(i, f);
      i = f;
      continue;
    }
    if (c === "\\") {
      const sig = s[i + 1];
      if (sig === "[" || sig === "(") {
        const fin = s.indexOf(sig === "[" ? "\\]" : "\\)", i + 2);
        const f = fin < 0 ? s.length : fin + 2;
        cortar(i, f);
        i = f;
        continue;
      }
      const m = /^\\([A-Za-z]+)\*?/.exec(s.slice(i, i + 40));
      if (!m) { cortar(i, i + 2); i += 2; continue; }
      let j = i + m[0].length;
      const nombre = m[1];
      if (nombre === "begin") {
        const fin = s.indexOf("}", j);
        const entorno = fin < 0 ? "" : s.slice(j + 1, fin);
        if (ENTORNOS_MATE.test(entorno) || ENTORNOS_CODIGO.test(entorno)) {
          const cierre = `\\end{${entorno}}`;
          const k = s.indexOf(cierre, fin);
          const f = k < 0 ? s.length : k + cierre.length;
          cortar(i, f);
          i = f;
          continue;
        }
      }
      if (ARG_TECNICO.has(nombre)) {
        while (s[j] === "[") { const f = s.indexOf("]", j); j = f < 0 ? s.length : f + 1; }
        if (s[j] === "{") j = saltarGrupo(s, j);
        if (nombre === "href" && s[j] === "{") { cortar(i, j + 1); i = j + 1; continue; }
        if (nombre === "begin" && s[j] === "{") j = saltarGrupo(s, j); // \begin{tabular}{|c|c|}
      }
      cortar(i, j);
      i = j;
      continue;
    }
    if (c === "{" || c === "}" || c === "&") { cortar(i, i + 1); i++; continue; }
    i++;
  }
  cortar(s.length, s.length);
  return r;
}

function prosaMarkdown(s: string): Rango[] {
  const excluir: Rango[] = [];
  const re = /```[\s\S]*?(```|$)|`[^`\n]*`|\$\$[\s\S]*?(\$\$|$)|\$[^$\n]+\$|<[^>\n]+>|\]\([^)\n]*\)|https?:\/\/\S+/g;
  for (let m; (m = re.exec(s)); ) {
    excluir.push({ ini: m.index, fin: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++;
  }
  const r: Rango[] = [];
  let ini = 0;
  for (const e of excluir) {
    if (e.ini > ini) r.push({ ini, fin: e.ini });
    ini = Math.max(ini, e.fin);
  }
  if (ini < s.length) r.push({ ini, fin: s.length });
  return r;
}

/** En el preámbulo solo se revisan \title, \author y \date. */
function sinPreambulo(src: string, r: Rango[]): Rango[] {
  const inicio = src.indexOf("\\begin{document}");
  if (inicio < 0) return r;
  const permitidas: Rango[] = [];
  for (const m of src.slice(0, inicio).matchAll(/\\(?:title|author|date)\{/g)) {
    const ini = m.index! + m[0].length - 1;
    permitidas.push({ ini, fin: saltarGrupo(src, ini) });
  }
  return r.flatMap((x) => {
    if (x.ini >= inicio) return [x];
    return permitidas
      .map((p) => ({ ini: Math.max(x.ini, p.ini), fin: Math.min(x.fin, p.fin, inicio) }))
      .filter((y) => y.fin > y.ini);
  });
}

export function rangosDeProsa(src: string, modo: Modo): Rango[] {
  return modo === "latex" ? sinPreambulo(src, prosaLatex(src)) : prosaMarkdown(src);
}
