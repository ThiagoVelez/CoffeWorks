import React from "react";
import type { DocumentTheme } from "../types";

interface RulerProps {
  zoom: number;
  theme?: DocumentTheme;
}

export const Ruler: React.FC<RulerProps> = ({ zoom, theme = "paper-white" }) => {
  // Generar marcas de centímetros para el ancho estándar de hoja A4 (aprox. 19-20 cm útiles)
  const centimeters = Array.from({ length: 20 }, (_, i) => i);
  const isLight = theme === "paper-white";

  return (
    <div
      className={`w-full h-5 flex justify-center select-none overflow-hidden transition-colors border-b ${
        isLight
          ? "bg-[#edebe9] border-[#d2d0ce]"
          : "bg-[#1e1916] border-[#393431]/50"
      }`}
    >
      <div
        style={{ width: `${794 * (zoom / 100)}px` }}
        className={`h-full flex relative border-x transition-colors ${
          isLight
            ? "border-[#d2d0ce] bg-white"
            : "border-[#534438]/60 bg-[#251e1a]/80"
        }`}
      >
        {/* Marcador de margen izquierdo de Word */}
        <div className="absolute left-[64px] top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize group z-10">
          <div
            className={`w-0 h-0 border-x-4 border-x-transparent border-t-[5px] ${
              isLight ? "border-t-[#185abd]" : "border-t-primary"
            }`}
          />
        </div>

        {/* Divisiones de centímetros */}
        <div className="flex-1 flex justify-between px-16 h-full items-end pb-0.5">
          {centimeters.map((cm) => (
            <div key={cm} className="flex flex-col items-center relative">
              <span
                className={`font-mono text-[8px] leading-none mb-0.5 ${
                  isLight ? "text-[#605e5c]" : "text-outline"
                }`}
              >
                {cm > 0 ? cm : ""}
              </span>
              <div
                className={`w-px h-2 ${
                  isLight ? "bg-[#a19f9d]" : "bg-outline-variant/60"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Marcador de margen derecho de Word */}
        <div className="absolute right-[64px] top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize group z-10">
          <div
            className={`w-0 h-0 border-x-4 border-x-transparent border-t-[5px] ${
              isLight ? "border-t-[#185abd]" : "border-t-primary"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

