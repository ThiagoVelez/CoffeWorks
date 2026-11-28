// Prueba de extremo a extremo de CoffeeQR en el navegador.
// Uso: npm run e2e   (arranca Vite en el puerto 1445 si no está corriendo). CAPTURA=/carpeta guarda capturas.

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const URL_APP = "http://localhost:1445/";

async function servidor() {
  try {
    await fetch(URL_APP);
    return null;
  } catch {
    const p = spawn("npx", ["vite", "--port", "1445", "--strictPort"], { stdio: "ignore" });
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { await fetch(URL_APP); return p; } catch { /* aún no */ }
    }
    throw new Error("Vite no arrancó");
  }
}

const paso = (t) => console.log(`✓ ${t}`);
const captura = process.env.CAPTURA;

/** Lee un PNG descargado con jsQR en la página (sobre blanco), y dice si tiene transparencia. */
async function leerPng(p, ruta) {
  const b64 = readFileSync(ruta).toString("base64");
  return p.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const crudo = g.getImageData(0, 0, c.width, c.height).data;
    let transparente = false;
    for (let i = 3; i < crudo.length; i += 4) if (crudo[i] === 0) { transparente = true; break; }
    g.globalCompositeOperation = "destination-over";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    const { default: jsQR } = await import("/node_modules/.vite/deps/jsqr.js");
    const d = g.getImageData(0, 0, c.width, c.height);
    return { texto: jsQR(d.data, c.width, c.height)?.data ?? null, transparente, ancho: img.width };
  }, b64);
}

async function descargar(p, nombreBoton) {
  const [d] = await Promise.all([p.waitForEvent("download"), p.getByTestId("descargas").getByRole("button", { name: nombreBoton, exact: true }).click()]);
  return d;
}

const vite = await servidor();
const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errores = [];
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(URL_APP);

  // Inicio → plantillas → Tienda de plantas
  await p.getByRole("button", { name: /Nuevo archivo/ }).click();
  await p.locator('[data-plantilla="plantas"]').click();
  await p.getByTestId("qr").locator("svg").waitFor();
  await p.locator('[data-testid="semaforo"][data-nivel="verde"]').waitFor({ timeout: 15000 });
  paso("plantilla «Tienda de plantas» con hojas y semáforo en verde");
  if (captura) await p.screenshot({ path: `${captura}/plantas.png` });

  // Mi enlace
  const enlace = p.getByTestId("panel").getByRole("textbox").first();
  await enlace.fill("vivero-luna.co/catalogo");
  await p.locator('[data-testid="semaforo"][data-nivel="verde"]').waitFor({ timeout: 15000 });

  // Forma de puntos y otro color
  await p.getByRole("button", { name: "Estilo", exact: true }).click();
  await p.getByRole("radiogroup", { name: "Forma de los puntos" }).getByRole("radio", { name: "Puntos" }).click();
  await p.getByRole("button", { name: "Colores", exact: true }).click();
  await p.getByRole("radiogroup", { name: "Tipo de color" }).getByRole("radio", { name: "Un color" }).click();
  await p.getByLabel("Color (hex)").fill("#7a1f5c");
  await p.locator('[data-testid="semaforo"][data-nivel="verde"]').waitFor({ timeout: 15000 });
  assert.ok((await p.getByTestId("qr").innerHTML()).includes("#7a1f5c"));
  paso("forma de puntos y color propio, sigue en verde");

  // PNG sin fondo: transparente y se lee
  const sin = await descargar(p, "PNG sin fondo");
  const png = await leerPng(p, await sin.path());
  assert.equal(png.texto, "https://vivero-luna.co/catalogo");
  assert.equal(png.transparente, true);
  assert.equal(png.ancho, 1024);
  assert.match(sin.suggestedFilename(), /\.png$/);
  paso("PNG sin fondo: con transparencia y se lee");

  // SVG que se lee
  const svg = await descargar(p, "SVG (para imprenta)");
  const textoSvg = readFileSync(await svg.path(), "utf8");
  assert.ok(textoSvg.startsWith("<svg"));
  const leido = await p.evaluate(async (s) => {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 700; c.height = Math.round((700 * img.height) / img.width);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const { default: jsQR } = await import("/node_modules/.vite/deps/jsqr.js");
    return jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data ?? null;
  }, textoSvg);
  assert.equal(leido, "https://vivero-luna.co/catalogo");
  paso("SVG descargado se lee");

  // Hoja de stickers
  const hoja = await descargar(p, "Hoja de stickers");
  assert.equal(readFileSync(await hoja.path()).subarray(0, 4).toString(), "%PDF");
  paso("hoja de stickers en PDF");

  // Colores invertidos → aviso
  await p.getByLabel("Color (hex)").fill("#ffffff");
  await p.getByLabel("Fondo (hex)").fill("#111111");
  const sem = p.getByTestId("semaforo");
  await p.locator('[data-testid="semaforo"]:not([data-nivel="verde"]):not([data-nivel=""])').waitFor({ timeout: 15000 });
  assert.match(await sem.textContent(), /invertidos/i);
  paso("colores invertidos: el semáforo avisa");
  await p.keyboard.press("Control+z");
  await p.keyboard.press("Control+z");

  // Wi-Fi
  await p.getByRole("button", { name: "Contenido", exact: true }).click();
  await p.getByLabel("Tipo de contenido").selectOption("wifi");
  const campos = p.getByTestId("panel").getByRole("textbox");
  await campos.nth(0).fill("Vivero;Luna");
  await campos.nth(1).fill("clave:123");
  await p.locator('[data-testid="semaforo"][data-nivel="verde"]').waitFor({ timeout: 15000 });
  const wifi = await descargar(p, "PNG con fondo");
  const pw = await leerPng(p, await wifi.path());
  assert.equal(pw.texto, "WIFI:T:WPA;S:Vivero\\;Luna;P:clave\\:123;;");
  assert.equal(pw.transparente, false);
  paso("Wi-Fi con caracteres especiales: PNG con fondo que se lee");

  // Imagen o PDF alojado: consejo de Drive
  await p.getByLabel("Tipo de contenido").selectOption("archivo");
  await p.getByTestId("panel").getByRole("textbox").first().fill("https://drive.google.com/file/d/abc/view");
  await p.getByTestId("consejo").waitFor();
  assert.match(await p.getByTestId("consejo").textContent(), /Cualquier persona con el enlace/);
  paso("menú en Drive: la app explica cómo compartirlo");
  if (captura) await p.screenshot({ path: `${captura}/drive.png` });

  // Contenido demasiado largo
  await p.getByLabel("Tipo de contenido").selectOption("texto");
  await p.getByTestId("panel").locator("textarea").fill("x".repeat(3000));
  await p.getByTestId("sin-qr").waitFor();
  assert.match(await p.getByTestId("sin-qr").textContent(), /demasiado largo/);
  paso("contenido demasiado largo: aviso claro");

  assert.deepEqual(errores, []);
  console.log("Todo bien");
} finally {
  await navegador.close();
  vite?.kill();
}
