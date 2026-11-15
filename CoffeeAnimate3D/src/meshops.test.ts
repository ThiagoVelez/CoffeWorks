import { test } from "node:test";
import assert from "node:assert/strict";
import { edgeFaces, primitiveMesh, validateMesh } from "./mesh";
import { edgeLoop, linked, proportional, selectedEdges, selectedFaces, selectionCenter } from "./meshsel";
import {
  applyMirror,
  applySubdivision,
  bevel,
  deleteSelection,
  extrude,
  fillFace,
  flipFaces,
  inset,
  loopCut,
  mergeVertices,
  moveVertices,
  recalcNormals,
  relax,
  rotateVertices,
  scaleVertices,
  subdivideFaces,
} from "./meshops";
import { cube8, facesOutward, halfCube } from "./meshtest-utils";
import { MAX_MESH_FACES, type MeshData } from "./types";

const ok = (m: MeshData) => assert.deepEqual(validateMesh(m), []);
const vertsWhere = (m: MeshData, fn: (v: [number, number, number]) => boolean) => m.vertices.flatMap((v, i) => (fn(v) ? [i] : []));
const faceVerts = (m: MeshData, f: number) => [...m.faces[f]];
const closed = (m: MeshData) => [...edgeFaces(m.faces).values()].every((l) => l.length === 2);

test("selección por vértices: caras, aristas, conectado y centro", () => {
  const c = cube8();
  assert.deepEqual(selectedFaces(c, [0, 1, 2, 3]), [0]);
  assert.deepEqual(selectedEdges(c, [0, 1]), [[0, 1]]);
  assert.equal(linked(c, [0]).length, 8);
  assert.deepEqual(selectionCenter(c, [0, 6]), [0, 0, 0]);
});

test("edgeLoop del cubo de 24 caras recorre 8 vértices", () => {
  const c = primitiveMesh("cube");
  const a = c.vertices.findIndex((v) => v[0] === 8 && v[1] === 0 && v[2] === 0);
  const b = c.vertices.findIndex((v) => v[0] === 8 && v[1] === 0 && v[2] === 8);
  const loop = edgeLoop(c, a, b);
  assert.equal(loop.length, 8);
  assert.ok(loop.every((i) => c.vertices[i][1] === 0));
});

test("proporcional: 1 en la selección, cae con la distancia, 0 fuera del radio", () => {
  const c = primitiveMesh("cube");
  const top = c.vertices.findIndex((v) => v[0] === 0 && v[1] === 8 && v[2] === 0);
  const w = proportional(c, [top], 10);
  assert.equal(w.get(top), 1);
  const near = c.vertices.findIndex((v) => v[0] === 8 && v[1] === 8 && v[2] === 0);
  assert.ok(w.get(near)! > 0 && w.get(near)! < 1);
  const far = c.vertices.findIndex((v) => v[1] === -8 && v[0] === 0 && v[2] === 0);
  assert.equal(w.get(far) ?? 0, 0);
  assert.equal(proportional(c, [top], null).size, 1);
});

test("extruir las caras de arriba del cubo de 24", () => {
  const c = primitiveMesh("cube");
  const top = vertsWhere(c, (v) => v[1] === 8);
  const r = extrude(c, top, 4);
  ok(r.mesh);
  assert.equal(r.mesh.faces.length, 24 + 8);
  assert.equal(r.verts.length, 9);
  assert.ok(r.verts.every((i) => Math.abs(r.mesh.vertices[i][1] - 12) < 1e-9));
  assert.ok(closed(r.mesh) && facesOutward(r.mesh, [0, 2, 0]));
});

test("extruir aristas de borde de un plano", () => {
  const p = primitiveMesh("plane");
  const edge = vertsWhere(p, (v) => v[2] === 8);
  const r = extrude(p, edge, 4);
  ok(r.mesh);
  assert.equal(r.mesh.faces.length, 16 + 4);
  assert.ok(r.verts.every((i) => Math.abs(r.mesh.vertices[i][2] - 12) < 1e-9));
  assert.throws(() => extrude(p, [], 4), /Extruir/);
});

test("insertar cara: una cara pasa a 5", () => {
  const c = cube8();
  const r = inset(c, faceVerts(c, 1), 2);
  ok(r.mesh);
  assert.equal(r.mesh.faces.length, 6 + 4);
  assert.equal(r.verts.length, 4);
  assert.ok(r.verts.every((i) => Math.abs(r.mesh.vertices[i][2] - 8) < 1e-9 && Math.abs(r.mesh.vertices[i][0]) <= 6 + 1e-9));
});

test("corte en bucle del cubo de 24: +8 caras y +8 vértices en anillo", () => {
  const c = primitiveMesh("cube");
  const a = c.vertices.findIndex((v) => v[0] === 8 && v[1] === 8 && v[2] === 0);
  const b = c.vertices.findIndex((v) => v[0] === 8 && v[1] === 0 && v[2] === 0);
  const r = loopCut(c, a, b, 0.5);
  ok(r.mesh);
  assert.equal(r.mesh.faces.length, 32);
  assert.equal(r.verts.length, 8);
  assert.ok(r.verts.every((i) => Math.abs(r.mesh.vertices[i][1] - 4) < 1e-9));
  assert.ok(closed(r.mesh) && facesOutward(r.mesh));
});

test("biselar una arista del cubo: 7 caras; tres aristas en un vértice da error", () => {
  const c = cube8();
  const r = bevel(c, [0, 1], 2);
  ok(r.mesh);
  assert.equal(r.mesh.faces.length, 7);
  assert.equal(r.mesh.vertices.length, 10);
  assert.ok(closed(r.mesh) && facesOutward(r.mesh));
  assert.throws(() => bevel(c, [0, 1, 3, 4], 2), /Biselar: selecciona aristas en hilera \(cadenas o bucles\)/);
});

test("biselar un bucle de aristas del cubo de 24", () => {
  const c = primitiveMesh("cube");
  const ring = vertsWhere(c, (v) => v[1] === 0);
  const r = bevel(c, ring, 1);
  ok(r.mesh);
  assert.equal(r.mesh.faces.length, 24 + 8);
  assert.ok(closed(r.mesh) && facesOutward(r.mesh));
});

test("unir al centro los 4 vértices de una cara", () => {
  const c = cube8();
  const r = mergeVertices(c, faceVerts(c, 1), "center");
  ok(r);
  assert.equal(r.vertices.length, 5);
  assert.equal(r.faces.length, 5);
  const byDist = mergeVertices(c, [0, 1], "distance", 0.5);
  assert.equal(byDist.vertices.length, 8);
});

test("borrar caras deja los vértices compartidos; borrar vértices quita sus caras", () => {
  const c = cube8();
  const f = deleteSelection(c, faceVerts(c, 1), "face");
  ok(f);
  assert.equal(f.faces.length, 5);
  assert.equal(f.vertices.length, 8);
  const v = deleteSelection(c, [6], "vertex");
  ok(v);
  assert.equal(v.faces.length, 3);
  assert.equal(v.vertices.length, 7);
  const all = deleteSelection(c, [0, 1, 2, 3, 4, 5, 6, 7], "face");
  assert.equal(all.faces.length, 0);
  assert.equal(all.vertices.length, 0);
});

test("crear cara cierra el agujero y mira hacia fuera", () => {
  const c = cube8();
  const holeVerts = faceVerts(c, 1);
  const holed = deleteSelection(c, holeVerts, "face");
  const r = fillFace(holed, holeVerts.map((i) => holed.vertices.findIndex((v) => v.join() === c.vertices[i].join())));
  ok(r);
  assert.ok(closed(r) && facesOutward(r));
  assert.throws(() => fillFace(c, [0, 1]), /Crear cara/);
});

test("subdividir una cara: queda en 4 y las vecinas ganan vértices", () => {
  const c = cube8();
  const r = subdivideFaces(c, faceVerts(c, 1));
  ok(r);
  assert.equal(r.faces.length, 5 + 4);
  assert.equal(r.vertices.length, 8 + 5);
  assert.ok(closed(r) && facesOutward(r));
});

test("relajar acerca un pico de la esfera a la media", () => {
  const s = primitiveMesh("sphere");
  const top = s.vertices.findIndex((v) => v[0] === 0 && v[2] === 0 && v[1] > 0);
  s.vertices[top] = [0, 20, 0];
  const r = relax(s, [top], 0.5);
  ok(r);
  assert.ok(r.vertices[top][1] < 20);
});

test("voltear y recalcular normales", () => {
  const c = cube8();
  const flipped = flipFaces(flipFaces(c, [0, 1, 2, 3, 4, 5, 6, 7]), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(flipped.faces, c.faces);
  // Voltear una cara voltea toda su parte conectada: la malla sigue coherente.
  const one = flipFaces(c, faceVerts(c, 0));
  ok(one);
  assert.ok(facesOutward({ ...one, faces: one.faces.map((f) => [...f].reverse()) }));
  const bad = { ...c, faces: c.faces.map((f, i) => (i < 3 ? [...f].reverse() : f)) };
  const r = recalcNormals(bad);
  ok(r);
  assert.ok(facesOutward(r));
  const inside = { ...c, faces: c.faces.map((f) => [...f].reverse()) };
  assert.ok(facesOutward(recalcNormals(inside)));
});

test("aplicar simetría y subdivisión", () => {
  const h = halfCube();
  const m = applyMirror(h);
  ok(m);
  assert.equal(m.mirrorX, false);
  assert.equal(m.vertices.length, 12);
  assert.ok(closed(m) && facesOutward(m));
  const s = applySubdivision({ ...h, subdivision: 1 });
  ok(s);
  assert.equal(s.subdivision, 0);
  assert.equal(s.mirrorX, true);
  assert.ok(s.vertices.every((v) => v[0] >= -1e-9));
  assert.equal(s.faces.length, 5 * 4);
});

test("simetría: nadie cruza x = 0 y el centro no se despega", () => {
  const h = halfCube();
  const w = new Map(h.vertices.map((_, i) => [i, 1]));
  const r = moveVertices(h, w, [-50, 3, 0]);
  ok(r);
  assert.ok(r.vertices.every((v) => v[0] === 0));
  assert.ok(r.vertices.every((v, i) => v[1] === h.vertices[i][1] + 3));
  const rot = rotateVertices(h, w, [0, 1, 0, 0], [0, 0, 0]);
  assert.ok(rot.vertices.every((v) => v[0] >= 0));
  const sc = scaleVertices(h, new Map([[1, 1]]), [2, 2, 2], [0, 0, 0]);
  assert.deepEqual(sc.vertices[1], [16, -16, -16]);
});

test("límite de caras", () => {
  const big = { ...primitiveMesh("plane") };
  const n = Math.ceil(Math.sqrt(MAX_MESH_FACES - 10));
  big.vertices = [];
  big.faces = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) big.vertices.push([i, 0, j]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (big.faces.length < MAX_MESH_FACES - 10) big.faces.push([j * (n + 1) + i, (j + 1) * (n + 1) + i, (j + 1) * (n + 1) + i + 1, j * (n + 1) + i + 1]);
  ok(big);
  assert.throws(() => subdivideFaces(big, big.vertices.map((_, i) => i)), /La malla superaría 20 000 caras/);
});

test("barrido con UV: toda operación deja UV coherentes y en [0, 1]", () => {
  const base = primitiveMesh("cube");
  base.uvs = base.faces.map(() => [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const top = vertsWhere(base, (v) => v[1] === 8);
  const face0 = faceVerts(base, 0);
  const a = base.vertices.findIndex((v) => v[0] === 8 && v[1] === 8 && v[2] === 0);
  const b = base.vertices.findIndex((v) => v[0] === 8 && v[1] === 0 && v[2] === 0);
  const ring = vertsWhere(base, (v) => v[1] === 0);
  const results: [string, MeshData][] = [
    ["extrude", extrude(base, top, 4).mesh],
    ["inset", inset(base, face0, 1).mesh],
    ["loopCut", loopCut(base, a, b, 0.3).mesh],
    ["bevel", bevel(base, ring, 1).mesh],
    ["merge", mergeVertices(base, face0, "center")],
    ["delete", deleteSelection(base, face0, "face")],
    ["subdivide", subdivideFaces(base, face0)],
    ["relax", relax(base, top, 0.5)],
    ["flip", flipFaces(base, face0)],
    ["recalc", recalcNormals(base)],
    ["applySub", applySubdivision({ ...base, subdivision: 1 })],
  ];
  for (const [name, m] of results) {
    assert.deepEqual(validateMesh(m), [], name);
    assert.equal(m.uvs.length, m.faces.length, name);
  }
});

// ---------- Revisión final ----------
import { halveForMirror } from "./meshops";
import { mirrorMesh, subdivideOnce } from "./meshgeo";
import { boxToMesh } from "./meshconvert";
import { addMeshPart, addPart, findPart, mirrorPart, newModel, parseModel, serializeModel } from "./model";

test("revisión 1: copia reflejada de una malla con simetría sigue válida y no se aplana", () => {
  const h = halfCube();
  let m = newModel();
  let a: string, b: string;
  [m, a] = addMeshPart(m, { name: "cuerpo izquierdo", pivot: [4, 0, 0], mesh: h });
  [m, b] = mirrorPart(m, a);
  const copy = findPart(m, b).mesh!;
  ok(copy);
  assert.deepEqual(copy.vertices, h.vertices);
  const moved = moveVertices(copy, new Map([[1, 1]]), [0, 3, 0]);
  assert.ok(moved.vertices.some((v) => v[0] === 8), "los demás vértices no se aplanan");
});

test("revisión 2: activar la simetría corta en x = 0 en vez de borrar casi todo", () => {
  const [mm, id] = addPart(newModel(), { name: "c", box: { from: [-4, -4, -4], size: [8, 8, 8] } });
  const conv = boxToMesh(findPart(mm, id).box!);
  const half = halveForMirror(conv);
  ok(half);
  assert.equal(half.mirrorX, true);
  assert.equal(half.faces.length, 5);
  assert.equal(half.uvs.length, half.faces.length);
  const full = mirrorMesh(half);
  for (const list of edgeFaces(full.faces).values()) assert.equal(list.length, 2);
  assert.throws(() => halveForMirror({ ...cube8(), vertices: cube8().vertices.map((v) => [v[0] - 20, v[1], v[2]]) }), /x < 0/);
});

test("revisión 3: recalcular normales de 6144 caras tarda poco", () => {
  let s = primitiveMesh("sphere");
  let g = { vertices: s.vertices, faces: s.faces, uvs: s.uvs };
  for (let i = 0; i < 3; i++) g = subdivideOnce(g.vertices, g.faces, g.uvs);
  const big = { ...s, vertices: g.vertices, faces: g.faces.map((f, i) => (i % 7 === 0 ? [...f].reverse() : f)), uvs: [] };
  const t = performance.now();
  const r = recalcNormals(big);
  assert.ok(performance.now() - t < 3000, `tardó ${Math.round(performance.now() - t)} ms`);
  ok(r);
});

test("revisión 4: un .ca3d con una malla dañada da un error claro al abrir", () => {
  const [m] = addMeshPart(newModel(), { name: "Rota", mesh: cube8() });
  const raw = JSON.parse(serializeModel(m));
  raw.parts[0].mesh.faces[0] = [0, 1, 50];
  assert.throws(() => parseModel(JSON.stringify(raw)), /malla dañada/);
});

test("revisión 6: biselar un anillo que toca la costura de la simetría", () => {
  const half = halveForMirror(primitiveMesh("cylinder"));
  const top = vertsWhere(half, (v) => v[1] === 8);
  const r = bevel(half, top, 1);
  ok(r.mesh);
  for (const list of edgeFaces(mirrorMesh(r.mesh).faces).values()) assert.equal(list.length, 2);
  assert.ok(r.mesh.vertices.every((v) => v[0] >= 0));
});
