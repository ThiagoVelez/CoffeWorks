// Catálogo de juegos de CoffeeWorks Games.
//
// Cada juego es un programa nativo (Rust) que se descarga aparte desde la
// sección Games, nunca dentro del instalador de la suite. Cada juego tiene
// tres tipos de contenido adicional:
// - Mods: módulos WebAssembly que el juego ejecuta aislados.
// - TexturePacks: paquetes .zip con imágenes que sustituyen a las del juego.
// - Shaders: efectos gráficos WGSL que el juego carga sin recompilarse.

export type GameContentKind = "mods" | "texturepacks" | "shaders";

export interface GameContent {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  /** Versión mínima del juego con la que funciona. */
  gameVersion: string;
  size: string;
  download: string;
}

export interface GameEntry {
  id: string;
  name: string;
  tagline: string;
  description: string;
  genre: string;
  version: string;
  size: string;
  /** Degradado de la portada (se ve mientras carga la imagen). */
  cover: [string, string];
  /** Imagen de portada (captura del juego). */
  image?: string;
  /** Lo más destacado, en frases cortas. */
  features: string[];
  download: string;
  /** Contenido adicional por tipo. */
  content: Record<GameContentKind, GameContent[]>;
}

/** Juegos publicados. La versión y el tamaño reales los da el manifiesto de cada juego. */
export const GAMES: GameEntry[] = [
  {
    id: "survivalforest",
    name: "SurvivalForest",
    tagline: "Supervivencia y construcción en un mundo de bloques gigante",
    description:
      "Explora un mundo procedural prácticamente infinito, con montañas cafeteras, páramos con frailejones, selvas, desiertos rojos y nevados. Construye, cava cuevas y mira pasar el día y la noche. En desarrollo: llegan vida, hambre, crafteo, criaturas, clima y multijugador por LAN.",
    genre: "Supervivencia",
    version: "0.1.0",
    size: "~45 MB",
    cover: ["#3c8f45", "#b5532f"],
    image: "/games/survivalforest.jpg",
    download: "https://github.com/ThiagoVelez/juego-rust/releases/latest",
    features: [
      "Mundo procedural con 11 biomas, cuevas y menas",
      "Modos supervivencia y creativo",
      "Ciclo de día y noche con estrellas y nubes",
      "Texturas propias de 32×32",
    ],
    content: { mods: [], texturepacks: [], shaders: [] },
  },
];

export const CONTENT_INFO: Record<GameContentKind, { label: string; description: string; detail: string }> = {
  mods: {
    label: "Mods",
    description: "Cambian o amplían cómo se juega: nuevos objetos, niveles, reglas o mecánicas.",
    detail: "Se ejecutan aislados (WebAssembly): solo pueden usar lo que el juego les permite y nunca tocan tus archivos.",
  },
  texturepacks: {
    label: "TexturePacks",
    description: "Cambian el aspecto del juego: bloques, personajes, objetos e interfaz.",
    detail: "Son paquetes de imágenes; no ejecutan nada, así que son totalmente seguros.",
  },
  shaders: {
    label: "Shaders",
    description: "Efectos gráficos: iluminación, sombras, reflejos, agua y filtros de color.",
    detail: "Programas gráficos WGSL que el juego carga sin recompilarse; puedes activarlos y desactivarlos.",
  },
};
