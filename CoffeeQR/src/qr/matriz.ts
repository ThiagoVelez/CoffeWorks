// La matriz del QR (qrcode-generator, MIT) con el texto en UTF-8 para que las tildes y la ñ se lean.
import qrcode from "qrcode-generator";

const utf8 = new TextEncoder();
qrcode.stringToBytes = (s: string) => Array.from(utf8.encode(s));

export type Nivel = "L" | "M" | "Q" | "H";

export interface Matriz {
  n: number;
  oscuro(f: number, c: number): boolean;
  /** Las tres esquinas de 7×7 (los «ojos»), que se dibujan aparte. */
  esOjo(f: number, c: number): boolean;
  /** Centros (fila, columna) de los patrones de alineación de 5×5. */
  alineacion: [number, number][];
  esAlineacion(f: number, c: number): boolean;
}

/** Posiciones de los patrones de alineación por versión (ISO/IEC 18004, anexo E). */
const TABLA_ALINEACION: number[][] = [[],[6, 18],[6, 22],[6, 26],[6, 30],[6, 34],[6, 22, 38],[6, 24, 42],[6, 26, 46],[6, 28, 50],[6, 30, 54],[6, 32, 58],[6, 34, 62],[6, 26, 46, 66],[6, 26, 48, 70],[6, 26, 50, 74],[6, 30, 54, 78],[6, 30, 56, 82],[6, 30, 58, 86],[6, 34, 62, 90],[6, 28, 50, 72, 94],[6, 26, 50, 74, 98],[6, 30, 54, 78, 102],[6, 28, 54, 80, 106],[6, 32, 58, 84, 110],[6, 30, 58, 86, 114],[6, 34, 62, 90, 118],[6, 26, 50, 74, 98, 122],[6, 30, 54, 78, 102, 126],[6, 26, 52, 78, 104, 130],[6, 30, 56, 82, 108, 134],[6, 34, 60, 86, 112, 138],[6, 30, 58, 86, 114, 142],[6, 34, 62, 90, 118, 146],[6, 30, 54, 78, 102, 126, 150],[6, 24, 50, 76, 102, 128, 154],[6, 28, 54, 80, 106, 132, 158],[6, 32, 58, 84, 110, 136, 162],[6, 26, 54, 82, 110, 138, 166],[6, 30, 58, 86, 114, 142, 170]];
export function posicionesAlineacion(n: number): number[] {
  return TABLA_ALINEACION[(n - 17) / 4 - 1] ?? [];
}

export const LARGO_MAXIMO = "El contenido es demasiado largo para un QR. Acórtalo (por ejemplo, con un enlace más corto).";

export function matriz(texto: string, nivel: Nivel = "H"): Matriz {
  const q = qrcode(0, nivel);
  q.addData(texto, "Byte");
  try {
    q.make();
  } catch {
    throw new Error(LARGO_MAXIMO);
  }
  const n = q.getModuleCount();
  const esOjo = (f: number, c: number) => (f < 7 && c < 7) || (f < 7 && c >= n - 7) || (f >= n - 7 && c < 7);
  const pos = posicionesAlineacion(n);
  const alineacion: [number, number][] = [];
  for (const f of pos) for (const c of pos) if (!esOjo(f - 2, c - 2) && !esOjo(f + 2, c + 2) && !esOjo(f - 2, c + 2) && !esOjo(f + 2, c - 2)) alineacion.push([f, c]);
  const esAlineacion = (f: number, c: number) => alineacion.some(([af, ac]) => Math.abs(f - af) <= 2 && Math.abs(c - ac) <= 2);
  return { n, oscuro: (f, c) => f >= 0 && c >= 0 && f < n && c < n && q.isDark(f, c), esOjo, alineacion, esAlineacion };
}
