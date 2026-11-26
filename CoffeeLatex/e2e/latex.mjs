// Prueba de extremo a extremo de CoffeeLatex en el navegador.
// Uso: npm run e2e   (arranca Vite en el puerto 1444 si no está corriendo)

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const { chromium } = createRequire(import.meta.url)("playwright");
const URL_APP = "http://localhost:1444/";
const DICCIONARIOS = fileURLToPath(new URL("../../dictionaries/", import.meta.url));

async function servidor() {
  try {
    await fetch(URL_APP);
    return null;
  } catch {
    const p = spawn("npx", ["vite", "--port", "1444", "--strictPort"], { stdio: "ignore" });
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
  // Los diccionarios los sirve el Launcher en desarrollo: aquí se sirven desde el repositorio.
  await ctx.route("**/dictionaries/*", (route) => {
    const nombre = new URL(route.request().url()).pathname.split("/").pop();
    route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: readFileSync(DICCIONARIOS + nombre, "utf8") });
  });
  const errores = [];
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(URL_APP);

  // Inicio: plantillas
  await p.locator('[data-plantilla="informe"]').click();
  await p.getByLabel("Código del documento").waitFor();
  await p.locator(".vista .katex").first().waitFor();
  assert.ok((await p.locator(".vista h2").count()) >= 5, "el informe muestra sus secciones");
  assert.equal(await p.getByTestId("modo").textContent(), "LaTeX");
  paso("plantilla de informe con secciones y fórmulas en la vista previa");
  if (captura) await p.screenshot({ path: `${captura}/informe.png` });

  // Escribir una fórmula
  const area = p.getByLabel("Código del documento");
  await area.click();
  await p.keyboard.press("Control+End");
  await area.evaluate((t) => {
    const i = t.value.indexOf("\\end{document}");
    t.setSelectionRange(i, i);
  });
  await p.keyboard.type("Prueba $F=ma$ final.\n");
  await p.waitForFunction(() => [...document.querySelectorAll(".vista .katex")].some((k) => k.textContent.includes("F=ma")));
  paso("escribir $F=ma$ dibuja la fórmula");

  // Botón «Fracción»
  await p.keyboard.type("Fraccion: ");
  await p.locator('[data-boton="fraccion"]').click();
  const valor = await area.inputValue();
  assert.ok(valor.includes("Fraccion: \\frac{}{}"), "inserta \\frac{}{}");
  const cursor = await area.evaluate((t) => t.value.slice(t.selectionStart, t.selectionStart + 1));
  assert.equal(cursor, "}", "el cursor queda dentro de la segunda llave");
  paso("el botón Fracción inserta \\frac{}{} con el cursor dentro");

  // Ctrl+B con selección
  await p.keyboard.press("End");
  await p.keyboard.type(" palabra");
  await p.keyboard.down("Shift");
  for (let i = 0; i < 7; i++) await p.keyboard.press("ArrowLeft");
  await p.keyboard.up("Shift");
  await p.keyboard.press("Control+b");
  assert.ok((await area.inputValue()).includes("\\textbf{palabra}"));
  paso("Ctrl+B pone \\textbf{} a la selección");

  // Letras griegas
  await p.locator('[data-boton="griegas"]').click();
  await p.getByTitle("\\omega", { exact: true }).click();
  assert.ok((await area.inputValue()).includes("$\\omega$"));
  paso("menú de letras griegas");

  // Corrector: palabra mal escrita subrayada, comandos sin marcar
  await p.keyboard.type(" Esto es un ejenplo raro.");
  await p.waitForFunction(() => {
    const h = CSS.highlights?.get("coffee-spell");
    return h && [...h].some((r) => r.toString() === "ejenplo");
  }, null, { timeout: 20000 });
  const marcadas = await p.evaluate(() => [...CSS.highlights.get("coffee-spell")].map((r) => r.toString()));
  assert.ok(!marcadas.some((w) => ["textbf", "frac", "documentclass", "usepackage"].includes(w)), `no marca comandos: ${marcadas}`);
  paso(`el corrector subraya «ejenplo» y no los comandos (${marcadas.length} marcas)`);

  // Clic derecho: sugerencias
  const caja = await p.evaluate(() => {
    const r = [...CSS.highlights.get("coffee-spell")].find((x) => x.toString() === "ejenplo");
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await p.mouse.click(caja.x, caja.y, { button: "right" });
  await p.locator("[data-spell-suggestion]").first().waitFor();
  await p.locator('[data-spell-suggestion="ejemplo"]').click();
  assert.ok((await area.inputValue()).includes("un ejemplo raro"));
  paso("clic derecho → «ejemplo» corrige la palabra");

  // Desde foto
  await p.getByRole("button", { name: "Desde foto" }).click();
  await p.getByText("llega en la próxima versión").waitFor();
  await p.getByRole("button", { name: "Entendido" }).click();
  paso("«Desde foto» avisa que llega en la próxima versión");

  // Exportar HTML
  await p.getByRole("button", { name: /Exportar…/ }).click();
  const [descarga] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "HTML (página web)" }).click()]);
  const html = readFileSync(await descarga.path(), "utf8");
  assert.ok(html.includes("@font-face") && html.includes("katex") && !/url\(fonts\//.test(html));
  assert.ok((html.match(/data:font\/woff2/g) ?? []).length >= 15, "las fuentes de KaTeX van dentro del archivo");
  assert.ok(!/url\(["']?\/(node_modules|assets)\//.test(html), "sin rutas al servidor");
  paso(`exportar a HTML (${Math.round(html.length / 1024)} KB, sin internet)`);

  // Sin el motor (navegador), el PDF explica qué instalar
  await p.getByRole("button", { name: "PDF", exact: true }).click();
  await p.getByText(/Solo en la aplicación de escritorio|Motor LaTeX/).first().waitFor();
  paso("PDF sin motor explica qué instalar");
  await p.keyboard.press("Escape");

  // Markdown
  await p.locator('img[alt=""]').first().click(); // logo → inicio
  await p.locator('[data-plantilla="md-notas"]').click();
  await p.waitForFunction(() => document.querySelector('[data-testid="modo"]')?.textContent === "Markdown");
  await p.locator(".vista h2", { hasText: "Ideas clave" }).waitFor({ timeout: 2000 });
  await p.locator(".vista .katex-display").first().waitFor();
  assert.ok((await p.locator(".vista h1").count()) === 1);
  assert.equal(await p.locator(".vista li").count(), 4, "dos viñetas y dos números");
  paso("plantilla Markdown con títulos y fórmulas aparte");
  if (captura) await p.screenshot({ path: `${captura}/markdown.png` });

  // Recientes en el inicio
  await p.locator('img[alt=""]').first().click();
  await p.getByText("Recientes").waitFor();
  assert.ok((await p.getByText(/Informe de laboratorio\.tex|Notas\.md/).count()) >= 1, "aparecen en recientes");
  paso("los documentos aparecen en Recientes");

  assert.deepEqual(errores, [], `errores en la página: ${errores.join(" | ")}`);
  console.log("\nTodo bien.");
} finally {
  await navegador.close();
  vite?.kill();
}
