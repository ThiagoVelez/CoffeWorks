import { test } from "node:test";
import assert from "node:assert/strict";
import { CORNER_UV, FACE_GEOMETRY, QUAD_INDICES, faceCorners, uvToPixel } from "./geometry";
import { FACES, type Box } from "./types";

test("los dos triángulos de cada cara miran hacia fuera", () => {
  const box = { from: [0, 0, 0], size: [2, 3, 4], faces: {} } as unknown as Box;
  for (const f of FACES) {
    const c = faceCorners(box, f);
    for (let t = 0; t < 6; t += 3) {
      const [a, b, d] = QUAD_INDICES.slice(t, t + 3).map((i) => c[i]);
      const e1 = b.map((v, k) => v - a[k]);
      const e2 = d.map((v, k) => v - a[k]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const dot = n.reduce((s, v, k) => s + v * FACE_GEOMETRY[f].normal[k], 0);
      assert.ok(dot > 0, `cara ${f}, triángulo ${t / 3}`);
    }
  }
});

test("las esquinas de cada cara están en su plano y la UV va de arriba-izquierda a abajo-derecha", () => {
  const box = { from: [-1, -1, -1], size: [2, 2, 2], faces: {} } as unknown as Box;
  for (const f of FACES) {
    const n = FACE_GEOMETRY[f].normal;
    const axis = n.findIndex((v) => v !== 0);
    for (const c of faceCorners(box, f)) assert.equal(c[axis], n[axis]);
    // La esquina de arriba-izquierda (TL) está más alta o igual que la de abajo-izquierda (BL).
    const [tl, , , bl] = faceCorners(box, f);
    if (axis !== 1) assert.ok(tl[1] > bl[1], f);
  }
  assert.deepEqual(CORNER_UV[0], [0, 0]);
  assert.deepEqual(uvToPixel(0.999, 0), [31, 0]);
  assert.deepEqual(uvToPixel(1.5, -1), [31, 0]);
});
