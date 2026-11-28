import { test } from "node:test";
import assert from "node:assert/strict";
import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { CENTROS_POR_MARCO, CENTRO_MAXIMO, DISENO_BASE, FORMAS, OJOS_MARCO, centroValido, dibujarSvg, ladoCentro, type Diseno, type FormaCentro } from "./dibujo";
import { matriz, LARGO_MAXIMO } from "./matriz";
import { TEMAS } from "./adornos";

/** Rasteriza el SVG sobre blanco y lo lee con jsQR (lo que haría un celular). */
export function leer(svg: string, px = 600): string | null {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: px }, background: "white", font: { loadSystemFonts: false } }).render();
  const datos = new Uint8ClampedArray(r.pixels.buffer, r.pixels.byteOffset, r.pixels.length);
  return jsQR(datos, r.width, r.height)?.data ?? null;
}

const TEXTO = "https://vivero-verde.co/menú?mesa=ñ12";
const con = (p: Partial<Diseno>): Diseno => ({ ...DISENO_BASE, ...p, marco: { ...DISENO_BASE.marco, ...(p.marco ?? {}) } });

test("matriz en UTF-8 y error claro si no cabe", () => {
  const m = matriz("Hola");
  assert.equal(m.n, 21);
  assert.equal(m.esOjo(0, 0) && m.esOjo(20, 0) && m.esOjo(0, 20), true);
  assert.equal(m.esOjo(20, 20), false);
  assert.throws(() => matriz("x".repeat(3000)), { message: LARGO_MAXIMO });
  assert.equal(leer(dibujarSvg("Señal ñandú café", DISENO_BASE).svg), "Señal ñandú café");
});

test("cada forma × ojos × sólido/degradado se lee (grande y chico)", () => {
  const colores: Diseno["color"][] = ["#1b4332", { tipo: "lineal", colores: ["#2b8a3e", "#1864ab"], angulo: 45 }, { tipo: "radial", colores: ["#5f3dc4", "#0b0b2b"] }];
  const fallos: string[] = [];
  let i = 0;
  for (const f of FORMAS) {
    for (const om of OJOS_MARCO) {
      for (const oc of Object.keys(CENTROS_POR_MARCO[om.id]) as FormaCentro[]) {
        const color = colores[i++ % colores.length];
        const { svg } = dibujarSvg(TEXTO, con({ modulo: f.id, ojoMarco: om.id, ojoCentro: oc, color }));
        for (const px of [600, 180]) if (leer(svg, px) !== TEXTO) fallos.push(`${f.id}/${om.id}/${oc}/${typeof color === "string" ? "sólido" : color.tipo}@${px}`);
      }
    }
  }
  assert.deepEqual(fallos, []);
});

test("un centro de ojo que no casa con el marco se cambia por uno que se lee", () => {
  assert.equal(centroValido("circulo", "cuadrado"), "punto");
  assert.equal(centroValido("cuadrado", "punto"), "cuadrado");
  assert.equal(centroValido("hoja", "hoja"), "hoja");
  assert.equal(leer(dibujarSvg(TEXTO, con({ ojoMarco: "circulo", ojoCentro: "cuadrado" })).svg), TEXTO);
});

test("cada tema con insignia en el centro y adornos en el borde se lee", () => {
  for (const t of TEMAS) {
    for (const modulo of ["cuadrado", "puntos", "liquido"] as const) {
      const d = con({ tema: t.id, adornoCentro: true, adornoBorde: true, color: t.color, modulo, ojoMarco: "redondeado", ojoCentro: "punto" });
      const { svg } = dibujarSvg(TEXTO, d);
      assert.ok(svg.includes(`color="${t.acento}"`), `${t.id}: borde`);
      assert.equal(leer(svg), TEXTO, `${t.id}/${modulo}`);
    }
  }
});

test("el centro no pasa del 15 % del área y el logo se lee", () => {
  for (let n = 21; n <= 177; n += 4) {
    const k = ladoCentro(n, 1);
    assert.ok((k * k) / (n * n) <= 0.15, `n=${n} k=${k}`);
    assert.equal(k % 2, 1);
  }
  assert.ok(CENTRO_MAXIMO < 0.39);
  const png = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#e8590c"/></svg>').render().asPng();
  const logo = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  for (const tamanoCentro of [0.3, 1]) {
    const { svg } = dibujarSvg(TEXTO, con({ logo, tamanoCentro, modulo: "redondeado" }));
    assert.ok(svg.includes("<image"));
    assert.equal(leer(svg), TEXTO, `logo ${tamanoCentro}`);
  }
});

test("marco con texto (abajo y burbuja) y sin fondo se lee", () => {
  for (const estilo of ["abajo", "burbuja"] as const) {
    const d = con({ marco: { texto: "Escanéame <ya>", color: "#5f3dc4", estilo }, modulo: "gotas" });
    const r = dibujarSvg(TEXTO, d);
    assert.ok(r.alto > r.ancho, estilo);
    assert.ok(r.svg.includes("Escanéame &lt;ya&gt;"));
    assert.equal(leer(r.svg), TEXTO, estilo);
  }
  const sin = dibujarSvg(TEXTO, con({ fondo: null }));
  assert.ok(!sin.svg.includes("<rect"));
  assert.equal(leer(sin.svg), TEXTO);
});
