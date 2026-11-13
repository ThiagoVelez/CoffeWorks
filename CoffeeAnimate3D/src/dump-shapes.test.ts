import { test } from "node:test";
import { writeFileSync } from "node:fs";
import { exportGlb } from "./gltf";
import { addPart, newModel } from "./model";
import { SHAPES } from "./types";

// Vuelca un modelo con todas las formas para validarlo fuera (SF_GLB_DIR=/ruta).
test("volcar formas", { skip: !process.env.SF_GLB_DIR }, () => {
  let m = newModel("Formas");
  SHAPES.forEach((shape, i) => {
    [m] = addPart(m, { name: shape, pivot: [i * 10, 0, 0], box: { from: [-2, 0, -3], size: [4, 6, 6], shape } });
  });
  writeFileSync(`${process.env.SF_GLB_DIR}/formas.glb`, exportGlb(m));
});
