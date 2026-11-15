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
  italic?: boolean;
  /** Color del texto (#rrggbb), si se conoce. */
  color?: string;
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

/**
 * Agrupa los fragmentos que comparten altura en líneas (de arriba abajo). Con
 * `splitColumns`, un hueco grande separa la línea en trozos (columnas distintas); para
 * tablas se deja en `false` y la fila queda entera.
 */
export function groupLines(items: TextItem[], splitColumns = true): Line[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: TextItem[][] = [];
  for (const item of sorted) {
    const g = groups.find((l) => Math.abs(l[0].y - item.y) <= Math.max(2, Math.min(l[0].size, item.size) * 0.45));
    if (g) g.push(item);
    else groups.push([item]);
  }
  // Una «línea» se corta donde hay un hueco grande: son columnas distintas a la misma altura.
  const segments: TextItem[][] = [];
  for (const g of groups) {
    g.sort((a, b) => a.x - b.x);
    let cur: TextItem[] = [];
    for (const item of g) {
      const prev = cur[cur.length - 1];
      if (splitColumns && prev && item.x - (prev.x + prev.w) > Math.max(12, Math.min(prev.size, item.size) * 1.5)) {
        segments.push(cur);
        cur = [];
      }
      cur.push(item);
    }
    if (cur.length) segments.push(cur);
  }
  return segments
    .map((g) => {
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
    .sort((a, b) => b.y - a.y || a.x - b.x);
}

/**
 * Orden de lectura por bloques (corte X-Y): primero las franjas horizontales separadas
 * por un hueco que cruza todo el ancho; dentro de cada franja, las columnas de izquierda a
 * derecha. Así un póster o un texto a dos columnas se lee columna por columna.
 */
export function readingOrder(items: TextItem[]): TextItem[][] {
  const visible = items.filter((i) => i.str.trim());
  if (!visible.length) return [];
  const size = median(visible.map((i) => i.size)) || 10;
  const out: TextItem[][] = [];
  const gaps = (spans: [number, number][], min: number): [number, number][] => {
    const sorted = [...spans].sort((a, b) => a[0] - b[0]);
    const found: [number, number][] = [];
    let end = sorted[0][1];
    for (const [a, b] of sorted.slice(1)) {
      if (a - end >= min) found.push([end, a]);
      end = Math.max(end, b);
    }
    return found;
  };
  const cut = (set: TextItem[], depth: number) => {
    if (set.length < 2 || depth > 40) {
      out.push(set);
      return;
    }
    // Franjas: huecos en la vertical (y crece hacia arriba, se lee de arriba abajo).
    const rows = gaps(set.map((i) => [-(i.y + i.size), -i.y] as [number, number]), size * 0.8);
    if (rows.length) {
      const [, at] = rows.reduce((best, g) => (g[1] - g[0] > best[1] - best[0] ? g : best));
      cut(set.filter((i) => -(i.y + i.size) < at), depth + 1);
      cut(set.filter((i) => -(i.y + i.size) >= at), depth + 1);
      return;
    }
    const cols = gaps(set.map((i) => [i.x, i.x + i.w] as [number, number]), Math.max(10, size * 1.2));
    if (cols.length) {
      const [, at] = cols.reduce((best, g) => (g[1] - g[0] > best[1] - best[0] ? g : best));
      cut(set.filter((i) => i.x < at), depth + 1);
      cut(set.filter((i) => i.x >= at), depth + 1);
      return;
    }
    out.push(set);
  };
  cut(visible, 0);
  return out;
}

/**
 * Une líneas en párrafos: un hueco grande o un cambio de tamaño empieza otro. `bodySize` es
 * el tamaño del texto normal de la página (si no, el de estas líneas): lo que es bastante
 * más grande es un título.
 */
export function toParagraphs(lines: Line[], bodySize?: number): Paragraph[] {
  if (!lines.length) return [];
  const body = bodySize || median(lines.map((l) => l.size));
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
