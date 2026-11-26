// Links para compartir un tablero: coffeedrawteam://unirse/<sala>#<clave>

export interface Sala {
  sala: string;
  clave: string;
  /** Llave pública del anfitrión: los invitados solo aceptan respuestas firmadas con ella. */
  llave?: string;
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
  return `${ESQUEMA}${s.sala}#${s.clave}${s.llave ? `.${s.llave}` : ""}`;
}

const B64 = /[A-Za-z0-9_-]/;

/**
 * Encuentra el link dentro de un texto (por ejemplo, un mensaje de WhatsApp pegado).
 * Tolera espacios o saltos de línea dentro del link, «%23» en vez de «#» y mayúsculas en el esquema.
 */
export function leerLink(texto: string): Sala | null {
  const ini = /coffeedrawteam:\/\/unirse\//i.exec(texto);
  if (!ini) return null;
  const resto = texto.slice(ini.index + ini[0].length).replace(/%23/gi, "#");
  let i = 0;
  const saltarEspacios = () => { while (i < resto.length && /\s/.test(resto[i])) i++; };
  const leer = (n: number) => {
    let out = "";
    while (out.length < n && i < resto.length) {
      if (/\s/.test(resto[i])) { i++; continue; }
      if (!B64.test(resto[i])) break;
      out += resto[i++];
    }
    return out;
  };
  const sala = leer(22);
  saltarEspacios();
  if (sala.length !== 22 || resto[i] !== "#") return null;
  i++;
  const clave = leer(22);
  if (clave.length !== 22 || B64.test(resto[i] ?? "")) return null;
  const antes = i;
  saltarEspacios();
  if (resto[i] === ".") {
    i++;
    const llave = leer(43);
    if (llave.length === 43 && !B64.test(resto[i] ?? "")) return { sala, clave, llave };
  }
  i = antes;
  return { sala, clave };
}
