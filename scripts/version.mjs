#!/usr/bin/env node
// Cambia la versión (y opcionalmente la fase) de toda la suite.
//
//   node scripts/version.mjs 2.7.1             (mantiene la fase actual)
//   node scripts/version.mjs 2.8.0 beta        (fase: alpha, beta o estable)
//
// Al llegar a main una versión que aún no está publicada, GitHub Actions crea
// la versión (Release) con el instalador y los Launcher instalados se
// actualizan solos.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [version, stageArg] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("Uso: node scripts/version.mjs <mayor.menor.parche> [alpha|beta|estable]");
  process.exit(1);
}
const stages = { alpha: "alpha", beta: "beta", estable: "", stable: "" };
if (stageArg !== undefined && !(stageArg in stages)) {
  console.error("La fase debe ser alpha, beta o estable.");
  process.exit(1);
}

function edit(file, replacements) {
  const path = join(root, file);
  let text = readFileSync(path, "utf8");
  for (const [pattern, value] of replacements) {
    if (!pattern.test(text)) throw new Error(`No se encontró ${pattern} en ${file}`);
    text = text.replace(pattern, value);
  }
  writeFileSync(path, text);
  console.log(`✓ ${file}`);
}

edit("Cargo.toml", [[/(\[workspace\.package\]\s*\nversion = ")[^"]+"/, `$1${version}"`]]);
edit("package.json", [[/("version": ")[^"]+"/, `$1${version}"`]]);
edit("src-tauri/tauri.conf.json", [[/("version": ")[^"]+"/, `$1${version}"`]]);
edit("installer/CoffeeWorks.iss", [[/(#define AppVersion ")[^"]+"/, `$1${version}"`]]);
edit("src/version.ts", [[/(APP_VERSION = ")[^"]+"/, `$1${version}"`]]);

if (stageArg !== undefined) {
  const stage = stages[stageArg];
  const label = stage ? stage[0].toUpperCase() + stage.slice(1) : "";
  edit("src-tauri/src/updater.rs", [[/(pub const STAGE: &str = ")[^"]*"/, `$1${stage}"`]]);
  edit("src/version.ts", [[/(APP_STAGE = ")[^"]*"/, `$1${label}"`]]);
}

console.log(`\nVersión ${version}${stageArg ? ` (${stageArg})` : ""}. Ejecuta \`cargo check\` para actualizar Cargo.lock y sube los cambios a main.`);
