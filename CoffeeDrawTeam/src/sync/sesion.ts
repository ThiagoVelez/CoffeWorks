// Sesión compartida de un tablero, en estrella: el anfitrión guarda la copia que manda y
// reenvía los cambios de cada invitado a los demás. Los invitados solo aceptan datos del
// anfitrión. El historial lo escribe siempre el anfitrión, con el nombre real de quien
// hizo cada cambio.

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as sync from "y-protocols/sync";
import { elementoValido, elementosDe, historialDe, imagenesDe, leerElemento, MAX_BYTES_IMAGEN, metaDe, type Kind } from "../board/model";
import { registrar, type Entrada } from "../board/history";
import { colorLibre, nombreValido, PALETA, type Persona } from "../board/personas";
import { crearSala, type Sala } from "../board/link";
import { codificar, decodificar, json, TIPO } from "./protocolo";
import type { Transporte } from "./transporte";

export const MAX_PERSONAS = 10;
const INTERVALO_PRESENCIA = 50; // 20 por segundo
const REMOTO = Symbol("remoto");

export interface Presencia {
  x: number;
  y: number;
  seleccion: string[];
}

export interface OpcionesSesion {
  ahora?: () => number;
}

export type MotivoFin = "cerrado" | "expulsado" | "lleno";

function presenciaValida(p: unknown): Presencia | null {
  if (!p || typeof p !== "object") return null;
  const { x, y, seleccion } = p as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Array.isArray(seleccion) || seleccion.length > 500 || !seleccion.every((s) => typeof s === "string")) return null;
  return { x, y, seleccion: seleccion as string[] };
}

function mensajeSync(escribir: (e: encoding.Encoder) => void): Uint8Array {
  const e = encoding.createEncoder();
  escribir(e);
  return codificar(TIPO.SYNC, encoding.toUint8Array(e));
}

/** Aplica un mensaje de y-protocols y devuelve la respuesta (si hay). Nunca lanza. */
function leerSync(doc: Y.Doc, cuerpo: Uint8Array, origen: unknown): Uint8Array | null {
  try {
    const dec = decoding.createDecoder(cuerpo);
    const enc = encoding.createEncoder();
    sync.readSyncMessage(dec, enc, doc, origen);
    return encoding.length(enc) > 0 ? codificar(TIPO.SYNC, encoding.toUint8Array(enc)) : null;
  } catch {
    return null;
  }
}

class Limitador {
  private ultimo = -Infinity;
  private pendiente: Presencia | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  constructor(private ahora: () => number, private enviar: (p: Presencia) => void) {}
  empujar(p: Presencia) {
    const t = this.ahora();
    if (t - this.ultimo >= INTERVALO_PRESENCIA) {
      this.ultimo = t;
      this.pendiente = null;
      this.enviar(p);
      return;
    }
    this.pendiente = p;
    if (!this.temporizador)
      this.temporizador = setTimeout(() => {
        this.temporizador = null;
        if (this.pendiente) this.empujar(this.pendiente);
      }, INTERVALO_PRESENCIA);
  }
  parar() {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  }
}

const DE_POSICION = new Set(["x", "y", "w", "h", "z"]);

function detalleDe(m: Y.Map<unknown> | undefined): string | undefined {
  const v = m?.get("texto");
  const t = v instanceof Y.Text ? v.toString() : v;
  if (typeof t !== "string" || !t.trim()) return undefined;
  const limpio = t.trim().replace(/\s+/g, " ");
  return limpio.length > 40 ? `${limpio.slice(0, 39)}…` : limpio;
}

export class SesionAnfitrion {
  activa = true;
  private admitidos = new Map<string, Persona>();
  private expulsados = new Set<string>();
  /** Deshace lo que un invitado cambie en el historial o en los nombres (solo los escribe el anfitrión). */
  private guardia: Y.UndoManager;
  private presencias = new Map<string, Presencia>();
  private cambios: (() => void)[] = [];
  private cola: Entrada[] = [];
  private limitador: Limitador;
  private ahora: () => number;

  constructor(readonly doc: Y.Doc, private t: Transporte, readonly yo: Persona, private sala: Sala, opciones: OpcionesSesion = {}) {
    this.ahora = opciones.ahora ?? Date.now;
    this.limitador = new Limitador(this.ahora, (p) => this.aTodos(codificar(TIPO.PRESENCIA, { id: yo.id, ...p })));
    this.recordar(yo);
    t.alRecibir((origen, datos) => this.recibir(origen, datos));
    t.alSalir((peer) => this.salio(peer));
    this.guardia = new Y.UndoManager([historialDe(doc), metaDe(doc)], { trackedOrigins: new Set(), captureTimeout: 0 });
    doc.on("update", this.alUpdate);
    doc.on("afterTransaction", this.vigilar);
    elementosDe(doc).observeDeep(this.alCambiarElementos);
  }

  private vigilar = (tr: Y.Transaction) => {
    if (typeof tr.origin !== "string" || !this.admitidos.has(tr.origin)) return;
    this.revisar(tr);
    const protegidos = [historialDe(this.doc), metaDe(this.doc)] as unknown as Y.AbstractType<Y.YEvent<any>>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!protegidos.some((t) => tr.changed.has(t) || tr.changedParentTypes.has(t))) return;
    queueMicrotask(() => {
      while (this.guardia.undoStack.length) this.guardia.undo();
      this.guardia.clear();
    });
  };

  /** Quita lo que un invitado mande mal formado o demasiado grande (podría romper el tablero de todos). */
  private revisar(tr: Y.Transaction) {
    const elementos = elementosDe(this.doc), imagenes = imagenesDe(this.doc);
    const ids = new Set<string>([...(tr.changed.get(elementos as never) ?? [])].filter((k): k is string => typeof k === "string"));
    for (const tipo of tr.changed.keys()) {
      if ((tipo as unknown) !== elementos && tipo.parent === (elementos as unknown)) ids.add((tipo as unknown as Y.Map<unknown>).get("id") as string);
      if (tipo instanceof Y.Text && tipo.parent?.parent === (elementos as unknown)) ids.add((tipo.parent as Y.Map<unknown>).get("id") as string);
    }
    const imgs = [...(tr.changed.get(imagenes as never) ?? [])].filter((k): k is string => typeof k === "string");
    queueMicrotask(() => {
      const malos = [...ids].filter((id) => {
        const m = elementos.get(id);
        return m && !(m instanceof Y.Map && elementoValido(leerElemento(m)) && leerElemento(m).id === id);
      });
      const grandes = imgs.filter((k) => {
        const b = imagenes.get(k) as unknown;
        return b !== undefined && !(b instanceof Uint8Array && b.length <= MAX_BYTES_IMAGEN);
      });
      if (!malos.length && !grandes.length) return;
      this.doc.transact(() => {
        malos.forEach((id) => elementos.delete(id));
        grandes.forEach((k) => imagenes.delete(k));
      }, "revision");
    });
  }

  personas(): Persona[] {
    return [this.yo, ...this.admitidos.values()];
  }

  presenciaDe(id: string): Presencia | undefined {
    return this.presencias.get(id);
  }

  link(): Sala {
    return this.sala;
  }

  alCambio(cb: () => void) {
    this.cambios.push(cb);
  }

  presencia(p: Presencia) {
    if (this.activa) this.limitador.empujar(p);
  }

  async cambiarLink(): Promise<Sala> {
    const nueva = await this.rotar();
    registrar(this.doc, { personaId: this.yo.id, accion: "cambioLink", t: this.ahora() });
    return nueva;
  }

  async expulsar(id: string): Promise<Sala> {
    this.expulsados.add(id);
    if (this.admitidos.has(id)) {
      this.guardia.trackedOrigins.delete(id);
      this.t.enviar(id, codificar(TIPO.EXPULSADO));
      this.admitidos.delete(id);
      this.presencias.delete(id);
      this.t.cortar(id);
      registrar(this.doc, { personaId: id, accion: "expulsado", t: this.ahora() });
      this.enviarRoster();
      this.avisar();
    }
    return this.rotar();
  }

  cerrar() {
    if (!this.activa) return;
    this.aTodos(codificar(TIPO.CERRADO));
    this.activa = false;
    this.limitador.parar();
    this.doc.off("update", this.alUpdate);
    this.doc.off("afterTransaction", this.vigilar);
    this.guardia.destroy();
    elementosDe(this.doc).unobserveDeep(this.alCambiarElementos);
    this.t.cerrar();
  }

  private async rotar(): Promise<Sala> {
    // La llave del anfitrión no cambia: es quien es.
    const nueva: Sala = { ...crearSala(), ...(this.sala.llave ? { llave: this.sala.llave } : {}) };
    try {
      await this.t.cambiarSala(nueva.sala, nueva.clave);
    } catch (e) {
      throw new Error(`No se pudo cambiar el link: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.sala = nueva;
    this.aTodos(codificar(TIPO.NUEVA_SALA, nueva));
    return nueva;
  }

  private aTodos(datos: Uint8Array, salvo?: unknown) {
    for (const id of this.admitidos.keys()) if (id !== salvo) this.t.enviar(id, datos);
  }

  private avisar() {
    this.cambios.forEach((f) => f());
  }

  private recordar(p: Persona) {
    const meta = metaDe(this.doc);
    const todas = { ...((meta.get("personas") as Record<string, { nombre: string; color: string }>) ?? {}) };
    todas[p.id] = { nombre: p.nombre, color: p.color };
    meta.set("personas", todas);
  }

  private enviarRoster() {
    const personas = this.personas();
    for (const id of this.admitidos.keys()) this.t.enviar(id, codificar(TIPO.ROSTER, { tu: id, personas }));
  }

  private recibir(origen: string, datos: Uint8Array) {
    if (!this.activa) return;
    const m = decodificar(datos);
    if (!m) return;
    if (m.tipo === TIPO.HOLA) return this.hola(origen, m.cuerpo);
    if (!this.admitidos.has(origen)) return;
    if (m.tipo === TIPO.SYNC) {
      const respuesta = leerSync(this.doc, m.cuerpo, origen);
      if (respuesta) this.t.enviar(origen, respuesta);
    } else if (m.tipo === TIPO.PRESENCIA) {
      const p = presenciaValida(json(m.cuerpo));
      if (!p) return;
      this.presencias.set(origen, p);
      this.aTodos(codificar(TIPO.PRESENCIA, { id: origen, ...p }), origen);
      this.avisar();
    }
  }

  private hola(peer: string, cuerpo: Uint8Array) {
    if (this.admitidos.has(peer)) return;
    if (this.expulsados.has(peer)) {
      this.t.cortar(peer);
      return;
    }
    const h = json<{ nombre?: unknown; color?: unknown }>(cuerpo);
    const nombre = typeof h?.nombre === "string" ? nombreValido(h.nombre) : null;
    if (!nombre) return;
    if (1 + this.admitidos.size >= MAX_PERSONAS) {
      this.t.enviar(peer, codificar(TIPO.LLENO));
      this.t.cortar(peer);
      return;
    }
    const preferido = typeof h?.color === "string" && PALETA.includes(h.color) ? h.color : PALETA[0];
    const persona: Persona = { id: peer, nombre, color: colorLibre(preferido, this.personas().map((p) => p.color)) };
    this.admitidos.set(peer, persona);
    this.guardia.trackedOrigins.add(peer);
    this.recordar(persona);
    registrar(this.doc, { personaId: peer, accion: "entro", t: this.ahora() });
    this.enviarRoster();
    this.t.enviar(peer, codificar(TIPO.NUEVA_SALA, this.sala));
    this.t.enviar(peer, mensajeSync((e) => sync.writeSyncStep1(e, this.doc)));
    this.avisar();
  }

  private salio(peer: string) {
    if (!this.admitidos.delete(peer)) return;
    this.guardia.trackedOrigins.delete(peer);
    this.presencias.delete(peer);
    if (this.activa) {
      registrar(this.doc, { personaId: peer, accion: "salio", t: this.ahora() });
      this.enviarRoster();
    }
    this.avisar();
  }

  private alUpdate = (update: Uint8Array, origen: unknown) => {
    if (this.activa) this.aTodos(mensajeSync((e) => sync.writeUpdate(e, update)), origen);
  };

  /** Quién hizo un cambio: el invitado cuyo update se aplicó, o el propio anfitrión. */
  private autorDe(origen: unknown): string | null {
    if (typeof origen === "string" && this.admitidos.has(origen)) return origen;
    if (origen === this.yo.id || origen instanceof Y.UndoManager) return this.yo.id;
    return null;
  }

  private alCambiarElementos = (eventos: Y.YEvent<Y.AbstractType<unknown>>[], tr: Y.Transaction) => {
    const personaId = this.autorDe(tr.origin);
    if (!personaId) return;
    const elementos = elementosDe(this.doc);
    const t = this.ahora();
    for (const ev of eventos) {
      if (ev.target === elementos) {
        ev.changes.keys.forEach((cambio, id) => {
          if (cambio.action === "delete") {
            let kind: Kind | undefined;
            try {
              kind = (cambio.oldValue as Y.Map<unknown>)?.get?.("kind") as Kind | undefined;
            } catch {
              kind = undefined;
            }
            this.cola.push({ personaId, accion: "borro", kind, elementoId: id, t });
          } else {
            const m = elementos.get(id);
            this.cola.push({ personaId, accion: "agrego", kind: m?.get("kind") as Kind, elementoId: id, detalle: detalleDe(m), t });
          }
        });
      } else {
        const id = String(ev.path[0] ?? "");
        const m = elementos.get(id);
        if (!m) continue;
        const claves = [...ev.changes.keys.keys()];
        const accion = ev.target instanceof Y.Text || !claves.every((k) => DE_POSICION.has(k)) ? "edito" : "movio";
        this.cola.push({ personaId, accion, kind: m.get("kind") as Kind, elementoId: id, detalle: detalleDe(m), t });
      }
    }
    // Se escribe después de la transacción que se está observando.
    queueMicrotask(() => {
      const cola = this.cola.splice(0);
      if (!cola.length || !this.activa) return;
      this.doc.transact(() => cola.forEach((e) => registrar(this.doc, e)), "historial");
    });
  };
}

export class SesionInvitado {
  activa = true;
  private anfitrion: string | null = null;
  private lista: Persona[] = [];
  private miId: string | null = null;
  private presencias = new Map<string, Presencia>();
  private cambios: (() => void)[] = [];
  private fines: ((m: MotivoFin) => void)[] = [];
  private limitador: Limitador;

  constructor(readonly doc: Y.Doc, private t: Transporte, readonly yo: { nombre: string; color: string }, private sala: Sala | null = null, opciones: OpcionesSesion = {}) {
    this.limitador = new Limitador(opciones.ahora ?? Date.now, (p) => {
      if (this.anfitrion) this.t.enviar(this.anfitrion, codificar(TIPO.PRESENCIA, p));
    });
    t.alEntrar((peer) => {
      if (this.anfitrion || !this.activa) return;
      this.anfitrion = peer;
      t.enviar(peer, codificar(TIPO.HOLA, yo));
      t.enviar(peer, mensajeSync((e) => sync.writeSyncStep1(e, doc)));
    });
    t.alRecibir((origen, datos) => this.recibir(origen, datos));
    t.alSalir((peer) => {
      if (peer === this.anfitrion) this.terminar("cerrado");
    });
    doc.on("update", this.alUpdate);
  }

  /** Mi id en este tablero (lo asigna el anfitrión). */
  id(): string | null {
    return this.miId;
  }

  personas(): Persona[] {
    return this.lista;
  }

  presenciaDe(id: string): Presencia | undefined {
    return this.presencias.get(id);
  }

  link(): Sala | null {
    return this.sala;
  }

  alCambio(cb: () => void) {
    this.cambios.push(cb);
  }

  alFin(cb: (m: MotivoFin) => void) {
    this.fines.push(cb);
  }

  presencia(p: Presencia) {
    if (this.activa) this.limitador.empujar(p);
  }

  cerrar() {
    if (!this.activa) return;
    this.activa = false;
    this.limitador.parar();
    this.doc.off("update", this.alUpdate);
    this.t.cerrar();
  }

  private terminar(m: MotivoFin) {
    if (!this.activa) return;
    this.cerrar();
    this.fines.forEach((f) => f(m));
  }

  private avisar() {
    this.cambios.forEach((f) => f());
  }

  private recibir(origen: string, datos: Uint8Array) {
    if (!this.activa || origen !== this.anfitrion) return;
    const m = decodificar(datos);
    if (!m) return;
    switch (m.tipo) {
      case TIPO.SYNC: {
        const respuesta = leerSync(this.doc, m.cuerpo, REMOTO);
        if (respuesta) this.t.enviar(origen, respuesta);
        break;
      }
      case TIPO.ROSTER: {
        const r = json<{ tu?: unknown; personas?: unknown }>(m.cuerpo);
        if (!r || typeof r.tu !== "string" || !Array.isArray(r.personas)) return;
        const personas = r.personas.filter(
          (p): p is Persona => !!p && typeof p.id === "string" && typeof p.nombre === "string" && typeof p.color === "string",
        );
        this.miId = r.tu;
        this.lista = personas.slice(0, MAX_PERSONAS);
        for (const id of this.presencias.keys()) if (!personas.some((p) => p.id === id)) this.presencias.delete(id);
        this.avisar();
        break;
      }
      case TIPO.PRESENCIA: {
        const p = json<{ id?: unknown }>(m.cuerpo);
        const v = presenciaValida(p);
        if (!v || typeof p?.id !== "string") return;
        this.presencias.set(p.id, v);
        this.avisar();
        break;
      }
      case TIPO.NUEVA_SALA: {
        const s = json<Sala>(m.cuerpo);
        if (s && typeof s.sala === "string" && typeof s.clave === "string") {
          this.sala = { sala: s.sala, clave: s.clave };
          this.avisar();
        }
        break;
      }
      case TIPO.EXPULSADO:
        return this.terminar("expulsado");
      case TIPO.LLENO:
        return this.terminar("lleno");
      case TIPO.CERRADO:
        return this.terminar("cerrado");
    }
  }

  private alUpdate = (update: Uint8Array, origen: unknown) => {
    if (this.activa && this.anfitrion && origen !== REMOTO) this.t.enviar(this.anfitrion, mensajeSync((e) => sync.writeUpdate(e, update)));
  };
}
