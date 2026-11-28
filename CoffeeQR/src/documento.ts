// Documento .cqr: el contenido del QR y su diseño, en JSON. Se guarda en la Bóveda como las demás apps.
import { createDocStore } from "./studio/docStore";
import { vacio, type Contenido } from "./qr/contenido";
import { DISENO_BASE, type Diseno } from "./qr/dibujo";

export const APP_ID = "coffeeqr";
export const ACENTO = "#5f3dc4";

export interface DocQR {
  version: 1;
  contenido: Contenido;
  diseno: Diseno;
  /** Preferencias de descarga. */
  descarga: { px: number; cm: number; margenMm: number };
}

export const DESCARGA_BASE: DocQR["descarga"] = { px: 1024, cm: 4, margenMm: 10 };

export const docNuevo = (contenido: Contenido = vacio("enlace"), diseno: Diseno = DISENO_BASE): DocQR => ({
  version: 1,
  contenido,
  diseno: { ...diseno, marco: { ...diseno.marco } },
  descarga: { ...DESCARGA_BASE },
});

/** Lee un .cqr tolerando campos que falten (archivos de versiones anteriores o editados a mano). */
export function leerDoc(texto: string): DocQR {
  const j = JSON.parse(texto) as Partial<DocQR>;
  const contenido = j.contenido && typeof j.contenido === "object" && "tipo" in j.contenido ? { ...vacio(j.contenido.tipo), ...j.contenido } as Contenido : vacio("enlace");
  const diseno = { ...DISENO_BASE, ...(j.diseno ?? {}), marco: { ...DISENO_BASE.marco, ...(j.diseno?.marco ?? {}) } };
  return { version: 1, contenido, diseno, descarga: { ...DESCARGA_BASE, ...(j.descarga ?? {}) } };
}

export const store = createDocStore<DocQR>({
  appId: APP_ID,
  extension: "cqr",
  category: "Office",
  defaultTitle: "Mi código QR",
  kindLabel: "Código QR de CoffeeQR",
  serialize: (d) => JSON.stringify(d, null, 2),
  parse: leerDoc,
  create: () => docNuevo(),
});
