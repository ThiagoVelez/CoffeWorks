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
