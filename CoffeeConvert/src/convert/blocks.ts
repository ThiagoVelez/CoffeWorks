// Texto, Markdown, HTML y CSV a bloques sencillos (títulos, párrafos, listas, código y
// tablas) que luego se maquetan en PDF. Sin DOM, para poder probarlo.

export type BlockKind = "h1" | "h2" | "h3" | "p" | "li" | "code" | "table";

export interface Block {
  kind: BlockKind;
  text: string;
  rows?: string[][];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", iexcl: "¡", iquest: "¿", copy: "©", reg: "®", euro: "€", mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** Quita el formato en línea de Markdown (negrita, cursiva, enlaces, código, imágenes). */
function inlineMd(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/~~(.+?)~~/g, "$1")
    .trim();
}

const tableRow = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => inlineMd(c.trim()));

export function markdownToBlocks(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", text: inlineMd(para.join(" ")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith("```")) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      out.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    if (t.startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const rows = [tableRow(t)];
      i++;
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) rows.push(tableRow(lines[++i]));
      out.push({ kind: "table", text: "", rows });
      continue;
    }
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    const li = t.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (!t) flush();
    else if (h) {
      flush();
      out.push({ kind: (h[1].length === 1 ? "h1" : h[1].length === 2 ? "h2" : "h3") as BlockKind, text: inlineMd(h[2].replace(/#+$/, "")) });
    } else if (li) {
      flush();
      out.push({ kind: "li", text: inlineMd(li[1]) });
    } else if (/^(-{3,}|\*{3,})$/.test(t)) flush();
    else para.push(t.replace(/^>\s?/, ""));
  }
  flush();
  return out;
}

export function htmlToBlocks(html: string): Block[] {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|template)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const out: Block[] = [];
  const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/[ \t\r\f]+/g, " ").replace(/ *\n */g, "\n").trim();
  const re = /<(h[1-6]|p|li|pre|table|blockquote|div|td|th|dt|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    if (tag === "table") {
      const rows = [...m[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => clean(c[1])));
      if (rows.length) out.push({ kind: "table", text: "", rows });
      continue;
    }
    if (tag === "td" || tag === "th") continue;
    const text = tag === "pre" ? decodeEntities(m[2].replace(/<[^>]+>/g, "")) : clean(m[2]);
    if (!text) continue;
    const kind: BlockKind = tag === "h1" ? "h1" : tag === "h2" ? "h2" : tag[0] === "h" ? "h3" : tag === "li" ? "li" : tag === "pre" ? "code" : "p";
    // Un <div> con bloques dentro ya se recorre por sus hijos.
    if (tag === "div" && /<(p|h[1-6]|li|table|pre)\b/i.test(m[2])) {
      re.lastIndex = m.index + m[0].indexOf(">") + 1;
      continue;
    }
    out.push({ kind, text });
  }
  if (!out.length) {
    const text = clean(body);
    if (text) out.push(...textToBlocks(text));
  }
  return out;
}

/** CSV (coma, punto y coma o tabulador) a una tabla. */
export function csvToBlocks(csv: string): Block[] {
  const first = csv.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows.length ? [{ kind: "table", text: "", rows }] : [];
}

export function textToBlocks(text: string): Block[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/g, "").replace(/^\n+/, ""))
    .filter((p) => p.trim())
    .map((p) => ({ kind: "p" as const, text: p }));
}

/** Corta un texto en líneas que caben en `width` (por palabras; si una no cabe, por letras). */
export function wrapText(text: string, width: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      line = "";
      let rest = word;
      while (measure(rest) > width && rest.length > 1) {
        let n = rest.length - 1;
        while (n > 1 && measure(rest.slice(0, n)) > width) n--;
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Solo los caracteres que pueden dibujar las fuentes estándar del PDF (Windows-1252). */
export function winAnsiSafe(text: string): string {
  return [...text.replace(/\t/g, "    ")]
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (ch === "\n" || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.includes(ch)) return ch;
      return "?";
    })
    .join("");
}
