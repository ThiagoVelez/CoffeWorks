import { test } from "node:test";
import assert from "node:assert/strict";
import { aEstereo44, deEstereo44, istft, leerWav, remuestrear, rfft, stft, wav16 } from "./senal";

const aleatoria = (n: number, semilla = 1) => {
  let s = semilla;
  return Float32Array.from({ length: n }, () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1);
};

test("rfft de tamaño no potencia de dos coincide con la DFT directa", () => {
  const n = 30;
  const x = aleatoria(n);
  const { re, im } = rfft(x);
  for (let k = 0; k <= n / 2; k++) {
    let r = 0, i = 0;
    for (let t = 0; t < n; t++) { r += x[t] * Math.cos((2 * Math.PI * k * t) / n); i -= x[t] * Math.sin((2 * Math.PI * k * t) / n); }
    assert.ok(Math.abs(r - re[k]) < 1e-3 && Math.abs(i - im[k]) < 1e-3, `k=${k}`);
  }
});

test("istft(stft(x)) reconstruye la señal (n_fft 7680, salto 1024)", () => {
  const x = aleatoria(30000);
  const s = stft(x, 7680, 1024);
  assert.equal(s.bandas, 3841);
  assert.equal(s.cuadros, 1 + Math.floor(30000 / 1024));
  const y = istft(s.re, s.im, s.bandas, s.cuadros, 7680, 1024, x.length);
  let err = 0;
  for (let i = 0; i < x.length; i++) err = Math.max(err, Math.abs(x[i] - y[i]));
  assert.ok(err < 1e-4, String(err));
});

test("remuestrear 44100→16000 conserva la frecuencia y la duración", () => {
  const n = 44100;
  const x = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 44100));
  const y = remuestrear(x, 44100, 16000);
  assert.ok(Math.abs(y.length - 16000) <= 1, String(y.length));
  let cruces = 0;
  for (let i = 1000; i < 15000; i++) if (y[i - 1] < 0 && y[i] >= 0) cruces++;
  const f = cruces / (14000 / 16000);
  assert.ok(Math.abs(f - 440) / 440 < 0.01, String(f));
});

test("mono a 48 kHz → estéreo 44,1 kHz → de vuelta", () => {
  const mono = aleatoria(48000);
  const [l, r] = aEstereo44([mono], 48000);
  assert.ok(Math.abs(l.length - 44100) <= 2);
  assert.deepEqual(l, r);
  const vuelta = deEstereo44(l, r, 48000, 1);
  assert.equal(vuelta.length, 1);
  assert.ok(Math.abs(vuelta[0].length - 48000) <= 2, String(vuelta[0].length));
  // 44,1 kHz estéreo pasa sin tocar
  const [a, b] = aEstereo44([mono.subarray(0, 100), mono.subarray(100, 200)], 44100);
  assert.deepEqual(Array.from(a), Array.from(mono.subarray(0, 100)));
  assert.deepEqual(Array.from(b), Array.from(mono.subarray(100, 200)));
});

test("wav16 y leerWav van y vuelven", () => {
  const x = Float32Array.from({ length: 100 }, (_, i) => Math.sin(i / 5) * 0.5);
  const w = leerWav(wav16([x, x], 22050));
  assert.equal(w.rate, 22050);
  assert.equal(w.canales.length, 2);
  assert.ok(Math.abs(w.canales[1][37] - x[37]) < 1e-4);
});
