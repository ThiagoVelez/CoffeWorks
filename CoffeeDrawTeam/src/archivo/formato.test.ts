import { test } from "node:test";
import assert from "node:assert/strict";
import { agregar, crearTablero, imagenesDe, listar } from "../board/model";
import { entradas, registrar } from "../board/history";
import { deserializar, serializar } from "./formato";

function ejemplo() {
  const doc = crearTablero();
  agregar(doc, { id: "n", kind: "nota", x: 1, y: 2, w: 100, h: 90, z: 1, autor: "a", color: "rosa", texto: "Ideas ñ ☕" }, "a");
  imagenesDe(doc).set("img", new Uint8Array([1, 2, 3, 250]));
  registrar(doc, { personaId: "a", accion: "agrego", kind: "nota", elementoId: "n", t: 5 });
  return doc;
}

test("serializar y deserializar ida y vuelta", () => {
  const texto = serializar(ejemplo(), { nombre: "Feria", personas: [] });
  const { doc } = deserializar(texto);
  assert.deepEqual(listar(doc), listar(ejemplo()));
  assert.deepEqual([...imagenesDe(doc).get("img")!], [1, 2, 3, 250]);
  assert.equal(entradas(doc)[0].elementoId, "n");
});

test("meta conserva link y personas", () => {
  const meta = { nombre: "Feria", link: { sala: "s".repeat(22), clave: "k".repeat(22) }, personas: [{ id: "a", nombre: "Ana", color: "#e5484d" }] };
  assert.deepEqual(deserializar(serializar(ejemplo(), meta)).meta, meta);
});

test("archivo dañado lanza el mensaje", () => {
  for (const malo of ["", "hola", "CDTEAM1\n{}\n@@@", "CDTEAM1\nno-json\nAAAA", "OTRO\n{}\nAAAA"]) {
    assert.throws(() => deserializar(malo), /Archivo de CoffeeDrawTeam dañado/, JSON.stringify(malo));
  }
});

import { envolver, svgDelTablero } from "./exportar";

test("envolver parte por palabras y respeta saltos", () => {
  assert.deepEqual(envolver("hola mundo de café", 9), ["hola", "mundo de", "café"]);
  assert.deepEqual(envolver("a\nb", 10), ["a", "b"]);
  assert.deepEqual(envolver("supercalifragilístico", 8), ["supercal", "ifragilí", "stico"]);
});

test("el SVG exportado no usa foreignObject e incluye el texto", () => {
  const { svg, w, h } = svgDelTablero(ejemplo());
  assert.ok(!svg.includes("foreignObject"));
  assert.ok(svg.includes(">Ideas<") && svg.includes("ñ ☕"));
  assert.equal(w, 180);
  assert.equal(h, 170);
});
