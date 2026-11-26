// Modelo del tablero de CoffeeDrawTeam sobre un documento Yjs.
// Cada elemento es un Y.Map (una clave por propiedad), así dos personas que cambian
// propiedades distintas del mismo elemento a la vez no se pisan.

import * as Y from "yjs";

export type NotaColor = "amarillo" | "rosa" | "verde" | "azul" | "naranja" | "lila";

export const NOTA_COLORES: Record<NotaColor, string> = {
  amarillo: "#fff3a3",
  rosa: "#ffc9de",
  verde: "#c8f2c2",
  azul: "#c4e2ff",
  naranja: "#ffd6a8",
  lila: "#e0d2ff",
};

interface Base {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** id de la persona que lo creó */
  autor: string;
}

export type Extremo = { id: string } | { x: number; y: number };

export interface Nota extends Base { kind: "nota"; color: NotaColor; texto: string }
export interface Texto extends Base { kind: "texto"; texto: string; tam: number; negrita: boolean; color: string }
export interface Forma extends Base {
  kind: "forma";
  forma: "rect" | "elipse" | "rombo" | "flecha";
  relleno: string;
  borde: string;
  texto: string;
}
export interface Conector extends Base {
  kind: "conector";
  desde: Extremo;
  hasta: Extremo;
  estilo: "recto" | "codo";
  flecha: boolean;
  color: string;
}
export interface Trazo extends Base { kind: "trazo"; puntos: number[]; grosor: number; color: string; marcador: boolean }
export interface Imagen extends Base { kind: "imagen"; imagenId: string }

export type Elemento = Nota | Texto | Forma | Conector | Trazo | Imagen;
export type Kind = Elemento["kind"];

export const elementosDe = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("elementos");
export const imagenesDe = (doc: Y.Doc) => doc.getMap<Uint8Array>("imagenes");
export const historialDe = (doc: Y.Doc) => doc.getArray<unknown>("historial");
export const metaDe = (doc: Y.Doc) => doc.getMap<unknown>("meta");

export function crearTablero(): Y.Doc {
  const doc = new Y.Doc();
  elementosDe(doc);
  imagenesDe(doc);
  historialDe(doc);
  metaDe(doc);
  return doc;
}

export function nuevoId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}

export function leerElemento(m: Y.Map<unknown>): Elemento {
  return m.toJSON() as Elemento;
}

export function obtener(doc: Y.Doc, id: string): Elemento | undefined {
  const m = elementosDe(doc).get(id);
  return m ? leerElemento(m) : undefined;
}

export function agregar(doc: Y.Doc, el: Elemento, origen: unknown): void {
  doc.transact(() => {
    const m = new Y.Map<unknown>();
    for (const [k, v] of Object.entries(el)) m.set(k, v);
    elementosDe(doc).set(el.id, m);
  }, origen);
}

export function actualizar(doc: Y.Doc, id: string, cambios: Partial<Elemento>, origen: unknown): void {
  const m = elementosDe(doc).get(id);
  if (!m) return;
  doc.transact(() => {
    for (const [k, v] of Object.entries(cambios)) {
      if (k === "id" || k === "kind") continue;
      if (m.get(k) !== v) m.set(k, v);
    }
  }, origen);
}

export function borrar(doc: Y.Doc, ids: string[], origen: unknown): void {
  const quitar = new Set(ids);
  const mapa = elementosDe(doc);
  // Conectores enganchados a lo que se borra
  mapa.forEach((m, id) => {
    if (m.get("kind") !== "conector") return;
    const d = m.get("desde") as Extremo, h = m.get("hasta") as Extremo;
    if (("id" in d && quitar.has(d.id)) || ("id" in h && quitar.has(h.id))) quitar.add(id);
  });
  doc.transact(() => {
    for (const id of quitar) mapa.delete(id);
  }, origen);
}

export function listar(doc: Y.Doc): Elemento[] {
  const out: Elemento[] = [];
  elementosDe(doc).forEach((m) => out.push(leerElemento(m)));
  return out.sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1));
}

export function zMaximo(doc: Y.Doc): number {
  let z = 0;
  elementosDe(doc).forEach((m) => { z = Math.max(z, (m.get("z") as number) ?? 0); });
  return z;
}

export function alFrente(doc: Y.Doc, ids: string[], origen: unknown): void {
  let z = zMaximo(doc);
  const orden = listar(doc).filter((e) => ids.includes(e.id));
  doc.transact(() => {
    for (const e of orden) elementosDe(doc).get(e.id)?.set("z", ++z);
  }, origen);
}

/** Centro de un elemento o el punto suelto de un extremo de conector. */
export function extremoPos(doc: Y.Doc, e: Extremo): { x: number; y: number } {
  if ("id" in e) {
    const el = obtener(doc, e.id);
    return el ? { x: el.x + el.w / 2, y: el.y + el.h / 2 } : { x: 0, y: 0 };
  }
  return { x: e.x, y: e.y };
}
