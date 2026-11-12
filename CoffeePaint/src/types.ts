// Modelo de datos de CoffeePaint: un lienzo con papel de fondo y capas de
// píxeles (cada una es una ficha del almacén de píxeles).

export type Blend = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "soft-light" | "hard-light" | "difference" | "color" | "luminosity";

export interface PaintLayer {
  id: string;
  name: string;
  data: string;
  visible: boolean;
  opacity: number;
  blend: Blend;
  locked: boolean;
  /** Bloquear transparencia: solo se pinta sobre lo que ya hay. */
  alphaLock: boolean;
}

export type Paper = "smooth" | "sketch" | "watercolor" | "canvas";

export interface PaintDoc {
  version: 1;
  width: number;
  height: number;
  paperColor: string;
  paper: Paper;
  layers: PaintLayer[];
  activeId: string;
}

export type Tool = "brush" | "smudge" | "eraser" | "fill" | "eyedropper" | "move" | "hand";

export type Symmetry = "none" | "vertical" | "horizontal" | "quad" | "radial";

export const ACCENT = "#e64980";
export const ACCENT_DARK = "#b8325f";
