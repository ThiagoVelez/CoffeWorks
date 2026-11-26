// Errores del compilador LaTeX (XeLaTeX o Tectonic) traducidos al español, con su línea.

export interface ErrorTex {
  linea: number | null;
  mensaje: string;
}

function traducir(original: string, contexto: string): string {
  const m = original.trim().replace(/\.$/, "");
  if (/^Undefined control sequence/i.test(m)) {
    const cmds = contexto.match(/\\[A-Za-z@]+/g);
    return cmds ? `Comando desconocido: ${cmds[cmds.length - 1]}` : "Comando desconocido";
  }
  if (/^Missing \$ inserted/i.test(m)) return "Falta abrir o cerrar una fórmula ($)";
  const archivo = /File [`'"]?([^`'"]+?)['"]? not found/i.exec(m);
  if (archivo) return `No se encuentra el archivo ${archivo[1]}`;
  if (/Emergency stop|Fatal error/i.test(m)) return "El documento tiene un error y no se pudo terminar";
  if (/^Missing \} inserted|^Extra \}/i.test(m)) return "Las llaves { } no están equilibradas";
  if (/^Environment (\S+) undefined/i.test(m)) return `Entorno desconocido: ${/^Environment (\S+) undefined/i.exec(m)![1]}`;
  if (/\\begin\{([^}]+)\} on input line \d+ ended by \\end\{([^}]+)\}/.test(m)) {
    const [, a, b] = /\\begin\{([^}]+)\} on input line \d+ ended by \\end\{([^}]+)\}/.exec(m)!;
    return `\\begin{${a}} se cierra con \\end{${b}}`;
  }
  return original.trim();
}

/** Lee el registro del compilador y devuelve los errores en orden, sin repetir. */
export function texErrors(registro: string): ErrorTex[] {
  const lineas = registro.split(/\r?\n/);
  const out: ErrorTex[] = [];
  const agregar = (e: ErrorTex) => {
    if (!out.some((o) => o.linea === e.linea && o.mensaje === e.mensaje)) out.push(e);
  };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    // Tectonic: «error: documento.tex:5: Undefined control sequence»
    const tect = /^error: [^:]+\.tex:(\d+): (.*)$/.exec(l);
    if (tect) {
      agregar({ linea: Number(tect[1]), mensaje: traducir(tect[2], tect[2]) });
      continue;
    }
    if (!l.startsWith("! ")) continue;
    const original = l.slice(2).replace(/^LaTeX Error:\s*/, "");
    let linea: number | null = null;
    let contexto = "";
    for (let j = i + 1; j < Math.min(lineas.length, i + 20); j++) {
      if (lineas[j].startsWith("! ")) break;
      const n = /^l\.(\d+)\s?(.*)$/.exec(lineas[j]);
      if (n) {
        linea = Number(n[1]);
        contexto = n[2];
        break;
      }
    }
    agregar({ linea, mensaje: traducir(original, contexto) });
  }
  return out;
}
