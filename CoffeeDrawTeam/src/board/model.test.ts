import { test } from "node:test";
import assert from "node:assert/strict";
import { agregar, actualizar, alFrente, borrar, crearTablero, listar, nuevoId, type Elemento } from "./model";

const nota = (id: string, z: number, texto = ""): Elemento => ({
  id, kind: "nota", x: 0, y: 0, w: 160, h: 160, z, autor: "yo", color: "amarillo", texto,
});

test("agregar y listar ordena por z", () => {
  const doc = crearTablero();
  agregar(doc, nota("b", 2), "yo");
  agregar(doc, nota("a", 1), "yo");
  agregar(doc, nota("c", 3), "yo");
  assert.deepEqual(listar(doc).map((e) => e.id), ["a", "b", "c"]);
});

test("actualizar texto de una nota", () => {
  const doc = crearTablero();
  agregar(doc, nota("a", 1, "hola"), "yo");
  actualizar(doc, "a", { texto: "Ideas" }, "yo");
  const [a] = listar(doc);
  assert.equal(a.kind === "nota" && a.texto, "Ideas");
  assert.equal(a.w, 160);
  assert.equal(a.z, 1);
});

test("borrar quita conectores colgantes", () => {
  const doc = crearTablero();
  agregar(doc, nota("A", 1), "yo");
  agregar(doc, nota("B", 2), "yo");
  agregar(doc, {
    id: "C", kind: "conector", x: 0, y: 0, w: 0, h: 0, z: 3, autor: "yo",
    desde: { id: "A" }, hasta: { id: "B" }, estilo: "recto", flecha: true, color: "#333",
  }, "yo");
  borrar(doc, ["A"], "yo");
  assert.deepEqual(listar(doc).map((e) => e.id), ["B"]);
});

test("alFrente pone el z más alto", () => {
  const doc = crearTablero();
  agregar(doc, nota("a", 1), "yo");
  agregar(doc, nota("b", 5), "yo");
  alFrente(doc, ["a"], "yo");
  assert.deepEqual(listar(doc).map((e) => e.id), ["b", "a"]);
});

test("nuevoId no se repite", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => nuevoId()));
  assert.equal(ids.size, 1000);
});

import * as Y from "yjs";
import { imagenesDe } from "./model";

test("dos personas escriben a la vez en la misma nota sin perder letras", () => {
  const a = crearTablero(), b = crearTablero();
  agregar(a, nota("n", 1, "hola"), "a");
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  actualizar(a, "n", { texto: "hola Ana" }, "a");
  actualizar(b, "n", { texto: "¡hola" }, "b");
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const [na] = listar(a), [nb] = listar(b);
  assert.equal(na.kind === "nota" && na.texto, "¡hola Ana");
  assert.equal(nb.kind === "nota" && nb.texto, "¡hola Ana");
});

test("borrar una imagen libera sus datos si nadie más la usa", () => {
  const doc = crearTablero();
  imagenesDe(doc).set("img", new Uint8Array([1]));
  const img = (id: string): Elemento => ({ id, kind: "imagen", imagenId: "img", x: 0, y: 0, w: 10, h: 10, z: 1, autor: "a" });
  agregar(doc, img("i1"), "a");
  agregar(doc, img("i2"), "a");
  borrar(doc, ["i1"], "a");
  assert.ok(imagenesDe(doc).has("img"));
  borrar(doc, ["i2"], "a");
  assert.ok(!imagenesDe(doc).has("img"));
});
