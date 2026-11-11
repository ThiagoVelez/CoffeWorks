import React from "react";
import type { PageSettings } from "../types";
import { MARGIN_PIXELS, PAGE_DIMENSIONS } from "../types";

interface RulerProps {
  zoom: number;
  settings: PageSettings;
}

/** Píxeles CSS por centímetro (96 ppp). */
const PX_PER_CM = 96 / 2.54;

/** Regla horizontal en centímetros alineada con la hoja y sus márgenes. */
export const Ruler: React.FC<RulerProps> = ({ zoom, settings }) => {
  const dims = PAGE_DIMENSIONS[settings.pageSize];
  const pageWidth = settings.orientation === "landscape" ? dims.height : dims.width;
  const margin = MARGIN_PIXELS[settings.margins];
  const scale = zoom / 100;
  const contentWidth = pageWidth - margin * 2;
  const centimeters = Math.floor(contentWidth / PX_PER_CM);

  return (
    <div className="w-full h-5 flex justify-center select-none overflow-hidden border-b bg-[#edebe9] border-[#d2d0ce] print:hidden">
      <div
        style={{ width: pageWidth * scale }}
        className="h-full relative border-x border-[#d2d0ce] bg-white shrink-0"
      >
        {/* Zonas de margen sombreadas */}
        <div className="absolute inset-y-0 left-0 bg-[#e1dfdd]/70" style={{ width: margin * scale }} />
        <div className="absolute inset-y-0 right-0 bg-[#e1dfdd]/70" style={{ width: margin * scale }} />

        {Array.from({ length: centimeters + 1 }, (_, cm) => (
          <div
            key={cm}
            className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
            style={{ left: (margin + cm * PX_PER_CM) * scale }}
          >
            <span className="font-mono text-[8px] leading-none mb-0.5 text-[#605e5c]">
              {cm > 0 ? cm : ""}
            </span>
            <div className="w-px h-1.5 bg-[#a19f9d]" />
          </div>
        ))}

        {/* Marcadores de los márgenes izquierdo y derecho */}
        {[margin, pageWidth - margin].map((position) => (
          <div
            key={position}
            className="absolute top-0 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-[#185abd]"
            style={{ left: position * scale }}
          />
        ))}
      </div>
    </div>
  );
};
