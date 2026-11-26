// Archivo .cdteam: cabecera, metadatos en JSON y el estado Yjs en base64.
//   CDTEAM1
//   {"nombre": …, "link": …, "personas": […]}
//   <estado Yjs en base64>

import * as Y from "yjs";
import { crearTablero } from "../board/model";
import type { Persona } from "../board/personas";
import type { Sala } from "../board/link";

export interface MetaTablero {
  nombre: string;
  link?: Sala;
  /** Llave secreta del anfitrión (firma sus respuestas); nunca va en el link. */
  secreto?: string;
  personas: Persona[];
}

const CABECERA = "CDTEAM1";
const DANADO = "Archivo de CoffeeDrawTeam dañado";

function aBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function deBase64(t: string): Uint8Array {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export function serializar(doc: Y.Doc, meta: MetaTablero): string {
  return `${CABECERA}\n${JSON.stringify(meta)}\n${aBase64(Y.encodeStateAsUpdate(doc))}`;
}

export function deserializar(texto: string): { doc: Y.Doc; meta: MetaTablero } {
  const [cabecera, metaTxt, estado] = texto.split("\n");
  if (cabecera?.trim() !== CABECERA || !metaTxt || estado === undefined) throw new Error(DANADO);
  try {
    const meta = JSON.parse(metaTxt) as MetaTablero;
    if (typeof meta?.nombre !== "string" || !Array.isArray(meta.personas)) throw new Error(DANADO);
    const doc = crearTablero();
    Y.applyUpdate(doc, deBase64(estado.trim()));
    return { doc, meta };
  } catch {
    throw new Error(DANADO);
  }
}
