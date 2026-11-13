import { test } from "node:test";
import assert from "node:assert/strict";
import { addPart, findPart, mirrorPart, newModel, paintPixel, parseModel, serializeModel, updatePart, validateModel } from "./model";
import { runTool } from "./mcp";
import { SHAPES, SHAPE_FACES } from "./types";

test("un .ca3d v1 se abre como v2 con cajas", () => {
  const v1 = JSON.stringify({ version: 1, name: "Viejo", parts: [{ id: "p1", name: "a", parent: null, pivot: [0, 0, 0], rotation: [0, 0, 0], visible: true, box: { from: [0, 0, 0], size: [2, 2, 2], faces: {} } }], animations: [] });
  const m = parseModel(v1);
  assert.equal(m.version, 2);
  assert.equal(m.parts[0].box!.shape, "box");
  assert.equal(JSON.parse(serializeModel(m)).version, 2);
  assert.equal(parseModel(serializeModel(m)).parts[0].box!.shape, "box");
});

test("cambiar la forma conserva la pintura", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", box: { from: [0, 0, 0], size: [4, 4, 4] } });
  m = paintPixel(m, a, "pz", 3, 3, "#ff0000");
  const before = findPart(m, a).box!.faces.pz.pixels;
  m = updatePart(m, a, { box: { shape: "sphere" } });
  assert.equal(findPart(m, a).box!.shape, "sphere");
  assert.equal(findPart(m, a).box!.faces.pz.pixels, before);
});

test("reflejar copia la forma", () => {
  let m = newModel(); let a: string, b: string;
  [m, a] = addPart(m, { name: "rueda izquierda", pivot: [4, 0, 0], box: { from: [0, 0, 0], size: [2, 4, 4], shape: "cylinder" } });
  [m, b] = mirrorPart(m, a);
  assert.equal(findPart(m, b).box!.shape, "cylinder");
});

test("formas y sus caras", () => {
  assert.deepEqual(SHAPES, ["box", "cylinder", "sphere", "ramp", "plane"]);
  assert.deepEqual(SHAPE_FACES.plane, ["py"]);
  assert.deepEqual([...SHAPE_FACES.ramp].sort(), ["nx", "ny", "nz", "px", "py"]);
  assert.equal(SHAPE_FACES.cylinder.length, 6);
});

test("MCP add_part con forma y error claro si no existe", () => {
  const r = runTool(newModel(), "add_part", { name: "tronco", from: [-2, 0, -2], size: [4, 16, 4], shape: "cylinder" });
  assert.ok(!r.isError);
  assert.equal(r.model!.parts[0].box!.shape, "cylinder");
  const bad = runTool(newModel(), "add_part", { name: "x", from: [0, 0, 0], size: [1, 1, 1], shape: "cono" });
  assert.equal(bad.isError, true);
  assert.match(bad.content.map((c) => (c.type === "text" ? c.text : "")).join(""), /shape debe ser box, cylinder, sphere, ramp o plane/);
  const u = runTool(r.model!, "update_part", { part: "tronco", shape: "ramp" });
  assert.equal(u.model!.parts[0].box!.shape, "ramp");
});

test("validateModel marca formas desconocidas", () => {
  let m = newModel(); let a: string;
  [m, a] = addPart(m, { name: "A", box: { from: [0, 0, 0], size: [1, 1, 1] } });
  const bad = { ...m, parts: m.parts.map((p) => ({ ...p, box: { ...p.box!, shape: "cono" as never } })) };
  assert.ok(validateModel(bad).some((e) => /forma/i.test(e)));
  assert.ok(a);
});
