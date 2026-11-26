// Historial del tablero: quién hizo qué y cuándo. Vive en el documento Yjs, así todos ven lo mismo.

import type * as Y from "yjs";
import { historialDe, type Kind } from "./model";

export type Accion = "entro" | "salio" | "expulsado" | "agrego" | "edito" | "movio" | "borro" | "cambioLink";

export interface Entrada {
  personaId: string;
  accion: Accion;
  kind?: Kind;
  elementoId?: string;
  detalle?: string;
  t: number;
}

export const TOPE_HISTORIAL = 5000;
const AGRUPAR_MS = 30_000;

export function registrar(doc: Y.Doc, e: Entrada): void {
  const arr = historialDe(doc) as Y.Array<Entrada>;
  doc.transact(() => {
    const ultima = arr.length ? arr.get(arr.length - 1) : undefined;
    const agrupable = (e.accion === "edito" || e.accion === "movio") && ultima && ultima.personaId === e.personaId &&
      ultima.accion === e.accion && ultima.elementoId === e.elementoId && e.t - ultima.t < AGRUPAR_MS;
    if (agrupable) arr.delete(arr.length - 1, 1);
    arr.push([e]);
    if (arr.length > TOPE_HISTORIAL) arr.delete(0, arr.length - TOPE_HISTORIAL);
  });
}

/** Más reciente primero; opcionalmente solo de una persona. */
export function entradas(doc: Y.Doc, filtroPersona?: string): Entrada[] {
  const todas = (historialDe(doc) as Y.Array<Entrada>).toArray();
  return todas.filter((e) => !filtroPersona || e.personaId === filtroPersona).reverse();
}

const NOMBRE_KIND: Record<Kind, string> = {
  nota: "una nota",
  texto: "un texto",
  forma: "una forma",
  conector: "un conector",
  trazo: "un dibujo",
  imagen: "una imagen",
};

export function describir(e: Entrada, nombreDe: (id: string) => string): string {
  const quien = nombreDe(e.personaId);
  const que = e.kind ? NOMBRE_KIND[e.kind] : "algo";
  const detalle = e.detalle ? ` «${e.detalle}»` : "";
  switch (e.accion) {
    case "entro": return `${quien} entró al tablero`;
    case "salio": return `${quien} salió del tablero`;
    case "expulsado": return `${quien} fue expulsado del tablero`;
    case "cambioLink": return `${quien} cambió el link del tablero`;
    case "agrego": return `${quien} añadió ${que}${detalle}`;
    case "edito": return `${quien} editó ${que}${detalle}`;
    case "movio": return `${quien} movió ${que}${detalle}`;
    case "borro": return `${quien} borró ${que}${detalle}`;
  }
}
