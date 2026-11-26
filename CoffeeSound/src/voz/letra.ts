// La letra: líneas con su tiempo, filtro de lo que Whisper inventa en silencios, y archivos
// .txt y .lrc (letra con tiempos que usan los reproductores de karaoke).

export interface LineaLetra {
  ini: number;
  fin: number;
  texto: string;
  dudas: { ini: number; fin: number; prob: number }[];
}

/** Frases que Whisper suele inventar en silencios o música sin voz. */
const INVENTOS = [
  /gracias por ver/i,
  /subt[ií]tulos? (realizados|por|hechos)/i,
  /amara\.org/i,
  /suscr[ií]bete/i,
  /thanks? (you )?for watching/i,
  /subtitles by/i,
  /^\W*(m[uú]sica|music|aplausos|applause)\W*$/i,
];

export function esAlucinacion(texto: string, probMedia: number): boolean {
  const t = texto.trim();
  if (!t || probMedia < 0.35) return true;
  if (INVENTOS.some((r) => r.test(t))) return true;
  const palabras = t.toLowerCase().split(/\s+/).map((p) => p.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  let repet = 1;
  for (let i = 1; i < palabras.length; i++) {
    repet = palabras[i] === palabras[i - 1] ? repet + 1 : 1;
    if (repet >= 4) return true;
  }
  return false;
}

const tiempo = (s: number) => {
  const cs = Math.round(Math.max(0, s) * 100);
  const mm = Math.floor(cs / 6000), ss = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
};

/** Tiempo corto para la pantalla: «1:05». */
export const tiempoCorto = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function aTxt(lineas: LineaLetra[]): string {
  return lineas.map((l) => l.texto.trim()).filter(Boolean).map((t) => `${t}\n`).join("");
}

export function aLrc(lineas: LineaLetra[], titulo?: string): string {
  const cab = titulo ? `[ti:${titulo}]\n` : "";
  return cab + lineas.filter((l) => l.texto.trim()).map((l) => `[${tiempo(l.ini)}]${l.texto.trim()}\n`).join("");
}
