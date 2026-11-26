// Prueba de extremo a extremo de «Separar voz y música» y «Sacar la letra» en el navegador.
// Uso: VOZ_MODELOS=/carpeta/con/los/modelos npm run e2e (sin modelos, prueba que ofrece instalarlos).

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const { chromium } = createRequire(import.meta.url)("playwright");
const URL_APP = "http://localhost:1436/";
const MODELOS = process.env.VOZ_MODELOS;
const MEZCLA = fileURLToPath(new URL("../src/voz/muestras/mezcla.wav", import.meta.url));

async function servidor() {
  try {
    await fetch(URL_APP);
    return null;
  } catch {
    const p = spawn("npx", ["vite", "--port", "1436", "--strictPort"], { stdio: "ignore" });
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { await fetch(URL_APP); return p; } catch { /* aún no */ }
    }
    throw new Error("Vite no arrancó");
  }
}

const paso = (t) => console.log(`✓ ${t}`);
const captura = process.env.CAPTURA;
const vite = await servidor();
const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 880 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(URL_APP);

  // Abrir la canción
  const [selector] = await Promise.all([p.waitForEvent("filechooser"), p.getByText("Abrir una sesión .csn o un audio").click()]);
  await selector.setFiles(MEZCLA);
  await p.getByRole("button", { name: "Efectos", exact: true }).first().waitFor();
  paso("canción de muestra abierta");

  const menu = async (item) => {
    await p.getByRole("button", { name: "Efectos", exact: true }).first().click();
    await p.getByRole("menuitem", { name: item }).click();
  };

  // Separar
  await menu("Separar voz y música…");
  const sep = p.locator("[data-modal-open]");
  await sep.getByText("Separar voz y música").first().waitFor();
  if (!MODELOS) {
    await sep.getByText("Separar voz y música", { exact: false }).nth(1).waitFor();
    await sep.getByRole("button", { name: "Instalar" }).waitFor();
    paso("sin modelos ofrece instalar «Separar voz y música»");
  } else {
    // Cancelar a mitad: no se agrega nada
    await sep.getByRole("button", { name: "Separar", exact: true }).click();
    await sep.getByTestId("progreso-voz").waitFor();
    await sep.getByRole("button", { name: "Cancelar" }).click();
    await p.waitForTimeout(500);
    assert.equal(await sep.getByTestId("separado").count(), 0);
    paso("cancelar detiene la separación sin agregar audios");

    await sep.getByRole("button", { name: "Separar", exact: true }).click();
    await sep.getByTestId("separado").waitFor({ timeout: 180000 });
    paso("separa la canción en voz y música");
    await sep.getByRole("button", { name: "Poner en dos pistas" }).click();
    // Los nombres de pista son campos editables
    await p.locator('input[value="Voz"]').first().waitFor();
    await p.locator('input[value="Música"]').first().waitFor();
    assert.ok((await p.getByText("mezcla — Voz").count()) >= 1);
    paso("«Poner en dos pistas» crea las pistas Voz y Música");
    if (captura) await p.screenshot({ path: `${captura}/pistas.png` });

    // Letra (de la canción abierta: separa primero y luego transcribe)
    await menu("Sacar la letra…");
    const let_ = p.locator("[data-modal-open]");
    await let_.getByRole("button", { name: "Sacar la letra" }).click();
    await let_.getByTestId("letra").locator("input").first().waitFor({ timeout: 300000 });
    await let_.getByRole("button", { name: "Guardar .txt" }).waitFor({ timeout: 300000 });
    const lineas = await let_.getByTestId("letra").locator("input").evaluateAll((l) => l.map((i) => i.value));
    const todo = lineas.join(" ").toLowerCase();
    assert.ok(todo.includes("luna") || todo.includes("canción"), JSON.stringify(lineas));
    paso(`saca la letra: ${JSON.stringify(lineas)}`);
    if (captura) await p.screenshot({ path: `${captura}/letra.png` });
    const [descarga] = await Promise.all([p.waitForEvent("download"), let_.getByRole("button", { name: "Guardar .lrc" }).click()]);
    const lrc = readFileSync(await descarga.path(), "utf8");
    assert.ok(/^\[ti:.*\]\n\[00:0\d\.\d\d\]/.test(lrc), lrc);
    paso(`descarga el .lrc: ${JSON.stringify(lrc.slice(0, 60))}`);
  }

  assert.deepEqual(errores, [], `errores en la página: ${errores.join(" | ")}`);
  console.log("\nTodo bien.");
} catch (e) {
  if (captura) await navegador.contexts()[0]?.pages()[0]?.screenshot({ path: `${captura}/fallo-voz.png` }).catch(() => undefined);
  throw e;
} finally {
  await navegador.close();
  vite?.kill();
}
