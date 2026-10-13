import React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { DocumentStats, DocumentTheme } from "../types";

interface StatusBarProps {
  stats: DocumentStats;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  theme?: DocumentTheme;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  stats,
  zoom,
  onZoomChange,
  theme = "paper-white",
}) => {
  const handleZoomIn = () => {
    if (zoom < 150) onZoomChange(zoom + 10);
  };

  const handleZoomOut = () => {
    if (zoom > 60) onZoomChange(zoom - 10);
  };

  const isLight = theme === "paper-white";

  return (
    <footer
      className={`h-7 px-3 flex items-center justify-between text-[11px] font-mono select-none z-40 transition-colors border-t ${
        isLight
          ? "bg-[#185abd] text-white border-[#144ea3]"
          : "bg-[#161311] text-[#eae0dd] border-[#38322e]"
      }`}
    >
      {/* Métricas en tiempo real */}
      <div className="flex items-center gap-4">
        <span>
          {stats.words} {stats.words === 1 ? "palabra" : "palabras"}
        </span>
        <span className="opacity-90">{stats.characters} caracteres</span>
        <span className="opacity-90 hidden sm:inline">~{stats.readingTimeMinutes} min lectura</span>
        <span className="opacity-90">Página 1 de {stats.pages}</span>
      </div>

      {/* Idioma y control de zoom */}
      <div className="flex items-center gap-3">
        <span className="font-sans font-semibold">Español</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Reducir zoom"
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <ZoomOut size={13} />
          </button>
          <span className="w-10 text-center font-bold">{zoom}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
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
