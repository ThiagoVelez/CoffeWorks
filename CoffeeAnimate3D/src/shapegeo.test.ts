import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeGeometry } from "./geometry";
import { SHAPES, SHAPE_FACES, FACES, type Box, type Shape } from "./types";

const box = (shape: Shape): Box => ({ shape, from: [-2, 0, -3], size: [4, 6, 6], faces: {} } as unknown as Box);

for (const shape of SHAPES) {
  test(`${shape}: dentro de la caja, normales unitarias, UV en [0,1] y solo sus caras`, () => {
    const g = shapeGeometry(box(shape));
    const b = box(shape);
    for (let i = 0; i < g.positions.length; i += 3)
      for (let k = 0; k < 3; k++) {
        assert.ok(g.positions[i + k] >= b.from[k] - 1e-6 && g.positions[i + k] <= b.from[k] + b.size[k] + 1e-6, `pos fuera ${shape}`);
      }
    for (let i = 0; i < g.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2]) - 1) < 1e-6);
    for (const v of g.uvs) assert.ok(v >= -1e-6 && v <= 1 + 1e-6, `uv ${v}`);
    assert.deepEqual([...new Set(g.groups.map((x) => x.face))].sort(), [...SHAPE_FACES[shape]].sort());
    assert.deepEqual(g.groups.map((x) => x.face), FACES.filter((f) => g.groups.some((x) => x.face === f)), "orden de FACES");
    const total = g.groups.reduce((s, x) => s + x.count, 0);
    assert.equal(total, g.indices.length);
  });
}

for (const shape of ["box", "cylinder", "sphere", "ramp"] as Shape[]) {
  test(`${shape}: todos los triángulos miran hacia fuera`, () => {
    const g = shapeGeometry(box(shape));
    // Centro de masa: el de la caja, salvo la rampa (cuña), cuya pendiente pasa por él.
    const c = shape === "ramp" ? [0, 0 + 6 / 3, -3 + 6 / 3] : [0, 3, 0];
    const p = (i: number) => [g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]];
    for (let t = 0; t < g.indices.length; t += 3) {
      const [a, b2, d] = [p(g.indices[t]), p(g.indices[t + 1]), p(g.indices[t + 2])];
      const e1 = b2.map((v, k) => v - a[k]);
      const e2 = d.map((v, k) => v - a[k]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const area = Math.hypot(...n);
      if (area < 1e-9) continue;
      const cen = [0, 1, 2].map((k) => (a[k] + b2[k] + d[k]) / 3 - c[k]);
      assert.ok(n.reduce((s, v, k) => s + v * cen[k], 0) > 0, `${shape} triángulo ${t / 3}`);
    }
  });
}

test("caja: 24 vértices; cilindro: 16 lados; plano: dos caras", () => {
  assert.equal(shapeGeometry(box("box")).positions.length / 3, 24);
  const cyl = shapeGeometry(box("cylinder"));
  const side = cyl.groups.filter((x) => !["py", "ny"].includes(x.face)).reduce((s, x) => s + x.count, 0);
  assert.equal(side / 6, 16);
  const plane = shapeGeometry(box("plane"));
  assert.equal(plane.indices.length, 12);
  const ys = new Set<number>();
  for (let i = 1; i < plane.positions.length; i += 3) ys.add(plane.positions[i]);
  assert.deepEqual([...ys], [3]);
});
