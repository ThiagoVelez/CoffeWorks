// Ventanas de la app: perfil (nombre y color), unirse a un tablero y compartir.

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, X } from "lucide-react";
import { leerLink, aLink, type Sala } from "../board/link";
import { nombreValido, PALETA } from "../board/personas";

export function Modal({ titulo, children, alCerrar, ancho = "max-w-md" }: { titulo: string; children: React.ReactNode; alCerrar?: () => void; ancho?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className={`w-full ${ancho} rounded-2xl bg-white shadow-xl border border-[#e8dfd8] p-6 flex flex-col gap-4 text-[#2c1b12]`}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{titulo}</h2>
          {alCerrar && (
            <button type="button" aria-label="Cerrar" className="w-8 h-8 rounded-lg hover:bg-[#f3ece4] flex items-center justify-center" onClick={alCerrar}>
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

const campo = "w-full h-10 px-3 rounded-xl border border-[#dfd3c7] bg-white outline-none focus:border-[#f08c2e] text-sm";
const principal = "h-10 px-4 rounded-xl bg-[#f08c2e] text-white font-semibold text-sm hover:bg-[#d97a1f] disabled:opacity-50";
const secundario = "h-10 px-4 rounded-xl border border-[#dfd3c7] text-sm font-semibold hover:bg-[#f3ece4]";

function SelectorColor({ color, setColor }: { color: string; setColor: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {PALETA.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={`Color ${c}`} onClick={() => setColor(c)}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${c === color ? "ring-2 ring-offset-2 ring-[#2c1b12]" : ""}`} style={{ background: c }}>
          {c === color && <Check size={16} color="#fff" />}
        </button>
      ))}
    </div>
  );
}

export function DialogoPerfil({ inicial, alGuardar, alCerrar }: { inicial?: { nombre: string; color: string }; alGuardar: (p: { nombre: string; color: string }) => void; alCerrar?: () => void }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [color, setColor] = useState(inicial?.color ?? PALETA[Math.floor(Math.random() * PALETA.length)]);
  const valido = nombreValido(nombre);
  return (
    <Modal titulo={inicial ? "Tu nombre y color" : "¡Hola! ¿Cómo te llamas?"} alCerrar={alCerrar}>
      <p className="text-sm text-[#5c3a21]">Tus compañeros verán tu cursor con este nombre y color, y el historial dirá lo que hiciste.</p>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (valido) alGuardar({ nombre: valido, color }); }}>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Nombre
          <input autoFocus className={campo} value={nombre} maxLength={24} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo, Sofía" aria-label="Nombre" />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-semibold">
          Color
          <SelectorColor color={color} setColor={setColor} />
        </div>
        <div className="flex justify-end">
          <button type="submit" className={principal} disabled={!valido}>Listo</button>
        </div>
      </form>
    </Modal>
  );
}

export function DialogoUnirse({ perfil, linkInicial, alUnirse, alCerrar }: {
  perfil: { nombre: string; color: string };
  linkInicial?: string;
  alUnirse: (sala: Sala, yo: { nombre: string; color: string }) => void;
  alCerrar: () => void;
}) {
  const [texto, setTexto] = useState(linkInicial ?? "");
  const [nombre, setNombre] = useState(perfil.nombre);
  const sala = leerLink(texto);
  const valido = nombreValido(nombre);
  return (
    <Modal titulo="Unirse a un tablero" alCerrar={alCerrar}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (sala && valido) alUnirse(sala, { nombre: valido, color: perfil.color }); }}>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Link del tablero
          <textarea autoFocus className={`${campo} h-20 py-2 resize-none font-mono text-xs`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pega aquí el link que te compartieron" aria-label="Link del tablero" />
          {texto.trim() && !sala && <span className="text-xs font-normal text-[#c62828]">Ese texto no tiene un link de CoffeeDrawTeam.</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Tu nombre en este tablero
          <input className={campo} value={nombre} maxLength={24} onChange={(e) => setNombre(e.target.value)} aria-label="Tu nombre en este tablero" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={secundario} onClick={alCerrar}>Cancelar</button>
          <button type="submit" className={principal} disabled={!sala || !valido}>Entrar</button>
        </div>
      </form>
    </Modal>
  );
}

export function DialogoCompartir({ link, alCambiarLink, alCerrar }: { link: Sala; alCambiarLink: () => Promise<void>; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const url = aLink(link);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el portapapeles no está disponible: el link se puede seleccionar a mano */
    }
  };
  return (
    <Modal titulo="Compartir tablero" alCerrar={alCerrar} ancho="max-w-lg">
      <p className="text-sm text-[#5c3a21]">Manda este link a tus compañeros. Lo abren en <b>CoffeeDrawTeam › Unirse a un tablero</b>, escriben su nombre y entran mientras tengas este tablero abierto.</p>
      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#faf7f2] border border-[#e8dfd8]">
        <Link2 size={16} className="text-[#8d6e63] shrink-0" />
        <input readOnly className="flex-1 bg-transparent outline-none font-mono text-xs select-all" value={url} aria-label="Link para compartir" data-link onFocus={(e) => e.target.select()} />
        <button type="button" className={`${principal} h-8 px-3 flex items-center gap-1.5`} onClick={copiar}>
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar link"}
        </button>
      </div>
      <p className="text-xs text-[#8d6e63]">Tus compañeros necesitan CoffeeWorks con CoffeeDrawTeam. Máximo 10 personas a la vez.</p>
      <div className="flex justify-between items-center">
        <button type="button" disabled={cambiando} className={`${secundario} flex items-center gap-1.5`}
          onClick={async () => { setCambiando(true); try { await alCambiarLink(); } finally { setCambiando(false); } }}
          title="El link viejo deja de servir; quienes ya están dentro siguen">
          <RefreshCw size={14} /> Cambiar link
        </button>
        <button type="button" className={principal} onClick={alCerrar}>Listo</button>
      </div>
    </Modal>
  );
}
