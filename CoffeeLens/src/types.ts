// Modelo de datos de CoffeeLens: un catálogo de fotografías con sus ajustes
// de revelado (no destructivos: el original nunca se modifica).

export interface Crop {
  /** Fracciones (0-1) de la imagen original. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Enderezar (grados). */
  angle: number;
}

export interface Edits {
  temp: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  texture: number;
  clarity: number;
  dehaze: number;
  vibrance: number;
  saturation: number;
  /** Curva de tonos: [x0, y0, x1, y1…] de 0 a 255. */
  curve: number[];
  /** Tono, saturación y luminancia de 8 gamas: rojo, naranja, amarillo, verde, aguamarina, azul, morado, magenta. */
  hslHue: number[];
  hslSat: number[];
  hslLum: number[];
  /** Virado: color de sombras y de luces. */
  splitShadowHue: number;
  splitShadowSat: number;
  splitHighlightHue: number;
  splitHighlightSat: number;
  sharpen: number;
  noise: number;
  vignette: number;
  grain: number;
  bw: boolean;
  crop: Crop | null;
  rotate: 0 | 90 | 180 | 270;
  flip: boolean;
}

export interface PhotoExif {
  camera?: string;
  lens?: string;
  iso?: number;
  shutter?: string;
  aperture?: string;
  focal?: string;
  date?: string;
  orientation?: number;
}

export interface Photo {
  id: string;
  name: string;
  /** Ruta en disco (escritorio) o imagen incrustada (navegador). */
  path: string | null;
  data: string | null;
  thumb: string;
  /** Miniatura con los ajustes aplicados. */
  preview?: string;
  width: number;
  height: number;
  added: number;
  rating: number;
  flag: "pick" | "reject" | null;
  label: string | null;
  keywords: string[];
  caption: string;
  exif: PhotoExif;
  edits: Edits;
}

export interface Collection {
  id: string;
  name: string;
  photos: string[];
}

export interface Preset {
  id: string;
  name: string;
  group: string;
  edits: Partial<Edits>;
}

export interface Catalog {
  version: 1;
  photos: Photo[];
  collections: Collection[];
  presets: Preset[];
}

export const ACCENT = "#d9480f";
export const ACCENT_DARK = "#a83608";

export const LABELS: Array<{ id: string; color: string; name: string }> = [
  { id: "red", color: "#e03131", name: "Rojo" },
  { id: "yellow", color: "#f59f00", name: "Amarillo" },
  { id: "green", color: "#37b24d", name: "Verde" },
  { id: "blue", color: "#1c7ed6", name: "Azul" },
  { id: "purple", color: "#9c36b5", name: "Morado" },
];
