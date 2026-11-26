import { test } from "node:test";
import assert from "node:assert/strict";
import { crearTablero, listar } from "./model";
import { aplicarPlantilla, PLANTILLAS } from "./templates";

const textos = (id: Parameters<typeof aplicarPlantilla>[1]) => {
  const doc = crearTablero();
  aplicarPlantilla(doc, id, "yo");
  const els = listar(doc);
  return { els, textos: els.map((e) => ("texto" in e ? e.texto : "")) };
};

test("cada plantilla crea elementos", () => {
  assert.equal(PLANTILLAS.length, 5);
  assert.equal(textos("blanco").els.length, 0);

  const lluvia = textos("lluvia").els;
  assert.ok(lluvia.filter((e) => e.kind === "nota").length >= 7);

  const kanban = textos("kanban");
  for (const t of ["Por hacer", "Haciendo", "Hecho"]) assert.ok(kanban.textos.includes(t), t);
  assert.equal(kanban.els.filter((e) => e.kind === "forma").length, 3);

  const pc = textos("proscontras").textos;
  assert.ok(pc.includes("Pros") && pc.includes("Contras"));

  const mapa = textos("mapa").els;
  assert.ok(mapa.some((e) => e.kind === "forma"));
  assert.ok(mapa.some((e) => e.kind === "conector"));
});
