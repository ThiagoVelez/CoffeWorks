// Modelo de CoffeePuppet (.cpup): personaje, escena, ajustes del seguimiento
// y tomas grabadas (parámetros por fotograma + voz).

/** Parámetros del títere en un instante (valores normalizados). */
export interface Rig {
  /** Desplazamiento de la cabeza (−1..1). */
  headX: number;
  headY: number;
  /** Inclinación lateral (grados). */
  tilt: number;
  /** Giro izquierda/derecha (−1..1). */
  turn: number;
  /** Cabeceo arriba/abajo (−1..1). */
  nod: number;
  /** Apertura de cada ojo (0..1). Izquierda/derecha según se ven en pantalla. */
  eyeL: number;
  eyeR: number;
  /** Dirección de la mirada (−1..1). */
  lookX: number;
  lookY: number;
  /** Cejas (−1 fruncidas .. 1 levantadas). */
  browL: number;
  browR: number;
  /** Boca: apertura (0..1) y sonrisa (−1 triste .. 1 sonrisa). */
  mouthOpen: number;
  smile: number;
  /** Posición del personaje en la escena (−1..1). */
  bodyX: number;
}

export const NEUTRAL: Rig = { headX: 0, headY: 0, tilt: 0, turn: 0, nod: 0, eyeL: 1, eyeR: 1, lookX: 0, lookY: 0, browL: 0, browR: 0, mouthOpen: 0, smile: 0.15, bodyX: 0 };

export type Trigger = "wave" | "jump" | "surprise" | "hearts" | "sad" | "angry" | "thumbs" | "laugh" | "sleep";

export const TRIGGERS: { id: Trigger; key: string; label: string; emoji: string }[] = [
  { id: "wave", key: "1", label: "Saludar", emoji: "👋" },
  { id: "jump", key: "2", label: "Saltar", emoji: "⤴️" },
  { id: "surprise", key: "3", label: "Sorpresa", emoji: "😮" },
  { id: "hearts", key: "4", label: "Corazones", emoji: "💖" },
  { id: "laugh", key: "5", label: "Reír", emoji: "😂" },
  { id: "thumbs", key: "6", label: "Pulgar arriba", emoji: "👍" },
  { id: "sad", key: "7", label: "Tristeza", emoji: "😢" },
  { id: "angry", key: "8", label: "Enfado", emoji: "😠" },
  { id: "sleep", key: "9", label: "Dormir", emoji: "😴" },
];

export const TRIGGER_DURATION = 1.6;

export interface Character {
  name: string;
  style: "coffee" | "person" | "robot" | "cat";
  /** Color principal (piel, taza, metal, pelaje). */
  skin: string;
  hair: string;
  hairStyle: "short" | "long" | "curly" | "bun" | "bald";
  eyes: string;
  shirt: string;
  accessory: "none" | "glasses" | "hat" | "bow" | "headphones" | "crown";
  cheeks: boolean;
}

export interface Scene {
  width: number;
  height: number;
  background: string;
  background2: string;
  gradient: boolean;
  image: string | null;
  /** Escala del personaje. */
  scale: number;
  /** Altura del suelo (0..1). */
  floor: number;
}

export interface TakeFrame {
  t: number;
  r: number[];
}

export interface Take {
  id: string;
  name: string;
  duration: number;
  /** Parámetros comprimidos: orden de RIG_KEYS. */
  frames: TakeFrame[];
  events: { t: number; trigger: Trigger }[];
  /** Voz grabada (data: URL). */
  audio: string | null;
  createdAt: number;
}

export const RIG_KEYS: (keyof Rig)[] = ["headX", "headY", "tilt", "turn", "nod", "eyeL", "eyeR", "lookX", "lookY", "browL", "browR", "mouthOpen", "smile", "bodyX"];

export interface Settings {
  /** 0 = sin suavizado, 0.9 = muy suave. */
  smoothing: number;
  /** Mover la boca con el micrófono. */
  lipSync: boolean;
  /** Sensibilidad del micrófono. */
  micGain: number;
  /** La cabeza sigue al ratón si no hay cámara. */
  mouseFollow: boolean;
  /** Parpadeo automático si no hay cámara. */
  autoBlink: boolean;
  /** Exagerar las expresiones. */
  expressiveness: number;
}

export interface PuppetDoc {
  version: 1;
  character: Character;
  scene: Scene;
  settings: Settings;
  takes: Take[];
}

export const ACCENT = "#d6336c";
export const ACCENT_DARK = "#a61e4d";
