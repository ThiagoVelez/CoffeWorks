import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PIECES } from "./pieces";
import { insertPiece, newModel, normalizeIds, serializeModel, validateModel } from "./model";

const DIR = join(import.meta.dirname, "..", "..", "addons", "coffee-ca3d-piezas");

test("al menos 20 piezas, con nombres y archivos únicos, que validan", () => {
  assert.ok(PIECES.length >= 20, `${PIECES.length}`);
  assert.equal(new Set(PIECES.map((p) => p.name)).size, PIECES.length);
  assert.equal(new Set(PIECES.map((p) => p.file)).size, PIECES.length);
  for (const p of PIECES) {
    const m = p.make();
    assert.ok(m.parts.length > 0, p.name);
    assert.deepEqual(validateModel(m), [], p.name);
  }
});

test("normalizeIds da siempre el mismo archivo", () => {
  const a = serializeModel(normalizeIds(PIECES[0].make()));
  const b = serializeModel(normalizeIds(PIECES[0].make()));
  assert.equal(a, b);
});

test("los archivos del complemento están al día (node scripts: npx tsx scripts/make-pieces.ts)", () => {
  const index = JSON.parse(readFileSync(join(DIR, "piezas.json"), "utf8"));
  assert.deepEqual(index.map((x: { name: string }) => x.name), PIECES.map((p) => p.name));
  for (const p of PIECES) assert.equal(readFileSync(join(DIR, p.file), "utf8"), serializeModel(normalizeIds(p.make())), p.file);
});

test("insertar una pieza dos veces: grupos distintos y el modelo valida", () => {
  let m = newModel();
  let g1: string, g2: string;
  [m, g1] = insertPiece(m, PIECES[0].make(), PIECES[0].name);
  [m, g2] = insertPiece(m, PIECES[0].make(), PIECES[0].name);
  assert.notEqual(g1, g2);
  assert.equal(new Set(m.parts.map((p) => p.id)).size, m.parts.length);
  assert.deepEqual(validateModel(m), []);
  assert.equal(m.parts.find((p) => p.id === g1)!.name, PIECES[0].name);
  assert.equal(m.animations.length, 0);
});
