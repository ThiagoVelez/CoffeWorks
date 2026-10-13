import React from "react";
import { Coffee, Search, Minus, Square, X } from "lucide-react";
import { tauriBridge } from "../services/tauriBridge";

interface TitleBarProps {
  onOpenCommandPalette: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenCommandPalette }) => {
  return (
    <header
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 h-10 z-50 bg-white/95 backdrop-blur-md border-b border-[#e8dfd8] flex items-center justify-between px-3 select-none text-[#2c1b12] shadow-sm"
    >
      {/* Marca e identidad con acento café */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#f0e6de] border border-[#dfd3c7] flex items-center justify-center text-[#6f4e37] shadow-xs">
          <Coffee size={17} strokeWidth={2.4} />
        </div>
        <span className="font-display text-base font-bold text-[#3e2723] tracking-tight">
          CoffeWorks
        </span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#f4ede6] text-[#6f4e37] font-semibold border border-[#dfd3c7]">
          v2.4 Pro
        </span>
      </div>

      {/* Buscador global con atajo Ctrl+K en tono crema y café */}
      <div className="flex-1 max-w-md mx-4">
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

      {/* Controles nativos de ventana para Windows */}
      <div className="flex items-center gap-0.5">
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
    </header>
  );
};
