// Vista previa de LaTeX: un traductor propio de un subconjunto de LaTeX a HTML, con las
// fórmulas dibujadas por KaTeX. Nunca lanza: lo que no entiende lo muestra en gris
// («se verá en el PDF»), y el código a medio escribir se muestra como pueda.

import katex from "katex";

export interface Vista {
  html: string;
  titulo?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function mathHtml(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false, trust: false, output: "html" });
  } catch {
    return `<span class="desconocido">${esc(tex)}</span>`;
  }
}

/** Lee un grupo {…} que empieza en s[i] (que debe ser «{»). Sin cierre, toma hasta el fin de línea. */
function grupo(s: string, i: number): [string, number] {
  if (s[i] !== "{") return ["", i];
  let nivel = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "{") nivel++;
    else if (c === "}" && --nivel === 0) return [s.slice(i + 1, j), j + 1];
  }
  const fin = s.indexOf("\n", i);
  return fin < 0 ? [s.slice(i + 1), s.length] : [s.slice(i + 1, fin), fin];
}

/** Salta un argumento opcional [ … ] si lo hay. */
function opcional(s: string, i: number): number {
  if (s[i] !== "[") return i;
  const fin = s.indexOf("]", i);
  return fin < 0 ? i : fin + 1;
}

/** Quita comentarios (% sin barra delante). */
function sinComentarios(s: string): string {
  return s.split("\n").map((l) => {
    for (let i = 0; i < l.length; i++) {
      if (l[i] === "\\") { i++; continue; }
      if (l[i] === "%") return l.slice(0, i);
    }
    return l;
  }).join("\n");
}

/** Busca el \end{nombre} que cierra un \begin{nombre}, con anidación. */
function cierre(s: string, desde: number, nombre: string): [number, number] {
  const abre = `\\begin{${nombre}}`, cierra = `\\end{${nombre}}`;
  let nivel = 1, i = desde;
  while (i < s.length) {
    const a = s.indexOf(abre, i), c = s.indexOf(cierra, i);
    if (c < 0) return [s.length, s.length];
    if (a >= 0 && a < c) { nivel++; i = a + abre.length; continue; }
    if (--nivel === 0) return [c, c + cierra.length];
    i = c + cierra.length;
  }
  return [s.length, s.length];
}

const ENTORNOS_MATE: Record<string, string> = {
  equation: "", "equation*": "", displaymath: "", gather: "gathered", "gather*": "gathered",
  align: "aligned", "align*": "aligned", multline: "", "multline*": "", eqnarray: "aligned", "eqnarray*": "aligned",
};

const SIMPLES: Record<string, string> = {
  "\\%": "%", "\\&": "&amp;", "\\_": "_", "\\#": "#", "\\$": "$", "\\{": "{", "\\}": "}",
  "\\,": "&thinsp;", "\\ ": " ", "\\;": " ", "\\quad": "&emsp;", "\\qquad": "&emsp;&emsp;",
  "\\LaTeX": "LaTeX", "\\TeX": "TeX", "\\ldots": "…", "\\dots": "…", "\\noindent": "", "\\centering": "",
  "\\today": new Date().toLocaleDateString("es"), "\\newline": "<br>", "\\par": "<br>", "\\hfill": "", "\\vfill": "",
  "\\medskip": "", "\\smallskip": "", "\\bigskip": "", "\\newpage": "", "\\clearpage": "", "\\tableofcontents": "",
  "\\hline": "", "\\small": "", "\\large": "", "\\Large": "", "\\normalsize": "", "\\footnotesize": "",
};

const FORMATO: Record<string, [string, string]> = {
  textbf: ["<strong>", "</strong>"], emph: ["<em>", "</em>"], textit: ["<em>", "</em>"], underline: ["<u>", "</u>"],
  texttt: ["<code>", "</code>"], textsc: ['<span style="font-variant:small-caps">', "</span>"], text: ["", ""],
  textrm: ["", ""], mbox: ["", ""], footnote: ['<sup class="nota" title="', '">*</sup>'],
};

class Traductor {
  secciones = [0, 0, 0];
  ecuacion = 0;
  figura = 0;
  tabla = 0;
  citas: string[] = [];
  etiquetas = new Map<string, string>();
  ultimoNumero = "";
  titulo?: string;
  autor?: string;
  fecha?: string;

  /** Texto en línea: fórmulas, formato, referencias y caracteres especiales. */
  enLinea(s: string): string {
    let out = "";
    for (let i = 0; i < s.length; ) {
      const c = s[i];
      if (c === "$") {
        const doble = s[i + 1] === "$";
        const marca = doble ? "$$" : "$";
        let fin = s.indexOf(marca, i + marca.length);
        while (fin > 0 && s[fin - 1] === "\\") fin = s.indexOf(marca, fin + 1);
        if (fin < 0) { out += `<span class="desconocido">${esc(s.slice(i))}</span>`; break; }
        out += mathHtml(s.slice(i + marca.length, fin), doble);
        i = fin + marca.length;
        continue;
      }
      if (c === "\\") {
        if (s[i + 1] === "(") {
          const fin = s.indexOf("\\)", i + 2);
          const f = fin < 0 ? s.length : fin;
          out += mathHtml(s.slice(i + 2, f), false);
          i = fin < 0 ? s.length : fin + 2;
          continue;
        }
        if (s[i + 1] === "\\") { out += "<br>"; i += 2; continue; }
        const m = /^\\([A-Za-z]+\*?|.)/.exec(s.slice(i));
        const cmd = m ? m[0] : "\\";
        if (SIMPLES[cmd] !== undefined) { out += SIMPLES[cmd]; i += cmd.length; continue; }
        const nombre = cmd.slice(1);
        let j = i + cmd.length;
        if (FORMATO[nombre]) {
          j = opcional(s, j);
          const [arg, k] = grupo(s, j);
          const [a, b] = FORMATO[nombre];
          out += nombre === "footnote" ? `${a}${esc(arg)}${b}` : `${a}${this.enLinea(arg)}${b}`;
          i = k;
          continue;
        }
        if (nombre === "label") {
          const [arg, k] = grupo(s, j);
          if (this.ultimoNumero) this.etiquetas.set(arg, this.ultimoNumero);
          i = k;
          continue;
        }
        if (nombre === "ref" || nombre === "eqref") {
          const [arg, k] = grupo(s, j);
          const ph = `\u0001${arg}\u0001`;
          out += nombre === "eqref" ? `(${ph})` : ph;
          i = k;
          continue;
        }
        if (nombre === "cite") {
          j = opcional(s, j);
          const [arg, k] = grupo(s, j);
          const nums = arg.split(",").map((c) => c.trim()).filter(Boolean).map((c) => {
            let n = this.citas.indexOf(c);
            if (n < 0) n = this.citas.push(c) - 1;
            return n + 1;
          });
          out += `[${nums.join(", ")}]`;
          i = k;
          continue;
        }
        if (nombre === "url") {
          const [arg, k] = grupo(s, j);
          out += `<span class="url">${esc(arg)}</span>`;
          i = k;
          continue;
        }
        if (nombre === "href") {
          const [, k] = grupo(s, j);
          const [texto, k2] = grupo(s, k);
          out += `<span class="url">${this.enLinea(texto)}</span>`;
          i = k2;
          continue;
        }
        // Comando desconocido: se muestra en gris con su argumento.
        let fin = j;
        fin = opcional(s, fin);
        if (s[fin] === "{") fin = grupo(s, fin)[1];
        out += `<span class="desconocido" title="Se verá en el PDF">${esc(s.slice(i, fin))}</span>`;
        i = fin === i ? i + 1 : fin;
        continue;
      }
      if (c === "~") { out += "&nbsp;"; i++; continue; }
      if (c === "{" || c === "}") { i++; continue; }
      if (s.startsWith("---", i)) { out += "—"; i += 3; continue; }
      if (s.startsWith("--", i)) { out += "–"; i += 2; continue; }
      if (s.startsWith("``", i)) { out += "“"; i += 2; continue; }
      if (s.startsWith("''", i)) { out += "”"; i += 2; continue; }
      out += esc(c);
      i++;
    }
    return out;
  }

  parrafo(s: string): string {
    const t = s.trim();
    return t ? `<p>${this.enLinea(t)}</p>` : "";
  }

  mateAparte(tex: string, entorno: string, numerada: boolean): string {
    let cuerpo = tex;
    let etiqueta: string | null = null;
    cuerpo = cuerpo.replace(/\\label\{([^}]*)\}/g, (_, l) => { etiqueta = l; return ""; });
    cuerpo = cuerpo.replace(/\\nonumber|\\notag/g, "");
    const envoltura = ENTORNOS_MATE[entorno];
    if (envoltura) cuerpo = `\\begin{${envoltura}}${cuerpo}\\end{${envoltura}}`;
    let numero = "";
    if (numerada) {
      numero = String(++this.ecuacion);
      if (etiqueta) this.etiquetas.set(etiqueta, numero);
    }
    return `<div class="ecuacion">${mathHtml(cuerpo.trim(), true)}${numero ? `<span class="num">(${numero})</span>` : ""}</div>`;
  }

  lista(cuerpo: string, ordenada: boolean): string {
    const items = cuerpo.split(/\\item\b/).slice(1);
    const tag = ordenada ? "ol" : "ul";
    return `<${tag}>${items.map((it) => `<li>${this.bloques(opcionalTexto(it))}</li>`).join("")}</${tag}>`;
  }

  tabla_(cuerpo: string): string {
    const sinSpec = cuerpo.replace(/^\s*\{[^}]*\}/, "");
    const filas = sinSpec.split(/\\\\/).map((f) => f.replace(/\\hline|\\toprule|\\midrule|\\bottomrule/g, "").trim()).filter((f) => f.length);
    return `<table class="tabla">${filas.map((f) => `<tr>${f.split(/(?<!\\)&/).map((c) => `<td>${this.enLinea(c.trim())}</td>`).join("")}</tr>`).join("")}</table>`;
  }

  figura_(cuerpo: string): string {
    let html = "";
    const img = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/.exec(cuerpo);
    if (img) html += `<img class="figura" data-src="${esc(img[1])}" alt="${esc(img[1])}">`;
    const cap = /\\caption\{/.exec(cuerpo);
    if (cap) {
      const [texto] = grupo(cuerpo, cap.index + cap[0].length - 1);
      const n = ++this.figura;
      this.ultimoNumero = String(n);
      html += `<figcaption>Figura ${n}: ${this.enLinea(texto)}</figcaption>`;
      const lab = /\\label\{([^}]*)\}/.exec(cuerpo);
      if (lab) this.etiquetas.set(lab[1], String(n));
    }
    const tab = /\\begin\{tabular\}/.exec(cuerpo);
    if (tab) {
      const desde = tab.index + tab[0].length;
      const [fin] = cierre(cuerpo, desde, "tabular");
      html = this.tabla_(cuerpo.slice(desde, fin)) + html;
    }
    return `<figure>${html}</figure>`;
  }

  entorno(nombre: string, cuerpo: string): string {
    if (nombre in ENTORNOS_MATE) return this.mateAparte(cuerpo, nombre, !nombre.endsWith("*") && nombre !== "displaymath");
    switch (nombre) {
      case "itemize": return this.lista(cuerpo, false);
      case "enumerate": return this.lista(cuerpo, true);
      case "description": return this.lista(cuerpo, false);
      case "tabular": return this.tabla_(cuerpo);
      case "figure": case "figure*": case "table": case "table*": return this.figura_(cuerpo);
      case "center": case "flushleft": case "flushright": case "minipage": return `<div class="${nombre}">${this.bloques(cuerpo.replace(/^\s*(\[[^\]]*\])?\{[^}]*\}/, nombre === "minipage" ? "" : "$&"))}</div>`;
      case "abstract": return `<div class="resumen"><strong>Resumen.</strong> ${this.bloques(cuerpo)}</div>`;
      case "quote": case "quotation": return `<blockquote>${this.bloques(cuerpo)}</blockquote>`;
      case "verbatim": return `<pre>${esc(cuerpo.replace(/^\n/, ""))}</pre>`;
      case "thebibliography": {
        const items = cuerpo.split(/\\bibitem/).slice(1).map((it) => {
          const [clave, k] = grupo(it, it.indexOf("{"));
          return `<li data-clave="${esc(clave)}">${this.enLinea(it.slice(k).trim())}</li>`;
        });
        return `<h2>Referencias</h2><ol class="biblio">${items.join("")}</ol>`;
      }
      default:
        return `<div class="desconocido" title="Se verá en el PDF">\\begin{${esc(nombre)}}${esc(cuerpo)}\\end{${esc(nombre)}}</div>`;
    }
  }

  titulo_(): string {
    let h = `<div class="titulo-doc">`;
    if (this.titulo) h += `<h1>${this.enLinea(this.titulo)}</h1>`;
    if (this.autor) h += `<div class="autor">${this.enLinea(this.autor.replace(/\\and/g, " · "))}</div>`;
    if (this.fecha !== undefined) h += `<div class="fecha">${this.enLinea(this.fecha || new Date().toLocaleDateString("es"))}</div>`;
    return h + "</div>";
  }

  bloques(s: string): string {
    const out: string[] = [];
    let parrafo = "";
    const vaciar = () => { out.push(this.parrafo(parrafo)); parrafo = ""; };
    for (let i = 0; i < s.length; ) {
      if (s.startsWith("\\begin{", i)) {
        const [nombre, k] = grupo(s, i + 6);
        const [fin, despues] = cierre(s, k, nombre);
        vaciar();
        out.push(this.entorno(nombre, s.slice(k, fin)));
        i = despues;
        continue;
      }
      if (s.startsWith("\\[", i)) {
        const fin = s.indexOf("\\]", i + 2);
        vaciar();
        out.push(this.mateAparte(s.slice(i + 2, fin < 0 ? s.length : fin), "", false));
        i = fin < 0 ? s.length : fin + 2;
        continue;
      }
      if (s.startsWith("$$", i)) {
        const fin = s.indexOf("$$", i + 2);
        vaciar();
        out.push(this.mateAparte(s.slice(i + 2, fin < 0 ? s.length : fin), "", false));
        i = fin < 0 ? s.length : fin + 2;
        continue;
      }
      const sec = /^\\(section|subsection|subsubsection|paragraph|chapter)(\*?)/.exec(s.slice(i, i + 20));
      if (sec) {
        vaciar();
        let j = opcional(s, i + sec[0].length);
        const [texto, k] = grupo(s, j);
        const nivel = sec[1] === "subsection" ? 1 : sec[1] === "subsubsection" || sec[1] === "paragraph" ? 2 : 0;
        let numero = "";
        if (!sec[2]) {
          this.secciones[nivel]++;
          for (let n = nivel + 1; n < 3; n++) this.secciones[n] = 0;
          numero = this.secciones.slice(0, nivel + 1).join(".");
          this.ultimoNumero = numero;
        }
        const tag = `h${nivel + 2}`;
        out.push(`<${tag}${numero ? ` data-num="${numero}"` : ""}>${numero ? `${numero}&nbsp; ` : ""}${this.enLinea(texto)}</${tag}>`);
        i = k;
        continue;
      }
      if (s.startsWith("\\maketitle", i)) { vaciar(); out.push(this.titulo_()); i += 10; continue; }
      const meta = /^\\(title|author|date)\{/.exec(s.slice(i, i + 9));
      if (meta) { i = grupo(s, i + meta[0].length - 1)[1]; continue; }
      if (s[i] === "\n" && /^\n[ \t]*\n/.test(s.slice(i))) {
        vaciar();
        i = s.indexOf("\n", i + 1) + 1;
        continue;
      }
      parrafo += s[i];
      i++;
    }
    vaciar();
    return out.join("");
  }
}

/** Quita un [opcional] al principio de un \item. */
function opcionalTexto(s: string): string {
  return s.replace(/^\s*\[([^\]]*)\]/, (_, t) => `\\textbf{${t}} `);
}

export function latexToHtml(src: string): Vista {
  try {
    const limpio = sinComentarios(src);
    const t = new Traductor();
    const meta = (nombre: string) => {
      const m = new RegExp(`\\\\${nombre}\\{`).exec(limpio);
      return m ? grupo(limpio, m.index + m[0].length - 1)[0] : undefined;
    };
    t.titulo = meta("title");
    t.autor = meta("author");
    t.fecha = meta("date");
    const ini = limpio.indexOf("\\begin{document}");
    let cuerpo = ini >= 0 ? limpio.slice(ini + "\\begin{document}".length) : limpio;
    const fin = cuerpo.lastIndexOf("\\end{document}");
    if (fin >= 0) cuerpo = cuerpo.slice(0, fin);
    let html = t.bloques(cuerpo);
    html = html.replace(/\u0001([^\u0001]*)\u0001/g, (_, l) => esc(t.etiquetas.get(l) ?? "??"));
    return { html, titulo: t.titulo?.replace(/\\[a-zA-Z]+|[{}]/g, "").trim() };
  } catch (e) {
    return { html: `<pre class="desconocido">${esc(src)}</pre><p class="desconocido">No se pudo mostrar: ${esc(String(e))}</p>` };
  }
}
