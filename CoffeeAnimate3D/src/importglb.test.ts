import { test } from "node:test";
import assert from "node:assert/strict";
import { exportGlb, importGlb } from "./gltf";
import { getReference, parseModel, serializeModel, setReference } from "./model";
import { exportObj, objReference } from "./objfile";
import { TEMPLATES } from "./templates";

/** GLB mínimo de «otro programa»: un triángulo y la lista de índices que se pida. */
function foreignGlb(json: any, bin: Uint8Array): Uint8Array {
  let jb = new TextEncoder().encode(JSON.stringify(json));
  const jp = (4 - (jb.length % 4)) % 4;
  const j2 = new Uint8Array(jb.length + jp).fill(0x20);
  j2.set(jb);
  jb = j2;
  const bp = (4 - (bin.length % 4)) % 4;
  const b2 = new Uint8Array(bin.length + bp);
  b2.set(bin);
  const out = new Uint8Array(12 + 8 + jb.length + 8 + b2.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jb.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jb, 20);
  dv.setUint32(20 + jb.length, b2.length, true); dv.setUint32(24 + jb.length, 0x004e4942, true); out.set(b2, 28 + jb.length);
  return out;
}

function triangleGlb(indexCount: number, node: any = { mesh: 0 }, extra: any = {}) {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const idx = new Uint32Array(indexCount).map((_, i) => i % 3);
  const bin = new Uint8Array(pos.byteLength + idx.byteLength);
  bin.set(new Uint8Array(pos.buffer), 0);
  bin.set(new Uint8Array(idx.buffer), pos.byteLength);
  return foreignGlb({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [node],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5125, count: indexCount, type: "SCALAR" },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength }],
    buffers: [{ byteLength: bin.length }],
    ...extra,
  }, bin);
}

test("un .glb ajeno grande (más de 50.000 triángulos) se importa", () => {
  const r = importGlb(triangleGlb(3 * 60000));
  assert.ok("reference" in r);
  assert.equal(r.reference.indices.length, 3 * 60000);
});

test("la matriz de un nodo se aplica (Z arriba → Y arriba)", () => {
  // Giro de −90° en X: el vértice (0,1,0) pasa a (0,0,−1).
  const m = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
  const r = importGlb(triangleGlb(3, { mesh: 0, matrix: m }));
  assert.ok("reference" in r);
  const p = r.reference.positions.slice(6, 9).map((v) => Math.round(v * 100) / 100 + 0);
  assert.deepEqual(p, [0, 0, -16]);
});

test("índices fuera de rango y mallas comprimidas dan un error claro en español", () => {
  const bad = triangleGlb(3);
  // Índice 2 → 9 (solo hay 3 vértices)
  const r = () => {
    const copy = bad.slice();
    const dv = new DataView(copy.buffer);
    const jl = dv.getUint32(12, true);
    dv.setUint32(28 + jl + 36 + 8, 9, true);
    return importGlb(copy);
  };
  assert.throws(r, /índices fuera de rango/);
  const draco = triangleGlb(3, { mesh: 0 }, { accessors: [{ componentType: 5126, count: 3, type: "VEC3" }, { componentType: 5125, count: 3, type: "SCALAR" }] });
  assert.throws(() => importGlb(draco), /comprimid|no se puede leer/i);
});

test("sin escenas, los hijos no se cuentan dos veces", () => {
  const g = triangleGlb(3, { children: [1] }, {});
  // Añadir un segundo nodo con la malla y quitar las escenas
  const dv = new DataView(g.buffer);
  const jl = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(g.subarray(20, 20 + jl)));
  json.nodes = [{ children: [1] }, { mesh: 0 }];
  delete json.scenes;
  delete json.scene;
  const bin = g.subarray(28 + jl);
  const r = importGlb(foreignGlb(json, bin));
  assert.ok("reference" in r);
  assert.equal(r.reference.indices.length, 3);
});

test("el .glb exportado no lleva la referencia dentro", () => {
  const m = setReference(TEMPLATES["ave"](), "calco.obj", { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] });
  const r = importGlb(exportGlb(m));
  assert.ok("model" in r);
  assert.equal(r.model.reference, undefined);
  assert.equal(serializeModel(r.model), serializeModel({ ...m, reference: undefined }));
});

test("un OBJ exportado vuelve como referencia del mismo tamaño (unidades ×16)", () => {
  const m = TEMPLATES["cuadrúpedo"]();
  const ref = objReference(exportObj(m, "vaca").obj);
  const ys = ref.positions.filter((_, i) => i % 3 === 1);
  // El cuerpo está a 12 u + 10 u de alto: la referencia llega a ~22 u, no a ~1,4.
  assert.ok(Math.max(...ys) > 20, String(Math.max(...ys)));
});

test("getReference descarta índices fuera de rango de un .ca3d editado a mano", () => {
  const m = setReference(TEMPLATES["ave"](), "x", { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 7] });
  assert.equal(getReference(parseModel(serializeModel(m))), null);
});
