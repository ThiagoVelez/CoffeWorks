// Transporte real: la red nativa de la app (Rust) a través de comandos y eventos de Tauri.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { EstadoRed, Transporte } from "./transporte";

function aBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function deBase64(t: string): Uint8Array {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export async function crearTransporteNativo(modo: "anfitrion" | "invitado", sala: string, clave: string): Promise<Transporte> {
  const recibir: ((o: string, d: Uint8Array) => void)[] = [];
  const entrar: ((p: string) => void)[] = [];
  const salir: ((p: string) => void)[] = [];
  const estado: ((e: EstadoRed) => void)[] = [];
  // Lo que llega antes de que la sesión se suscriba no se pierde.
  const pendientes: (() => void)[] = [];
  let ultimoEstado: EstadoRed | null = null;
  let listo = false;
  const entregar = (_lista: unknown[], f: () => void) => (listo ? f() : pendientes.push(f));
  const quitar: UnlistenFn[] = await Promise.all([
    listen<{ peer: string; datos: string }>("red:dato", (e) => {
      const d = deBase64(e.payload.datos);
      entregar(recibir, () => recibir.forEach((f) => f(e.payload.peer, d)));
    }),
    listen<{ peer: string }>("red:entra", (e) => entregar(entrar, () => entrar.forEach((f) => f(e.payload.peer)))),
    listen<{ peer: string }>("red:sale", (e) => entregar(salir, () => salir.forEach((f) => f(e.payload.peer)))),
    listen<{ estado: string; mensaje?: string | null }>("red:estado", (e) => {
      const { estado: tipo, mensaje } = e.payload;
      const ev: EstadoRed =
        tipo === "error" ? { tipo: "error", mensaje: mensaje || "Error de conexión" } :
        tipo === "conectado" ? { tipo: "conectado" } :
        tipo === "cerrado" ? { tipo: "cerrado" } : { tipo: "conectando" };
      ultimoEstado = ev;
      estado.forEach((f) => f(ev));
    }),
  ]);
  try {
    await invoke<string>(modo === "anfitrion" ? "red_anfitrion" : "red_unirse", { sala, clave });
  } catch (e) {
    quitar.forEach((q) => q());
    throw new Error(String(e));
  }
  // La sesión se suscribe justo después de recibir el transporte; entonces se entrega lo guardado.
  setTimeout(() => {
    listo = true;
    pendientes.splice(0).forEach((f) => f());
  }, 0);
  return {
    enviar(destino, datos) {
      void invoke("red_enviar", { destino: destino === "todos" ? null : destino, datos: aBase64(datos) });
    },
    alRecibir: (cb) => void recibir.push(cb),
    alEntrar: (cb) => void entrar.push(cb),
    alSalir: (cb) => void salir.push(cb),
    alEstado: (cb) => {
      estado.push(cb);
      if (ultimoEstado) cb(ultimoEstado);
    },
    cortar: (peer) => void invoke("red_cortar", { peer }),
    cambiarSala: (s, c) => invoke("red_cambiar_sala", { sala: s, clave: c }),
    cerrar() {
      quitar.forEach((q) => q());
      void invoke("red_cerrar");
    },
  };
}
