// Con los modelos reales: se ejecuta si OCR_MODELOS apunta a la carpeta del complemento
// (encoder.onnx, decoder.onnx, image_resizer.onnx y tokenizer.json). En el CI de complementos sí.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { leerPgm } from "./imagen";
import { leerVocabulario, reconocerFormula, type Modelos } from "./latexocr";

const dir = process.env.OCR_MODELOS;
const hay = !!dir && existsSync(join(dir, "encoder.onnx"));
const muestra = (n: string) => leerPgm(readFileSync(join(import.meta.dirname, "muestras", `${n}.pgm`)));

let modelos: Promise<Modelos> | null = null;
async function cargar(): Promise<Modelos> {
  modelos ??= (async () => {
    const ort = await import("onnxruntime-node");
    const s = (n: string) => ort.InferenceSession.create(join(dir!, n));
    const [redimensionador, codificador, decodificador] = await Promise.all([s("image_resizer.onnx"), s("encoder.onnx"), s("decoder.onnx")]);
    return { ort: ort as never, redimensionador, codificador, decodificador, vocabulario: leerVocabulario(readFileSync(join(dir!, "tokenizer.json"), "utf8")) } as Modelos;
  })();
  return modelos;
}

test("reconoce F = ma", { skip: !hay && "sin OCR_MODELOS" }, async () => {
  const r = await reconocerFormula(await cargar(), muestra("newton"));
  assert.equal(r.latex.replace(/\s/g, ""), "F=ma");
  assert.ok(r.confianza > 0.5, String(r.confianza));
});

test("reconoce una fracción", { skip: !hay && "sin OCR_MODELOS" }, async () => {
  const r = await reconocerFormula(await cargar(), muestra("caida"));
  assert.ok(r.latex.includes("\\frac{1}{2}"), r.latex);
  assert.ok(r.latex.includes("t^{2}"), r.latex);
});

test("lo dudoso queda marcado con alternativas", { skip: !hay && "sin OCR_MODELOS" }, async () => {
  const r = await reconocerFormula(await cargar(), muestra("fraccion"));
  assert.ok(r.latex.includes("\\frac{a}{b}"), r.latex);
  for (const d of r.dudas) {
    assert.ok(d.ini < d.fin && d.fin <= r.latex.length);
    assert.ok(d.prob < 0.5);
  }
});
