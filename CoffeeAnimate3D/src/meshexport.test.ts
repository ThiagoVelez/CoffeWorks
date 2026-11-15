import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { exportGlb, importGlb } from "./gltf";
import { exportObj } from "./objfile";
import { addMeshPart, addPart, newModel, serializeModel } from "./model";
import { primitiveMesh } from "./mesh";
import { meshGeometry } from "./meshgeo";
import { boxToMesh } from "./meshconvert";
import { shapeGeometry } from "./geometry";
import { cube8, halfCube } from "./meshtest-utils";
import { findPart } from "./model";
import type { Model3D } from "./types";

function readGlbJson(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = dv.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
}

/** Cubo normal + malla con UV + malla sin UV + malla con simetría y subdivisión. */
function sample(): Model3D {
  let m = newModel("Mallas");
  let box: string;
  [m, box] = addPart(m, { name: "Caja", box: { from: [0, 0, 0], size: [4, 4, 4] } });
  [m] = addMeshPart(m, { name: "Convertida", pivot: [20, 0, 0], mesh: boxToMesh(findPart(m, box).box!) });
  [m] = addMeshPart(m, { name: "Esfera", parent: box, pivot: [0, 10, 0], mesh: primitiveMesh("sphere") });
  [m] = addMeshPart(m, { name: "Media", pivot: [-20, 0, 0], mesh: { ...halfCube(), subdivision: 1 } });
  return m;
}

const tris = (m: Model3D) =>
  m.parts.reduce((n, p) => n + (p.box ? shapeGeometry(p.box).indices.length / 3 : p.mesh ? meshGeometry(p.mesh).indices.length / 3 : 0), 0);

test("exportGlb incluye las mallas con sus triángulos y materiales", () => {
  const m = sample();
  const glb = exportGlb(m);
  if (process.env.SF_GLB_DIR) writeFileSync(`${process.env.SF_GLB_DIR}/mallas.glb`, glb);
  const json = readGlbJson(glb);
  const count = json.meshes.reduce((n: number, me: any) => n + json.accessors[me.primitives[0].indices].count / 3, 0);
  assert.equal(count, tris(m));
  // Caja (atlas), malla con UV (su imagen) y mallas sin UV (color): 3 materiales, 2 imágenes.
  assert.equal(json.images.length, 2);
  assert.ok(json.materials.length >= 3);
  const plain = json.meshes.find((me: any) => me.name === "Esfera").primitives[0];
  assert.equal(plain.attributes.TEXCOORD_0, undefined);
  assert.ok(json.materials[plain.material].pbrMetallicRoughness.baseColorFactor);
});

test("ida y vuelta: el .glb propio devuelve el mismo modelo con mallas", () => {
  const m = sample();
  const back = importGlb(exportGlb(m));
  assert.ok("model" in back);
  assert.equal(serializeModel((back as { model: Model3D }).model), serializeModel(m));
});

test("una malla sin caras no rompe la exportación", () => {
  let m = newModel();
  [m] = addMeshPart(m, { name: "Vacía", mesh: { ...cube8(), vertices: [], faces: [] } });
  [m] = addMeshPart(m, { name: "Llena", mesh: cube8() });
  const json = readGlbJson(exportGlb(m));
  assert.equal(json.meshes.length, 1);
  assert.equal(json.nodes.find((n: any) => n.name === "Vacía").mesh, undefined);
  const obj = exportObj(m, "x");
  assert.ok(obj.obj.includes("o Llena"));
});

test("exportObj incluye las mallas y un PNG por malla con UV", () => {
  const m = sample();
  const r = exportObj(m, "Mi modelo");
  const faces = r.obj.split("\n").filter((l) => l.startsWith("f ")).length;
  assert.equal(faces, tris(m));
  assert.equal(r.pngs.length, 2);
  assert.equal(r.pngs[0].name, "Mi_modelo.png");
  assert.ok(r.pngs.some((p) => p.name === "Mi_modelo_Convertida.png"));
  assert.ok(r.mtl.includes("map_Kd Mi_modelo_Convertida.png"));
});
