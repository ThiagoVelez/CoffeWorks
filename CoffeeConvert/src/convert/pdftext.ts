// Texto de un PDF (fragmentos con posición, de pdf.js) a líneas, párrafos y tablas.
// Coordenadas del PDF: y crece hacia arriba. Sin DOM ni pdf.js, para poder probarlo.

export interface TextItem {
  str: string;
  /** Esquina inferior izquierda, en puntos. */
  x: number;
  y: number;
  /** Ancho del fragmento en puntos. */
  w: number;
  /** Tamaño de letra en puntos. */
  size: number;
  bold?: boolean;
}

export interface Line {
  text: string;
  y: number;
  x: number;
  size: number;
  bold: boolean;
  items: TextItem[];
}

export interface Paragraph {
  text: string;
  heading: boolean;
  size: number;
  bold: boolean;
}

const median = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Agrupa los fragmentos que comparten altura en líneas (de arriba abajo). */
export function groupLines(items: TextItem[]): Line[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: TextItem[][] = [];
  for (const item of sorted) {
    const g = groups.find((l) => Math.abs(l[0].y - item.y) <= Math.max(2, Math.min(l[0].size, item.size) * 0.45));
    if (g) g.push(item);
    else groups.push([item]);
  }
  return groups
    .map((g) => {
      g.sort((a, b) => a.x - b.x);
      let text = "";
      g.forEach((item, i) => {
        if (i > 0) {
          const prev = g[i - 1];
          const gap = item.x - (prev.x + prev.w);
          if (gap > item.size * 0.2 && !text.endsWith(" ") && !item.str.startsWith(" ")) text += " ";
        }
        text += item.str;
      });
      return {
        text: text.replace(/\s+/g, " ").trim(),
        y: median(g.map((i) => i.y)),
        x: g[0].x,
        size: Math.max(...g.map((i) => i.size)),
        bold: g.every((i) => i.bold),
        items: g,
      };
    })
    .sort((a, b) => b.y - a.y);
}

/** Une líneas en párrafos: un hueco grande o un cambio de tamaño empieza otro. */
export function toParagraphs(lines: Line[]): Paragraph[] {
  if (!lines.length) return [];
  const body = median(lines.map((l) => l.size));
  const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter((g) => g > 0);
  const step = median(gaps.filter((g) => g < body * 3)) || body * 1.2;
  const out: Paragraph[] = [];
  let cur: Paragraph | null = null;
  let prev: Line | null = null;
  for (const line of lines) {
    const heading = line.size >= body * 1.25;
    const gap = prev ? prev.y - line.y : 0;
    const joins = cur && prev && cur.heading === heading && Math.abs(line.size - prev.size) < 1.5 && gap <= step * 1.4 && !heading;
    if (cur && joins) {
      cur.text = cur.text.endsWith("-") && /^[a-záéíóúñü]/.test(line.text) ? cur.text.slice(0, -1) + line.text : `${cur.text} ${line.text}`;
    } else {
      cur = { text: line.text, heading, size: line.size, bold: line.bold };
      out.push(cur);
    }
    prev = line;
  }
  return out;
}

/** Reparte las líneas en filas y columnas según dónde empieza cada fragmento. */
export function toTable(lines: Line[]): string[][] {
  const starts: number[] = [];
  for (const l of lines)
    for (const it of l.items) {
      const tol = Math.max(6, it.size * 0.8);
      if (!starts.some((s) => Math.abs(s - it.x) <= tol)) starts.push(it.x);
    }
  starts.sort((a, b) => a - b);
  // Fragmentos muy juntos de la misma línea se tratan como una sola celda.
  return lines.map((l) => {
    const row: string[] = Array(starts.length).fill("");
    for (const it of l.items) {
      let col = 0;
      for (let c = 0; c < starts.length; c++) if (starts[c] <= it.x + Math.max(6, it.size * 0.8)) col = c;
      row[col] = row[col] ? `${row[col]} ${it.str.trim()}` : it.str.trim();
    }
    while (row.length && row[row.length - 1] === "") row.pop();
    return row;
  });
}
