// Red en memoria para pruebas: imita la red nativa (estrella: los invitados solo
// «ven» entrar al anfitrión), con entrega asíncrona y en orden.

import type { EstadoRed, Transporte } from "./transporte";

interface Nodo {
  recibir: ((origen: string, datos: Uint8Array) => void)[];
  entrar: ((peer: string) => void)[];
  salir: ((peer: string) => void)[];
  estado: ((e: EstadoRed) => void)[];
  conectados: Set<string>;
  salas: { sala: string; clave: string }[];
  enviados: Uint8Array[];
}

export function crearRedMemoria(anfitrion: string) {
  const nodos = new Map<string, Nodo>();
  const luego = (f: () => void) => setTimeout(f, 0);

  const conectar = (a: string, b: string) => {
    const na = nodos.get(a), nb = nodos.get(b);
    if (!na || !nb) return;
    na.conectados.add(b);
    nb.conectados.add(a);
    luego(() => {
      na.entrar.forEach((f) => f(b));
      nb.entrar.forEach((f) => f(a));
    });
  };
  const desconectar = (a: string, b: string) => {
    const na = nodos.get(a), nb = nodos.get(b);
    if (!na?.conectados.has(b)) return;
    na.conectados.delete(b);
    nb?.conectados.delete(a);
    luego(() => {
      na.salir.forEach((f) => f(b));
      nb?.salir.forEach((f) => f(a));
    });
  };
  const entregar = (de: string, para: string, datos: Uint8Array) => {
    const copia = datos.slice();
    luego(() => nodos.get(para)?.recibir.forEach((f) => f(de, copia)));
  };

  return {
    transporte(id: string): Transporte {
      const nodo: Nodo = { recibir: [], entrar: [], salir: [], estado: [], conectados: new Set(), salas: [], enviados: [] };
      nodos.set(id, nodo);
      if (id === anfitrion) for (const otro of nodos.keys()) { if (otro !== id) conectar(id, otro); }
      else if (nodos.has(anfitrion)) conectar(id, anfitrion);
      luego(() => nodo.estado.forEach((f) => f({ tipo: "conectado" })));
      return {
        enviar(destino, datos) {
          nodo.enviados.push(datos);
          const destinos = destino === "todos" ? [...nodo.conectados] : nodo.conectados.has(destino) ? [destino] : [];
          for (const d of destinos) entregar(id, d, datos);
        },
        alRecibir: (cb) => void nodo.recibir.push(cb),
        alEntrar: (cb) => void nodo.entrar.push(cb),
        alSalir: (cb) => void nodo.salir.push(cb),
        alEstado: (cb) => void nodo.estado.push(cb),
        cortar: (peer) => desconectar(id, peer),
        async cambiarSala(sala, clave) {
          nodo.salas.push({ sala, clave });
        },
        cerrar() {
          for (const p of [...nodo.conectados]) desconectar(id, p);
          luego(() => nodos.delete(id));
        },
      };
    },
    /** Inyecta un mensaje como si `de` lo hubiera enviado (aunque no estén conectados). */
    enviarComo(de: string, para: string, datos: Uint8Array) {
      entregar(de, para, datos);
    },
    salasDe: (id: string) => nodos.get(id)?.salas ?? [],
    enviados: (id: string, tipo: number) => (nodos.get(id)?.enviados ?? []).filter((d) => d[0] === tipo).length,
  };
}
