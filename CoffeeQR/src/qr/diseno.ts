// Tipos del diseño de un QR y el diseño clásico. Sin dependencias: lo usa también el Launcher
// (plantillas de «Nuevo documento»).
import type { TemaId } from "./adornos";

export type Forma = "cuadrado" | "redondeado" | "puntos" | "gotas" | "diamantes" | "estrellas" | "barrasV" | "barrasH" | "liquido";
export type FormaOjo = "cuadrado" | "redondeado" | "circulo" | "hoja";
export type FormaCentro = "cuadrado" | "punto" | "redondeado" | "hoja";
export type EstiloMarco = "abajo" | "burbuja" | "ninguno";

export type Relleno =
  | string
  | { tipo: "lineal"; colores: [string, string]; angulo: number }
  | { tipo: "radial"; colores: [string, string] };

export interface Diseno {
  modulo: Forma;
  ojoMarco: FormaOjo;
  ojoCentro: FormaCentro;
  color: Relleno;
  colorOjos?: string;
  /** `null` = sin fondo (transparente). */
  fondo: string | null;
  /** Zona en blanco alrededor, en módulos (mínimo 2). */
  margen: number;
  tema: TemaId | null;
  adornoCentro: boolean;
  adornoBorde: boolean;
  /** Imagen (data URL) para el centro. */
  logo: string | null;
  /** Parte del lado del QR que ocupa el centro (se limita a ~15 % del área). */
  tamanoCentro?: number;
  marco: { texto: string; color: string; estilo: EstiloMarco };
}

export const DISENO_BASE: Diseno = {
  modulo: "cuadrado",
  ojoMarco: "cuadrado",
  ojoCentro: "cuadrado",
  color: "#000000",
  fondo: "#ffffff",
  margen: 4,
  tema: null,
  adornoCentro: false,
  adornoBorde: false,
  logo: null,
  marco: { texto: "", color: "#000000", estilo: "ninguno" },
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const color = (c: unknown, def: string) => (typeof c === "string" && HEX.test(c) ? c : def);
const una = <T extends string>(v: unknown, validos: readonly T[], def: T): T => (validos.includes(v as T) ? (v as T) : def);
const FORMAS_ID = ["cuadrado", "redondeado", "puntos", "gotas", "diamantes", "estrellas", "barrasV", "barrasH", "liquido"] as const;
const TEMAS_ID = ["plantas", "cafe", "comida", "musica", "ropa", "mascotas", "fiesta", "salud", "tecnologia"] as const;
const LOGO = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Diseño con valores seguros: lo que llega de un archivo .cqr no es de fiar (el SVG se muestra en la
 * app), así que los colores deben ser hexadecimales, el logo una imagen en base64 y cada opción una
 * de las conocidas.
 */
export function limpiarDiseno(d: Partial<Diseno> & Record<string, unknown>): Diseno {
  const b = DISENO_BASE;
  const c = d.color as unknown;
  let relleno: Relleno = color(c, b.color as string);
  if (c && typeof c === "object") {
    const o = c as { tipo?: unknown; colores?: unknown; angulo?: unknown };
    const cs = Array.isArray(o.colores) ? o.colores : [];
    const par: [string, string] = [color(cs[0], "#000000"), color(cs[1], "#000000")];
    relleno = o.tipo === "radial" ? { tipo: "radial", colores: par } : { tipo: "lineal", colores: par, angulo: Number.isFinite(Number(o.angulo)) ? Number(o.angulo) : 45 };
  }
  const m = (d.marco ?? {}) as Partial<Diseno["marco"]>;
  const margen = Number(d.margen);
  const tam = Number(d.tamanoCentro);
  return {
    modulo: una(d.modulo, FORMAS_ID, b.modulo),
    ojoMarco: una(d.ojoMarco, ["cuadrado", "redondeado", "circulo", "hoja"] as const, b.ojoMarco),
    ojoCentro: una(d.ojoCentro, ["cuadrado", "punto", "redondeado", "hoja"] as const, b.ojoCentro),
    color: relleno,
    colorOjos: d.colorOjos === undefined || d.colorOjos === null ? undefined : color(d.colorOjos, "#000000"),
    fondo: d.fondo === null ? null : color(d.fondo, "#ffffff"),
    margen: Number.isFinite(margen) ? Math.min(8, Math.max(2, Math.round(margen))) : b.margen,
    tema: d.tema === null || d.tema === undefined ? null : una(d.tema, TEMAS_ID, "plantas"),
    adornoCentro: d.adornoCentro === true,
    adornoBorde: d.adornoBorde === true,
    logo: typeof d.logo === "string" && LOGO.test(d.logo) ? d.logo : null,
    ...(Number.isFinite(tam) ? { tamanoCentro: tam } : {}),
    marco: { texto: typeof m.texto === "string" ? m.texto : "", color: color(m.color, b.marco.color), estilo: una(m.estilo, ["abajo", "burbuja", "ninguno"] as const, "ninguno") },
  };
}
