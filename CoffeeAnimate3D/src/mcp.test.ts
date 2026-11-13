import { test } from "node:test";
import assert from "node:assert/strict";
import { newModel, getPixel, samplePose } from "./model";
import { runTool, TOOL_NAMES } from "./mcp";
import tools from "./mcp-tools.json";
import { TEMPLATES } from "./templates";

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

test("group_parts y ungroup por nombre", () => {
  let m = TEMPLATES["cuadrúpedo"]();
  const r = runTool(m, "group_parts", { parts: ["pata delantera izquierda", "pata delantera derecha"], name: "Delanteras" });
  assert.ok(!r.isError, text(r));
  m = r.model!;
  const g = m.parts.find((p) => p.name === "Delanteras")!;
  assert.equal(r.select, g.id);
  assert.equal(m.parts.filter((p) => p.parent === g.id).length, 2);
  const u = runTool(m, "ungroup", { part: "Delanteras" });
  assert.ok(!u.model!.parts.some((p) => p.name === "Delanteras"));
});

test("group_parts con padres distintos devuelve un error claro", () => {
  const r = runTool(TEMPLATES["cuadrúpedo"](), "group_parts", { parts: ["hocico", "cola"] });
  assert.equal(r.isError, true);
  assert.match(text(r), /mismo padre/);
});

test("ungroup borra las pistas del grupo", () => {
  let m = TEMPLATES["cuadrúpedo"]();
  m = runTool(m, "group_parts", { parts: ["cola"], name: "G" }).model!;
  m = runTool(m, "set_keyframe", { animation: m.animations[0].id, part: "G", time: 0, rot: [0, 10, 0] }).model!;
  const gid = m.parts.find((p) => p.name === "G")!.id;
  const u = runTool(m, "ungroup", { part: "G" }).model!;
  assert.ok(u.animations.every((a) => a.tracks[gid] === undefined));
});

test("preview acepta una dirección", () => {
  const r = runTool(TEMPLATES["cuadrúpedo"](), "preview", { direction: [1, 1, 1] });
  assert.deepEqual(r.needs, { preview: { direction: [1, 1, 1] } });
  const bad = runTool(TEMPLATES["cuadrúpedo"](), "preview", { direction: [0, 0, 0] });
  assert.equal(bad.isError, true);
});

test("las 15 herramientas originales siguen y hay 17 en total", () => {
  for (const n of ["get_model", "new_model", "add_part", "update_part", "remove_part", "duplicate_part", "mirror_part", "fill_face", "paint_pixels", "add_animation", "set_keyframe", "remove_keyframe", "update_animation", "preview", "export_glb"]) assert.ok(TOOL_NAMES.includes(n), n);
  assert.ok(TOOL_NAMES.length >= 17);
});

test("copy_pose y paste_pose reflejada", () => {
  let m = TEMPLATES["bípedo"]();
  const anim = m.animations.find((a) => a.name === "Andar")!.id;
  m = runTool(m, "set_keyframe", { animation: anim, part: "brazo izquierdo", time: 0, rot: [40, 5, 10] }).model!;
  const c = runTool(m, "copy_pose", { animation: anim, time: 0, parts: ["brazo izquierdo"] });
  assert.ok(!c.isError, text(c));
  const clip = JSON.parse(text(c).split("\n").slice(1).join("\n"));
  const r = runTool(m, "paste_pose", { animation: anim, time: 0.5, pose: clip, mirrored: true });
  assert.ok(!r.isError, text(r));
  const right = r.model!.parts.find((p) => p.name === "brazo derecho")!.id;
  assert.deepEqual(samplePose(r.model!, anim, 0.5).get(right)!.rot, [40, -5, -10]);
});

test("export_obj pide a la app guardar el ZIP", () => {
  const r = runTool(TEMPLATES["ave"](), "export_obj", { file_name: "pájaro" });
  assert.deepEqual(r.needs, { exportObj: "pájaro" });
});


test("insert_piece y render piden a la app (que comprueba el complemento)", () => {
  const m = TEMPLATES["ave"]();
  assert.deepEqual(runTool(m, "insert_piece", { name: "Roble" }).needs, { insertPiece: "Roble" });
  assert.equal(runTool(m, "insert_piece", {}).isError, true);
  assert.deepEqual(runTool(m, "render", { size: "1920x1080", transparent: true, angle: "frente" }).needs, { render: { width: 1920, height: 1080, transparent: true, angle: "frente" } });
  assert.deepEqual(runTool(m, "render", {}).needs, { render: { width: 1280, height: 720, transparent: false } });
  assert.equal(runTool(m, "render", { size: "800x600" }).isError, true);
});

test("hay 22 herramientas", () => {
  assert.equal(TOOL_NAMES.length, 22);
});
