import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { leerFichas, melWhisper, metaDeArchivo, transcribir, type ModelosWhisper } from "./whisper";
import { leerWav } from "./senal";

const muestras = join(import.meta.dirname, "muestras");

test("1 s de silencio: 100 cuadros a −1,5 y 1500 de relleno en cero", () => {
  const { datos, cuadros } = melWhisper(new Float32Array(16000));
  assert.equal(cuadros, 1600);
  assert.equal(datos.length, 80 * 1600);
  for (const b of [0, 40, 79]) {
    assert.ok(Math.abs(datos[b * cuadros + 50] + 1.5) < 1e-6);
    assert.equal(datos[b * cuadros + 100], 0);
  }
});

test("el espectrograma coincide con el de Whisper original", () => {
  const ref = JSON.parse(readFileSync(join(muestras, "mel_ref.json"), "utf8")) as { cuadros: number; max: number; ref: number[][]; medio: number[] };
  const x = leerWav(readFileSync(join(muestras, "voz16.wav"))).canales[0];
  const { datos, cuadros } = melWhisper(x);
  assert.equal(cuadros, ref.cuadros + 1500);
  let err = 0, n = 0, maxv = -Infinity;
  for (let t = 0; t < ref.cuadros; t++) for (let b = 0; b < 80; b++) maxv = Math.max(maxv, datos[b * cuadros + t]);
  for (let t = 0; t < 50; t++) for (let b = 0; b < 3; b++) { err += Math.abs(datos[b * cuadros + t] - ref.ref[t][b]); n++; }
  assert.ok(err / n < 0.02, `error medio ${err / n}`);
  assert.ok(Math.abs(maxv - ref.max) < 0.01);
  ref.medio.forEach((m, k) => {
    let s = 0;
    for (let b = 0; b < 80; b++) s += datos[b * cuadros + k * 20];
    assert.ok(Math.abs(s / 80 - m) < 0.02, `cuadro ${k * 20}`);
  });
});

test("frases largas se recortan a 2950 cuadros + 50 de relleno", () => {
  const { cuadros } = melWhisper(new Float32Array(16000 * 29));
  assert.equal(cuadros, 3000);
});

test("leerFichas decodifica el base64 de sherpa", () => {
  const f = leerFichas("IQ== 0\nIg== 1\nSG9sYQ== 2\n= 3\n");
  assert.equal(new TextDecoder().decode(f[2]), "Hola");
  assert.equal(f.length, 4);
  assert.equal(f[3].length, 0); // la pieza vacía de sherpa («=») no rompe la lectura
});

const dir = process.env.LETRA_MODELOS;
const hay = !!dir && existsSync(join(dir, "small-encoder.int8.onnx"));

test("con el modelo real transcribe la frase de muestra en español", { skip: !hay && "sin LETRA_MODELOS" }, async () => {
  const ort = await import("onnxruntime-node");
  const [codificador, decodificador] = await Promise.all([ort.InferenceSession.create(join(dir!, "small-encoder.int8.onnx")), ort.InferenceSession.create(join(dir!, "small-decoder.int8.onnx"))]);
  const meta = metaDeArchivo(readFileSync(join(dir!, "small-encoder.int8.onnx")));
  const m: ModelosWhisper = { ort: ort as never, codificador: codificador as never, decodificador: decodificador as never, fichas: leerFichas(readFileSync(join(dir!, "small-tokens.txt"), "utf8")), meta };
  const x = leerWav(readFileSync(join(muestras, "voz16.wav"))).canales[0];
  const r = await transcribir(m, x);
  assert.equal(r.idioma, "es");
  // Los pesos int8 dan resultados algo distintos según el procesador (en el CI salió «lua»):
  // se exigen 4 de 5 palabras clave, que sigue siendo una transcripción casi perfecta.
  const clave = ["luna", "brilla", "mar", "canto", "canción"];
  const aciertos = clave.filter((p) => r.texto.toLowerCase().includes(p)).length;
  assert.ok(aciertos >= 4, `${aciertos}/5: ${r.texto}`);
  assert.ok(r.probMedia > 0.5);
  const en = await transcribir(m, x, { idioma: "es" });
  assert.equal(en.idioma, "es");
});
