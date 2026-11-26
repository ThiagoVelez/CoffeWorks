// Pantalla de inicio: plantillas (LaTeX y Markdown), abrir y documentos recientes.

import React from "react";
import { ArrowRight, Clock, FileCode2, FolderOpen, Minus, Square, X, Pin } from "lucide-react";
import { appWindow, relativeTime, type RecentEntry } from "./studio/desktop";
import { PLANTILLAS, type Plantilla } from "./editor/plantillas";
import { mathHtml } from "./preview/latex";
import { ThemeSwitch } from "./theme/ThemeSwitch";

const MUESTRA: Record<Plantilla["id"], string> = {
  informe: "g = \\frac{2h}{t^2}",
  taller: "a = \\frac{F}{m}",
  articulo: "E = \\tfrac12 mv^2",
  blanco: "\\int_a^b f\\,dx",
  "md-blanco": "F = ma",
  "md-notas": "v = \\frac{dx}{dt}",
};

interface Props {
  recientes: RecentEntry[];
  onPlantilla: (p: Plantilla) => void;
  onAbrir: () => void;
  onReciente: (r: RecentEntry) => void;
  onContinuar?: () => void;
  tituloActual?: string;
}

export const Inicio: React.FC<Props> = ({ recientes, onPlantilla, onAbrir, onReciente, onContinuar, tituloActual }) => (
  <div className="fixed inset-0 z-50 flex flex-col bg-[#f3f7f8] dark:bg-[#11171a] text-[#14323a] dark:text-[#d6e1e4] select-none">
    <header data-tauri-drag-region className="h-10 shrink-0 bg-[#0d5e6f] text-white flex items-center justify-between px-3">
      <div data-tauri-drag-region className="flex items-center gap-2 text-[13px] font-semibold">
        <img src="/app-icon.png" alt="" className="w-5 h-5 rounded" /> CoffeeLatex
      </div>
      <div className="flex items-center gap-1">
        <ThemeSwitch compact />
        <button type="button" aria-label="Minimizar" onClick={() => void appWindow.minimize()} className="w-9 h-8 flex items-center justify-center hover:bg-white/15 rounded"><Minus size={15} /></button>
        <button type="button" aria-label="Maximizar" onClick={() => void appWindow.toggleMaximize()} className="w-9 h-8 flex items-center justify-center hover:bg-white/15 rounded"><Square size={12} /></button>
        <button type="button" aria-label="Cerrar" onClick={() => void appWindow.close()} className="w-9 h-8 flex items-center justify-center hover:bg-red-500 rounded"><X size={15} /></button>
      </div>
    </header>
    <main className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-[26px] font-bold">Documentos científicos y técnicos</h1>
            <p className="text-[14px] text-[#4d646b] dark:text-[#93a7ad] mt-1">Escribe en LaTeX o Markdown con las fórmulas a la vista, y exporta a PDF, Word o HTML.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {onContinuar && (
              <button type="button" onClick={onContinuar} className="h-9 px-3.5 rounded-lg bg-white dark:bg-[#1b2427] border border-[#cddade] dark:border-[#2a373b] text-[13px] font-semibold flex items-center gap-1.5 hover:border-[#0d5e6f]">
                Volver a «{tituloActual}» <ArrowRight size={14} />
              </button>
            )}
            <button type="button" onClick={onAbrir} className="h-9 px-3.5 rounded-lg bg-[#0d5e6f] text-white text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[#0a4d5b]">
              <FolderOpen size={15} /> Abrir .tex o .md
            </button>
          </div>
        </div>

        <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#5c7178] mb-2.5">Nuevo documento</h2>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PLANTILLAS.map((p) => (
            <button key={p.id} type="button" data-plantilla={p.id} onClick={() => onPlantilla(p)} className="group text-left rounded-xl bg-white dark:bg-[#192124] border border-[#d5e0e3] dark:border-[#263236] hover:border-[#0d5e6f] hover:shadow-md transition-all overflow-hidden">
              <div className="h-20 flex items-center justify-center bg-[#fbfdfd] dark:bg-[#151c1f] border-b border-[#e4ecee] dark:border-[#232e32] text-[17px] text-[#14323a] dark:text-[#d6e1e4]" dangerouslySetInnerHTML={{ __html: mathHtml(MUESTRA[p.id], true) }} />
              <div className="px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                  {p.nombre}
                  <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${p.modo === "latex" ? "bg-[#d9eef2] text-[#0d5e6f]" : "bg-[#efe6f6] text-[#6b3d8f]"}`}>{p.modo === "latex" ? "LaTeX" : "Markdown"}</span>
                </div>
                <div className="text-[12px] text-[#5c7178] dark:text-[#8fa3a9] mt-0.5 truncate">{p.descripcion}</div>
              </div>
            </button>
          ))}
        </div>

        <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#5c7178] mb-2.5 flex items-center gap-1.5"><Clock size={13} /> Recientes</h2>
        {recientes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cbd9dd] dark:border-[#2a373b] p-6 text-center text-[13px] text-[#5c7178]">Aún no hay documentos. Elige una plantilla para empezar.</div>
        ) : (
          <div className="rounded-xl bg-white dark:bg-[#192124] border border-[#d5e0e3] dark:border-[#263236] divide-y divide-[#e7eef0] dark:divide-[#232e32]">
            {recientes.slice(0, 12).map((r) => (
              <button key={r.id} type="button" onClick={() => onReciente(r)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f2f8f9] dark:hover:bg-[#1f2a2e]">
                <FileCode2 size={17} className="text-[#0d5e6f] shrink-0" />
                <span className="text-[13.5px] font-medium truncate">{r.name}</span>
                {r.is_pinned && <Pin size={12} className="text-[#c2701a]" />}
                <span className="ml-auto text-[12px] text-[#6d8288] shrink-0">{relativeTime(r.updated_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  </div>
);
