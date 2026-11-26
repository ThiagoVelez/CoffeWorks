// Barra «Insertar»: fórmulas de física y estructura del documento.

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BOTONES, GRIEGAS, UNIDADES, type Boton, type Modo } from "./editor/insertar";
import { mathHtml } from "./preview/latex";

const Formula: React.FC<{ tex: string }> = ({ tex }) => <span className="pointer-events-none" dangerouslySetInnerHTML={{ __html: mathHtml(tex, false) }} />;

interface Props {
  modo: Modo;
  onBoton: (b: Boton) => void;
  onSimbolo: (tex: string) => void;
}

const Menu: React.FC<{ b: Boton; opciones: string[]; onElegir: (t: string) => void }> = ({ b, opciones, onElegir }) => {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    window.addEventListener("mousedown", cerrar);
    return () => window.removeEventListener("mousedown", cerrar);
  }, [abierto]);
  return (
    <div ref={ref} className="relative">
      <button type="button" title={b.etiqueta} data-boton={b.id} onMouseDown={(e) => e.preventDefault()} onClick={() => setAbierto((v) => !v)} className="boton-insertar">
        <Formula tex={b.tex} />
        <ChevronDown size={11} className="opacity-60" />
      </button>
      {abierto && (
        <div className="absolute z-40 top-full left-0 mt-1 p-1.5 grid grid-cols-6 gap-1 rounded-lg bg-white dark:bg-[#1d2427] border border-[#d5e0e3] dark:border-[#2c383c] shadow-xl w-[260px]">
          {opciones.map((t) => (
            <button key={t} type="button" title={t} onMouseDown={(e) => e.preventDefault()} onClick={() => (onElegir(t), setAbierto(false))} className="h-8 rounded hover:bg-[#e6f1f3] dark:hover:bg-[#25343a] flex items-center justify-center text-[13px]">
              <Formula tex={t} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const BarraInsertar: React.FC<Props> = ({ onBoton, onSimbolo }) => {
  const mate = BOTONES.filter((b) => !["tabla", "figura", "cita"].includes(b.id));
  const estructura = BOTONES.filter((b) => ["tabla", "figura", "cita"].includes(b.id));
  return (
    <div className="h-11 shrink-0 flex items-center gap-1 px-3 border-b border-[#dbe5e8] dark:border-[#263236] bg-[#f4f8f9] dark:bg-[#182024] overflow-x-auto" role="toolbar" aria-label="Insertar">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5c7178] mr-1">Insertar</span>
      {mate.map((b) =>
        b.id === "griegas" ? <Menu key={b.id} b={b} opciones={GRIEGAS} onElegir={onSimbolo} /> :
        b.id === "unidades" ? <Menu key={b.id} b={b} opciones={UNIDADES} onElegir={onSimbolo} /> :
        (
          <button key={b.id} type="button" title={b.etiqueta} aria-label={b.etiqueta} data-boton={b.id} onMouseDown={(e) => e.preventDefault()} onClick={() => onBoton(b)} className="boton-insertar">
            <Formula tex={b.tex} />
          </button>
        )
      )}
      <div className="w-px h-6 bg-[#d0dde1] dark:bg-[#2c383c] mx-1.5" />
      {estructura.map((b) => (
        <button key={b.id} type="button" title={b.etiqueta} aria-label={b.etiqueta} data-boton={b.id} onMouseDown={(e) => e.preventDefault()} onClick={() => onBoton(b)} className="boton-insertar px-2.5 text-[12.5px] font-medium text-[#24323a] dark:text-[#d6e1e4]">
          {b.etiqueta}
        </button>
      ))}
    </div>
  );
};

export const BARRA_CSS = `
.boton-insertar{height:30px;min-width:34px;padding:0 7px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;gap:2px;color:#14323a;font-size:13px;border:1px solid transparent;white-space:nowrap}
.boton-insertar:hover{background:#fff;border-color:#c9dade}
:root[data-theme="dark"] .boton-insertar{color:#d6e1e4}
:root[data-theme="dark"] .boton-insertar:hover{background:#22303a;border-color:#2f4148}
.boton-insertar .katex{font-size:1.05em}
`;
