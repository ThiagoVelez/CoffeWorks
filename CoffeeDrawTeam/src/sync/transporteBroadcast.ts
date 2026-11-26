// Transporte entre pestañas o ventanas del mismo navegador (BroadcastChannel).
// Se usa en el modo web y en las pruebas de extremo a extremo (?red=memoria).

import type { EstadoRed, Transporte } from "./transporte";

type Msg =
  | { t: "busco"; de: string }
  | { t: "aqui"; de: string; para: string }
  | { t: "dato"; de: string; para: string; datos: Uint8Array }
  | { t: "corte"; de: string; para: string };

export function crearTransporteBroadcast(modo: "anfitrion" | "invitado", sala: string, yo: string): Transporte {
  const bc = new BroadcastChannel(`coffeedrawteam-${sala}`);
  const conectados = new Set<string>();
  const recibir: ((o: string, d: Uint8Array) => void)[] = [];
  const entrar: ((p: string) => void)[] = [];
  const salir: ((p: string) => void)[] = [];
  const estado: ((e: EstadoRed) => void)[] = [];
  let anfitrion: string | null = null;
  let busqueda: ReturnType<typeof setInterval> | null = null;
  const post = (m: Msg) => bc.postMessage(m);
  const conectar = (p: string) => {
    if (conectados.has(p)) return;
    conectados.add(p);
    entrar.forEach((f) => f(p));
  };

  bc.onmessage = (ev: MessageEvent<Msg>) => {
    const m = ev.data;
    if (!m || m.de === yo) return;
    if (m.t === "busco" && modo === "anfitrion") {
      post({ t: "aqui", de: yo, para: m.de });
      conectar(m.de);
    } else if (m.t === "aqui" && m.para === yo && modo === "invitado" && !anfitrion) {
      anfitrion = m.de;
      if (busqueda) clearInterval(busqueda);
      estado.forEach((f) => f({ tipo: "conectado" }));
      conectar(m.de);
    } else if (m.t === "dato" && m.para === yo && conectados.has(m.de)) {
      recibir.forEach((f) => f(m.de, m.datos));
    } else if (m.t === "corte" && m.para === yo && conectados.delete(m.de)) {
      salir.forEach((f) => f(m.de));
    }
  };

  if (modo === "invitado") {
    const buscar = () => post({ t: "busco", de: yo });
    setTimeout(buscar, 0);
    busqueda = setInterval(buscar, 400);
  } else {
    setTimeout(() => estado.forEach((f) => f({ tipo: "conectado" })), 0);
  }

  return {
    enviar(destino, datos) {
      const destinos = destino === "todos" ? [...conectados] : conectados.has(destino) ? [destino] : [];
      for (const d of destinos) post({ t: "dato", de: yo, para: d, datos });
    },
    alRecibir: (cb) => void recibir.push(cb),
    alEntrar: (cb) => void entrar.push(cb),
    alSalir: (cb) => void salir.push(cb),
    alEstado: (cb) => void estado.push(cb),
    cortar(peer) {
      setTimeout(() => {
        post({ t: "corte", de: yo, para: peer });
        if (conectados.delete(peer)) salir.forEach((f) => f(peer));
      }, 100);
    },
    async cambiarSala() {
      /* las pestañas conectadas siguen en el mismo canal */
    },
    cerrar() {
      if (busqueda) clearInterval(busqueda);
      for (const p of conectados) post({ t: "corte", de: yo, para: p });
      conectados.clear();
      setTimeout(() => bc.close(), 50);
    },
  };
}
