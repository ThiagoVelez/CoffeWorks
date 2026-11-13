import { test } from "node:test";
import assert from "node:assert/strict";
import { exportObj, parseObj } from "./objfile";
import { addPart, newModel } from "./model";
import { shapeGeometry } from "./geometry";

test("exportObj: vértices, UV y caras de todas las piezas visibles", () => {
  let m = newModel("Cosa");
  [m] = addPart(m, { name: "cubo", pivot: [0, 16, 0], box: { from: [-8, 0, -8], size: [16, 16, 16] } });
  [m] = addPart(m, { name: "rueda", pivot: [16, 0, 0], box: { from: [-2, 0, -4], size: [4, 8, 8], shape: "cylinder" } });
  [m] = addPart(m, { name: "oculta", visible: false, box: { from: [0, 0, 0], size: [1, 1, 1] } });
  const { obj, mtl, png } = exportObj(m, "cosa");
  const lines = obj.split("\n");
  const count = (p: string) => lines.filter((l) => l.startsWith(p)).length;
  const verts = m.parts.filter((p) => p.visible).reduce((s, p) => s + shapeGeometry(p.box!).positions.length / 3, 0);
  const tris = m.parts.filter((p) => p.visible).reduce((s, p) => s + shapeGeometry(p.box!).indices.length / 3, 0);
  assert.equal(count("v "), verts);
  assert.equal(count("vt "), verts);
  assert.equal(count("f "), tris);
  assert.ok(obj.startsWith("# CoffeeAnimate3D") && obj.includes("mtllib cosa.mtl") && obj.includes("o cubo") && !obj.includes("o oculta"));
  assert.ok(mtl.includes("map_Kd cosa.png"));
  assert.deepEqual([...png.subarray(0, 4)], [137, 80, 78, 71]);
  // En bloques: el cubo de 16 u a 16 u de altura llega a y = 2.
  const ys = lines.filter((l) => l.startsWith("v ")).map((l) => Number(l.split(" ")[2]));
  assert.equal(Math.max(...ys), 2);
});

test("parseObj triangula polígonos, acepta índices negativos y v/vt/vn", () => {
  const text = ["v 0 0 0", "v 1 0 0", "v 1 1 0", "v 0 1 0", "vt 0 0", "vn 0 0 1", "f 1/1/1 2/1/1 3/1/1 4/1/1", "v 0 0 1", "v 1 0 1", "v 1 1 1", "f -3 -2 -1"].join("\n");
  const r = parseObj(text);
  assert.equal(r.positions.length / 3, 7);
  assert.deepEqual(r.indices, [0, 1, 2, 0, 2, 3, 4, 5, 6]);
});

test("parseObj sin caras da un error claro", () => {
  assert.throws(() => parseObj("v 0 0 0"), /no tiene caras/);
});
