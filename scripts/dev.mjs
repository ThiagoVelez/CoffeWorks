#!/usr/bin/env node
// Arranca a la vez los once servidores de desarrollo web de la suite:
//   Launcher  http://localhost:1420      CoffeeDoc   http://localhost:1421
//   CoffeeCalc http://localhost:1422      CoffeeView  http://localhost:1423
//   CoffeePDF  http://localhost:1424      CoffeePage  http://localhost:1425
//   CoffeeBooks http://localhost:1440
//   CoffeeEdit http://localhost:1426      CoffeeLive http://localhost:1427
//   CoffeeDataBase http://localhost:1428  CoffeeUI/UX http://localhost:1429
//   CoffeeUML http://localhost:1430
//   CoffeePhoto http://localhost:1431
//   CoffeeVector http://localhost:1432
//   CoffeePaint http://localhost:1433
//   CoffeeLens http://localhost:1434
//   CoffeeMotion http://localhost:1435
//   CoffeeSound http://localhost:1436
//   CoffeeEncoder http://localhost:1437
//   CoffeeAnimate http://localhost:1438
//   CoffeePuppet http://localhost:1439

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [".", "CoffeeDoc", "CoffeeCalc", "CoffeeView", "CoffeePDF", "CoffeePage", "CoffeeBooks", "CoffeeDataBase", "CoffeeEdit", "CoffeeLive", "CoffeeUIUX", "CoffeeUML", "CoffeePhoto", "CoffeeVector", "CoffeePaint", "CoffeeLens", "CoffeeMotion", "CoffeeSound", "CoffeeEncoder", "CoffeeAnimate", "CoffeePuppet"].map((dir) =>
  spawn(npm, ["run", "dev"], { cwd: path.join(root, dir), stdio: "inherit", shell: process.platform === "win32" })
);

const stop = () => children.forEach((child) => child.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
