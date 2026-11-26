// Mensajes entre anfitrión e invitados: un byte de tipo y el cuerpo.

export const TIPO = {
  SYNC: 1,
  PRESENCIA: 2,
  HOLA: 3,
  ROSTER: 4,
  EXPULSADO: 5,
  LLENO: 6,
  CERRADO: 7,
  NUEVA_SALA: 8,
} as const;
export type Tipo = (typeof TIPO)[keyof typeof TIPO];

const VALIDOS = new Set<number>(Object.values(TIPO));
const texto = new TextEncoder();
const lector = new TextDecoder();

export function codificar(tipo: Tipo, cuerpo: Uint8Array | unknown = new Uint8Array()): Uint8Array {
  const bytes = cuerpo instanceof Uint8Array ? cuerpo : texto.encode(JSON.stringify(cuerpo));
  const out = new Uint8Array(bytes.length + 1);
  out[0] = tipo;
  out.set(bytes, 1);
  return out;
}

export function decodificar(bytes: Uint8Array): { tipo: Tipo; cuerpo: Uint8Array } | null {
  if (!(bytes instanceof Uint8Array) || bytes.length < 1 || !VALIDOS.has(bytes[0])) return null;
  return { tipo: bytes[0] as Tipo, cuerpo: bytes.subarray(1) };
}

/** JSON del cuerpo, o null si no es JSON válido. */
export function json<T>(cuerpo: Uint8Array): T | null {
  try {
    return JSON.parse(lector.decode(cuerpo)) as T;
  } catch {
    return null;
  }
}
