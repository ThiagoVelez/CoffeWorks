import { test } from "node:test";
import assert from "node:assert/strict";
import { addMeshPart, addPart, findPart, mirrorPart, newModel, parseModel, serializeModel, updateMesh, validateModel } from "./model";
import { cloneMesh, meshEdges, primitiveMesh, validateMesh } from "./mesh";
import { MESH_PRIMITIVES } from "./types";
import { TEMPLATES } from "./templates";
import type { MeshData, Vec3 } from "./types";

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Cada cara mira hacia fuera respecto al centro `c`. */
export function facesOutward(m: MeshData, c: Vec3 = [0, 0, 0]): boolean {
  return m.faces.every((f) => {
    const [a, b, d] = [m.vertices[f[0]], m.vertices[f[1]], m.vertices[f[2]]];
    const n = cross(sub(b, a), sub(d, a));
    const cen = f.reduce<Vec3>((s, i) => [s[0] + m.vertices[i][0] / f.length, s[1] + m.vertices[i][1] / f.length, s[2] + m.vertices[i][2] / f.length], [0, 0, 0]);
    return dot(n, sub(cen, c)) > 0;
  });
}

const quad = (): MeshData => ({
  vertices: [[0, 0, 0], [4, 0, 0], [4, 0, 4], [0, 0, 4]],
  faces: [[0, 3, 2, 1]],
  uvs: [],
  texture: { size: 64, color: "#c8a27a" },
  mirrorX: false,
  subdivision: 0,
  smooth: false,
});

test("v2 sin mallas → guardar solo cambia version", () => {
  for (const make of Object.values(TEMPLATES)) {
    const v2 = serializeModel(make()).replace('"version":3', '"version":2');
    assert.ok(v2.includes('"version":2'));
    assert.equal(serializeModel(parseModel(v2)), v2.replace('"version":2', '"version":3'));
  }
});

test("primitivas válidas y con los conteos del plan", () => {
  for (const k of MESH_PRIMITIVES) assert.deepEqual(validateMesh(primitiveMesh(k)), [], k);
  const cube = primitiveMesh("cube");
  assert.equal(cube.vertices.length, 26);
  assert.equal(cube.faces.length, 24);
  const sphere = primitiveMesh("sphere");
  assert.equal(sphere.vertices.length, 98);
  assert.equal(sphere.faces.length, 96);
  assert.equal(primitiveMesh("plane").faces.length, 16);
  const cyl = primitiveMesh("cylinder");
  assert.equal(cyl.faces.length, 18);
  assert.equal(cyl.vertices.length, 32);
  assert.deepEqual(cube.uvs, []);
  assert.equal(cube.texture.size, 64);
});

test("primitivas cerradas miran hacia fuera", () => {
  for (const k of ["cube", "sphere", "cylinder"] as const) assert.ok(facesOutward(primitiveMesh(k)), k);
});

test("validateMesh detecta los problemas", () => {
  const broken = (fn: (m: MeshData) => void) => {
    const m = quad();
    fn(m);
    return validateMesh(m);
  };
  assert.deepEqual(validateMesh(quad()), []);
  assert.ok(broken((m) => (m.faces[0][1] = 9)).length > 0, "índice roto");
  assert.ok(broken((m) => (m.faces[0] = [0, 1])).length > 0, "cara de 2");
  assert.ok(broken((m) => (m.faces[0] = [0, 1, 1, 2])).length > 0, "vértice repetido");
  assert.ok(broken((m) => (m.uvs = [[[0, 0], [1, 0], [1, 1]]])).length > 0, "uvs de otra longitud");
  assert.ok(broken((m) => (m.uvs = [[[0, 0], [1, 0], [1, 2], [0, 1]]])).length > 0, "uv fuera de [0,1]");
  assert.ok(
    broken((m) => {
      m.vertices.push([2, 4, 2], [2, -4, 2]);
      m.faces = [[0, 1, 4], [1, 0, 5], [0, 1, 2]];
    }).length > 0,
    "arista con 3 caras",
  );
  assert.ok(
    broken((m) => {
      m.vertices.push([8, 0, 0], [8, 0, 4]);
      m.faces = [[0, 3, 2, 1], [4, 5, 2, 1]];
    }).length > 0,
    "cara vecina volteada",
  );
  assert.ok(
    broken((m) => {
      m.mirrorX = true;
      m.vertices[0] = [-2, 0, 0];
    }).length > 0,
    "x < 0 con simetría",
  );
});

test("meshEdges y cloneMesh", () => {
  const m = quad();
  assert.deepEqual(meshEdges(m), [[0, 1], [0, 3], [1, 2], [2, 3]]);
  const c = cloneMesh(m);
  c.vertices[0][0] = 99;
  assert.equal(m.vertices[0][0], 0);
});

test("parseModel conserva la malla y validateModel marca caja y malla", () => {
  let m = newModel();
  let id: string;
  [m, id] = addMeshPart(m, { name: "Cuerpo", mesh: primitiveMesh("sphere") });
  const back = parseModel(serializeModel(m));
  assert.deepEqual(findPart(back, id).mesh, findPart(m, id).mesh);
  assert.equal(findPart(back, id).box, null);
  assert.deepEqual(validateModel(back), []);
  const [bm, bid] = addPart(newModel(), { name: "c", box: { from: [0, 0, 0], size: [1, 1, 1] } });
  const boxed = findPart(bm, bid);
  const both = { ...m, parts: m.parts.map((p) => ({ ...p, box: boxed.box })) };
  assert.ok(validateModel(both).some((s) => s.includes("caja y malla")));
  // Al leer un archivo con las dos, gana la caja.
  const read = parseModel(serializeModel(both));
  assert.equal(read.parts[0].mesh, undefined);
  assert.ok(read.parts[0].box);
});

test("parseModel sanea la malla", () => {
  const raw = JSON.parse(serializeModel(addMeshPart(newModel(), { name: "M", mesh: quad() })[0]));
  raw.parts[0].mesh.subdivision = 7;
  raw.parts[0].mesh.texture.size = 100;
  const m = parseModel(JSON.stringify(raw));
  assert.equal(m.parts[0].mesh!.subdivision, 2);
  assert.equal(m.parts[0].mesh!.texture.size, 64);
});

test("addMeshPart y updateMesh rechazan una malla rota con el primer aviso", () => {
  const bad = quad();
  bad.faces[0][0] = 40;
  assert.throws(() => addMeshPart(newModel(), { name: "M", mesh: bad }), new RegExp(validateMesh(bad)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const [m, id] = addMeshPart(newModel(), { name: "M", mesh: quad() });
  assert.throws(() => updateMesh(m, id, bad));
  const moved = quad();
  moved.vertices[0] = [1, 0, 0];
  assert.deepEqual(findPart(updateMesh(m, id, moved), id).mesh!.vertices[0], [1, 0, 0]);
});

test("mirrorPart refleja una malla", () => {
  let m = newModel();
  let a: string, b: string;
  const mesh = primitiveMesh("cube");
  mesh.vertices = mesh.vertices.map((v) => [v[0] + 20, v[1], v[2]]);
  [m, a] = addMeshPart(m, { name: "brazo izquierdo", mesh });
  [m, b] = mirrorPart(m, a);
  const r = findPart(m, b).mesh!;
  r.vertices.forEach((v, i) => assert.equal(v[0], -mesh.vertices[i][0] || 0));
  assert.deepEqual(validateMesh(r), []);
  assert.ok(facesOutward(r, [-20, 0, 0]));
  // Una caja sigue reflejándose como antes.
  let n = newModel();
  let c: string;
  [n, c] = addPart(n, { name: "x", box: { from: [0, 0, 0], size: [1, 1, 1] } });
  assert.equal(mirrorPart(n, c)[0].parts.length, 2);
});
