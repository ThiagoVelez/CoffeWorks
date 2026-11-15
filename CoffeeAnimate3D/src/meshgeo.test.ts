import { test } from "node:test";
import assert from "node:assert/strict";
import { meshGeometry, mirrorMesh, subdivideOnce } from "./meshgeo";
import { edgeFaces, emptyMesh, primitiveMesh, validateMesh } from "./mesh";
import { cube8, facesOutward, halfCube } from "./meshtest-utils";
import type { MeshData, Vec3 } from "./types";

const asMesh = (r: { vertices: Vec3[]; faces: number[][]; uvs: [number, number][][] }): MeshData => ({ ...emptyMesh(), vertices: r.vertices, faces: r.faces, uvs: r.uvs });

test("cubo 8v/6c subdividido: 26/24 y 98/96, todo cuadriláteros", () => {
  const c = cube8();
  assert.deepEqual(validateMesh(c), []);
  const l1 = subdivideOnce(c.vertices, c.faces, c.uvs);
  assert.equal(l1.vertices.length, 26);
  assert.equal(l1.faces.length, 24);
  const l2 = subdivideOnce(l1.vertices, l1.faces, l1.uvs);
  assert.equal(l2.vertices.length, 98);
  assert.equal(l2.faces.length, 96);
  assert.ok(l2.faces.every((f) => f.length === 4));
  assert.deepEqual(validateMesh(asMesh(l2)), []);
  assert.ok(facesOutward(asMesh(l2)));
});

test("la subdivisión encoge hacia dentro", () => {
  const c = cube8();
  const l1 = subdivideOnce(c.vertices, c.faces, c.uvs);
  assert.ok(l1.vertices.every((v) => v.every((x) => Math.abs(x) <= 8 + 1e-9)));
  assert.ok(l1.vertices.some((v) => Math.min(...v.map((x) => 8 - Math.abs(x))) > 1));
});

test("borde abierto: los vértices del borde siguen en su plano", () => {
  const p = primitiveMesh("plane");
  const r = subdivideOnce(p.vertices, p.faces, p.uvs);
  assert.ok(r.vertices.every((v) => Math.abs(v[1]) < 1e-9));
  assert.ok(r.vertices.some((v) => Math.abs(v[0] + 8) < 1e-9 && Math.abs(v[2] + 8) < 1e-9), "la esquina se queda");
  assert.equal(r.faces.length, 64);
});

test("media malla con simetría queda cerrada y sin vértices repetidos", () => {
  const h = halfCube();
  assert.deepEqual(validateMesh(h), []);
  const r = mirrorMesh(h);
  assert.equal(r.vertices.length, 12);
  for (let i = 0; i < r.vertices.length; i++)
    for (let j = i + 1; j < r.vertices.length; j++) assert.ok(Math.hypot(...(r.vertices[i].map((x, k) => x - r.vertices[j][k]) as Vec3)) > 1e-6);
  for (const list of edgeFaces(r.faces).values()) assert.equal(list.length, 2);
  assert.ok(facesOutward(asMesh(r)));
  assert.deepEqual(r.source.slice(8), [1, 2, 5, 6]);
  const off = mirrorMesh({ ...h, mirrorX: false });
  assert.equal(off.vertices.length, 8);
});

test("faceOf apunta a la cara de origen; con simetría cada cara aparece el doble", () => {
  const h = halfCube();
  const plain = meshGeometry({ ...h, mirrorX: false });
  const mir = meshGeometry(h);
  assert.equal(plain.faceOf.length, plain.indices.length / 3);
  assert.equal(mir.faceOf.length, mir.indices.length / 3);
  assert.ok(mir.faceOf.every((f) => f >= 0 && f < h.faces.length));
  for (let f = 0; f < h.faces.length; f++) assert.equal(mir.faceOf.filter((x) => x === f).length, 2 * plain.faceOf.filter((x) => x === f).length);
  const sub = meshGeometry({ ...h, subdivision: 2 });
  assert.equal(sub.indices.length / 3, 10 * 16 * 2);
});

test("normales unitarias, planas y suaves", () => {
  for (const smooth of [false, true]) {
    const g = meshGeometry({ ...primitiveMesh("sphere"), smooth, subdivision: 1 });
    for (let i = 0; i < g.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2]) - 1) < 1e-6);
  }
  // Con sombreado suave, las copias de un mismo punto llevan la misma normal.
  const g = meshGeometry({ ...cube8(), smooth: true });
  const byPos = new Map<string, string>();
  for (let i = 0; i < g.positions.length; i += 3) {
    const k = g.positions.slice(i, i + 3).join(",");
    const n = g.normals.slice(i, i + 3).map((x) => x.toFixed(6)).join(",");
    if (byPos.has(k)) assert.equal(byPos.get(k), n);
    byPos.set(k, n);
  }
});

test("UV en [0, 1] y sin desplegar (0, 0)", () => {
  const c = cube8();
  c.uvs = c.faces.map(() => [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const g = meshGeometry({ ...c, subdivision: 2 });
  assert.ok(g.uvs.every((u) => u >= 0 && u <= 1));
  assert.ok(g.uvs.some((u) => u > 0 && u < 1));
  const bare = meshGeometry(cube8());
  assert.ok(bare.uvs.every((u) => u === 0));
  assert.equal(bare.uvs.length, (bare.positions.length / 3) * 2);
});

test("escala y malla vacía", () => {
  const g = meshGeometry(cube8(), 1 / 16);
  assert.ok(g.positions.every((x) => Math.abs(x) <= 0.5 + 1e-9));
  const e = meshGeometry(emptyMesh());
  assert.equal(e.indices.length, 0);
});
