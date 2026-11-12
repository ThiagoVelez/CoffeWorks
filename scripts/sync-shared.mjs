#!/usr/bin/env node
// Copia el código compartido (shared/) a las apps que lo usan.
//   node scripts/sync-shared.mjs          copia
//   node scripts/sync-shared.mjs --check  falla si alguna copia está desactualizada

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Carpeta de shared/ → apps que la usan (se copia en src/<carpeta>)
const GROUPS = {
  spell: ["CoffeeDoc", "CoffeeView", "CoffeePDF", "CoffeeCalc", "CoffeePage", "CoffeeDataBase"],
  theme: [".", "CoffeeDoc", "CoffeeBooks", "CoffeeCalc", "CoffeeView", "CoffeePDF", "CoffeePage", "CoffeeDataBase", "CoffeeUIUX", "CoffeeUML", "CoffeeEdit", "CoffeeLive"],
  studio: ["CoffeePhoto", "CoffeeVector", "CoffeePaint", "CoffeeLens", "CoffeeMotion", "CoffeeSound", "CoffeeEncoder", "CoffeeAnimate", "CoffeePuppet"],
};
const check = process.argv.includes("--check");
let stale = 0;

for (const [group, apps] of Object.entries(GROUPS))
for (const app of apps) {
  const source = path.join(root, "shared", group);
  const target = path.join(root, app, "src", group);
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(source)) {
    const content = `// ⚠ Copia de shared/${group}/${file}: edita el original y ejecuta node scripts/sync-shared.mjs\n${readFileSync(path.join(source, file), "utf8")}`;
    const dest = path.join(target, file);
    if (check) {
      if (!existsSync(dest) || readFileSync(dest, "utf8") !== content) {
        console.error(`Desactualizado: ${path.relative(root, dest)}`);
        stale++;
      }
    } else writeFileSync(dest, content);
  }
}
if (check && stale) process.exit(1);
console.log(check ? "El código compartido está al día." : `Copiado shared/ a ${Object.values(GROUPS).flat().length} apps.`);
