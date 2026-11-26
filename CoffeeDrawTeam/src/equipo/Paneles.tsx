// Personas conectadas, historial y estado de la conexión.

import { useEffect, useState } from "react";
import { History, UserX, WifiOff, X } from "lucide-react";
import type * as Y from "yjs";
import { metaDe } from "../board/model";
import { describir, entradas } from "../board/history";
import type { Persona } from "../board/personas";
import type { EstadoSesion } from "./useSesion";

export function Avatar({ p, tam = 30 }: { p: { nombre: string; color: string }; tam?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center font-bold text-white border-2 border-white shrink-0" style={{ background: p.color, width: tam, height: tam, fontSize: tam * 0.42 }}>
      {p.nombre.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function PanelPersonas({ personas, miId, esAnfitrion, siguiendo, alSeguir, alExpulsar }: {
  personas: Persona[];
  miId: string | null;
  esAnfitrion: boolean;
  siguiendo: string | null;
  alSeguir: (id: string | null) => void;
  alExpulsar: (p: Persona) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  if (personas.length <= 1) return null;
  return (
    <div className="relative">
      <button type="button" className="flex -space-x-2 items-center" onClick={() => setAbierto(!abierto)} aria-label={`${personas.length} personas en el tablero`} data-personas={personas.length}>
        {personas.slice(0, 5).map((p) => <Avatar key={p.id} p={p} />)}
        {personas.length > 5 && <span className="ml-3 text-xs font-semibold text-[#5c3a21]">+{personas.length - 5}</span>}
      </button>
      {abierto && (
        <div className="absolute right-0 top-10 z-30 w-64 rounded-2xl bg-white border border-[#e8dfd8] shadow-xl p-2 flex flex-col">
          {personas.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[#faf7f2]">
              <Avatar p={p} tam={26} />
              <span className="flex-1 text-sm font-semibold truncate">{p.nombre}{p.id === miId ? " (tú)" : ""}</span>
              {p.id !== miId && (
                <button type="button" className={`text-xs px-2 h-7 rounded-lg ${siguiendo === p.id ? "bg-[#f08c2e] text-white" : "hover:bg-[#f3ece4]"}`} onClick={() => alSeguir(siguiendo === p.id ? null : p.id)}>
                  {siguiendo === p.id ? "Siguiendo" : "Seguir"}
                </button>
              )}
              {esAnfitrion && p.id !== miId && (
                <button type="button" title={`Expulsar a ${p.nombre}`} aria-label={`Expulsar a ${p.nombre}`} className="w-7 h-7 rounded-lg text-[#c62828] hover:bg-[#fde8e8] flex items-center justify-center" onClick={() => alExpulsar(p)}>
                  <UserX size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function hora(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PanelHistorial({ doc, alIr, alCerrar, yoId }: { doc: Y.Doc; alIr: (id: string) => void; alCerrar: () => void; yoId: string | null }) {
  const [, setV] = useState(0);
  const [filtro, setFiltro] = useState("");
  useEffect(() => {
    const f = () => setV((v) => v + 1);
    doc.on("update", f);
    return () => doc.off("update", f);
  }, [doc]);
  const conocidas = (metaDe(doc).get("personas") as Record<string, { nombre: string; color: string }>) ?? {};
  const nombreDe = (id: string) => (id === yoId ? "Tú" : conocidas[id]?.nombre ?? "Alguien");
  const lista = entradas(doc, filtro || undefined).slice(0, 400);
  return (
    <aside className="absolute right-3 top-3 bottom-44 w-80 z-20 rounded-2xl bg-white border border-[#e8dfd8] shadow-xl flex flex-col overflow-hidden" aria-label="Historial" data-historial>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#efe6dd]">
        <History size={16} className="text-[#f08c2e]" />
        <span className="font-display font-bold flex-1">Historial</span>
        <button type="button" aria-label="Cerrar historial" className="w-7 h-7 rounded-lg hover:bg-[#f3ece4] flex items-center justify-center" onClick={alCerrar}><X size={16} /></button>
      </div>
      <div className="px-3 py-2 border-b border-[#efe6dd]">
        <select className="w-full h-8 px-2 rounded-lg border border-[#dfd3c7] text-sm bg-white" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por persona">
          <option value="">Todas las personas</option>
          {Object.entries(conocidas).map(([id, p]) => <option key={id} value={id}>{id === yoId ? "Tú" : p.nombre}</option>)}
        </select>
      </div>
      <ol className="flex-1 overflow-y-auto py-1">
        {!lista.length && <li className="px-4 py-6 text-sm text-[#8d6e63] text-center">Todavía no hay cambios.</li>}
        {lista.map((e, i) => (
          <li key={`${e.t}-${i}`}>
            <button type="button" className="w-full text-left flex items-start gap-2 px-4 py-2 hover:bg-[#faf7f2] text-sm disabled:cursor-default" disabled={!e.elementoId} onClick={() => e.elementoId && alIr(e.elementoId)}>
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: conocidas[e.personaId]?.color ?? "#a1887f" }} />
              <span className="flex-1">{describir(e, nombreDe)}</span>
              <span className="text-xs font-mono text-[#a1887f] mt-0.5">{hora(e.t)}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function EstadoConexion({ estado, alReintentar, alGuardarCopia, alSalir }: { estado: EstadoSesion; alReintentar: () => void; alGuardarCopia: () => void; alSalir: () => void }) {
  const fin = estado.fin;
  if (fin) {
    const texto = fin === "cerrado" ? "El anfitrión cerró el tablero" : fin === "expulsado" ? "El anfitrión te sacó de este tablero" : "El tablero está lleno (máximo 10 personas)";
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#2c1b12] text-white shadow-xl text-sm" role="status" data-fin={fin}>
        <WifiOff size={16} /> {texto}
        {fin === "cerrado" && <button type="button" className="px-3 h-8 rounded-lg bg-white/15 hover:bg-white/25 font-semibold" onClick={alReintentar}>Volver a entrar</button>}
        <button type="button" className="px-3 h-8 rounded-lg bg-white/15 hover:bg-white/25 font-semibold" onClick={alGuardarCopia}>Guardar una copia</button>
        <button type="button" className="px-3 h-8 rounded-lg bg-[#f08c2e] font-semibold" onClick={alSalir}>Salir</button>
      </div>
    );
  }
  const red = estado.red;
  if (!red || estado.modo === "solo") return null;
  if (red.tipo === "error")
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#fde8e8] text-[#8e1c1c] border border-[#f5c2c2] shadow-md text-sm" role="alert">
        <WifiOff size={16} /> No se pudo conectar — tu red puede estar bloqueando la conexión directa
        <button type="button" className="px-3 h-8 rounded-lg bg-white border border-[#f5c2c2] font-semibold" onClick={alReintentar}>Reintentar</button>
      </div>
    );
  return null;
}

export function etiquetaRed(estado: EstadoSesion): string {
  if (estado.modo === "solo") return "Solo tú";
  if (estado.fin) return "Desconectado";
  if (!estado.red || estado.red.tipo === "conectando") return "Conectando…";
  if (estado.red.tipo === "error") return "Sin conexión";
  const n = Math.max(1, estado.personas.length);
  return `Conectado (${n} ${n === 1 ? "persona" : "personas"})`;
}
