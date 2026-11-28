// Semáforo de lectura: junta lo que leyó el lector (grande y chico) con reglas de color que fallan en
// muchos celulares aunque aquí se lea (poco contraste, colores invertidos, sin fondo y módulos claros).
import type { Diseno } from "./dibujo";

export type Nivel = "verde" | "amarillo" | "rojo";
export interface Evaluacion { nivel: Nivel; motivos: string[] }

function rgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((x) => x + x).join("");
  const v = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(v) ? [0, 0, 0] : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Luminancia relativa (WCAG 2). */
export function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const PEOR = { verde: 0, amarillo: 1, rojo: 2 } as const;

export function evaluar(lecturas: { grande: boolean; chico: boolean }, d: Diseno): Evaluacion {
  let nivel: Nivel = "verde";
  const motivos: string[] = [];
  const sube = (n: Nivel, m: string) => {
    if (PEOR[n] > PEOR[nivel]) nivel = n;
    motivos.push(m);
  };

  if (!lecturas.grande) sube("rojo", "No se lee: prueba con menos adornos, otra forma o más contraste.");
  else if (!lecturas.chico) sube("amarillo", "Impreso pequeño puede fallar: imprímelo de al menos 3 cm o usa una forma más simple.");

  const fondo = d.fondo ?? "#ffffff";
  const modulos = typeof d.color === "string" ? [d.color] : [...d.color.colores];
  const peor = Math.min(...modulos.map((c) => contraste(c, fondo)));
  if (peor < 3) sube("rojo", "Poco contraste entre el QR y el fondo: oscurece los módulos o aclara el fondo.");
  else if (peor < 4.5) sube("amarillo", "Contraste justo: con poca luz puede costar leerlo.");

  if (d.colorOjos && contraste(d.colorOjos, fondo) < 3) sube("rojo", "Las esquinas tienen poco contraste con el fondo: el lector las busca primero.");

  const claro = Math.max(...modulos.map(luminancia));
  if (d.fondo && claro > luminancia(d.fondo)) sube("amarillo", "Colores invertidos (QR claro sobre fondo oscuro): muchos celulares no lo leen. Mejor módulos oscuros sobre fondo claro.");
  if (!d.fondo && claro > 0.4) sube("amarillo", "Sin fondo y con módulos claros: sobre papel blanco o una pared clara casi no se verá.");

  return { nivel, motivos };
}
