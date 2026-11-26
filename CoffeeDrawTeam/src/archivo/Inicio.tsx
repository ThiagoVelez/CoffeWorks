// Pantalla de inicio: nuevo tablero, unirse, mis tableros y tableros a los que me uní.

import { useEffect, useState } from "react";
import { LogIn, Plus, Users } from "lucide-react";
import { PLANTILLAS, type PlantillaId } from "../board/templates";
import { listRecent, relativeTime, type RecentEntry } from "../studio/desktop";
import { Avatar } from "../equipo/Paneles";
import { tablerosUnidos, type Unido } from "./almacen";

const DIBUJOS: Record<PlantillaId, React.ReactNode> = {
  blanco: <rect x="10" y="10" width="100" height="60" rx="6" fill="#fff" stroke="#e8dfd8" />,
  lluvia: (
    <g>
      <rect x="46" y="27" width="28" height="24" rx="3" fill="#ffd6a8" />
      {[[14, 10], [82, 10], [14, 48], [82, 48], [48, 2], [48, 56]].map(([x, y], i) => <rect key={i} x={x} y={y} width="22" height="18" rx="3" fill={["#fff3a3", "#ffc9de", "#c8f2c2", "#c4e2ff", "#e0d2ff", "#fff3a3"][i]} />)}
    </g>
  ),
  mapa: (
    <g stroke="#6f4e37" strokeWidth="1.5">
      {[[20, 14], [90, 14], [20, 62], [90, 62]].map(([x, y], i) => <line key={i} x1="60" y1="40" x2={x} y2={y} />)}
      <ellipse cx="60" cy="40" rx="20" ry="11" fill="#ffd6a8" />
      {[[6, 8], [76, 8], [6, 56], [76, 56]].map(([x, y], i) => <rect key={i} x={x} y={y} width="28" height="12" rx="3" fill="#fff" />)}
    </g>
  ),
  proscontras: (
    <g>
      <rect x="10" y="8" width="45" height="64" rx="4" fill="#c8f2c2" opacity="0.6" />
      <rect x="65" y="8" width="45" height="64" rx="4" fill="#ffc9de" opacity="0.6" />
    </g>
  ),
  kanban: <g>{[8, 44, 80].map((x) => <rect key={x} x={x} y="8" width="32" height="64" rx="4" fill="#faf7f2" stroke="#6f4e37" />)}<rect x="12" y="16" width="24" height="12" rx="2" fill="#fff3a3" /></g>,
};

export function Inicio({ perfil, alNuevo, alAbrir, alUnirse, alVolver, alPerfil }: {
  perfil: { nombre: string; color: string };
  alNuevo: (p: PlantillaId) => void;
  alAbrir: (r: RecentEntry) => void;
  alUnirse: () => void;
  alVolver: (u: Unido) => void;
  alPerfil: () => void;
}) {
  const [recientes, setRecientes] = useState<RecentEntry[]>([]);
  const [unidos] = useState(tablerosUnidos);
  useEffect(() => {
    void listRecent("coffeedrawteam").then((r) => setRecientes(r.sort((a, b) => b.updated_at - a.updated_at).slice(0, 12)));
  }, []);
  return (
    <div className="h-full w-full overflow-y-auto bg-[#faf7f2] text-[#2c1b12]" data-inicio>
      <div className="max-w-5xl mx-auto px-8 py-10 flex flex-col gap-10">
        <header className="flex items-center gap-3">
          <img src="/app-icon.png" alt="" className="w-11 h-11" draggable={false} />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">CoffeeDrawTeam</h1>
            <p className="text-sm text-[#8d6e63]">Tableros para trabajar en grupo o solo</p>
          </div>
          <button type="button" className="flex items-center gap-2 px-3 h-10 rounded-xl hover:bg-white border border-transparent hover:border-[#e8dfd8]" onClick={alPerfil} title="Cambiar tu nombre y color">
            <Avatar p={perfil} /> <span className="text-sm font-semibold">{perfil.nombre}</span>
          </button>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold flex items-center gap-2"><Plus size={18} className="text-[#f08c2e]" /> Nuevo tablero</h2>
            <button type="button" className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#f08c2e] text-white font-semibold text-sm hover:bg-[#d97a1f]" onClick={alUnirse}>
              <LogIn size={16} /> Unirse a un tablero
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PLANTILLAS.map((p) => (
              <button key={p.id} type="button" className="group flex flex-col gap-2 text-left" onClick={() => alNuevo(p.id)} data-plantilla={p.id}>
                <svg viewBox="0 0 120 80" className="w-full rounded-xl bg-white border border-[#e8dfd8] group-hover:border-[#f08c2e] group-hover:shadow-md transition">{DIBUJOS[p.id]}</svg>
                <span className="text-sm font-semibold">{p.nombre}</span>
                <span className="text-xs text-[#8d6e63] -mt-1.5">{p.descripcion}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Mis tableros</h2>
          {recientes.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recientes.map((r) => (
                <button key={r.id} type="button" className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#e8dfd8] hover:border-[#f08c2e] text-left" onClick={() => alAbrir(r)}>
                  <span className="w-9 h-9 rounded-lg bg-[#ffd6a8] flex items-center justify-center text-[#a8541a] font-bold">▦</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{r.name.replace(/\.cdteam$/i, "")}</span>
                    <span className="block text-xs text-[#8d6e63]">{relativeTime(r.updated_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#8d6e63]">Aún no tienes tableros. Empieza uno con una plantilla.</p>
          )}
        </section>

        {unidos.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold flex items-center gap-2"><Users size={18} className="text-[#f08c2e]" /> Tableros a los que me uní</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unidos.map((u) => (
                <button key={u.link.sala} type="button" className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#e8dfd8] hover:border-[#f08c2e] text-left" onClick={() => alVolver(u)}>
                  <Users size={18} className="text-[#8d6e63]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{u.nombre}</span>
                    <span className="block text-xs text-[#8d6e63]">Volver a entrar · {relativeTime(u.fecha)}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
