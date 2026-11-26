import { test } from "node:test";
import assert from "node:assert/strict";
import { aLrc, aPalabras, aTxt, esAlucinacion, type LineaLetra } from "./letra";

const lineas: LineaLetra[] = [
  { ini: 5.2, fin: 8, texto: "La luna brilla", dudas: [] },
  { ini: 65.5, fin: 70, texto: "sobre el mar", dudas: [{ ini: 9, fin: 12, prob: 0.3 }] },
  { ini: 80, fin: 81, texto: "   ", dudas: [] },
];

test("aLrc con tiempos [mm:ss.cc] y título", () => {
  const lrc = aLrc(lineas, "Mi canción");
  assert.ok(lrc.startsWith("[ti:Mi canción]\n"));
  assert.ok(lrc.includes("[00:05.20]La luna brilla\n"));
  assert.ok(lrc.includes("[01:05.50]sobre el mar\n"));
  assert.ok(!lrc.includes("[01:20.00]"), "las líneas vacías no van");
});

test("aTxt: una línea por frase, sin tiempos", () => {
  assert.equal(aTxt(lineas), "La luna brilla\nsobre el mar\n");
});

test("aPalabras amplía las dudas a palabras completas y las une", () => {
  const texto = "La luna ría son el marío canto";
  // trozos sueltos: «l» de luna, «r» e «ía» de ría, «io» de marío
  const d = aPalabras(texto, [{ ini: 3, fin: 4, prob: 0.4 }, { ini: 8, fin: 9, prob: 0.3 }, { ini: 9, fin: 11, prob: 0.2 }, { ini: 22, fin: 24, prob: 0.4 }]);
  assert.deepEqual(d.map((x) => texto.slice(x.ini, x.fin)), ["luna", "ría", "marío"]);
  assert.equal(d[1].prob, 0.2); // la peor de las unidas
});

test("esAlucinacion detecta lo que Whisper inventa en silencios", () => {
  assert.equal(esAlucinacion("gracias gracias gracias gracias", 0.9), true);
  assert.equal(esAlucinacion("Hola mundo", 0.2), true);
  assert.equal(esAlucinacion("¡Gracias por ver el video!", 0.8), true);
  assert.equal(esAlucinacion("Subtítulos realizados por la comunidad de Amara.org", 0.9), true);
  assert.equal(esAlucinacion("", 0.9), true);
  assert.equal(esAlucinacion("La luna brilla", 0.8), false);
});
