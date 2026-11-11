import React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { DocumentStats } from "../types";

interface StatusBarProps {
  stats: DocumentStats;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onOpenWordCount: () => void;
  spellcheck: boolean;
  readOnly: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  stats,
  zoom,
  onZoomChange,
  onOpenWordCount,
  spellcheck,
  readOnly,
}) => {
  const clampZoom = (value: number) => Math.max(50, Math.min(200, value));

  return (
    <footer className="h-7 px-3 flex items-center justify-between text-[11px] font-mono select-none z-40 border-t bg-[#185abd] text-white border-[#144ea3] print:hidden">
      <button
        type="button"
        onClick={onOpenWordCount}
        title="Ver el recuento completo"
        className="flex items-center gap-4 hover:bg-white/15 rounded px-1.5 py-0.5 transition-colors"
      >
        <span>
          {stats.words} {stats.words === 1 ? "palabra" : "palabras"}
        </span>
        <span className="opacity-90">{stats.characters} caracteres</span>
        <span className="opacity-90 hidden sm:inline">~{stats.readingTimeMinutes} min de lectura</span>
        <span className="opacity-90">
          {stats.pages} {stats.pages === 1 ? "página" : "páginas"}
        </span>
      </button>

      <div className="flex items-center gap-3">
        {readOnly && <span className="font-sans font-semibold">Solo lectura</span>}
        <span className="font-sans font-semibold">
          Español{spellcheck ? " · corrector activo" : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onZoomChange(clampZoom(zoom - 10))}
            title="Reducir zoom"
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(100)}
            title="Restablecer zoom al 100%"
            className="w-10 text-center font-bold hover:bg-white/20 rounded"
          >
            {zoom}%
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(clampZoom(zoom + 10))}
            title="Aumentar zoom"
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>
    </footer>
  );
};
