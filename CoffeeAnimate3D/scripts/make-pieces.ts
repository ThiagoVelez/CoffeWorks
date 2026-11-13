// Escribe las piezas del complemento «Pack de piezas» en addons/coffee-ca3d-piezas.
// Uso (desde CoffeeAnimate3D): npx tsx scripts/make-pieces.ts

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PIECES } from "../src/pieces";
import { normalizeIds, serializeModel } from "../src/model";

const dir = join(import.meta.dirname, "..", "..", "addons", "coffee-ca3d-piezas");
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.endsWith(".ca3d")) rmSync(join(dir, f));
for (const p of PIECES) writeFileSync(join(dir, p.file), serializeModel(normalizeIds(p.make())));
writeFileSync(join(dir, "piezas.json"), JSON.stringify(PIECES.map((p) => ({ name: p.name, category: p.category, file: p.file })), null, 2) + "\n");
console.log(`${PIECES.length} piezas en ${dir}`);
