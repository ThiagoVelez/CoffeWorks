// Web Worker de la voz: separa (MDX-Net) y transcribe (Whisper) con onnxruntime-web, sin
// congelar la ventana. Los modelos llegan una vez, como bytes.

import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { separarVoz, type SesionOnnx } from "./separar";
import { leerFichas, metaDeArchivo, transcribir, type ModelosWhisper, type Transcripcion } from "./whisper";

export type Pedido =
  | { tipo: "cargarSeparador"; modelo: ArrayBuffer }
  | { tipo: "cargarLetra"; encoder: ArrayBuffer; decoder: ArrayBuffer; fichas: string }
  | { tipo: "separar"; id: number; l: Float32Array; r: Float32Array }
  | { tipo: "transcribir"; id: number; x16k: Float32Array; idioma?: string }
  | { tipo: "cancelar"; id: number };

export type Respuesta =
  | { tipo: "cargado"; que: "separador" | "letra" }
  | { tipo: "avance"; id: number; fraccion: number }
  | { tipo: "separado"; id: number; voz: [Float32Array, Float32Array]; musica: [Float32Array, Float32Array] }
  | { tipo: "transcrito"; id: number; resultado: Transcripcion }
  | { tipo: "error"; id?: number; mensaje: string };

ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href };
// Con aislamiento entre orígenes (crossOriginIsolated) se usan varios núcleos; si no, uno.
ort.env.wasm.numThreads = (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 1) : 1;

let separador: SesionOnnx | null = null;
let whisper: ModelosWhisper | null = null;
const cancelados = new Set<number>();
const enviar = (r: Respuesta, transferir: Transferable[] = []) => (self as unknown as Worker).postMessage(r, transferir);
const opciones = { executionProviders: ["wasm"] };

self.onmessage = async (e: MessageEvent<Pedido>) => {
  const p = e.data;
  if (p.tipo === "cancelar") { cancelados.add(p.id); return; }
  const id = "id" in p ? p.id : undefined;
  try {
    if (p.tipo === "cargarSeparador") {
      separador = (await ort.InferenceSession.create(new Uint8Array(p.modelo), opciones)) as unknown as SesionOnnx;
      enviar({ tipo: "cargado", que: "separador" });
    } else if (p.tipo === "cargarLetra") {
      const enc = new Uint8Array(p.encoder);
      const meta = metaDeArchivo(enc);
      const [codificador, decodificador] = await Promise.all([ort.InferenceSession.create(enc, opciones), ort.InferenceSession.create(new Uint8Array(p.decoder), opciones)]);
      whisper = { ort: ort as never, codificador: codificador as never, decodificador: decodificador as never, fichas: leerFichas(p.fichas), meta };
      enviar({ tipo: "cargado", que: "letra" });
    } else if (p.tipo === "separar") {
      if (!separador) throw new Error("El separador no está cargado");
      const { voz, musica } = await separarVoz({ ort: ort as never, sesion: separador }, p.l, p.r, {
        alAvanzar: (f) => enviar({ tipo: "avance", id: p.id, fraccion: f }),
        cancelado: () => cancelados.has(p.id),
      });
      enviar({ tipo: "separado", id: p.id, voz, musica }, [voz[0].buffer, voz[1].buffer, musica[0].buffer, musica[1].buffer]);
    } else if (p.tipo === "transcribir") {
      if (!whisper) throw new Error("El modelo de la letra no está cargado");
      const resultado = await transcribir(whisper, p.x16k, { idioma: p.idioma, cancelado: () => cancelados.has(p.id) });
      enviar({ tipo: "transcrito", id: p.id, resultado });
    }
  } catch (err) {
    enviar({ tipo: "error", id, mensaje: String((err as Error)?.message ?? err) });
  } finally {
    if (id !== undefined) cancelados.delete(id);
  }
};
