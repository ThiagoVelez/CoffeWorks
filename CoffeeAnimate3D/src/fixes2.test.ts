import { test } from "node:test";
import assert from "node:assert/strict";
import { addAnimation, addPart, copyPose, getPixel, mirrorPart, newModel, paintPixel, pastePose, samplePose, setKeyframe } from "./model";
import { runTool } from "./mcp";
import { exportObj } from "./objfile";
import { PIECES } from "./pieces";
import { TEMPLATES } from "./templates";
import { TEX } from "./types";

test("reflejar una rampa pintada conserva la pintura visible de los lados", () => {
  let m = newModel(); let a: string, b: string;
  [m, a] = addPart(m, { name: "rampa izquierda", pivot: [6, 0, 0], box: { from: [0, 0, 0], size: [4, 8, 8], shape: "ramp" } });
  // (29, 5): arriba a la derecha de la cara +X, dentro del triángulo visible (u + v ≥ 1).
  m = paintPixel(m, a, "px", 29, 5, "#ff0000");
  [m, b] = mirrorPart(m, a);
  assert.equal(getPixel(m, b, "nx", TEX - 1 - 29, 5), "#ff0000");
});

test("pegar reflejada también refleja las piezas del centro sobre sí mismas", () => {
  let m = newModel(); let body: string, l: string, r: string, an: string;
  [m, body] = addPart(m, { name: "cuerpo" });
  [m, l] = addPart(m, { name: "pata izquierda" });
  [m, r] = addPart(m, { name: "pata derecha" });
  [m, an] = addAnimation(m, "Andar", 1);
  m = setKeyframe(m, an, body, 0, { pos: [1, 0, 0], rot: [5, 10, 3] });
  m = setKeyframe(m, an, l, 0, { rot: [30, 0, 0] });
  const res = pastePose(m, an, 0.5, copyPose(m, an, 0, [body, l]), true, "linear");
  assert.equal(res.pasted, 2);
  assert.deepEqual(res.skipped, []);
  const p = samplePose(res.model, an, 0.5).get(body)!;
  assert.deepEqual(p.pos, [-1, 0, 0]);
  assert.deepEqual(p.rot, [5, -10, -3]);
  assert.deepEqual(samplePose(res.model, an, 0.5).get(r)!.rot, [30, 0, 0]);
});

test("render con un ángulo desconocido da un error claro", () => {
  const r = runTool(TEMPLATES["ave"](), "render", { angle: "diagonal" });
  assert.equal(r.isError, true);
});

test("los nombres dentro del OBJ no llevan espacios", () => {
  const { obj, mtl } = exportObj(TEMPLATES["ave"](), "Modelo sin título");
  assert.ok(obj.includes("mtllib Modelo_sin_título.mtl"), obj.split("\n")[2]);
  assert.ok(mtl.includes("map_Kd Modelo_sin_título.png"));
});

test("el bloque de hierba tiene la cara de arriba verde", () => {
  const m = PIECES.find((p) => p.name === "Bloque de hierba")!.make();
  assert.equal(m.parts[0].box!.faces.py.color, "#6fb84a");
});
