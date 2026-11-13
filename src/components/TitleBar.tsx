import React from "react";
import { Search, Minus, Square, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { tauriBridge } from "../services/tauriBridge";
import { APP_STAGE, APP_VERSION } from "../version";

interface TitleBarProps {
  onOpenCommandPalette: () => void;
  version?: string;
  stage?: string;
  /** Notificación breve: se muestra en la barra, junto a los botones de la ventana. */
  notice?: { message: string; isError: boolean } | null;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenCommandPalette, version = APP_VERSION, stage = APP_STAGE, notice }) => {
  return (
    <header
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 h-10 z-50 bg-white/95 backdrop-blur-md border-b border-[#e8dfd8] flex items-center justify-between px-3 select-none text-[#2c1b12] shadow-sm"
    >
      {/* Marca e identidad con acento café (también permite arrastrar la ventana) */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 [&>*]:pointer-events-none">
        <img src="/icons/CoffeeWorks.png" alt="" className="w-7 h-7" draggable={false} />
        <span className="font-display text-base font-bold text-[#3e2723] tracking-tight">
          CoffeeWorks
        </span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#f4ede6] text-[#6f4e37] font-semibold border border-[#dfd3c7]">
          v{version}
        </span>
        {stage && (
          <span
            title="Versión en desarrollo: puede tener errores. Se actualiza sola."
            className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#fff3e0] text-[#e65100] font-bold border border-[#ffcc80] uppercase tracking-wide"
          >
            {stage}
          </span>
        )}
      </div>

      {/* Buscador global con atajo Ctrl+K en tono crema y café */}
      <div className="flex-1 min-w-0 max-w-md mx-4">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between bg-[#fbf9f6] hover:bg-[#f4ede6] transition-colors px-3 py-1.5 rounded-lg gap-2 text-left border border-[#dfd3c7] group shadow-xs"
        >
          <div className="flex items-center gap-2 text-[#8d6e63] group-hover:text-[#3e2723] transition-colors min-w-0">
            <Search size={14} className="shrink-0 text-[#6f4e37]" />
            <span className="text-xs truncate font-medium">
              Buscar apps, documentos o acciones...
            </span>
          </div>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-[#6f4e37] border border-[#dfd3c7] font-semibold shrink-0 shadow-xs">
            Ctrl + K
          </span>
        </button>
      </div>

      {/* Notificaciones arriba a la derecha, dentro de la barra: no tapan el contenido */}
      <div className="flex items-center gap-2 min-w-0">
        {notice && (
          <div
            role="status"
            aria-live="polite"
            title={notice.message}
            data-notice
            className={`flex items-center gap-2 h-7 px-3 rounded-lg border shadow-xs text-xs font-medium min-w-0 max-w-[420px] animate-in fade-in ${
              notice.isError ? "bg-red-50 border-red-300 text-red-800" : "bg-[#fbf9f6] border-[#dfd3c7] text-[#2c1b12]"
            }`}
          >
            {notice.isError ? <AlertTriangle size={14} className="text-red-600 shrink-0" /> : <CheckCircle2 size={14} className="text-[#107c41] shrink-0" />}
            <span className="truncate">{notice.message}</span>
          </div>
        )}
      {/* Controles nativos de ventana para Windows */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => tauriBridge.minimizeWindow()}
          title="Minimizar"
          className="w-8 h-8 flex items-center justify-center text-[#5c3a21] hover:bg-[#f4ede6] transition-colors rounded"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => tauriBridge.maximizeWindow()}
          title="Maximizar"
          className="w-8 h-8 flex items-center justify-center text-[#5c3a21] hover:bg-[#f4ede6] transition-colors rounded"
        >
          <Square size={12} />
        </button>
        <button
          type="button"
          onClick={() => tauriBridge.closeWindow()}
          title="Cerrar"
          className="w-8 h-8 flex items-center justify-center text-[#5c3a21] hover:bg-red-600 hover:text-white transition-colors rounded"
        >
          <X size={14} />
        </button>
      </div>
      </div>
    </header>
  );
};
