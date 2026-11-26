// Plantillas para empezar un tablero (lluvia de ideas, mapa mental, pros y contras, Kanban).

import type * as Y from "yjs";
import { agregar, nuevoId, type Elemento, type NotaColor } from "./model";

export type PlantillaId = "blanco" | "lluvia" | "mapa" | "proscontras" | "kanban";

export const PLANTILLAS: { id: PlantillaId; nombre: string; descripcion: string }[] = [
  { id: "blanco", nombre: "En blanco", descripcion: "Un tablero vacío" },
  { id: "lluvia", nombre: "Lluvia de ideas", descripcion: "Una idea central y notas alrededor" },
  { id: "mapa", nombre: "Mapa mental", descripcion: "Tema central con ramas" },
  { id: "proscontras", nombre: "Pros y contras", descripcion: "Dos columnas para comparar" },
  { id: "kanban", nombre: "Kanban", descripcion: "Por hacer, haciendo y hecho" },
];

export function aplicarPlantilla(doc: Y.Doc, id: PlantillaId, autor: string): void {
  let z = 0;
  const els: Elemento[] = [];
  const nota = (x: number, y: number, texto: string, color: NotaColor, w = 180, h = 140) => {
    const e: Elemento = { id: nuevoId(), kind: "nota", x, y, w, h, z: ++z, autor, color, texto };
    els.push(e);
    return e;
  };
  const forma = (x: number, y: number, w: number, h: number, texto: string, f: "rect" | "elipse" = "rect", relleno = "#ffffff") => {
    const e: Elemento = { id: nuevoId(), kind: "forma", forma: f, x, y, w, h, z: ++z, autor, relleno, borde: "#6f4e37", texto };
    els.push(e);
    return e;
  };
  const texto = (x: number, y: number, t: string, tam = 28) => {
    els.push({ id: nuevoId(), kind: "texto", x, y, w: 240, h: tam * 1.5, z: ++z, autor, texto: t, tam, negrita: true, color: "#2c1b12" });
  };
  const conector = (a: Elemento, b: Elemento) => {
    els.push({ id: nuevoId(), kind: "conector", x: 0, y: 0, w: 0, h: 0, z: ++z, autor, desde: { id: a.id }, hasta: { id: b.id }, estilo: "recto", flecha: false, color: "#6f4e37" });
  };

  switch (id) {
    case "blanco":
      break;
    case "lluvia": {
      nota(-110, -90, "Tema de la lluvia de ideas", "naranja", 220, 180);
      const colores: NotaColor[] = ["amarillo", "rosa", "verde", "azul", "lila", "amarillo"];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        nota(Math.cos(ang) * 330 - 90, Math.sin(ang) * 250 - 70, "Idea", colores[i]);
      }
      break;
    }
    case "mapa": {
      const centro = forma(-130, -60, 260, 120, "Tema central", "elipse", "#ffd6a8");
      const ramas = ["Idea 1", "Idea 2", "Idea 3", "Idea 4"];
      ramas.forEach((t, i) => {
        const ang = (i / ramas.length) * Math.PI * 2 + Math.PI / 4;
        const r = forma(Math.cos(ang) * 360 - 90, Math.sin(ang) * 240 - 35, 180, 70, t);
        conector(centro, r);
      });
      break;
    }
    case "proscontras":
      texto(-380, -260, "Pros");
      texto(60, -260, "Contras");
      for (let i = 0; i < 3; i++) {
        nota(-380, -190 + i * 160, "", "verde");
        nota(60, -190 + i * 160, "", "rosa");
      }
      break;
    case "kanban":
      ["Por hacer", "Haciendo", "Hecho"].forEach((t, i) => forma(-480 + i * 330, -300, 300, 600, t, "rect", "#faf7f2"));
      nota(-460, -220, "Primera tarea", "amarillo", 260, 110);
      break;
  }
  doc.transact(() => {
    for (const e of els) agregar(doc, e, autor);
  }, autor);
}
