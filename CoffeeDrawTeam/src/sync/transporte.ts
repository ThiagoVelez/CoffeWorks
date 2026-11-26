// Capa de transporte: lo único que la sesión necesita de la red.
// En la app es la red nativa (Rust); en las pruebas, una red en memoria.

export type EstadoRed =
  | { tipo: "conectando" }
  | { tipo: "conectado" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "cerrado" };

export interface Transporte {
  enviar(destino: string | "todos", datos: Uint8Array): void;
  alRecibir(cb: (origen: string, datos: Uint8Array) => void): void;
  alEntrar(cb: (peer: string) => void): void;
  alSalir(cb: (peer: string) => void): void;
  alEstado(cb: (e: EstadoRed) => void): void;
  cortar(peer: string): void;
  /** El anfitrión escucha a partir de ahora en otra sala (las conexiones abiertas siguen). */
  cambiarSala(sala: string, clave: string): Promise<void>;
  cerrar(): void;
}
