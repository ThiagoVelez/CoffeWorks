// Puente con el trabajador de la voz: trae los modelos de los complementos (o, en el modo de
// desarrollo del navegador, de /modelos-voz/), separa y transcribe, con avance y cancelación.

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../studio/desktop";
import type { Pedido, Respuesta } from "./trabajador";
import type { Transcripcion } from "./whisper";

type Complemento = "separarvoz" | "letra";
type Par = [Float32Array, Float32Array];

const esModelo = (r: Response) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html");

async function leer(complemento: Complemento, nombre: string): Promise<ArrayBuffer> {
  if (isTauri) return invoke<ArrayBuffer>("doc_audio_modelo", { complemento, nombre });
  const r = await fetch(`/modelos-voz/${nombre}`);
  if (!esModelo(r)) throw new Error("Faltan los modelos en el modo de desarrollo (VOZ_MODELOS).");
  return r.arrayBuffer();
}

/** Qué complementos hay (sin descargar nada). */
export async function complementosVoz(): Promise<{ separarvoz: boolean; letra: boolean }> {
  if (isTauri) {
    try {
      const h = await invoke<{ separarvoz: boolean; letra: boolean }>("doc_herramientas");
      return { separarvoz: h.separarvoz, letra: h.letra };
    } catch {
      return { separarvoz: false, letra: false };
    }
  }
  if (!import.meta.env.DEV) return { separarvoz: false, letra: false };
  const hay = async (n: string) => {
    try {
      return esModelo(await fetch(`/modelos-voz/${n}`, { method: "HEAD" }));
    } catch {
      return false;
    }
  };
  return { separarvoz: await hay("voc_ft.onnx"), letra: await hay("small-tokens.txt") };
}

export class Cancelado extends Error {
  constructor() {
    super("Cancelado");
  }
}

export class MotorVoz {
  private w: Worker | null = null;
  private cargas: Partial<Record<"separador" | "letra", Promise<void>>> = {};
  private esperando = new Map<number, { ok: (r: Respuesta) => void; mal: (e: Error) => void; avance?: (f: number) => void }>();
  private cargado: Partial<Record<"separador" | "letra", () => void>> = {};
  private siguiente = 1;

  private trabajador(): Worker {
    if (this.w) return this.w;
    const w = new Worker(new URL("./trabajador.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<Respuesta>) => {
      const r = e.data;
      if (r.tipo === "cargado") { this.cargado[r.que]?.(); return; }
      if (r.id === undefined) { for (const p of this.esperando.values()) p.mal(new Error(r.tipo === "error" ? r.mensaje : "Error")); return; }
      const p = this.esperando.get(r.id);
      if (!p) return;
      if (r.tipo === "avance") p.avance?.(r.fraccion);
      else {
        this.esperando.delete(r.id);
        if (r.tipo === "error") p.mal(r.mensaje === "Cancelado" ? new Cancelado() : new Error(r.mensaje));
        else p.ok(r);
      }
    };
    this.w = w;
    return w;
  }

  private cargar(que: "separador" | "letra", alCargar?: (t: string) => void): Promise<void> {
    this.cargas[que] ??= (async () => {
      const w = this.trabajador();
      let pedido: Pedido;
      if (que === "separador") {
        alCargar?.("Cargando el separador…");
        pedido = { tipo: "cargarSeparador", modelo: await leer("separarvoz", "voc_ft.onnx") };
      } else {
        alCargar?.("Cargando el modelo de la letra (1/3)…");
        const encoder = await leer("letra", "small-encoder.int8.onnx");
        alCargar?.("Cargando el modelo de la letra (2/3)…");
        const decoder = await leer("letra", "small-decoder.int8.onnx");
        alCargar?.("Cargando el modelo de la letra (3/3)…");
        const fichas = new TextDecoder().decode(await leer("letra", "small-tokens.txt"));
        pedido = { tipo: "cargarLetra", encoder, decoder, fichas };
      }
      alCargar?.("Preparando…");
      await new Promise<void>((ok, mal) => {
        this.cargado[que] = ok;
        const viejo = w.onerror;
        w.onerror = (e) => { mal(new Error(e.message || "No se pudo cargar el modelo")); w.onerror = viejo; };
        const transfer = pedido.tipo === "cargarSeparador" ? [pedido.modelo] : pedido.tipo === "cargarLetra" ? [pedido.encoder, pedido.decoder] : [];
        w.postMessage(pedido, transfer);
      });
    })();
    this.cargas[que]!.catch(() => delete this.cargas[que]);
    return this.cargas[que]!;
  }

  private pedir(pedido: Pedido & { id: number }, avance?: (f: number) => void, señal?: AbortSignal, transfer: Transferable[] = []): Promise<Respuesta> {
    return new Promise((ok, mal) => {
      this.esperando.set(pedido.id, { ok, mal, avance });
      señal?.addEventListener("abort", () => this.w?.postMessage({ tipo: "cancelar", id: pedido.id } satisfies Pedido));
      this.trabajador().postMessage(pedido, transfer);
    });
  }

  /** Separa estéreo a 44,1 kHz. */
  async separar(l: Float32Array, r: Float32Array, avance?: (f: number) => void, señal?: AbortSignal, alCargar?: (t: string) => void): Promise<{ voz: Par; musica: Par }> {
    await this.cargar("separador", alCargar);
    if (señal?.aborted) throw new Cancelado();
    const res = await this.pedir({ tipo: "separar", id: this.siguiente++, l, r }, avance, señal, [l.buffer, r.buffer]);
    if (res.tipo !== "separado") throw new Error("Respuesta inesperada");
    return { voz: res.voz, musica: res.musica };
  }

  /** Transcribe una frase (mono, 16 kHz). */
  async transcribir(x16k: Float32Array, idioma?: string, señal?: AbortSignal, alCargar?: (t: string) => void): Promise<Transcripcion> {
    await this.cargar("letra", alCargar);
    if (señal?.aborted) throw new Cancelado();
    const res = await this.pedir({ tipo: "transcribir", id: this.siguiente++, x16k, idioma }, undefined, señal);
    if (res.tipo !== "transcrito") throw new Error("Respuesta inesperada");
    return res.resultado;
  }

  cerrar() {
    this.w?.terminate();
    this.w = null;
    this.cargas = {};
    for (const p of this.esperando.values()) p.mal(new Cancelado());
    this.esperando.clear();
  }
}
