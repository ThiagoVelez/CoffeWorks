// Conecta el tablero abierto con su sesión compartida (anfitrión o invitado) y
// expone personas, cursores y estado de la conexión a la interfaz.

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import { isTauri } from "../studio/desktop";
import type { Sala } from "../board/link";
import type { Persona } from "../board/personas";
import { SesionAnfitrion, SesionInvitado, type MotivoFin, type Presencia } from "../sync/sesion";
import type { EstadoRed, Transporte } from "../sync/transporte";
import { crearTransporteNativo } from "../sync/transporteNativo";
import { crearTransporteBroadcast } from "../sync/transporteBroadcast";
import type { CursorAjeno } from "../canvas/Lienzo";

const QUIETO_MS = 5000;

/** En el navegador (o con ?red=memoria) se usa el canal entre pestañas. */
const usarMemoria = () => !isTauri || new URLSearchParams(window.location.search).get("red") === "memoria";

async function crearTransporte(modo: "anfitrion" | "invitado", sala: Sala, yo: string): Promise<Transporte> {
  return usarMemoria() ? crearTransporteBroadcast(modo, sala.sala, yo) : crearTransporteNativo(modo, sala.sala, sala.clave);
}

export interface EstadoSesion {
  modo: "solo" | "anfitrion" | "invitado";
  red: EstadoRed | null;
  personas: Persona[];
  miId: string | null;
  cursores: CursorAjeno[];
  fin: MotivoFin | null;
  link: Sala | null;
}

const INICIAL: EstadoSesion = { modo: "solo", red: null, personas: [], miId: null, cursores: [], fin: null, link: null };

export function useSesion() {
  const sesion = useRef<SesionAnfitrion | SesionInvitado | null>(null);
  const [estado, setEstado] = useState<EstadoSesion>(INICIAL);
  const movidas = useRef(new Map<string, { x: number; y: number; t: number }>());

  const refrescar = useCallback(() => {
    const s = sesion.current;
    if (!s) return;
    const miId = s instanceof SesionAnfitrion ? s.yo.id : s.id();
    const ahora = Date.now();
    const cursores: CursorAjeno[] = [];
    for (const p of s.personas()) {
      if (p.id === miId) continue;
      const pr = s.presenciaDe(p.id);
      if (!pr) continue;
      const antes = movidas.current.get(p.id);
      if (!antes || antes.x !== pr.x || antes.y !== pr.y) movidas.current.set(p.id, { x: pr.x, y: pr.y, t: ahora });
      const t = movidas.current.get(p.id)!.t;
      cursores.push({ id: p.id, nombre: p.nombre, color: p.color, x: pr.x, y: pr.y, seleccion: pr.seleccion, quieto: ahora - t > QUIETO_MS });
    }
    setEstado((e) => ({ ...e, personas: [...s.personas()], miId, cursores, link: s.link() }));
  }, []);

  // Los cursores quietos ocultan su nombre.
  useEffect(() => {
    const t = setInterval(refrescar, 1000);
    return () => clearInterval(t);
  }, [refrescar]);

  const cerrar = useCallback(() => {
    sesion.current?.cerrar();
    sesion.current = null;
    movidas.current.clear();
    setEstado(INICIAL);
  }, []);

  useEffect(() => () => sesion.current?.cerrar(), []);

  const anfitrion = useCallback(async (doc: Y.Doc, yo: Persona, sala: Sala) => {
    cerrar();
    setEstado({ ...INICIAL, modo: "anfitrion", red: { tipo: "conectando" }, link: sala, personas: [yo], miId: yo.id });
    try {
      const t = await crearTransporte("anfitrion", sala, yo.id);
      t.alEstado((red) => setEstado((e) => ({ ...e, red })));
      const s = new SesionAnfitrion(doc, t, yo, sala);
      sesion.current = s;
      s.alCambio(refrescar);
      refrescar();
    } catch (err) {
      setEstado((e) => ({ ...e, red: { tipo: "error", mensaje: err instanceof Error ? err.message : String(err) } }));
    }
  }, [cerrar, refrescar]);

  const invitado = useCallback(async (doc: Y.Doc, yo: { nombre: string; color: string }, sala: Sala) => {
    cerrar();
    setEstado({ ...INICIAL, modo: "invitado", red: { tipo: "conectando" }, link: sala });
    try {
      const id = `inv-${Math.random().toString(36).slice(2, 10)}`;
      const t = await crearTransporte("invitado", sala, id);
      t.alEstado((red) => setEstado((e) => ({ ...e, red: e.fin ? e.red : red })));
      const s = new SesionInvitado(doc, t, yo, sala);
      sesion.current = s;
      s.alCambio(refrescar);
      s.alFin((fin) => setEstado((e) => ({ ...e, fin, cursores: [] })));
    } catch (err) {
      setEstado((e) => ({ ...e, red: { tipo: "error", mensaje: err instanceof Error ? err.message : String(err) } }));
    }
  }, [cerrar, refrescar]);

  const presencia = useCallback((p: Presencia) => sesion.current?.presencia(p), []);

  const expulsar = useCallback(async (id: string) => {
    const s = sesion.current;
    if (s instanceof SesionAnfitrion) {
      await s.expulsar(id);
      refrescar();
    }
  }, [refrescar]);

  const cambiarLink = useCallback(async () => {
    const s = sesion.current;
    if (s instanceof SesionAnfitrion) {
      await s.cambiarLink();
      refrescar();
    }
  }, [refrescar]);

  return { estado, anfitrion, invitado, cerrar, presencia, expulsar, cambiarLink };
}
