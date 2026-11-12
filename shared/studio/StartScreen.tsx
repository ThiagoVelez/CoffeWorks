import React from "react";
import {
  Plus,
  FolderOpen,
  FileText,
  ArrowRight,
  Clock,
  Coffee,
  Minus,
  Square,
  X,
} from "lucide-react";
import { appWindow, relativeTime, type RecentEntry } from "./desktop";

interface StartScreenProps {
  appName: string;
  tagline: string;
  /** Color de la barra superior de la aplicación. */
  accent: string;
  newHint: string;
  openHint: string;
  formats: string[];
  recents: RecentEntry[];
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (entry: RecentEntry) => void;
  /** Volver al documento que ya está abierto (si lo hay). */
  onContinue?: () => void;
  currentTitle?: string;
}

/** Pantalla de inicio común: nuevo archivo, abrir archivo y recientes. */
export const StartScreen: React.FC<StartScreenProps> = ({
  appName,
  tagline,
  accent,
  newHint,
  openHint,
  formats,
  recents,
  onNew,
  onOpen,
  onOpenRecent,
  onContinue,
  currentTitle,
}) => {
  const bigButton =
    "group flex flex-col items-center justify-center p-8 rounded-2xl bg-white hover:bg-[#fcfaf7] border-2 border-[#dfd3c7] hover:border-[#6f4e37] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center gap-4 cursor-pointer";
  const bigIcon =
    "w-16 h-16 rounded-2xl bg-[#eeddd0] group-hover:bg-[#6f4e37] text-[#6f4e37] group-hover:text-white flex items-center justify-center transition-all shadow-xs border border-[#dfd3c7]";

  return (
    <div className="fixed inset-0 z-50 bg-[#faf7f2] flex flex-col select-none overflow-hidden print:hidden">
      <header
        data-tauri-drag-region
        style={{ backgroundColor: accent }}
        className="h-10 text-white flex items-center justify-between px-3 shrink-0 shadow-xs z-50"
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 text-white font-bold text-xs tracking-wide">
            <Coffee size={14} />
            <span>{appName}</span>
          </div>
          <span data-tauri-drag-region className="text-[11px] text-white/80 font-mono hidden sm:inline">
            Inicio • CoffeeWorks
          </span>
        </div>
        <div className="flex-1 h-full" data-tauri-drag-region />
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => void appWindow.minimize()}
            title="Minimizar"
            className="w-8 h-8 flex items-center justify-center hover:bg-white/15 transition-colors rounded"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={() => void appWindow.toggleMaximize()}
            title="Maximizar / Restaurar"
            className="w-8 h-8 flex items-center justify-center hover:bg-white/15 transition-colors rounded"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            onClick={() => void appWindow.close()}
            title="Cerrar"
            className="w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors rounded"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col items-center gap-7 my-auto py-4">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#eeddd0] border border-[#dfd3c7] flex items-center justify-center text-[#6f4e37] shadow-sm">
              <Coffee size={32} strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#2c1b12] tracking-tight">{appName}</h1>
              <p className="text-xs font-mono text-[#795548] mt-1">{tagline}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
            <button type="button" onClick={onNew} className={bigButton}>
              <div className={bigIcon}>
                <Plus size={36} strokeWidth={2.6} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold text-[#2c1b12] group-hover:text-[#6f4e37] transition-colors">
                  Nuevo archivo
                </span>
                <span className="font-mono text-[11px] text-[#795548]">{newHint}</span>
              </div>
            </button>

            <button type="button" onClick={onOpen} className={bigButton}>
              <div className={bigIcon}>
                <FolderOpen size={34} strokeWidth={2.4} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold text-[#2c1b12] group-hover:text-[#6f4e37] transition-colors">
                  Abrir archivo
                </span>
                <span className="font-mono text-[11px] text-[#795548]">{openHint}</span>
              </div>
            </button>
          </div>

          {onContinue && (
            <div className="w-full max-w-lg pt-4 border-t border-[#dfd3c7] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#eeddd0] flex items-center justify-center text-[#6f4e37] shrink-0 border border-[#dfd3c7]">
                  <FileText size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#2c1b12] truncate">{currentTitle}</span>
                  <span className="text-[10px] text-[#795548] font-mono">Documento abierto</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onContinue}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#6f4e37] hover:bg-[#eeddd0] transition-colors shrink-0"
              >
                <span>Continuar editando</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {recents.length > 0 && (
            <div className="w-full max-w-lg flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#795548] uppercase tracking-wide">
                <Clock size={12} />
                <span>Recientes</span>
              </div>
              <div className="flex flex-col rounded-xl border border-[#dfd3c7] bg-white overflow-hidden divide-y divide-[#efe6dd]">
                {recents.slice(0, 6).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onOpenRecent(entry)}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#fcfaf7] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={15} className="text-[#6f4e37] shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-[#2c1b12] truncate group-hover:text-[#6f4e37]">
                          {entry.name}
                        </span>
                        {entry.path && !entry.path.startsWith("web:") && (
                          <span className="text-[10px] font-mono text-[#a1887f] truncate">{entry.path}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#795548] shrink-0">
                      {relativeTime(entry.updated_at)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] font-mono text-[#795548] flex-wrap justify-center">
            <span>Formatos admitidos:</span>
            {formats.map((format) => (
              <span
                key={format}
                className="px-2 py-0.5 rounded bg-white border border-[#dfd3c7] text-[#5c3a21] font-semibold"
              >
                {format}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
