import { test } from "node:test";
import assert from "node:assert/strict";
import { boxToMesh, convertPartToMesh, joinTriangles, refToMesh } from "./meshconvert";
import { validateMesh } from "./mesh";
import { addPart, findPart, meshTexturePixels, newModel, paintPixel, setKeyframe, addAnimation } from "./model";
import { parseObj } from "./objfile";
import { shapeGeometry } from "./geometry";
import { facesOutward } from "./meshtest-utils";
import { FACES, SHAPES, type Box, type Vec3 } from "./types";

function boxOf(shape: Box["shape"]) {
  const [m, id] = addPart(newModel(), { name: "A", box: { shape, from: [-4, -4, -4], size: [8, 8, 8], color: "#336699" } });
  return { m, id, box: findPart(m, id).box! };
}

test("joinTriangles une dos triángulos coplanares en un cuadrilátero", () => {
  const v: Vec3[] = [[0, 0, 0], [4, 0, 0], [4, 0, 4], [0, 0, 4]];
  const faces = joinTriangles(v, [[0, 3, 2], [0, 2, 1]]);
  assert.equal(faces.length, 1);
  assert.equal(faces[0].length, 4);
  // Doblados 90° no se unen.
  const bent: Vec3[] = [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 0, 4]];
  assert.equal(joinTriangles(bent, [[0, 3, 1], [0, 1, 2]]).length, 2);
});

test("boxToMesh de un cubo: 8 vértices, 6 cuadriláteros y la pintura en su celda", () => {
  let { m, id } = boxOf("box");
  m = paintPixel(m, id, "pz", 5, 7, "#ff0000");
  const mesh = boxToMesh(findPart(m, id).box!);
  assert.deepEqual(validateMesh(mesh), []);
  assert.equal(mesh.vertices.length, 8);
  assert.equal(mesh.faces.length, 6);
  assert.ok(mesh.faces.every((f) => f.length === 4));
  assert.ok(facesOutward(mesh));
  assert.equal(mesh.texture.size, 128);
  const px = meshTexturePixels(mesh.texture);
  const i = FACES.indexOf("pz");
  const x = (i % 4) * 32 + 5;
  const y = Math.floor(i / 4) * 32 + 7;
  assert.deepEqual([...px.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)], [255, 0, 0, 255]);
  const y2 = Math.floor(i / 4) * 32 + 8;
  assert.deepEqual([...px.subarray((y2 * 128 + x) * 4, (y2 * 128 + x) * 4 + 3)], [0x33, 0x66, 0x99]);
});

test("las UV de boxToMesh caen en la celda de su cara", () => {
  const { box } = boxOf("box");
  const mesh = boxToMesh(box);
  const g = shapeGeometry(box);
  assert.equal(g.groups.length, 6);
  for (const u of mesh.uvs.flat()) assert.ok(u[0] >= 0 && u[0] <= 1 && u[1] >= 0 && u[1] <= 0.5);
});

test("boxToMesh de todas las formas: válidas y con UV en [0, 1]", () => {
  for (const s of SHAPES) {
    const mesh = boxToMesh(boxOf(s).box);
    assert.deepEqual(validateMesh(mesh), [], s);
    assert.equal(mesh.uvs.length, mesh.faces.length, s);
  }
});

test("convertPartToMesh conserva id, hijos y animaciones", () => {
  let { m, id } = boxOf("cylinder");
  let child: string;
  [m, child] = addPart(m, { name: "hijo", parent: id, box: { from: [0, 0, 0], size: [1, 1, 1] } });
  let anim: string;
  [m, anim] = addAnimation(m, "Andar");
  m = setKeyframe(m, anim, id, 0, { rot: [0, 30, 0] });
  const out = convertPartToMesh(m, id);
  const p = findPart(out, id);
  assert.equal(p.box, null);
  assert.ok(p.mesh);
  assert.equal(findPart(out, child).parent, id);
  assert.equal(out.animations[0].tracks[id].length, 1);
  assert.throws(() => convertPartToMesh(out, id), /ya es una malla|no tiene caja/);
});

test("refToMesh de un OBJ con cuadrilátero, índices negativos y v/vt/vn", () => {
  const obj = ["v 0 0 0", "v 1 0 0", "v 1 0 1", "v 0 0 1", "vt 0 0", "vn 0 1 0", "f -4/1/1 -1/1/1 -2/1/1 -3/1/1"].join("\n");
  const mesh = refToMesh(parseObj(obj));
  assert.deepEqual(validateMesh(mesh), []);
  assert.equal(mesh.faces.length, 1);
  assert.equal(mesh.faces[0].length, 4);
  assert.deepEqual(mesh.uvs, []);
});

test("refToMesh suelda y mira hacia fuera (malla de triángulos sueltos)", () => {
  const g = shapeGeometry(boxOf("box").box);
  const mesh = refToMesh({ positions: g.positions, indices: g.indices });
  assert.deepEqual(validateMesh(mesh), []);
  assert.equal(mesh.vertices.length, 8);
  assert.equal(mesh.faces.length, 6);
  assert.ok(facesOutward(mesh));
});

test("refToMesh con más de 20 000 caras da error", () => {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < 20001; i++) {
    positions.push(i * 3, 0, 0, i * 3 + 1, 0, 0, i * 3, 1, 0);
    indices.push(i * 3, i * 3 + 1, i * 3 + 2);
  }
  assert.throws(() => refToMesh({ positions, indices }), /La malla superaría 20 000 caras/);
});
