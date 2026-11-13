import { test } from "node:test";
import assert from "node:assert/strict";
import { VIEWCUBE_REGIONS, cameraDir } from "./viewcube-data";

test("26 regiones, direcciones únicas", () => {
  assert.equal(VIEWCUBE_REGIONS.length, 26);
  assert.equal(new Set(VIEWCUBE_REGIONS.map((r) => r.dir.join())).size, 26);
  assert.equal(VIEWCUBE_REGIONS.filter((r) => r.kind === "face").length, 6);
  assert.equal(VIEWCUBE_REGIONS.filter((r) => r.kind === "edge").length, 12);
  assert.equal(VIEWCUBE_REGIONS.filter((r) => r.kind === "corner").length, 8);
  const label = (l: string) => VIEWCUBE_REGIONS.find((r) => r.label === l)!.dir.join();
  assert.equal(label("Frente"), "0,0,1");
  assert.equal(label("Detrás"), "0,0,-1");
  assert.equal(label("Der."), "1,0,0");
  assert.equal(label("Izq."), "-1,0,0");
  assert.equal(label("Arriba"), "0,1,0");
  assert.equal(label("Abajo"), "0,-1,0");
});

test("cameraDir no es paralela a Y ni da NaN", () => {
  for (const v of [[0, 1, 0], [0, -1, 0]] as const) {
    const d = cameraDir([...v]);
    assert.ok(d[2] > 0 && d.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
  }
  const c = cameraDir([1, 1, 1]);
  assert.ok(Math.abs(c[0] - 1 / Math.sqrt(3)) < 1e-9);
});
