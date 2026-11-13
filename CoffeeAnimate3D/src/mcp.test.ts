import { test } from "node:test";
import assert from "node:assert/strict";
import { newModel, getPixel, samplePose } from "./model";
import { runTool, TOOL_NAMES } from "./mcp";
import tools from "./mcp-tools.json";

const text = (r: ReturnType<typeof runTool>) => r.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");

test("todas las herramientas del JSON están implementadas", () => {
  assert.deepEqual([...TOOL_NAMES].sort(), tools.map((t) => t.name).sort());
});

test("Claude construye, pinta y anima por nombres", () => {
  let m = newModel("Oso");
  let r = runTool(m, "add_part", { name: "cuerpo", pivot: [0, 12, 0], from: [-6, 0, -9], size: [12, 10, 18], color: "#3a2a20" });
  m = r.model!;
  r = runTool(m, "add_part", { name: "pata delantera izquierda", parent: "cuerpo", pivot: [4, 0, -6], from: [-2, -12, -2], size: [4, 12, 4] });
  m = r.model!;
  r = runTool(m, "mirror_part", { part: "pata delantera izquierda" });
  m = r.model!;
  assert.match(text(r), /pata delantera derecha/);
  r = runTool(m, "paint_pixels", { part: "cuerpo", face: "pz", color: "#f2e6c8", rect: [10, 10, 4, 3] });
  m = r.model!;
  const body = m.parts.find((p) => p.name === "cuerpo")!.id;
  assert.equal(getPixel(m, body, "pz", 13, 12), "#f2e6c8");
  assert.equal(getPixel(m, body, "pz", 14, 12), "#3a2a20");
  r = runTool(m, "add_animation", { name: "Andar", length: 1 });
  m = r.model!;
  for (const [t, x] of [[0, -25], [0.5, 25], [1, -25]] as const) m = runTool(m, "set_keyframe", { animation: "Andar", part: "pata delantera izquierda", time: t, rot: [x, 0, 0], ease: "smooth" }).model!;
  const leg = m.parts.find((p) => p.name === "pata delantera izquierda")!.id;
  assert.equal(samplePose(m, m.animations[0].id, 0.5).get(leg)!.rot[0], 25);
  const info = JSON.parse(text(runTool(m, "get_model", {})));
  assert.equal(info.parts.length, 3);
  assert.equal(info.animations[0].keyframes, 3);
});

test("errores claros y el modelo no cambia", () => {
  const m = newModel("x");
  const r = runTool(m, "update_part", { part: "no existe", name: "y" });
  assert.equal(r.isError, true);
  assert.equal(r.model, undefined);
  assert.match(text(r), /No hay ninguna pieza/);
  assert.equal(runTool(m, "herramienta_rara", {}).isError, true);
  assert.equal(runTool(m, "add_part", { name: "a", size: [0, 1, 1], from: [0, 0, 0] }).isError, true);
  assert.equal(runTool(m, "paint_pixels", { part: "a", face: "px", color: "rojo" }).isError, true);
});

test("plantillas, vista previa y exportación piden ayuda a la app", () => {
  const r = runTool(newModel(), "new_model", { template: "cuadrúpedo", name: "Vaca de páramo" });
  assert.equal(r.model!.name, "Vaca de páramo");
  assert.ok(r.model!.parts.length > 5);
  const p = runTool(r.model!, "preview", { angle: "frente", animation: "Andar", time: 0.25 });
  assert.deepEqual(p.needs, { preview: { angle: "frente", animation: r.model!.animations.find((a) => a.name === "Andar")!.id, time: 0.25 } });
  const e = runTool(r.model!, "export_glb", { file_name: "../vaca" });
  assert.deepEqual(e.needs, { export: "vaca.glb" });
});
