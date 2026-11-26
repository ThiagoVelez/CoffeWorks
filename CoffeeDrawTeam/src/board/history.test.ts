import { test } from "node:test";
import assert from "node:assert/strict";
import { crearTablero } from "./model";
import { describir, entradas, registrar, TOPE_HISTORIAL } from "./history";

test("registrar agrupa ediciones en 30 s", () => {
  const doc = crearTablero();
  registrar(doc, { personaId: "s", accion: "edito", kind: "nota", elementoId: "n1", t: 0 });
  registrar(doc, { personaId: "s", accion: "edito", kind: "nota", elementoId: "n1", t: 29_000 });
  const e = entradas(doc);
  assert.equal(e.length, 1);
  assert.equal(e[0].t, 29_000);
  registrar(doc, { personaId: "s", accion: "edito", kind: "nota", elementoId: "n1", t: 60_000 });
  assert.equal(entradas(doc).length, 2);
});

test("no agrupa personas distintas", () => {
  const doc = crearTablero();
  registrar(doc, { personaId: "s", accion: "edito", elementoId: "n1", t: 0 });
  registrar(doc, { personaId: "m", accion: "edito", elementoId: "n1", t: 1000 });
  assert.equal(entradas(doc).length, 2);
});

test("tope de 5000 líneas descarta las más viejas", () => {
  const doc = crearTablero();
  for (let i = 0; i <= TOPE_HISTORIAL; i++) registrar(doc, { personaId: "s", accion: "agrego", elementoId: `e${i}`, t: i });
  const e = entradas(doc);
  assert.equal(TOPE_HISTORIAL, 5000);
  assert.equal(e.length, 5000);
  assert.equal(e[e.length - 1].elementoId, "e1");
  assert.equal(e[0].elementoId, "e5000");
});

test("filtra por persona", () => {
  const doc = crearTablero();
  registrar(doc, { personaId: "s", accion: "entro", t: 1 });
  registrar(doc, { personaId: "m", accion: "entro", t: 2 });
  assert.deepEqual(entradas(doc, "m").map((e) => e.personaId), ["m"]);
});

test("describir", () => {
  const nombre = (id: string) => (id === "s" ? "Sofía" : "?");
  assert.equal(describir({ personaId: "s", accion: "agrego", kind: "nota", detalle: "Ideas", t: 0 }, nombre), "Sofía añadió una nota «Ideas»");
  assert.equal(describir({ personaId: "s", accion: "entro", t: 0 }, nombre), "Sofía entró al tablero");
  assert.equal(describir({ personaId: "s", accion: "borro", kind: "imagen", t: 0 }, nombre), "Sofía borró una imagen");
});
