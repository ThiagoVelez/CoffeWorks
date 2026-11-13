import { test } from "node:test";
import assert from "node:assert/strict";
import { exportGlb, importGlb } from "./gltf";
import { clearReference, getReference, parseModel, serializeModel, setReference } from "./model";
import { exportObj } from "./objfile";
import { TEMPLATES } from "./templates";

test("un .glb propio vuelve exacto", () => {
  const m = TEMPLATES["cuadrúpedo"]();
  const r = importGlb(exportGlb(m));
  assert.ok("model" in r);
  assert.equal(serializeModel(r.model), serializeModel(m));
});

test("un .glb ajeno entra como referencia con sus triángulos y transformaciones", () => {
  const m = TEMPLATES["cuadrúpedo"]();
  const bytes = exportGlb(m);
  // Quitar los extras: así parece un GLB de otro programa.
  const dv = new DataView(bytes.buffer, bytes.byteOffset);
  const len = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  delete json.asset.extras;
  let jb = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jb.length % 4)) % 4;
  const padded = new Uint8Array(jb.length + pad).fill(0x20);
  padded.set(jb);
  jb = padded;
  const rest = bytes.subarray(20 + len);
  const out = new Uint8Array(20 + jb.length + rest.length);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, 0x46546c67, true); odv.setUint32(4, 2, true); odv.setUint32(8, out.length, true);
  odv.setUint32(12, jb.length, true); odv.setUint32(16, 0x4e4f534a, true);
  out.set(jb, 20); out.set(rest, 20 + jb.length);
  const r = importGlb(out);
  assert.ok("reference" in r);
  const tris = m.parts.filter((p) => p.box).length * 12;
  assert.equal(r.reference.indices.length / 3, tris);
  // En unidades del editor (×16): el cuerpo (pivote y = 12) queda por encima del suelo.
  const ys = r.reference.positions.filter((_, i) => i % 3 === 1);
  assert.ok(Math.max(...ys) > 16);
});

test("la referencia se guarda en el documento, no se exporta y tiene límite", () => {
  const m = setReference(TEMPLATES["ave"](), "calco.obj", { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] });
  const back = parseModel(serializeModel(m));
  assert.deepEqual(getReference(back)!.mesh.indices, [0, 1, 2]);
  assert.equal(getReference(back)!.name, "calco.obj");
  assert.ok(!exportObj(back, "x").obj.includes("calco"));
  const r = importGlb(exportGlb(back));
  assert.ok("model" in r && r.model.reference, "viaja dentro del .ca3d embebido");
  assert.equal(clearReference(back).reference, undefined);
  const huge = { positions: new Array(3 * 900_000).fill(1), indices: new Array(900_000).fill(0) };
  assert.throws(() => setReference(m, "grande", huge), /demasiado grande/);
});
