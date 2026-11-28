import { test } from "node:test";
import assert from "node:assert/strict";
import { contraste, evaluar } from "./lectura";
import { DISENO_BASE, dibujarSvg, type Diseno } from "./dibujo";
import { PLANTILLAS } from "./plantillas";
import { aTexto } from "./contenido";
import { leeChico, leer } from "./leerNode";

const con = (p: Partial<Diseno>): Diseno => ({ ...DISENO_BASE, ...p });
const bien = { grande: true, chico: true };

test("contraste WCAG", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff") * 10) / 10, 21);
  assert.equal(contraste("#777777", "#777777"), 1);
  assert.equal(Math.round(contraste("#fff", "#000") * 10) / 10, 21);
});

test("semáforo: verde, colores invertidos, poco contraste y sin fondo", () => {
  assert.deepEqual(evaluar(bien, DISENO_BASE), { nivel: "verde", motivos: [] });

  const inv = evaluar(bien, con({ color: "#ffffff", fondo: "#1b1b1b" }));
  assert.notEqual(inv.nivel, "verde");
  assert.ok(inv.motivos.some((m) => /colores invertidos/i.test(m)));

  const bajo = evaluar(bien, con({ color: "#9a9a9a", fondo: "#ffffff" }));
  assert.equal(bajo.nivel, "rojo");
  assert.ok(bajo.motivos.some((m) => /contraste/i.test(m)));

  const degr = evaluar(bien, con({ color: { tipo: "lineal", colores: ["#000000", "#f1f3f5"], angulo: 0 } }));
  assert.equal(degr.nivel, "rojo");

  const transp = evaluar(bien, con({ color: "#ffe066", fondo: null }));
  assert.notEqual(transp.nivel, "verde");
  assert.ok(transp.motivos.some((m) => /sin fondo/i.test(m)));

  const ojos = evaluar(bien, con({ colorOjos: "#e9ecef" }));
  assert.equal(ojos.nivel, "rojo");
  assert.ok(ojos.motivos.some((m) => /esquinas/i.test(m)));
});

test("semáforo: lecturas", () => {
  const no = evaluar({ grande: false, chico: false }, DISENO_BASE);
  assert.equal(no.nivel, "rojo");
  assert.ok(no.motivos[0].startsWith("No se lee"));
  const chico = evaluar({ grande: true, chico: false }, DISENO_BASE);
  assert.equal(chico.nivel, "amarillo");
  assert.ok(chico.motivos.some((m) => /pequeño/i.test(m)));
});

test("cada plantilla de negocio se lee y queda en verde", () => {
  assert.ok(PLANTILLAS.length >= 9);
  const ids = new Set(PLANTILLAS.map((p) => p.id));
  assert.equal(ids.size, PLANTILLAS.length);
  for (const p of PLANTILLAS) {
    const texto = aTexto(p.contenido);
    const dib = dibujarSvg(texto, p.diseno);
    const grande = leer(dib.svg, 600) === texto;
    const chico = leeChico(dib, texto);
    assert.ok(grande && chico, `${p.id}: grande=${grande} chico=${chico}`);
    assert.deepEqual(evaluar({ grande, chico }, p.diseno), { nivel: "verde", motivos: [] }, p.id);
  }
});
