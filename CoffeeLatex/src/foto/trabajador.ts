// Web Worker de «Desde foto»: carga los modelos con onnxruntime-web y reconoce fórmulas sin
// congelar la ventana.

import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { leerVocabulario, reconocerFormula, type Modelos } from "./latexocr";
import type { Gris } from "./imagen";

export type Pedido =
  | { tipo: "cargar"; archivos: { encoder: ArrayBuffer; decoder: ArrayBuffer; resizer: ArrayBuffer; tokenizer: string } }
  | { tipo: "reconocer"; id: number; img: Gris };

export type Respuesta =
  | { tipo: "listo" }
  | { tipo: "avance"; id: number; piezas: number }
  | { tipo: "resultado"; id: number; latex: string; dudas: import("./tokens").Duda[]; confianza: number }
  | { tipo: "error"; id?: number; mensaje: string };

ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href };
ort.env.wasm.numThreads = 1; // sin aislamiento entre orígenes no hay hilos de wasm

let modelos: Modelos | null = null;
const enviar = (r: Respuesta) => (self as unknown as Worker).postMessage(r);

self.onmessage = async (e: MessageEvent<Pedido>) => {
  const p = e.data;
  try {
    if (p.tipo === "cargar") {
      const opciones = { executionProviders: ["wasm"] };
      const [redimensionador, codificador, decodificador] = await Promise.all([
        ort.InferenceSession.create(new Uint8Array(p.archivos.resizer), opciones),
        ort.InferenceSession.create(new Uint8Array(p.archivos.encoder), opciones),
        ort.InferenceSession.create(new Uint8Array(p.archivos.decoder), opciones),
      ]);
      modelos = { ort: ort as never, redimensionador, codificador, decodificador, vocabulario: leerVocabulario(p.archivos.tokenizer) } as unknown as Modelos;
      enviar({ tipo: "listo" });
    } else if (p.tipo === "reconocer") {
      if (!modelos) throw new Error("Los modelos aún no están cargados");
      const r = await reconocerFormula(modelos, p.img, { alAvanzar: (n) => enviar({ tipo: "avance", id: p.id, piezas: n }) });
      enviar({ tipo: "resultado", id: p.id, ...r });
    }
  } catch (err) {
    enviar({ tipo: "error", id: p.tipo === "reconocer" ? p.id : undefined, mensaje: String((err as Error)?.message ?? err) });
  }
};
