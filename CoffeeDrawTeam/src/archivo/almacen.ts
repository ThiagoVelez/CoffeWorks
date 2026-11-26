// Dónde se guardan los tableros propios, los tableros a los que me uní y mi id.

import type * as Y from "yjs";
import { createDocStore } from "../studio/docStore";
import { crearTablero } from "../board/model";
import type { Sala } from "../board/link";
import { deserializar, serializar, type MetaTablero } from "./formato";

export interface Archivo {
  doc: Y.Doc;
  meta: MetaTablero;
}

export const store = createDocStore<Archivo>({
  appId: "coffeedrawteam",
  extension: "cdteam",
  category: "Equipos",
  defaultTitle: "Tablero sin título",
  kindLabel: "Tableros de CoffeeDrawTeam",
  serialize: (a) => serializar(a.doc, a.meta),
  parse: (t) => deserializar(t),
  create: () => ({ doc: crearTablero(), meta: { nombre: "Tablero sin título", personas: [] } }),
});

export interface Unido {
  nombre: string;
  link: Sala;
  fecha: number;
}

const UNIDOS = "coffeedrawteam_unidos";
const MI_ID = "coffeedrawteam_id";

export function tablerosUnidos(): Unido[] {
  try {
    const l = JSON.parse(localStorage.getItem(UNIDOS) || "[]");
    return Array.isArray(l) ? l.filter((u) => u?.link?.sala && u?.link?.clave) : [];
  } catch {
    return [];
  }
}

export function recordarUnido(u: Unido): void {
  try {
    const resto = tablerosUnidos().filter((x) => x.link.sala !== u.link.sala);
    localStorage.setItem(UNIDOS, JSON.stringify([u, ...resto].slice(0, 20)));
  } catch {
    /* sin almacenamiento */
  }
}

/** Id fijo de esta instalación (para el historial de mis propios tableros). */
export function miId(): string {
  try {
    let id = localStorage.getItem(MI_ID);
    if (!id) {
      id = `p-${crypto.randomUUID().slice(0, 12)}`;
      localStorage.setItem(MI_ID, id);
    }
    return id;
  } catch {
    return "p-local";
  }
}
