#!/usr/bin/env node
// Compila la suite CoffeWorks para escritorio.
//
//   node scripts/build.mjs [--target <triple>] [--skip-frontend]
//
// 1. Compila la interfaz web del Launcher y de las seis aplicaciones.
// 2. Compila los siete ejecutables nativos (Tauri) en modo producción.
// 3. Los reúne en installer/build con la estructura que espera el instalador:
//      installer/build/CoffeWorks(.exe)            Launcher
//      installer/build/packages/CoffeDoc(.exe)     paquetes que instala el Launcher
//      installer/build/packages/CoffeCalc(.exe)
//      installer/build/packages/CoffeView(.exe)
//      installer/build/packages/CoffePDF(.exe)
//      installer/build/packages/CoffePage(.exe)
//      installer/build/packages/CoffeCams(.exe)

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
const target = targetIndex >= 0 ? args[targetIndex + 1] : null;
const skipFrontend = args.includes("--skip-frontend");

const run = (command, cwd = root) => {
  console.log(`\n> ${command}  (${path.relative(root, cwd) || "."})`);
  execSync(command, { cwd, stdio: "inherit" });
};

const frontends = [".", "CoffeDoc", "CoffeCalc", "CoffeView", "CoffePDF", "CoffePage", "CoffeCams"];

if (!skipFrontend) {
  for (const dir of frontends) {
    const cwd = path.join(root, dir);
    if (!existsSync(path.join(cwd, "node_modules"))) run("npm ci --no-audit --no-fund", cwd);
    run("npm run build", cwd);
  }
}

run(`cargo build --release --workspace --features custom-protocol${target ? ` --target ${target}` : ""}`);

const isWindows = target ? target.includes("windows") : process.platform === "win32";
const suffix = isWindows ? ".exe" : "";
const releaseDir = path.join(root, "target", ...(target ? [target] : []), "release");
const outDir = path.join(root, "installer", "build");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, "packages"), { recursive: true });

const stage = (name, destination) => {
  const source = path.join(releaseDir, name + suffix);
  if (!existsSync(source)) throw new Error(`No se encontró el ejecutable ${source}`);
  copyFileSync(source, path.join(outDir, destination, name + suffix));
  console.log(`  ${path.join(destination, name + suffix).padEnd(28)} ${(statSync(source).size / 1048576).toFixed(1)} MB`);
};

console.log(`\nEjecutables en ${path.relative(root, outDir)}:`);
stage("CoffeWorks", "");
for (const app of ["CoffeDoc", "CoffeCalc", "CoffeView", "CoffePDF", "CoffePage", "CoffeCams"]) stage(app, "packages");

// Las compilaciones con MinGW necesitan el cargador de WebView2 junto a cada ejecutable
const loader = path.join(releaseDir, "WebView2Loader.dll");
if (isWindows && existsSync(loader)) {
  copyFileSync(loader, path.join(outDir, "WebView2Loader.dll"));
  copyFileSync(loader, path.join(outDir, "packages", "WebView2Loader.dll"));
  console.log("  WebView2Loader.dll (compilación MinGW)");
}

console.log("\nListo. Para crear el instalador compila installer/CoffeWorks.iss con Inno Setup.");
