// Rangos de páginas («1-3, 5, 8-») y nombres de los archivos de salida.

/** Grupos de páginas (empezando en 1). Cada grupo separado por comas es un archivo al dividir. */
export function parseRanges(text: string, pageCount: number): number[][] {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Escribe las páginas, por ejemplo «1-3, 5, 8-»");
  const check = (n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > pageCount) throw new Error(`Las páginas deben estar entre 1 y ${pageCount}`);
    return n;
  };
  return parts.map((part) => {
    const m = part.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`«${part}» no se entiende; usa números y guiones, por ejemplo «2-4»`);
    if (!m[2]) return [check(Number(m[1]))];
    const from = check(m[1] ? Number(m[1]) : 1);
    const to = check(m[3] ? Number(m[3]) : pageCount);
    const step = from <= to ? 1 : -1;
    const out: number[] = [];
    for (let p = from; p !== to + step; p += step) out.push(p);
    return out;
  });
}

/** Nombre de salida: mismo nombre con otra extensión, y número si hay varios. */
export function outputName(input: string, ext: string, index?: number): string {
  const name = input.split(/[\\/]/).pop() || "documento";
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name).trim() || "documento";
  return `${stem}${index !== undefined ? `-${index}` : ""}.${ext}`;
}
