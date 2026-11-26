// Puente con el trabajador de «Desde foto»: trae los modelos del complemento (o, en el modo de
// desarrollo del navegador, de /modelos-ocr/) y reconoce renglones uno a uno.

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../studio/desktop";
import type { Gris } from "./imagen";
import type { Pedido, Respuesta } from "./trabajador";
import type { Duda } from "./tokens";

export interface Reconocido {
  latex: string;
  dudas: Duda[];
  confianza: number;
}

/** En desarrollo, una ruta que no existe devuelve la página (HTML): eso no es un modelo. */
const esModelo = (r: Response) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html");

const ARCHIVOS = ["encoder.onnx", "decoder.onnx", "image_resizer.onnx", "tokenizer.json"] as const;

async function leer(nombre: (typeof ARCHIVOS)[number]): Promise<ArrayBuffer> {
  if (isTauri) return invoke<ArrayBuffer>("doc_ocr_modelo", { nombre });
  const r = await fetch(`/modelos-ocr/${nombre}`);
  if (!esModelo(r)) throw new Error("Faltan los modelos de «Desde foto».");
  return r.arrayBuffer();
}

/** Si los modelos se pueden cargar aquí (sin descargarlos). */
export async function hayModelos(): Promise<boolean> {
  if (isTauri) {
    try {
      return (await invoke<{ ocr: boolean }>("doc_herramientas")).ocr;
    } catch {
      return false;
    }
  }
  if (!import.meta.env.DEV) return false;
  try {
    return esModelo(await fetch("/modelos-ocr/tokenizer.json", { method: "HEAD" }));
  } catch {
    return false;
  }
}

export class MotorFormulas {
  private w: Worker | null = null;
  private listo: Promise<void> | null = null;
  private siguiente = 1;
  private pendientes = new Map<number, { ok: (r: Reconocido) => void; mal: (e: Error) => void; avance?: (n: number) => void }>();

  /** Carga los modelos (una vez). `alCargar` informa qué archivo se está leyendo. */
  cargar(alCargar?: (texto: string) => void): Promise<void> {
    this.listo ??= (async () => {
      const w = new Worker(new URL("./trabajador.ts", import.meta.url), { type: "module" });
      this.w = w;
      const leidos: Record<string, ArrayBuffer> = {};
      for (const [i, n] of ARCHIVOS.entries()) {
        alCargar?.(`Cargando modelos (${i + 1}/${ARCHIVOS.length})…`);
        leidos[n] = await leer(n);
      }
      await new Promise<void>((ok, mal) => {
        w.onmessage = (e: MessageEvent<Respuesta>) => {
          const r = e.data;
          if (r.tipo === "listo") ok();
          else if (r.tipo === "error" && r.id === undefined) mal(new Error(r.mensaje));
          else this.recibir(r);
        };
        w.onerror = (e) => mal(new Error(e.message || "El reconocedor no pudo arrancar"));
        const pedido: Pedido = {
          tipo: "cargar",
          archivos: { encoder: leidos["encoder.onnx"], decoder: leidos["decoder.onnx"], resizer: leidos["image_resizer.onnx"], tokenizer: new TextDecoder().decode(leidos["tokenizer.json"]) },
        };
        alCargar?.("Preparando el reconocedor…");
        w.postMessage(pedido, [pedido.archivos.encoder, pedido.archivos.decoder, pedido.archivos.resizer]);
      });
      w.onmessage = (e: MessageEvent<Respuesta>) => this.recibir(e.data);
    })();
    this.listo.catch(() => {
      this.listo = null;
      this.w?.terminate();
      this.w = null;
    });
    return this.listo;
  }

  private recibir(r: Respuesta) {
    if (r.tipo === "listo" || r.id === undefined) return;
    const p = this.pendientes.get(r.id);
    if (!p) return;
    if (r.tipo === "avance") p.avance?.(r.piezas);
    else if (r.tipo === "resultado") {
      this.pendientes.delete(r.id);
      p.ok({ latex: r.latex, dudas: r.dudas, confianza: r.confianza });
    } else if (r.tipo === "error") {
      this.pendientes.delete(r.id);
      p.mal(new Error(r.mensaje));
    }
  }

  async reconocer(img: Gris, avance?: (piezas: number) => void): Promise<Reconocido> {
    await this.cargar();
    const id = this.siguiente++;
    return new Promise((ok, mal) => {
      this.pendientes.set(id, { ok, mal, avance });
      const pedido: Pedido = { tipo: "reconocer", id, img };
      this.w!.postMessage(pedido);
    });
  }

  cerrar() {
    this.w?.terminate();
    this.w = null;
    this.listo = null;
    for (const p of this.pendientes.values()) p.mal(new Error("Cancelado"));
    this.pendientes.clear();
  }
}
