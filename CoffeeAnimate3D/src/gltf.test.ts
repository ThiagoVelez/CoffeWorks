import { test } from "node:test";
import assert from "node:assert/strict";
import { addAnimation, addPart, newModel, paintPixel, setKeyframe } from "./model";
import { buildAtlas, encodePng, exportGlb } from "./gltf";
import { TEMPLATES } from "./templates";

function readGlb(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(dv.getUint32(0, true), 0x46546c67, "magia glTF");
  assert.equal(dv.getUint32(4, true), 2, "versión 2");
  assert.equal(dv.getUint32(8, true), bytes.byteLength, "longitud total");
  const jsonLen = dv.getUint32(12, true);
  assert.equal(dv.getUint32(16, true), 0x4e4f534a, "trozo JSON");
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
  const binStart = 20 + jsonLen;
  const binLen = dv.getUint32(binStart, true);
  assert.equal(dv.getUint32(binStart + 4, true), 0x004e4942, "trozo BIN");
  const bin = bytes.subarray(binStart + 8, binStart + 8 + binLen);
  return { json, bin };
}

test("PNG válido con su firma y cabecera", () => {
  const png = encodePng(2, 3, new Uint8Array(2 * 3 * 4).fill(200));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer);
  assert.equal(dv.getUint32(16), 2);
  assert.equal(dv.getUint32(20), 3);
});

test("el atlas coloca cada cara y conserva los píxeles pintados", () => {
  let m = newModel("Atlas");
  let p: string;
  [m, p] = addPart(m, { name: "cubo", box: { from: [0, 0, 0], size: [4, 4, 4], color: "#102030" } });
  m = paintPixel(m, p, "pz", 3, 7, "#ff0000");
  const atlas = buildAtlas(m);
  assert.equal(atlas.width % 32, 0);
  const rect = atlas.rects.get(`${p}:pz`)!;
  const px = (rect.x + 3 + (rect.y + 7) * atlas.width) * 4;
  assert.deepEqual([...atlas.rgba.subarray(px, px + 4)], [255, 0, 0, 255]);
  const other = (rect.x + 4 + (rect.y + 7) * atlas.width) * 4;
  assert.deepEqual([...atlas.rgba.subarray(other, other + 3)], [16, 32, 48]);
});

test("GLB: nodos en jerarquía, mallas, textura y animaciones", () => {
  let m = newModel("Exportar");
  let body: string, leg: string, a: string;
  [m, body] = addPart(m, { name: "cuerpo", pivot: [0, 16, 0], box: { from: [-4, 0, -4], size: [8, 8, 8] } });
  [m, leg] = addPart(m, { name: "pata", parent: body, pivot: [2, 0, 0], box: { from: [-1, -8, -1], size: [2, 8, 2] } });
  [m] = addPart(m, { name: "hueso vacío", parent: body, pivot: [0, 8, 0] });
  [m, a] = addAnimation(m, "Andar", 1);
  m = setKeyframe(m, a, leg, 0, { rot: [-30, 0, 0] });
  m = setKeyframe(m, a, leg, 0.5, { rot: [30, 0, 0] });
  m = setKeyframe(m, a, leg, 1, { rot: [-30, 0, 0] });
  const { json, bin } = readGlb(exportGlb(m));
  assert.equal(json.asset.version, "2.0");
  assert.equal(json.nodes.length, 3);
  assert.equal(json.meshes.length, 2, "la pieza sin caja no tiene malla");
  const root = json.nodes[json.scenes[0].nodes[0]];
  assert.equal(root.name, "cuerpo");
  assert.deepEqual(root.translation, [0, 1, 0], "16 unidades = 1 bloque");
  assert.equal(root.children.length, 2);
  const legNode = json.nodes[root.children[0]];
  assert.deepEqual(legNode.translation, [0.125, 0, 0]);
  // Accesores de posición con min/max (obligatorio en glTF).
  const posAcc = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
  assert.equal(posAcc.count, 24);
  assert.ok(posAcc.min && posAcc.max);
  assert.deepEqual(posAcc.max, [0.25, 0.5, 0.25]);
  // Textura PNG con muestreo sin suavizar.
  assert.equal(json.images[0].mimeType, "image/png");
  const view = json.bufferViews[json.images[0].bufferView];
  assert.deepEqual([...bin.subarray(view.byteOffset, view.byteOffset + 4)], [137, 80, 78, 71]);
  assert.equal(json.samplers[0].magFilter, 9728);
  // Animación: rotación de la pata con muestras a 24 fps.
  assert.equal(json.animations.length, 1);
  const ch = json.animations[0].channels.find((c: any) => c.target.path === "rotation");
  assert.equal(json.nodes[ch.target.node].name, "pata");
  const input = json.accessors[json.animations[0].samplers[ch.sampler].input];
  assert.equal(input.count, 25);
  assert.equal(input.max[0], 1);
  assert.equal(json.buffers[0].byteLength, bin.byteLength);
});

test("las plantillas se exportan", () => {
  for (const [name, make] of Object.entries(TEMPLATES)) {
    const { json } = readGlb(exportGlb(make()));
    assert.ok(json.animations.length >= 1, name);
    assert.ok(json.meshes.length >= 6, name);
  }
});
