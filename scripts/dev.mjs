#!/usr/bin/env node
// Arranca a la vez los cuatro servidores de desarrollo web de la suite:
//   Launcher  http://localhost:1420      CoffeDoc   http://localhost:1421
//   CoffeCalc http://localhost:1422      CoffeView  http://localhost:1423

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [".", "CoffeDoc", "CoffeCalc", "CoffeView"].map((dir) =>
  spawn(npm, ["run", "dev"], { cwd: path.join(root, dir), stdio: "inherit", shell: process.platform === "win32" })
);

const stop = () => children.forEach((child) => child.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
