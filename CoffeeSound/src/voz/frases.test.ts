import { test } from "node:test";
import assert from "node:assert/strict";
import { frases } from "./frases";

const R = 16000;
/** Tono en los tramos dados (segundos) y silencio en el resto. */
function senal(total: number, tramos: [number, number][]) {
  const x = new Float32Array(Math.round(total * R));
  for (const [a, b] of tramos) for (let i = Math.round(a * R); i < Math.round(b * R); i++) x[i] = 0.5 * Math.sin(i / 3);
  return x;
}

test("tres ráfagas separadas por silencio dan tres frases", () => {
  const f = frases(senal(9, [[0.5, 2], [3, 5], [6, 8]]), R);
  assert.equal(f.length, 3, JSON.stringify(f));
  for (const [i, ini] of [0.5, 3, 6].entries()) assert.ok(Math.abs(f[i].ini - ini) <= 0.2, JSON.stringify(f[i]));
  assert.ok(f.every((x) => x.fin > x.ini));
});

test("un minuto sin pausas se parte en frases de hasta 28 s que lo cubren todo", () => {
  const f = frases(senal(60, [[0, 60]]), R);
  assert.ok(f.length >= 3);
  assert.ok(f.every((x) => x.fin - x.ini <= 28.001), JSON.stringify(f));
  assert.ok(f[0].ini <= 0.01 && f.at(-1)!.fin >= 59.9);
  for (let i = 1; i < f.length; i++) assert.ok(Math.abs(f[i].ini - f[i - 1].fin) < 0.01);
});

test("silencio total da cero frases y una ráfaga muy corta se descarta", () => {
  assert.deepEqual(frases(new Float32Array(R * 3), R), []);
  assert.deepEqual(frases(senal(3, [[1, 1.1]]), R), []);
});

test("pausas cortas (respiraciones) no cortan la frase", () => {
  const f = frases(senal(5, [[0.5, 2], [2.2, 4]]), R);
  assert.equal(f.length, 1);
});
