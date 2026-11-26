// Links para compartir un tablero: coffeedrawteam://unirse/<sala>#<clave>

export interface Sala {
  sala: string;
  clave: string;
}

const ESQUEMA = "coffeedrawteam://unirse/";

function aleatorio128(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function crearSala(): Sala {
  return { sala: aleatorio128(), clave: aleatorio128() };
}

export function aLink(s: Sala): string {
  return `${ESQUEMA}${s.sala}#${s.clave}`;
}

/** Encuentra el link dentro de un texto (por ejemplo, un mensaje de WhatsApp pegado). */
export function leerLink(texto: string): Sala | null {
  const m = /coffeedrawteam:\/\/unirse\/([A-Za-z0-9_-]{22})#([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/.exec(texto);
  return m ? { sala: m[1], clave: m[2] } : null;
}
