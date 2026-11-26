import { test } from "node:test";
import assert from "node:assert/strict";
import { agregar, actualizar, crearTablero, type Conector, type Elemento } from "../board/model";
import { rutaConector } from "./conectores";

const caja = (id: string, x: number, y: number): Elemento => ({ id, kind: "forma", forma: "rect", x, y, w: 100, h: 100, z: 1, autor: "a", relleno: "#fff", borde: "#000", texto: "" });
const con = (estilo: "recto" | "codo"): Conector => ({ id: "c", kind: "conector", x: 0, y: 0, w: 0, h: 0, z: 2, autor: "a", desde: { id: "A" }, hasta: { id: "B" }, estilo, flecha: true, color: "#000" });

function tablero() {
  const doc = crearTablero();
  agregar(doc, caja("A", 0, 0), "a");
  agregar(doc, caja("B", 300, 0), "a");
  return doc;
}

test("conector recto sale del borde, no del centro", () => {
  assert.deepEqual(rutaConector(tablero(), con("recto")).puntos, [100, 50, 300, 50]);
});

test("conector sigue al elemento movido", () => {
  const doc = tablero();
  const antes = rutaConector(doc, con("recto")).puntos;
  actualizar(doc, "B", { y: 300 }, "a");
  const despues = rutaConector(doc, con("recto")).puntos;
  assert.notDeepEqual(antes, despues);
  assert.equal(despues[3], 300);
});

test("conector en codo es ortogonal", () => {
  const doc = tablero();
  actualizar(doc, "B", { y: 200 }, "a");
  const p = rutaConector(doc, con("codo")).puntos;
  assert.equal(p.length, 8);
  for (let i = 0; i < p.length - 2; i += 2) assert.ok(p[i] === p[i + 2] || p[i + 1] === p[i + 3], `tramo ${i / 2} no es recto`);
});

test("conector con extremo suelto", () => {
  const doc = tablero();
  const c = { ...con("recto"), hasta: { x: 500, y: 50 } };
  assert.deepEqual(rutaConector(doc, c).puntos, [100, 50, 500, 50]);
});
