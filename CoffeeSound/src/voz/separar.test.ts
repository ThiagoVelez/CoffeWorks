import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { separarVoz, type Ort, type SesionOnnx } from "./separar";
import { leerWav } from "./senal";

/** onnxruntime de mentira: el «modelo» devuelve la entrada tal cual. */
class Tensor {
  constructor(public type: string, public data: Float32Array, public dims: number[]) {}
}
const ortFalso = { Tensor } as unknown as Ort;
let llamadas = 0;
const eco: SesionOnnx = {
  inputNames: ["input"],
  outputNames: ["output"],
  async run(e) {
    llamadas++;
    const t = e.input as Tensor;
    return { output: { data: t.data, dims: t.dims } };
  },
};

const tono = (n: number) => Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i / 7));

for (const seg of [0.05, 1, 7]) {
  test(`separar conserva el largo (${seg} s) y voz + música = mezcla`, async () => {
    const n = Math.round(seg * 44100);
    const l = tono(n), r = tono(n).map((v) => v * 0.5);
    const avances: number[] = [];
    const { voz, musica } = await separarVoz({ ort: ortFalso, sesion: eco }, l, r, { alAvanzar: (f) => avances.push(f) });
    assert.equal(voz[0].length, n);
    assert.equal(musica[1].length, n);
    assert.equal(avances.at(-1), 1);
    // Con el modelo «eco» la voz es la mezcla × 1,021 (sin las 3 primeras bandas): voz + música = mezcla
    for (const i of [0, Math.floor(n / 2), n - 1]) {
      assert.ok(Math.abs(voz[0][i] + musica[0][i] - l[i]) < 1e-5);
      assert.ok(Math.abs(voz[1][i] + musica[1][i] - r[i]) < 1e-5);
    }
    if (n > 20000) assert.ok(Math.abs(voz[0][n >> 1] - 1.021 * l[n >> 1]) < 0.02, `${voz[0][n >> 1]} vs ${1.021 * l[n >> 1]}`);
  });
}

test("cancelar corta la separación", async () => {
  llamadas = 0;
  const n = 44100 * 20;
  await assert.rejects(() => separarVoz({ ort: ortFalso, sesion: eco }, tono(n), tono(n), { cancelado: () => llamadas >= 1 }), /Cancelado/);
  assert.equal(llamadas, 1);
});

const dir = process.env.SEP_MODELOS;
const hay = !!dir && existsSync(join(dir, "voc_ft.onnx"));

test("con el modelo real la voz sale limpia (SDR > 12 dB)", { skip: !hay && "sin SEP_MODELOS" }, async () => {
  const ort = await import("onnxruntime-node");
  const sesion = await ort.InferenceSession.create(join(dir!, "voc_ft.onnx"));
  const mezcla = leerWav(readFileSync(join(import.meta.dirname, "muestras", "mezcla.wav")));
  const ref = leerWav(readFileSync(join(import.meta.dirname, "muestras", "voz_ref.wav"))).canales[0];
  const { voz } = await separarVoz({ ort: ort as never, sesion: sesion as never }, mezcla.canales[0], mezcla.canales[1]);
  const sdr = (est: Float32Array) => {
    let s = 0, e = 0;
    for (let i = 0; i < ref.length; i++) { s += ref[i] ** 2; e += (ref[i] - est[i]) ** 2; }
    return 10 * Math.log10(s / e);
  };
  const antes = sdr(mezcla.canales[0]), despues = sdr(voz[0]);
  assert.ok(antes < 0, String(antes));
  assert.ok(despues > 12, `SDR ${despues.toFixed(1)} dB`);
});
