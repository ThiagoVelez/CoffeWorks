import { test } from "node:test";
import assert from "node:assert/strict";
import { aLink, crearSala, leerLink } from "./link";

test("crearSala da 22 caracteres base64url", () => {
  const s = crearSala();
  assert.match(s.sala, /^[A-Za-z0-9_-]{22}$/);
  assert.match(s.clave, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(s.sala, s.clave);
});

test("aLink y leerLink ida y vuelta", () => {
  const s = crearSala();
  assert.ok(aLink(s).startsWith("coffeedrawteam://unirse/"));
  assert.deepEqual(leerLink(aLink(s)), s);
});

test("leerLink tolera texto alrededor", () => {
  const s = crearSala();
  assert.deepEqual(leerLink(`únete: ${aLink(s)} \n`), s);
  assert.deepEqual(leerLink(`  ${aLink(s)}.`), s);
});

test("leerLink rechaza basura", () => {
  assert.equal(leerLink("hola"), null);
  assert.equal(leerLink("coffeedrawteam://unirse/abc#def"), null);
});

test("leerLink tolera espacios y saltos dentro del link, %23 y mayúsculas", () => {
  const s = crearSala();
  const l = aLink(s);
  const partido = `${l.slice(0, 30)} \n ${l.slice(30)}`;
  assert.deepEqual(leerLink(partido), s);
  assert.deepEqual(leerLink(l.replace("#", "%23")), s);
  assert.deepEqual(leerLink(l.replace("coffeedrawteam://unirse/", "CoffeeDrawTeam://Unirse/")), s);
});

test("el link puede llevar la llave del anfitrión", () => {
  const s = { ...crearSala(), llave: "A".repeat(43) };
  assert.ok(aLink(s).endsWith(`.${"A".repeat(43)}`));
  assert.deepEqual(leerLink(`mira: ${aLink(s)}`), s);
});
