import React from "react";
import { Plus, Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Slide, SlideTheme } from "../types";

interface SlideThumbnailsProps {
  slides: Slide[];
  activeSlideId: string;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onMoveSlide: (index: number, direction: "up" | "down") => void;
  currentTheme: SlideTheme;
}

export const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  activeSlideId,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  currentTheme,
}) => {
  return (
    <aside className="w-64 bg-[#f3f2f1] border-r border-[#d2d0ce] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Encabezado del panel de diapositivas */}
      <div className="h-9 px-3 border-b border-[#e1dfdd] flex items-center justify-between bg-[#edebe9]">
        <span className="font-bold text-[11px] text-[#323130] uppercase tracking-wider font-mono">
          Diapositivas ({slides.length})
        </span>
        <button
          type="button"
          onClick={onAddSlide}
          title="Agregar diapositiva"
          className="flex items-center gap-1 text-[11px] font-semibold text-[#c43e1c] hover:text-[#a93217] transition-colors"
        >
          <Plus size={14} />
          <span>Nueva</span>
        </button>
      </div>

      {/* Lista scrollable de miniaturas */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;

          return (
            <div key={slide.id} className="flex items-start gap-2 group">
              {/* Número de diapositiva */}
              <span className="font-mono text-xs text-[#605e5c] w-4 pt-1 text-right shrink-0">
                {index + 1}
              </span>

              {/* Contenedor de la miniatura 16:9 */}
              <div
                onClick={() => onSelectSlide(slide.id)}
                className={`flex-1 aspect-video rounded border-2 transition-all cursor-pointer relative overflow-hidden shadow-xs ${
                  isActive
                    ? "border-[#c43e1c] ring-2 ring-[#c43e1c]/30 shadow-md scale-[1.02]"
                    : "border-[#d2d0ce] hover:border-gray-400 bg-white"
                }`}
                style={{ backgroundColor: slide.background || currentTheme.slideBg }}
              >
                {/* Renderizado simplificado de elementos en la miniatura */}
                <div className="w-full h-full p-2 relative pointer-events-none">
                  {slide.elements.slice(0, 3).map((el) => {
                    if (el.type === "title") {
                      return (
                        <div
                          key={el.id}
                          className="font-bold truncate text-[8px] leading-tight"
                          style={{ color: el.color || currentTheme.titleColor }}
                        >
                          {el.content || "Título"}
                        </div>
                      );
                    }
                    if (el.type === "subtitle" || el.type === "text") {
                      return (
                        <div
                          key={el.id}
                          className="truncate text-[6px] opacity-75 mt-0.5 leading-none"
                          style={{ color: el.color || currentTheme.textColor }}
                        >
                          {el.content.split("\n")[0] || "Contenido"}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* Acciones flotantes al pasar el cursor */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-black/60 backdrop-blur-xs p-0.5 rounded text-white">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveSlide(index, "up");
                      }}
                      title="Mover arriba"
                      className="p-1 hover:bg-white/20 rounded"
                    >
                      <ArrowUp size={11} />
                    </button>
                  )}
                  {index < slides.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveSlide(index, "down");
                      }}
                      title="Mover abajo"
                      className="p-1 hover:bg-white/20 rounded"
                    >
                      <ArrowDown size={11} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateSlide(slide.id);
                    }}
                    title="Duplicar"
                    className="p-1 hover:bg-white/20 rounded"
                  >
                    <Copy size={11} />
                  </button>
                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSlide(slide.id);
                      }}
                      title="Eliminar"
                      className="p-1 hover:bg-red-600 rounded"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
