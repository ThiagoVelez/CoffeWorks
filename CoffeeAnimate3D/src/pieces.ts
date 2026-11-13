// Piezas del complemento «Pack de piezas»: árboles, plantas, rocas, bloques y muebles
// con el estilo de SurvivalForest. `scripts/make-pieces.ts` las escribe en
// addons/coffee-ca3d-piezas (una prueba comprueba que estén al día).

import { addPart, newModel, paintPixels } from "./model";
import { FACES, TEX, type Model3D, type Shape, type Vec3 } from "./types";

interface Spec {
  name: string;
  parent?: string;
  pivot?: Vec3;
  from: Vec3;
  size: Vec3;
  color: string;
  shape?: Shape;
  /** Motas de otro color (corteza, hojas, piedra). */
  speckle?: string;
  /** Color distinto en la cara de arriba (hierba sobre tierra). */
  top?: [string, string];
}

/** Ruido determinista (sin Math.random) para las motas. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function build(name: string, specs: Spec[]): Model3D {
  let m = newModel(name);
  const ids = new Map<string, string>();
  specs.forEach((s, i) => {
    let id: string;
    [m, id] = addPart(m, { name: s.name, parent: s.parent ? ids.get(s.parent)! : null, pivot: s.pivot ?? [0, 0, 0], box: { from: s.from, size: s.size, color: s.color, shape: s.shape, faces: s.top ? { py: { color: s.top[0] } } : undefined } });
    ids.set(s.name, id);
    if (s.speckle) {
      const rand = rng(i * 7919 + name.length * 31 + 17);
      for (const f of FACES) {
        const pts: [number, number][] = [];
        for (let k = 0; k < 90; k++) pts.push([Math.floor(rand() * TEX), Math.floor(rand() * TEX)]);
        m = paintPixels(m, id, f, pts, f === "py" && s.top ? s.top[1] : s.speckle);
      }
    }
  });
  return m;
}

const tree = (trunk: string, bark: string, leaf: string, dots: string, height: number, crown: Vec3, crownShape: Shape = "box"): Spec[] => [
  { name: "tronco", from: [-2, 0, -2], size: [4, height, 4], color: trunk, speckle: bark },
  { name: "copa", parent: "tronco", pivot: [0, height, 0], from: [-crown[0] / 2, 0, -crown[2] / 2], size: crown, color: leaf, speckle: dots, shape: crownShape },
];

export const PIECES: { file: string; name: string; category: string; make: () => Model3D }[] = [
  { file: "roble.ca3d", name: "Roble", category: "Árboles", make: () => build("Roble", tree("#7a5233", "#5a3a22", "#3c8f45", "#2c6e3a", 20, [20, 14, 20])) },
  { file: "pino.ca3d", name: "Pino", category: "Árboles", make: () => build("Pino", [...tree("#5a3a22", "#3d2716", "#2c6e3a", "#1f5230", 10, [16, 10, 16]), { name: "punta", parent: "copa", pivot: [0, 10, 0], from: [-5, 0, -5], size: [10, 10, 10], color: "#2c6e3a", speckle: "#1f5230" }]) },
  { file: "palma.ca3d", name: "Palma de cera", category: "Árboles", make: () => build("Palma de cera", [{ name: "tronco", from: [-1.5, 0, -1.5], size: [3, 40, 3], color: "#c9b79a", speckle: "#9a9389", shape: "cylinder" }, { name: "hojas", parent: "tronco", pivot: [0, 40, 0], from: [-10, 0, -10], size: [20, 2, 20], color: "#3c8f45", shape: "plane" }]) },
  { file: "arbol-redondo.ca3d", name: "Árbol redondo", category: "Árboles", make: () => build("Árbol redondo", tree("#7a5233", "#5a3a22", "#6fb84a", "#3c8f45", 14, [18, 16, 18], "sphere")) },
  { file: "frailejon.ca3d", name: "Frailejón", category: "Plantas", make: () => build("Frailejón", [{ name: "tallo", from: [-2, 0, -2], size: [4, 14, 4], color: "#7e6a4f", speckle: "#5a4a3a", shape: "cylinder" }, { name: "roseta", parent: "tallo", pivot: [0, 14, 0], from: [-6, 0, -6], size: [12, 6, 12], color: "#b7c4a2", speckle: "#e8d49b", shape: "sphere" }]) },
  { file: "cafeto.ca3d", name: "Cafeto", category: "Plantas", make: () => build("Cafeto", [{ name: "tallo", from: [-1, 0, -1], size: [2, 8, 2], color: "#7a5233" }, { name: "hojas", parent: "tallo", pivot: [0, 6, 0], from: [-6, 0, -6], size: [12, 10, 12], color: "#2c6e3a", speckle: "#d23a3f" }]) },
  { file: "cactus.ca3d", name: "Cactus", category: "Plantas", make: () => build("Cactus", [{ name: "cuerpo", from: [-3, 0, -3], size: [6, 22, 6], color: "#3c8f45", speckle: "#e8d49b", shape: "cylinder" }, { name: "brazo izquierdo", parent: "cuerpo", pivot: [3, 10, 0], from: [0, 0, -2], size: [6, 4, 4], color: "#3c8f45" }, { name: "brazo derecho", parent: "cuerpo", pivot: [-3, 14, 0], from: [-6, 0, -2], size: [6, 4, 4], color: "#3c8f45" }]) },
  { file: "seta-roja.ca3d", name: "Seta roja", category: "Plantas", make: () => build("Seta roja", [{ name: "pie", from: [-1, 0, -1], size: [2, 5, 2], color: "#f3eee4", shape: "cylinder" }, { name: "sombrero", parent: "pie", pivot: [0, 5, 0], from: [-4, 0, -4], size: [8, 4, 8], color: "#d23a3f", speckle: "#f3eee4", shape: "sphere" }]) },
  { file: "seta-cafe.ca3d", name: "Seta café", category: "Plantas", make: () => build("Seta café", [{ name: "pie", from: [-1, 0, -1], size: [2, 4, 2], color: "#e8d49b", shape: "cylinder" }, { name: "sombrero", parent: "pie", pivot: [0, 4, 0], from: [-3, 0, -3], size: [6, 2, 6], color: "#7a5233", shape: "cylinder" }]) },
  { file: "flores.ca3d", name: "Flores", category: "Plantas", make: () => build("Flores", [{ name: "tallos", from: [-4, 0, -4], size: [8, 4, 8], color: "#3c8f45", shape: "plane" }, { name: "flor amarilla", pivot: [-2, 4, 1], from: [-1, 0, -1], size: [2, 2, 2], color: "#f2c230" }, { name: "flor roja", pivot: [2, 3, -2], from: [-1, 0, -1], size: [2, 2, 2], color: "#d23a3f" }]) },
  { file: "roca.ca3d", name: "Roca", category: "Rocas", make: () => build("Roca", [{ name: "roca", from: [-6, 0, -5], size: [12, 8, 10], color: "#9a9389", speckle: "#6f6a62" }, { name: "lasca", pivot: [3, 0, 3], from: [-3, 0, -3], size: [6, 5, 6], color: "#9a9389", speckle: "#6f6a62" }]) },
  { file: "canto-rodado.ca3d", name: "Canto rodado", category: "Rocas", make: () => build("Canto rodado", [{ name: "piedra", from: [-6, 0, -5], size: [12, 8, 10], color: "#9a9389", speckle: "#6f6a62", shape: "sphere" }]) },
  { file: "roca-roja.ca3d", name: "Roca de arena roja", category: "Rocas", make: () => build("Roca de arena roja", [{ name: "roca", from: [-7, 0, -6], size: [14, 10, 12], color: "#b5532f", speckle: "#7e3524" }, { name: "cima", pivot: [0, 10, 0], from: [-4, 0, -4], size: [8, 4, 8], color: "#c4583a", speckle: "#7e3524", shape: "ramp" }]) },
  { file: "bloque-hierba.ca3d", name: "Bloque de hierba", category: "Bloques", make: () => build("Bloque de hierba", [{ name: "bloque", from: [-8, 0, -8], size: [16, 16, 16], color: "#7a5233", speckle: "#5a3a22", top: ["#6fb84a", "#3c8f45"] }]) },
  { file: "bloque-piedra.ca3d", name: "Bloque de piedra", category: "Bloques", make: () => build("Bloque de piedra", [{ name: "bloque", from: [-8, 0, -8], size: [16, 16, 16], color: "#9a9389", speckle: "#6f6a62" }]) },
  { file: "bloque-arena.ca3d", name: "Bloque de arena roja", category: "Bloques", make: () => build("Bloque de arena roja", [{ name: "bloque", from: [-8, 0, -8], size: [16, 16, 16], color: "#d9824f", speckle: "#b5532f" }]) },
  { file: "bloque-nieve.ca3d", name: "Bloque de nieve", category: "Bloques", make: () => build("Bloque de nieve", [{ name: "bloque", from: [-8, 0, -8], size: [16, 16, 16], color: "#f3eee4", speckle: "#d8dde6" }]) },
  { file: "bloque-madera.ca3d", name: "Bloque de madera", category: "Bloques", make: () => build("Bloque de madera", [{ name: "bloque", from: [-8, 0, -8], size: [16, 16, 16], color: "#c98f62", speckle: "#7a5233" }]) },
  { file: "mesa.ca3d", name: "Mesa", category: "Muebles", make: () => build("Mesa", [{ name: "tablero", pivot: [0, 12, 0], from: [-10, 0, -7], size: [20, 2, 14], color: "#c98f62", speckle: "#7a5233" }, ...[[-8, -5], [8, -5], [-8, 5], [8, 5]].map(([x, z], i) => ({ name: `pata ${i + 1}`, parent: "tablero", pivot: [x, 0, z] as Vec3, from: [-1, -12, -1] as Vec3, size: [2, 12, 2] as Vec3, color: "#7a5233" }))]) },
  { file: "silla.ca3d", name: "Silla", category: "Muebles", make: () => build("Silla", [{ name: "asiento", pivot: [0, 7, 0], from: [-4, 0, -4], size: [8, 1, 8], color: "#c98f62" }, { name: "respaldo", parent: "asiento", pivot: [0, 1, -4], from: [-4, 0, 0], size: [8, 9, 1], color: "#c98f62" }, ...[[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([x, z], i) => ({ name: `pata ${i + 1}`, parent: "asiento", pivot: [x, 0, z] as Vec3, from: [-0.5, -7, -0.5] as Vec3, size: [1, 7, 1] as Vec3, color: "#7a5233" }))]) },
  { file: "cofre.ca3d", name: "Cofre", category: "Muebles", make: () => build("Cofre", [{ name: "caja", from: [-7, 0, -5], size: [14, 9, 10], color: "#7a5233", speckle: "#5a3a22" }, { name: "tapa", parent: "caja", pivot: [0, 9, -5], from: [-7, 0, 0], size: [14, 4, 10], color: "#7a5233" }, { name: "cerradura", parent: "caja", pivot: [0, 7, 5], from: [-1, -1, 0], size: [2, 2, 1], color: "#f2c230" }]) },
  { file: "lampara.ca3d", name: "Farol", category: "Muebles", make: () => build("Farol", [{ name: "poste", from: [-1, 0, -1], size: [2, 24, 2], color: "#2b2724", shape: "cylinder" }, { name: "luz", parent: "poste", pivot: [0, 24, 0], from: [-3, 0, -3], size: [6, 6, 6], color: "#f2c230", speckle: "#e8822f" }]) },
  { file: "cama.ca3d", name: "Cama", category: "Muebles", make: () => build("Cama", [{ name: "base", from: [-8, 0, -14], size: [16, 6, 28], color: "#7a5233" }, { name: "colchón", parent: "base", pivot: [0, 6, 0], from: [-7, 0, -13], size: [14, 3, 26], color: "#f3eee4" }, { name: "manta", parent: "colchón", pivot: [0, 3, 2], from: [-7.5, 0, -2], size: [15, 1, 13], color: "#2f6fb3" }]) },
];
