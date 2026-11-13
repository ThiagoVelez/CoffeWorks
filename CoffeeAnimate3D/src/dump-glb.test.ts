import { test } from "node:test";
import { writeFileSync } from "node:fs";
import { exportGlb } from "./gltf";
import { TEMPLATES } from "./templates";

// Vuelca las plantillas en GLB para validarlas fuera (SF_GLB_DIR=/ruta npx tsx --test …).
test("volcar plantillas", { skip: !process.env.SF_GLB_DIR }, () => {
  for (const [n, make] of Object.entries(TEMPLATES)) writeFileSync(`${process.env.SF_GLB_DIR}/${n}.glb`, exportGlb(make()));
});
