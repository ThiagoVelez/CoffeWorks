// Modelo de CoffeeAnimate3D: piezas de cubo en jerarquía (cada pieza es también un
// hueso), texturas de 32×32 por cara y animaciones por fotogramas clave.
// Unidades: 16 unidades = 1 bloque (al exportar a glTF se divide entre 16).

export const TEX = 32;
export const UNITS_PER_BLOCK = 16;
export const ACCENT = "#ff8a3d";
export const ACCENT_DARK = "#c2410c";

export type Vec3 = [number, number, number];
export type FaceName = "px" | "nx" | "py" | "ny" | "pz" | "nz";
export const FACES: FaceName[] = ["px", "nx", "py", "ny", "pz", "nz"];
export const FACE_LABEL: Record<FaceName, string> = {
  px: "Derecha (+X)",
  nx: "Izquierda (−X)",
  py: "Arriba (+Y)",
  ny: "Abajo (−Y)",
  pz: "Delante (+Z)",
  nz: "Detrás (−Z)",
};

export interface FaceTex {
  /** Color base de la cara (#rrggbb). */
  color: string;
  /** Píxeles pintados: TEX×TEX en RGBA, en base64. Sin píxeles, la cara es del color base. */
  pixels?: string;
}

export interface Box {
  /** Esquina mínima relativa al pivote de la pieza. */
  from: Vec3;
  size: Vec3;
  faces: Record<FaceName, FaceTex>;
}

export interface Part {
  id: string;
  name: string;
  parent: string | null;
  /** Pivote (centro de giro) relativo al pivote del padre. */
  pivot: Vec3;
  /** Rotación de reposo en grados (orden XYZ). */
  rotation: Vec3;
  box: Box | null;
  visible: boolean;
}

export type Ease = "linear" | "smooth" | "step";

export interface Keyframe {
  /** Segundos. */
  t: number;
  /** Desplazamiento respecto al reposo. */
  pos: Vec3;
  /** Grados que se suman a la rotación de reposo. */
  rot: Vec3;
  scale: Vec3;
  ease: Ease;
}

export interface Animation {
  id: string;
  name: string;
  /** Duración en segundos. */
  length: number;
  loop: boolean;
  /** Fotogramas clave por pieza, ordenados por tiempo. */
  tracks: Record<string, Keyframe[]>;
}

export interface Model3D {
  version: 1;
  name: string;
  parts: Part[];
  animations: Animation[];
}

export interface Pose {
  pos: Vec3;
  rot: Vec3;
  scale: Vec3;
}
