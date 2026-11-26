// Prueba de extremo a extremo con dos ventanas del navegador (canal entre pestañas).
// Uso: npm run e2e   (arranca Vite en el puerto 1443 si no está corriendo)

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

// Playwright viene instalado en el sistema (o en el proyecto): se carga con require.
const { chromium } = createRequire(import.meta.url)("playwright");

const URL_APP = "http://localhost:1443/?red=memoria";

async function servidor() {
  try {
    await fetch("http://localhost:1443/");
    return null;
  } catch {
    const p = spawn("npx", ["vite", "--port", "1443", "--strictPort"], { stdio: "ignore" });
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { await fetch("http://localhost:1443/"); return p; } catch { /* aún no */ }
    }
    throw new Error("Vite no arrancó");
  }
}

const paso = (t) => console.log(`✓ ${t}`);

const vite = await servidor();
const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
  const errores = [];
  const A = await ctx.newPage();
  A.on("pageerror", (e) => errores.push(`A: ${e.message}`));
  await A.goto(URL_APP);
  await A.getByLabel("Nombre", { exact: true }).fill("Ana");
  await A.getByRole("button", { name: "Listo" }).click();
  await A.locator('[data-plantilla="blanco"]').click();
  await A.getByLabel("Nombre del tablero").fill("Feria");
  paso("A crea el tablero «Feria»");

  await A.getByRole("button", { name: "Compartir" }).click();
  const link = await A.locator("[data-link]").inputValue();
  assert.match(link, /^coffeedrawteam:\/\/unirse\/[A-Za-z0-9_-]{22}#[A-Za-z0-9_-]{22}$/);
  await A.getByRole("button", { name: "Listo" }).click();
  paso("A comparte y obtiene el link");

  const B = await ctx.newPage();
  B.on("pageerror", (e) => errores.push(`B: ${e.message}`));
  await B.goto(URL_APP);
  await B.getByRole("button", { name: "Unirse a un tablero" }).click();
  await B.getByLabel("Link del tablero").fill(`Únete al tablero: ${link}\n`);
  await B.getByLabel("Tu nombre en este tablero").fill("Sofía");
  await B.getByRole("button", { name: "Entrar" }).click();
  await B.locator("[data-estado-red]", { hasText: "Conectado (2 personas)" }).waitFor({ timeout: 5000 });
  await A.locator("[data-estado-red]", { hasText: "Conectado (2 personas)" }).waitFor({ timeout: 5000 });
  assert.equal(await B.locator("header").getByText("Feria").count(), 1);
  paso("B pega el link, escribe «Sofía» y entra (ve el nombre «Feria»)");

  await B.keyboard.press("n");
  await B.mouse.click(700, 450);
  await B.keyboard.type("Ideas");
  await B.mouse.move(800, 300);
  await B.mouse.move(810, 310);
  await A.getByText("Ideas", { exact: true }).waitFor({ timeout: 5000 });
  paso("B añade una nota «Ideas» y A la ve");

  await A.locator('[data-cursor="Sofía"]').waitFor({ timeout: 5000 });
  paso("A ve el cursor de B con «Sofía»");

  await A.getByRole("button", { name: "Historial" }).click();
  const lineas = A.locator("[data-historial] li");
  await A.locator("[data-historial]", { hasText: "Sofía añadió una nota" }).waitFor({ timeout: 5000 });
  await A.locator("[data-historial]", { hasText: "Sofía editó una nota «Ideas»" }).waitFor({ timeout: 5000 });
  paso("El historial de A dice «Sofía añadió una nota» y «Sofía editó una nota «Ideas»»");

  // Mover la vista lejos y volver con el historial
  for (let i = 0; i < 6; i++) await A.mouse.wheel(0, 600);
  await lineas.filter({ hasText: "añadió una nota" }).first().click();
  await A.waitForTimeout(300);
  const caja = await A.getByText("Ideas", { exact: true }).boundingBox();
  const lienzo = await A.locator("[data-lienzo]").boundingBox();
  const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
  assert.ok(Math.abs(cx - (lienzo.x + lienzo.width / 2)) < 60 && Math.abs(cy - (lienzo.y + lienzo.height / 2)) < 60, "la nota queda al centro");
  paso("Clic en el historial centra la nota");

  // Deshacer solo lo propio: A añade una nota y la deshace; la de B sigue
  await A.getByRole("button", { name: "Cerrar historial" }).click();
  await A.keyboard.press("n");
  await A.mouse.click(300, 300);
  await A.keyboard.type("Mía");
  await A.mouse.click(1000, 700);
  await A.keyboard.press("Control+z");
  await A.keyboard.press("Control+z");
  await A.waitForTimeout(300);
  assert.equal(await A.getByText("Mía", { exact: true }).count(), 0);
  assert.equal(await A.getByText("Ideas", { exact: true }).count(), 1);
  paso("Ctrl+Z de A deshace lo suyo y no la nota de Sofía");

  // Exportar
  await A.getByRole("button", { name: "Exportar" }).click();
  const [descarga] = await Promise.all([A.waitForEvent("download"), A.getByRole("button", { name: "Todo el tablero (PNG)" }).click()]);
  assert.match(descarga.suggestedFilename(), /^Feria\.png$/);
  paso("Exportar a PNG descarga «Feria.png»");

  // Guardar una copia sin salir del tablero compartido
  await B.getByRole("button", { name: "Guardar una copia" }).click();
  await B.waitForTimeout(500);
  assert.match(await B.locator("[data-estado-red]").innerText(), /Conectado/);
  assert.equal(await B.locator("header").getByText("Feria").count(), 1);
  paso("B guarda una copia y sigue conectado al tablero de A");

  // Deshacer sigue funcionando después de cambiar el nombre del tablero
  await A.keyboard.press("n");
  await A.mouse.click(300, 650);
  await A.keyboard.type("Deshacer");
  await A.mouse.click(1000, 700);
  await A.getByLabel("Nombre del tablero").fill("");
  await A.getByLabel("Nombre del tablero").pressSequentially("Feria 2026");
  await A.mouse.click(1000, 700);
  await A.keyboard.press("Control+z");
  await A.keyboard.press("Control+z");
  await A.waitForTimeout(300);
  assert.equal(await A.getByText("Deshacer", { exact: true }).count(), 0, "Ctrl+Z tras renombrar");
  paso("Ctrl+Z funciona después de renombrar el tablero");

  // Expulsar
  A.once("dialog", (d) => d.accept());
  await A.locator("[data-personas]").click();
  await A.getByRole("button", { name: "Expulsar a Sofía" }).click();
  await B.locator('[data-fin="expulsado"]').waitFor({ timeout: 5000 });
  paso("A expulsa a B y B ve el aviso");

  // El guardado automático guarda el nombre completo (sin salir del tablero)
  await A.waitForTimeout(4000);
  await A.reload();
  await A.locator("[data-inicio]").waitFor({ timeout: 8000 }).catch(async (e) => {
    await A.screenshot({ path: "/tmp/claude-0/e2e-fallo.png" });
    console.log("texto:", (await A.locator("body").innerText()).slice(0, 300));
    throw e;
  });
  assert.ok(await A.getByText("Feria 2026", { exact: true }).count() >= 1, "nombre guardado completo");
  assert.equal(await A.getByText("Feria 202", { exact: true }).count(), 0, "sin la última letra");
  paso("El guardado automático guarda «Feria 2026» completo");

  assert.deepEqual(errores, []);
  console.log("\nTodo bien.");
} finally {
  await navegador.close();
  vite?.kill();
}
